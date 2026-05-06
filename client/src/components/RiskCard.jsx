export default function RiskCard({ risk, index }) {
  const sev = (risk.severity || 'Low').toLowerCase()
  const icons = { high: '🔴', medium: '🟡', low: '🟢' }
  const icon = icons[sev] || '⚪'

  return (
    <div
      className={`card risk-card severity-${sev} animate-fade-up`}
      style={{ animationDelay: `${index * 0.1}s`, borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: 'var(--sev-color)', background: 'var(--sev-bg)' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{icon}</span>
        <div>
          <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--sev-color)', marginBottom: 4 }}>
            {risk.issue}
          </p>
          <span className={`badge badge-${sev === 'high' ? 'danger' : sev === 'medium' ? 'warning' : 'success'}`}>
            {risk.severity}
          </span>
        </div>
      </div>
    </div>
  )
}
