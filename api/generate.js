// api/generate.js (TEMP TEST HANDLER)
// Returns a static sample response so we can verify frontend and Vercel are working.
// Replace this with the real handler after the test.

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  const sample = {
    notes: {
      type: "study_notes",
      title: "TEST: Buffer Overflow (sample)",
      "tl;dr": "This is a test response.",
      body_md: "# Test\nThis is a test note body. If you see this, the server returned JSON."
    },
    quiz: {
      type: "quiz",
      title: "TEST Quiz",
      questions: [
        { question: "Test Q1", options: { A: "One", B: "Two", C: "Three", D: "Four" }, answer: "A", explanation: "Because it's a test." }
      ]
    }
  };
  return res.status(200).json(sample);
}
