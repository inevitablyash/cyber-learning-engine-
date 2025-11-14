import React, { useState } from 'react'

function Loader(){
  return <div className="loader">Generating…</div>
}

// Normalize different quiz shapes into a consistent array of questions:
// Accepts either:
// - [{ id, q, options: [..], answer, explain }, ...]
// - or [{ question, options: {A:..,B:..}, answer, explanation }, ...]
// Returns: [{ id, q, options: [...], answer, explain }]
function normalizeQuestions(rawQuestions) {
  if (!Array.isArray(rawQuestions)) return [];
  return rawQuestions.map((rq, idx) => {
    // If already in normalized shape:
    if (rq && rq.q && Array.isArray(rq.options)) {
      return {
        id: rq.id || `q${idx+1}`,
        q: rq.q,
        options: rq.options,
        answer: rq.answer || rq.correct || rq.correctOption || null,
        explain: rq.explain || rq.explanation || ''
      }
    }

    // If it's the 'question' + 'options' object shape:
    // options might be an object { A: '...', B: '...' }
    if (rq && rq.question) {
      const opts = [];
      if (Array.isArray(rq.options)) {
        opts.push(...rq.options);
      } else if (rq.options && typeof rq.options === 'object') {
        // ensure order A..D if present
        ['A','B','C','D'].forEach(letter => {
          if (rq.options[letter] !== undefined) opts.push(rq.options[letter]);
        });
        // fallback: push remaining keys
        Object.keys(rq.options).forEach(k => {
          if (!['A','B','C','D'].includes(k)) opts.push(rq.options[k]);
        });
      }
      return {
        id: rq.id || `q${idx+1}`,
        q: rq.question,
        options: opts,
        answer: rq.answer || rq.correct || null,
        explain: rq.explanation || rq.explain || ''
      }
    }

    // Last fallback: try to stringify whatever we have
    return {
      id: rq.id || `q${idx+1}`,
      q: rq.q || rq.question || 'Question text unavailable',
      options: Array.isArray(rq.options) ? rq.options : (rq.options && typeof rq.options === 'object' ? Object.values(rq.options) : []),
      answer: rq.answer || rq.correct || null,
      explain: rq.explain || rq.explanation || ''
    }
  })
}

export default function App(){
  const [topic, setTopic] = useState('Buffer overflow')
  const [notes, setNotes] = useState(null)
  const [quiz, setQuiz] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate(){
    setLoading(true)
    setError('')
    setNotes(null)
    setQuiz(null)

    try{
      const apiUrl = `${window.location.origin}/api/generate`
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type':'application/json'},
        body: JSON.stringify({ topic })
      })

      if (!resp.ok) {
        const txt = await resp.text().catch(()=>'')
        throw new Error(`API error ${resp.status} — ${txt}`)
      }

      const data = await resp.json()
      // data should be { notes, quiz }
      setNotes(data.notes || null)
      setQuiz(data.quiz || null)
    }catch(e){
      setError(e.message || 'Request failed')
      console.error(e)
    }finally{
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <header className="header">
        <h1>Cyber Learning Engine — Notes + Quiz</h1>
        <p className="muted">Type a topic (e.g., "Buffer overflow") and hit Generate.</p>
      </header>

      <div className="controls">
        <input value={topic} onChange={e=>setTopic(e.target.value)} className="input" />
        <button onClick={generate} className="btn">Generate</button>
      </div>

      {loading && <Loader />}
      {error && <div className="error">{error}</div>}

      {notes && (
        <section className="card">
          <h2>{notes.title || 'Notes'}</h2>
          <p className="muted">{notes['tl;dr']}</p>
          <div className="notes" dangerouslySetInnerHTML={{__html: markdownToHtml(notes.body_md)}} />
        </section>
      )}

      {quiz && (
        <section className="card">
          <h3>{quiz.title || 'Quiz'}</h3>
          <ol>
            {normalizeQuestions(quiz.questions).map((q, i)=> (
              <li key={q.id || i}>
                <div className="q">{q.q}</div>
                <ul>
                  {q.options && q.options.length ? q.options.map((o,idx)=> <li key={idx}>{String.fromCharCode(65+idx)}. {o}</li>) : <li className="muted">No options available</li>}
                </ul>
                <div className="explain muted">Answer: {q.answer || 'N/A'} — {q.explain}</div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="foot muted">Made for Asher — copy, paste, deploy.</footer>
    </div>
  )
}

// VERY simple markdown -> HTML converter for our small cases
function markdownToHtml(md){
  if(!md) return ''
  // replace code fences and headings — tiny parser
  let out = md
    .replace(/```([\s\S]*?)```/g, (m,code)=> `<pre><code>${escapeHtml(code)}</code></pre>`)
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\n\n+/gim, '</p><p>')
  out = '<p>' + out + '</p>'
  return out
}

function escapeHtml(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
