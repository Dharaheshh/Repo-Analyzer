import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyzeRepo, getAnalyses } from '../api/analysisApi'
import LoadingAnalysis from '../components/LoadingAnalysis'
import './HomePage.css'

export default function HomePage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadStep, setLoadStep] = useState(0)
  const [error, setError] = useState('')
  const [recent, setRecent] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    getAnalyses(1).then(r => setRecent(r.data?.slice(0, 6) || [])).catch(() => {})
  }, [])

  const handleAnalyze = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setError('')
    setLoading(true)
    setLoadStep(0)

    try {
      const t1 = setTimeout(() => setLoadStep(1), 1800)
      const t2 = setTimeout(() => setLoadStep(2), 3500)
      const result = await analyzeRepo(url.trim())
      clearTimeout(t1); clearTimeout(t2)
      navigate(`/analysis/${result.data._id}`)
    } catch (err) {
      setError(err.message)
      setLoading(false)
      setLoadStep(0)
    }
  }

  const examples = [
    'https://github.com/facebook/react',
    'https://github.com/vercel/next.js',
    'https://github.com/expressjs/express',
  ]

  if (loading) {
    return (
      <div className="container">
        <LoadingAnalysis step={loadStep} />
      </div>
    )
  }

  return (
    <div className="home-page">
      {/* Hero */}
      <section className="hero">
        <div className="hero-glow" />
        <div className="container hero-content">
          <div className="hero-badge badge badge-accent animate-fade-up">
            ✨ AI-Powered Repository Analysis
          </div>
          <h1 className="hero-title animate-fade-up delay-1">
            Understand Any GitHub Repo<br />
            <span className="gradient-text">In Seconds</span>
          </h1>
          <p className="hero-sub animate-fade-up delay-2">
            Paste a GitHub URL and get instant insights — tech stack, code quality scores,
            risk assessment, and recruiter-grade evaluation powered by Gemini AI.
          </p>

          {/* Analyze form */}
          <form className="analyze-form animate-fade-up delay-3" onSubmit={handleAnalyze} id="analyze-form">
            <div className="input-wrap analyze-input-wrap">
              <span className="input-icon">🔗</span>
              <input
                id="repo-url-input"
                className="input analyze-input"
                type="url"
                placeholder="https://github.com/owner/repository"
                value={url}
                onChange={e => setUrl(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button id="analyze-btn" className="btn btn-primary analyze-btn" type="submit">
              <span>Analyze</span>
              <span>→</span>
            </button>
          </form>

          {error && (
            <div className="error-box animate-fade-in">⚠️ {error}</div>
          )}

          {/* Example links */}
          <div className="examples animate-fade-up delay-4">
            <span className="examples-label">Try an example:</span>
            {examples.map(ex => (
              <button
                key={ex}
                className="btn btn-ghost example-btn"
                onClick={() => setUrl(ex)}
                type="button"
              >
                {ex.replace('https://github.com/', '')}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <div className="stats-strip">
        <div className="container stats-inner">
          {[
            { icon: '📊', label: 'Code Quality Score' },
            { icon: '⚡', label: 'Activity Analysis' },
            { icon: '🛡️', label: 'Risk Detection' },
            { icon: '🎯', label: 'Recruiter Evaluation' },
          ].map(s => (
            <div key={s.label} className="stat-item">
              <span className="stat-icon">{s.icon}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent analyses */}
      {recent.length > 0 && (
        <section className="section recent-section">
          <div className="container">
            <h2 className="section-title animate-fade-up">Recent Analyses</h2>
            <div className="grid-3">
              {recent.map((a, i) => (
                <div
                  key={a._id}
                  className={`card recent-card animate-fade-up delay-${(i % 3) + 1}`}
                  onClick={() => navigate(`/analysis/${a._id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate(`/analysis/${a._id}`)}
                >
                  <div className="recent-card-header">
                    <span className="recent-repo-name mono">{a.repo_name}</span>
                    <span className={`badge ${a.scores?.overall >= 70 ? 'badge-success' : a.scores?.overall >= 40 ? 'badge-warning' : 'badge-danger'}`}>
                      {a.scores?.overall ?? '—'}
                    </span>
                  </div>
                  <p className="recent-activity">{a.activity || '—'}</p>
                  <p className="recent-date">{new Date(a.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
