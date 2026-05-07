import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getAnalysis } from '../api/analysisApi'
import ScoreGauge from '../components/ScoreGauge'
import RiskCard from '../components/RiskCard'
import TechBadge from '../components/TechBadge'
import './AnalysisPage.css'

export default function AnalysisPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getAnalysis(id)
      .then(r => setData(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, border: '3px solid rgba(99,102,241,0.2)', borderTopColor: 'var(--accent-1)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading analysis...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</p>
        <button className="btn btn-ghost" onClick={() => navigate('/')}>Back</button>
      </div>
    )
  }

  if (!data) return null

  const {
    tech_stack,
    architecture,
    code_quality,
    activity,
    risks,
    strengths,
    weaknesses,
    detailed_findings,
    vulnerabilities,
    positive_findings,
    improvement_plan,
    recruiter_decision,
    recruiter_evaluation,
    scores,
    ai_used,
    repo_name,
    repo_url,
    createdAt,
    model,
    reason,
  } = data

  const decisionIsShortlist = recruiter_decision === 'Shortlist' || recruiter_evaluation?.decision === 'Shortlist'
  const isRealValue = (value) => value && value !== 'insufficient data'
  const usableDetailedFindings = (detailed_findings || []).filter(f => isRealValue(f.title))
  const usableVulnerabilities = (vulnerabilities || []).filter(f => isRealValue(f.title))
  const usablePositiveFindings = (positive_findings || []).filter(f => isRealValue(f.title))
  const usablePlan = (improvement_plan || []).filter(f => isRealValue(f.task))
  const severityClass = (severity = 'Low') => `severity-${String(severity).toLowerCase()}`

  const FindingCard = ({ finding, showCategory = true }) => (
    <article className={`audit-finding ${severityClass(finding.severity)}`}>
      <div className="finding-topline">
        <h3>{finding.title}</h3>
        {finding.severity && <span className="finding-severity">{finding.severity}</span>}
      </div>
      {showCategory && finding.category && <p className="finding-category">{finding.category}</p>}
      <dl className="finding-details">
        <div>
          <dt>Evidence</dt>
          <dd>{finding.evidence}</dd>
        </div>
        <div>
          <dt>Impact</dt>
          <dd>{finding.impact}</dd>
        </div>
        {finding.recommendation && (
          <div>
            <dt>Fix</dt>
            <dd>{finding.recommendation}</dd>
          </div>
        )}
      </dl>
    </article>
  )

  return (
    <div className="analysis-page">
      <div className="container">
        <button className="btn btn-ghost back-btn animate-fade-up" onClick={() => navigate('/')}>
          New Analysis
        </button>

        <div className="analysis-header card animate-fade-up delay-1">
          <div className="header-left">
            <div className="header-top">
              <span className="badge badge-accent mono">{repo_name}</span>
              {!ai_used && <span className="badge badge-warning">Numeric Fallback</span>}
              {ai_used && model && <span className="badge badge-success mono">{model}</span>}
            </div>
            <a href={repo_url} target="_blank" rel="noreferrer" className="repo-url-link">
              {repo_url}
            </a>
            {!ai_used && reason && <p className="analysis-warning">AI unavailable: {reason}</p>}
            <p className="analysis-date">Analyzed {new Date(createdAt).toLocaleString()}</p>
          </div>
          <div className={`decision-badge ${decisionIsShortlist ? 'shortlist' : 'reject'}`}>
            <span>{decisionIsShortlist ? 'Shortlist' : 'Reject'}</span>
          </div>
        </div>

        <div className="card scores-card animate-fade-up delay-2">
          <h2 className="section-label">Overall Scores</h2>
          <div className="gauges-grid">
            <ScoreGauge score={scores?.code_quality} label="Code Quality" />
            <ScoreGauge score={scores?.maintainability} label="Maintainability" />
            <ScoreGauge score={scores?.activity} label="Activity" />
            <ScoreGauge score={scores?.overall} label="Overall Health" />
          </div>
        </div>

        <div className="card animate-fade-up delay-3">
          <h2 className="section-label">Tech Stack</h2>
          <div className="tech-grid">
            {tech_stack?.frontend && tech_stack.frontend !== 'insufficient data' && <TechBadge label={tech_stack.frontend} type="frontend" />}
            {tech_stack?.backend && tech_stack.backend !== 'insufficient data' && <TechBadge label={tech_stack.backend} type="backend" />}
            {tech_stack?.database && tech_stack.database !== 'insufficient data' && <TechBadge label={tech_stack.database} type="database" />}
            {(tech_stack?.other || []).filter(o => o !== 'insufficient data').map(o => (
              <TechBadge key={o} label={o} type="other" />
            ))}
          </div>
        </div>

        <div className="card animate-fade-up">
          <h2 className="section-label">Architecture</h2>
          <p className="body-text">{architecture}</p>
        </div>

        <div className="card animate-fade-up">
          <h2 className="section-label">Code Quality</h2>
          <div className="quality-row">
            <div className="quality-score-pill">{code_quality?.score}<span>/10</span></div>
            <p className="body-text">{code_quality?.reason}</p>
          </div>
        </div>

        <div className="card animate-fade-up">
          <h2 className="section-label">Activity</h2>
          <p className="body-text">{activity}</p>
        </div>

        <div className="animate-fade-up">
          <h2 className="section-label" style={{ marginBottom: 16 }}>Risk Detection</h2>
          <div className="risks-grid">
            {(risks || []).map((r, i) => <RiskCard key={i} risk={r} index={i} />)}
          </div>
        </div>

        {usableDetailedFindings.length > 0 && (
          <div className="card audit-card animate-fade-up">
            <h2 className="section-label">Detailed Mistakes & Weak Spots</h2>
            <div className="audit-list">
              {usableDetailedFindings.map((finding, i) => (
                <FindingCard key={`${finding.title}-${i}`} finding={finding} />
              ))}
            </div>
          </div>
        )}

        {usableVulnerabilities.length > 0 && (
          <div className="card audit-card animate-fade-up">
            <h2 className="section-label">Security & Vulnerability Review</h2>
            <div className="audit-list">
              {usableVulnerabilities.map((finding, i) => (
                <FindingCard key={`${finding.title}-${i}`} finding={finding} />
              ))}
            </div>
          </div>
        )}

        <div className="grid-2 animate-fade-up">
          <div className="card">
            <h2 className="section-label">Strengths</h2>
            <ul className="insight-list">
              {(strengths || []).map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
          <div className="card">
            <h2 className="section-label">Weaknesses</h2>
            <ul className="insight-list weakness">
              {(weaknesses || []).map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        </div>

        {usablePositiveFindings.length > 0 && (
          <div className="card audit-card animate-fade-up">
            <h2 className="section-label">Positive Engineering Signals</h2>
            <div className="positive-grid">
              {usablePositiveFindings.map((finding, i) => (
                <article key={`${finding.title}-${i}`} className="positive-finding">
                  <h3>{finding.title}</h3>
                  <p><span>Evidence:</span> {finding.evidence}</p>
                  <p><span>Why it matters:</span> {finding.impact}</p>
                </article>
              ))}
            </div>
          </div>
        )}

        {usablePlan.length > 0 && (
          <div className="card audit-card animate-fade-up">
            <h2 className="section-label">Improvement Plan</h2>
            <div className="plan-list">
              {usablePlan.map((item, i) => (
                <article key={`${item.task}-${i}`} className="plan-item">
                  <span className="plan-priority">{item.priority}</span>
                  <div>
                    <h3>{item.task}</h3>
                    <p>{item.why}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {recruiter_evaluation && (
          <div className={`card recruiter-card animate-fade-up ${decisionIsShortlist ? 'shortlist-card' : 'reject-card'}`}>
            <h2 className="section-label">Recruiter Evaluation</h2>
            <p className="recruiter-reason">{recruiter_evaluation.reason}</p>
            <div className="recruiter-tags">
              <div>
                <p className="tag-label">Skills Detected</p>
                <div className="tag-list">
                  {(recruiter_evaluation.skills_detected || []).filter(s => s !== 'insufficient data').map(s => (
                    <span key={s} className="badge badge-success">{s}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="tag-label">Missing Skills</p>
                <div className="tag-list">
                  {(recruiter_evaluation.missing_skills || []).filter(s => s !== 'insufficient data').map(s => (
                    <span key={s} className="badge badge-danger">{s}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
