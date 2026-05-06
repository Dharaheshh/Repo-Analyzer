import './ScoreGauge.css'

const RADIUS = 45
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function getColor(score) {
  if (score >= 70) return '#10b981'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

export default function ScoreGauge({ score = 0, label = '' }) {
  const pct = Math.min(100, Math.max(0, score))
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE
  const color = getColor(pct)

  return (
    <div className="gauge-wrap">
      <svg className="gauge-svg" viewBox="0 0 100 100" aria-label={`${label}: ${score}`}>
        {/* Track */}
        <circle
          cx="50" cy="50" r={RADIUS}
          fill="none"
          stroke="rgba(99,102,241,0.1)"
          strokeWidth="8"
        />
        {/* Fill */}
        <circle
          cx="50" cy="50" r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          className="gauge-fill"
          style={{ '--offset': offset, '--color': color }}
        />
        {/* Score text */}
        <text x="50" y="46" textAnchor="middle" className="gauge-score" fill={color}>
          {pct}
        </text>
        <text x="50" y="58" textAnchor="middle" className="gauge-sub" fill="rgba(148,163,184,0.7)">
          /100
        </text>
      </svg>
      <p className="gauge-label">{label}</p>
    </div>
  )
}
