async function generate(){
  setLoading(true)
  setError('')
  setNotes(null)
  setQuiz(null)
  setRawResponse(null)
  setStatusCode(null)

  try{
    // absolute API URL (robust)
    const apiUrl = `${window.location.origin}/api/generate`;

    // call the API
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type':'application/json'},
      body: JSON.stringify({ topic })
    })

    // store status for debugging
    setStatusCode(resp.status)

    // read raw text (so we can see exactly what the server returned)
    const text = await resp.text()
    // show raw text in UI and console
    setRawResponse(text)
    console.log('RAW API RESPONSE:', text)

    // try to parse JSON safely
    try {
      const data = JSON.parse(text)
      setNotes(data.notes || null)
      setQuiz(data.quiz || null)
    } catch(parseErr){
      // parsing failed — show an informative error and keep raw text visible
      setError('Failed to parse JSON from API. See raw response below.')
      console.error('JSON parse error:', parseErr)
    }
  }catch(e){
    setError(e.message || 'Request failed')
    console.error(e)
  }finally{
    setLoading(false)
  }
}
