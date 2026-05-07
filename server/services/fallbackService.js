/**
 * Numeric fallback analysis when Gemini AI is unavailable.
 * Computes basic insights from raw numeric repo data only.
 */
export function numericFallback(repoData, reason = 'all_models_failed') {
  const { open_issues, closed_issues, recent_commits, stars } = repoData;

  // Activity classification
  let activity = 'Inactive';
  if (recent_commits >= 20) activity = 'Active';
  else if (recent_commits >= 5) activity = 'Moderate';

  // Issue resolution ratio
  const totalIssues = (open_issues || 0) + (closed_issues || 0);
  const issueRatio = totalIssues > 0 ? closed_issues / totalIssues : 0;

  // Popularity tier
  const popularityScore =
    stars >= 1000 ? 80 : stars >= 100 ? 60 : stars >= 10 ? 40 : 20;

  // Computed scores
  const activityScore = Math.min(
    100,
    Math.round((recent_commits / 30) * 100)
  );
  const maintainabilityScore = Math.round(issueRatio * 100);
  const overall = Math.round(
    (activityScore + maintainabilityScore + popularityScore) / 3
  );

  return {
    tech_stack: {
      frontend: 'insufficient data',
      backend: 'insufficient data',
      database: 'insufficient data',
      other: ['insufficient data'],
    },
    architecture: 'insufficient data',
    code_quality: {
      score: 0,
      reason: 'AI unavailable - numeric fallback only',
    },
    activity,
    risks: [
      {
        issue: 'AI analysis unavailable',
        severity: 'Medium',
      },
    ],
    strengths: [`${stars} GitHub stars`, `${recent_commits} commits in last 30 days`],
    weaknesses: ['Full analysis requires AI service'],
    detailed_findings: [
      {
        title: 'AI review unavailable',
        severity: 'Medium',
        category: 'Analysis Coverage',
        evidence: reason,
        impact: 'Only numeric metadata could be evaluated.',
        recommendation: 'Restore Gemini quota or key access and rerun the analysis.',
      },
      {
        title: 'Open issue load',
        severity: open_issues > 100 ? 'High' : 'Medium',
        category: 'Maintainability',
        evidence: `${open_issues || 0} open issues and ${closed_issues || 0} closed issues`,
        impact: 'A large unresolved backlog can slow maintenance and triage.',
        recommendation: 'Review stale issues and add labels or automation for triage.',
      },
    ],
    vulnerabilities: [
      {
        title: 'Security review unavailable',
        severity: 'Medium',
        category: 'Security',
        evidence: 'AI provider unavailable during analysis',
        impact: 'Dependency and configuration risks could not be reviewed.',
        recommendation: 'Rerun with AI available and run a dependency scanner such as npm audit or equivalent.',
      },
    ],
    positive_findings: [
      {
        title: 'Repository popularity signal',
        evidence: `${stars} GitHub stars`,
        impact: 'Popularity can indicate ecosystem adoption and community review.',
      },
      {
        title: 'Recent activity signal',
        evidence: `${recent_commits} commits in the last 30 days`,
        impact: 'Recent commits indicate whether maintainers are still active.',
      },
    ],
    improvement_plan: [
      {
        priority: 'P1',
        task: 'Rerun AI analysis after provider quota is available',
        why: 'The detailed audit depends on model access.',
      },
      {
        priority: 'P2',
        task: 'Review open issue backlog',
        why: 'Issue volume affects maintainability and project health.',
      },
    ],
    recruiter_decision: 'insufficient data',
    recruiter_evaluation: {
      skills_detected: ['insufficient data'],
      missing_skills: ['insufficient data'],
      decision: 'Reject',
      reason: 'AI unavailable - cannot evaluate code quality',
    },
    scores: {
      code_quality: 0,
      maintainability: maintainabilityScore,
      activity: activityScore,
      overall,
    },
    ai_used: false,
    source: 'fallback',
    reason,
  };
}
