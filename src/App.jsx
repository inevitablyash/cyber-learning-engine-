import React, { useState } from 'react'

function Loader(){
  return <div className="loader">Generating…</div>
}

export default function App(){
  const [topic, setTopic] = useState('Buffer overflow')
  const [notes, setNotes] = useState(null)
  const [quiz, setQuiz] = useState(null)
  const [loading, setLoading] = useState(false)
const [rawResponse, setRawResponse] = useState(null)
const [statusCode, setStatusCode] = useState(null)
const [rawResponse, setRawResponse] = useState(null)   // debug: raw API response
const [statusCode, setStatusCode] = useState(null)     // debug: http status

async function generate(){
  setLoading(true)
  setError('')
  setNotes(null)
  setQuiz(null)
  setRawResponse(null)
  setStatusCode(null)

  try{
    const apiUrl = `${window.location.origin}/api/generate`

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ topic })
    })

    setStatusCode(resp.status)

    const text = await resp.text()
    setRawResponse(text)
    console.log("RAW API RESPONSE:", text)

    try {
      const data = JSON.parse(text)
      setNotes(data.notes || null)
      setQuiz(data.quiz || null)
    } catch (parseErr){
      setError('Failed to parse JSON. See raw response below.')
      console.error("JSON parse error:", parseErr)
    }

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
          <h2>{notes.title}</h2>
          <p className="muted">{notes['tl;dr']}</p>
          <div className="notes" dangerouslySetInnerHTML={{__html: markdownToHtml(notes.body_md)}} />
        </section>
      )}

      {quiz && (
        <section className="card">
          <h3>{quiz.title}</h3>
          <ol>
            {quiz.questions.map(q=> (
              <li key={q.id}>
                <div className="q">{q.q}</div>
                <ul>
                  {q.options.map((o,idx)=> <li key={idx}>{String.fromCharCode(65+idx)}. {o}</li>)}
                </ul>
                <div className="explain muted">Answer: {q.answer} — {q.explain}</div>
              </li>
            ))}
          </ol>
        </section>
      )}
  {rawResponse && (
  <section className="card">
    <h4>Raw API response (status: {statusCode})</h4>
    <pre style={{whiteSpace:'pre-wrap', maxHeight:'320px', overflow:'auto'}}>
      {rawResponse}
    </pre>
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
