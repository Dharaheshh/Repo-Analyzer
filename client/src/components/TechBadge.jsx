export default function TechBadge({ label, type = 'accent' }) {
  const icons = {
    frontend: '🎨',
    backend: '⚙️',
    database: '🗄️',
    other: '🔧',
    default: '💠',
  }
  const icon = icons[type] || icons.default

  return (
    <span className="badge badge-accent" style={{ gap: 6, padding: '6px 14px', fontSize: '0.8rem' }}>
      <span>{icon}</span>
      {label}
    </span>
  )
}
