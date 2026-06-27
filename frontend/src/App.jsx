import { useState, useEffect, useCallback } from 'react'

const API = ''

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function App() {
  const [min, setMin] = useState(1)
  const [max, setMax] = useState(100)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [animKey, setAnimKey] = useState(0)

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API}/history`)
      const data = await res.json()
      setHistory(data.history)
    } catch {
      // silent — history is non-critical
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const generate = async () => {
    setError('')
    if (Number(min) >= Number(max)) {
      setError('Min must be less than Max.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API}/generate?min=${min}&max=${max}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Something went wrong')
      }
      const data = await res.json()
      setResult(data)
      setAnimKey(k => k + 1)
      fetchHistory()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const clearHistory = async () => {
    await fetch(`${API}/history`, { method: 'DELETE' })
    setHistory([])
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') generate()
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Random Number Generator</h1>
        <p>Generate random numbers with a FastAPI + React stack</p>
      </header>

      {/* Controls */}
      <div className="card">
        <div className="card-title">Configure Range</div>
        <div className="range-row">
          <div className="field">
            <label>Min</label>
            <input
              type="number"
              value={min}
              onChange={e => setMin(e.target.value)}
              onKeyDown={handleKey}
            />
          </div>
          <div className="field">
            <label>Max</label>
            <input
              type="number"
              value={max}
              onChange={e => setMax(e.target.value)}
              onKeyDown={handleKey}
            />
          </div>
        </div>
        <button className="btn-generate" onClick={generate} disabled={loading}>
          {loading ? <span className="spinner" /> : 'Generate'}
        </button>
      </div>

      {/* Result */}
      <div className="result-card">
        {error ? (
          <p className="error-msg">{error}</p>
        ) : result ? (
          <>
            <div className="result-label">Your number</div>
            <div className="result-number" key={animKey}>{result.number}</div>
            <div className="result-range">range: {result.min} – {result.max}</div>
          </>
        ) : (
          <p className="result-placeholder">Hit Generate to get a number</p>
        )}
      </div>

      {/* History */}
      <div className="history-card">
        <div className="history-header">
          <div className="card-title">History ({history.length})</div>
          {history.length > 0 && (
            <button className="btn-clear" onClick={clearHistory}>Clear</button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="history-empty">No history yet</p>
        ) : (
          <div className="history-list">
            {history.map((item, i) => (
              <div className="history-item" key={i}>
                <span className="history-num">{item.number}</span>
                <div className="history-meta">
                  <div className="history-range">{item.min} – {item.max}</div>
                  <div className="history-time">{formatTime(item.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
