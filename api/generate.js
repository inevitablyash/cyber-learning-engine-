// api/generate.js — Vercel serverless function (Node 18+)
// Minimal handler: calls OpenAI Chat Completions and returns JSON { notes, quiz }.
// IMPORTANT: Set OPENAI_API_KEY in Vercel project env vars.
// using global fetch available in Vercel's Node runtime (no node-fetch required)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { topic = 'Buffer overflow' } = req.body || {};
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) return res.status(500).json({ error: 'missing_api_key' });

  const system = `You are an expert cybersecurity instructor and pedagogue. Produce concise, accurate study materials suitable for a motivated student preparing for practical labs and interviews. Use bullet lists, highlight commands or code in fenced blocks, and output JSON.`;

  const notesPrompt = `Generate SHORT study notes for the topic: ${topic}.
Requirements:
- 250–350 words
- Include: one-line definition, 5 key concept bullets, 3 unsafe functions (if applicable), 3 mitigations, 1 minimal hands-on lab (2–4 steps), 2 interview tips.
Output JSON with keys: type,title,tl;dr,body_md.`;

  const quizPrompt = `Generate an 8-question quiz for topic: ${topic}.
Requirements:
- 4 easy, 3 medium, 1 hard
- Multiple choice (4 options A-D)
- Provide answer letter and 1-2 sentence explanation
Output JSON: {"type":"quiz","title":"...","questions":[{...}]}`;

  try {
    // 1) Request notes
    const noteResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: notesPrompt },
        ],
        max_tokens: 900,
      }),
    });

    const noteJson = await noteResp.json();
    const noteText = noteJson.choices?.[0]?.message?.content || '{}';
    let notes = {};
    try {
      notes = JSON.parse(noteText);
    } catch (e) {
      // Fallback: return raw text in body_md so UI shows something useful
      notes = { title: `${topic} — notes`, 'tl;dr': '', body_md: noteText };
    }

    // 2) Request quiz (use notes as context)
    const quizResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Context notes:\n${notes.body_md}\n\nNow: ${quizPrompt}` },
        ],
        max_tokens: 900,
      }),
    });

    const quizJson = await quizResp.json();
    const quizText = quizJson.choices?.[0]?.message?.content || '{}';
    let quiz = {};
    try {
      quiz = JSON.parse(quizText);
    } catch (e) {
      quiz = { title: `${topic} — quiz`, questions: [], raw: quizText };
    }

    return res.json({ notes, quiz });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'generation_failed', detail: String(err) });
  }
}
