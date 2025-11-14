// api/generate.js — hardened Vercel serverless function (Node 18+)
// IMPORTANT: set OPENAI_API_KEY in Vercel (exact name, uppercase).

function extractJsonFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const s = text.trim();
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    try { return JSON.parse(fenced[1]); } catch (e) {}
  }
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    const cand = s.slice(first, last + 1);
    try { return JSON.parse(cand); } catch (e) {}
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) {
    console.error('Missing OPENAI_API_KEY env var');
    return res.status(500).json({ error: 'missing_api_key' });
  }

  const { topic = 'Buffer overflow' } = req.body || {};
  const system = `You are an expert cybersecurity instructor and pedagogue. Produce concise study materials and a quiz.`;
  const notesPrompt = `Generate SHORT study notes for the topic: ${topic}.
Output JSON with keys: type,title,tl;dr,body_md.`;
  const quizPrompt = `Generate an 8-question multiple-choice quiz for topic: ${topic}.
Output JSON: {"type":"quiz","title":"...","questions":[{...}]}`;

  try {
    // 1) Notes
    const noteResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: system }, { role: 'user', content: notesPrompt }],
        max_tokens: 900
      }),
    });

    if (!noteResp.ok) {
      const txt = await noteResp.text().catch(()=>'<no-body>');
      console.error('OpenAI notes request failed', noteResp.status, txt);
      return res.status(502).json({ error: 'openai_notes_failed', status: noteResp.status, detail: txt });
    }
    const noteBody = await noteResp.json().catch(()=>null);
    const noteText = noteBody?.choices?.[0]?.message?.content || '';

    let notes = extractJsonFromText(noteText);
    if (!notes) notes = { title: `${topic} — notes`, 'tl;dr': '', body_md: noteText };
    else if (typeof notes.body_md !== 'string' && notes.body_md !== undefined) {
      notes.body_md = typeof notes.body_md === 'object' ? JSON.stringify(notes.body_md) : String(notes.body_md);
    }

    // 2) Quiz
    const quizResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Context notes:\n${notes.body_md}\n\nNow: ${quizPrompt}` }
        ],
        max_tokens: 900
      }),
    });

    if (!quizResp.ok) {
      const txt = await quizResp.text().catch(()=>'<no-body>');
      console.error('OpenAI quiz request failed', quizResp.status, txt);
      return res.status(502).json({ error: 'openai_quiz_failed', status: quizResp.status, detail: txt });
    }

    const quizBody = await quizResp.json().catch(()=>null);
    const quizText = quizBody?.choices?.[0]?.message?.content || '';
    let quiz = extractJsonFromText(quizText);
    if (!quiz) quiz = { title: `${topic} — quiz`, questions: [], raw: quizText };
    else if (!Array.isArray(quiz.questions) && quiz.questions !== undefined) {
      if (typeof quiz.questions === 'object') quiz.questions = Object.values(quiz.questions);
      else quiz.questions = [];
    }

    return res.status(200).json({ notes, quiz });
  } catch (err) {
    console.error('Generation error:', err);
    return res.status(500).json({ error: 'generation_failed', detail: String(err) });
  }
}
