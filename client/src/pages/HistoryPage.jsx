import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAnalyses } from '../api/analysisApi'
import './HistoryPage.css'

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState([])
  const [page, setPage]         = useState(1)
  const [pages, setPages]       = useState(1)
  const [total, setTotal]       = useState(0)
  const [query, setQuery]       = useState('')
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const navigate = useNavigate()

  const load = useCallback(async (p = 1, q = '') => {
    setLoading(true)
    setError('')
    try {
      const res = await getAnalyses(p, q)
      setAnalyses(res.data || [])
      setPage(res.page || 1)
      setPages(res.pages || 1)
      setTotal(res.total || 0)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(1, '') }, [load])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => load(1, query), 400)
    return () => clearTimeout(t)
  }, [query, load])

  const scoreColor = (s) => s >= 70 ? 'badge-success' : s >= 40 ? 'badge-warning' : 'badge-danger'

  return (
    <div className="history-page">
      <div className="container">

        {/* Header */}
        <div className="history-header animate-fade-up">
          <div>
            <h1 className="history-title">Analysis <span className="gradient-text">History</span></h1>
            <p className="history-sub">{total} repositories analyzed</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            + New Analysis
          </button>
        </div>

        {/* Search */}
        <div className="input-wrap history-search animate-fade-up delay-1">
          <span className="search-icon">🔍</span>
          <input
            id="history-search"
            className="input"
            style={{ paddingLeft: 44 }}
            type="text"
            placeholder="Search repositories…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className="clear-btn" onClick={() => setQuery('')} aria-label="Clear search">✕</button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="error-box animate-fade-in" style={{ marginBottom: 24 }}>⚠️ {error}</div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="history-grid">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="card history-skeleton">
                <div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 12, width: '80%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 12, width: '40%' }} />
              </div>
            ))}
          </div>
        ) : analyses.length === 0 ? (
          <div className="empty-state animate-fade-in">
            <span className="empty-icon">🔭</span>
            <p>{query ? `No results for "${query}"` : 'No analyses yet. Analyze a repo to get started!'}</p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>Analyze a Repo</button>
          </div>
        ) : (
          <div className="history-grid">
            {analyses.map((a, i) => (
              <div
                key={a._id}
                className={`card history-card animate-fade-up delay-${(i % 3) + 1}`}
                onClick={() => navigate(`/analysis/${a._id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && navigate(`/analysis/${a._id}`)}
              >
                {/* Top row */}
                <div className="hcard-top">
                  <span className="hcard-name mono">{a.repo_name}</span>
                  <span className={`badge ${scoreColor(a.scores?.overall ?? 0)}`}>
                    {a.scores?.overall ?? '—'}
                  </span>
                </div>

                {/* Score bars */}
                <div className="score-bars">
                  {[
                    { label: 'Code',    val: a.scores?.code_quality },
                    { label: 'Maint.',  val: a.scores?.maintainability },
                    { label: 'Activity',val: a.scores?.activity },
                  ].map(s => (
                    <div key={s.label} className="score-bar-row">
                      <span className="score-bar-label">{s.label}</span>
                      <div className="score-bar-track">
                        <div
                          className="score-bar-fill"
                          style={{
                            width: `${s.val ?? 0}%`,
                            background: s.val >= 70 ? 'var(--success)' : s.val >= 40 ? 'var(--warning)' : 'var(--danger)',
                          }}
                        />
                      </div>
                      <span className="score-bar-val">{s.val ?? '—'}</span>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="hcard-footer">
                  <span className={`badge ${a.ai_used ? 'badge-accent' : 'badge-warning'}`}>
                    {a.ai_used ? '🤖 AI' : '⚡ Fallback'}
                  </span>
                  <span className="hcard-date">{new Date(a.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="pagination animate-fade-up">
            <button
              className="btn btn-ghost"
              onClick={() => load(page - 1, query)}
              disabled={page <= 1}
            >
              ← Prev
            </button>
            <span className="page-info">Page {page} of {pages}</span>
            <button
              className="btn btn-ghost"
              onClick={() => load(page + 1, query)}
              disabled={page >= pages}
            >
              Next →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
