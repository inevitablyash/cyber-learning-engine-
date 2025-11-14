// api/generate.js — Vercel serverless function (Node 18+)
// Robust version: uses global fetch and safe JSON extraction from LLM responses.
// IMPORTANT: Ensure OPENAI_API_KEY is set in Vercel env vars.

async function safeFetch(url, opts) {
  // thin wrapper for fetch to allow easier debugging later
  return fetch(url, opts);
}

// Try to find and parse JSON inside a string returned by the LLM.
// Handles fenced code blocks like ```json\n{...}\n``` and also raw {...}.
// Returns parsed object or null on failure.
function extractJsonFromText(text) {
  if (!text || typeof text !== 'string') return null;

  // 1) Remove leading/trailing whitespace
  const s = text.trim();

  // 2) If the LLM returned a fenced block like ```json\n{...}\n``` or ```{...}```
  const fencedJsonMatch = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedJsonMatch && fencedJsonMatch[1]) {
    try {
      return JSON.parse(fencedJsonMatch[1]);
    } catch (e) {
      // fallthrough to other strategies
    }
  }

  // 3) Try to find the first balanced JSON object substring by searching for first '{' and last '}'.
  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = s.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch (e) {
      // fallthrough
    }
  }

  // 4) As a last resort, try to find any line that looks like "key": ... pairs (not robust)
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { topic = 'Buffer overflow' } = req.body || {};
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) return res.status(500).json({ error: 'missing_api_key' });

  const system = `You are an expert cybersecurity instructor and pedagogue. Produce concise, accurate study materials suitable for a motivated student preparing for practical labs and interviews. Use bullet lists, highlight commands or code in fenced blocks, and when asked to return structured data output strict JSON (but your response might be inside code fences).`;

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
    const noteResp = await safeFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
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
    const noteText = noteJson.choices?.[0]?.message?.content || '';

    // Try to extract JSON robustly
    let notes = extractJsonFromText(noteText);
    if (!notes) {
      // If we couldn't parse JSON, fall back to a safe structure that contains raw text
      notes = { title: `${topic} — notes`, 'tl;dr': '', body_md: noteText };
    } else {
      // If the extracted JSON itself contains a field 'body_md' that is JSON-escaped,
      // ensure it's a string for the frontend. (Some models embed JSON inside JSON.)
      if (typeof notes.body_md !== 'string' && notes.body_md !== undefined) {
        // If nested structure exists, stringify or pull nested field if present.
        notes.body_md = (typeof notes.body_md === 'object') ? JSON.stringify(notes.body_md) : String(notes.body_md);
      }
    }

    // 2) Request quiz (use notes.body_md as context)
    const quizResp = await safeFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
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
    const quizText = quizJson.choices?.[0]?.message?.content || '';

    let quiz = extractJsonFromText(quizText);
    if (!quiz) {
      // If extraction fails, fall back to returning the raw text so frontend can display it
      quiz = { title: `${topic} — quiz`, questions: [], raw: quizText };
    } else {
      // ensure questions is an array if present, or normalize possible formats
      if (!Array.isArray(quiz.questions) && quiz.questions !== undefined) {
        // attempt to normalize object->array if necessary
        if (typeof quiz.questions === 'object') {
          quiz.questions = Object.values(quiz.questions);
        } else {
          quiz.questions = [];
        }
      }
    }

    return res.json({ notes, quiz });
  } catch (err) {
    console.error('Generation error:', err);
    return res.status(500).json({ error: 'generation_failed', detail: String(err) });
  }
}
