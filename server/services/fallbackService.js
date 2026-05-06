/**
 * Numeric fallback analysis when Gemini AI is unavailable.
 * Computes basic insights from raw numeric repo data only.
 */
export function numericFallback(repoData) {
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
      reason: 'AI unavailable — numeric fallback only',
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
    recruiter_decision: 'insufficient data',
    recruiter_evaluation: {
      skills_detected: ['insufficient data'],
      missing_skills: ['insufficient data'],
      decision: 'Reject',
      reason: 'AI unavailable — cannot evaluate code quality',
    },
    scores: {
      code_quality: 0,
      maintainability: maintainabilityScore,
      activity: activityScore,
      overall,
    },
    ai_used: false,
  };
}
