import './LoadingAnalysis.css'

const STEPS = [
  { icon: '🔍', label: 'Fetching repository data…' },
  { icon: '🤖', label: 'Analyzing with Gemini AI…' },
  { icon: '📊', label: 'Generating report…' },
]

export default function LoadingAnalysis({ step = 0 }) {
  return (
    <div className="loading-wrap animate-fade-in">
      <div className="loading-spinner" />
      <h3 className="loading-title gradient-text">Analyzing Repository</h3>
      <div className="loading-steps">
        {STEPS.map((s, i) => (
          <div
            key={i}
            className={`loading-step ${i < step ? 'done' : i === step ? 'active' : 'pending'}`}
          >
            <span className="step-icon">{i < step ? '✅' : s.icon}</span>
            <span className="step-label">{s.label}</span>
          </div>
        ))}
      </div>
      {/* Skeleton preview */}
      <div className="skeleton-preview">
        <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 14, width: '90%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 14, width: '75%', marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton" style={{ height: 90, flex: 1, borderRadius: 12 }} />
          ))}
        </div>
      </div>
    </div>
  )
}
