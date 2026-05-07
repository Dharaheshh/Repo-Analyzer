/**
 * Validates an AI-generated analysis JSON before MongoDB insertion.
 * Fixes common issues (nulls, empty arrays, out-of-range scores).
 * Returns { valid: boolean, data: object, errors: string[] }
 */

const REQUIRED_KEYS = [
  'tech_stack',
  'architecture',
  'code_quality',
  'activity',
  'risks',
  'strengths',
  'weaknesses',
  'detailed_findings',
  'vulnerabilities',
  'positive_findings',
  'improvement_plan',
  'recruiter_decision',
  'scores',
];

const SCORE_KEYS = ['code_quality', 'maintainability', 'activity', 'overall'];
const FINDING_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const TASK_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

function fallbackForMissingKey(key) {
  if (key === 'scores') return {};
  if (key === 'tech_stack') {
    return {
      frontend: 'insufficient data',
      backend: 'insufficient data',
      database: 'insufficient data',
      other: ['insufficient data'],
    };
  }
  if (
    [
      'risks',
      'strengths',
      'weaknesses',
      'detailed_findings',
      'vulnerabilities',
      'positive_findings',
      'improvement_plan',
    ].includes(key)
  ) {
    return [];
  }
  return 'insufficient data';
}

function normalizeFinding(finding, fallbackCategory = 'General') {
  return {
    title: String(finding?.title || 'insufficient data'),
    severity: FINDING_SEVERITIES.includes(finding?.severity) ? finding.severity : 'Low',
    category: String(finding?.category || fallbackCategory),
    evidence: String(finding?.evidence || 'insufficient data'),
    impact: String(finding?.impact || 'insufficient data'),
    recommendation: String(finding?.recommendation || 'insufficient data'),
  };
}

export function validateAnalysis(raw) {
  const errors = [];
  const data = structuredClone(raw);

  for (const key of REQUIRED_KEYS) {
    if (!(key in data)) {
      errors.push(`Missing key: ${key}`);
      data[key] = fallbackForMissingKey(key);
    }
  }

  const replaceNulls = (obj) => {
    if (Array.isArray(obj)) {
      return obj.map(replaceNulls);
    }
    if (obj !== null && typeof obj === 'object') {
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, replaceNulls(v)])
      );
    }
    return obj === null || obj === undefined ? 'insufficient data' : obj;
  };
  Object.assign(data, replaceNulls(data));

  for (const arrKey of ['risks', 'strengths', 'weaknesses']) {
    if (!Array.isArray(data[arrKey]) || data[arrKey].length === 0) {
      errors.push(`Empty array: ${arrKey} - injecting fallback`);
      data[arrKey] =
        arrKey === 'risks'
          ? [{ issue: 'insufficient data', severity: 'Low' }]
          : ['insufficient data'];
    }
  }

  if (!Array.isArray(data.detailed_findings) || data.detailed_findings.length === 0) {
    data.detailed_findings = [normalizeFinding(null)];
  } else {
    data.detailed_findings = data.detailed_findings.map((finding) =>
      normalizeFinding(finding)
    );
  }

  if (!Array.isArray(data.vulnerabilities) || data.vulnerabilities.length === 0) {
    data.vulnerabilities = [normalizeFinding(null, 'Security')];
  } else {
    data.vulnerabilities = data.vulnerabilities.map((finding) =>
      normalizeFinding(finding, 'Security')
    );
  }

  if (!Array.isArray(data.positive_findings) || data.positive_findings.length === 0) {
    data.positive_findings = [
      {
        title: 'insufficient data',
        evidence: 'insufficient data',
        impact: 'insufficient data',
      },
    ];
  } else {
    data.positive_findings = data.positive_findings.map((finding) => ({
      title: String(finding?.title || 'insufficient data'),
      evidence: String(finding?.evidence || 'insufficient data'),
      impact: String(finding?.impact || 'insufficient data'),
    }));
  }

  if (!Array.isArray(data.improvement_plan) || data.improvement_plan.length === 0) {
    data.improvement_plan = [
      {
        priority: 'P2',
        task: 'insufficient data',
        why: 'insufficient data',
      },
    ];
  } else {
    data.improvement_plan = data.improvement_plan.map((task) => ({
      priority: TASK_PRIORITIES.includes(task?.priority) ? task.priority : 'P2',
      task: String(task?.task || 'insufficient data'),
      why: String(task?.why || 'insufficient data'),
    }));
  }

  if (data.scores && typeof data.scores === 'object') {
    for (const sk of SCORE_KEYS) {
      if (!(sk in data.scores)) {
        errors.push(`Missing score: scores.${sk}`);
        data.scores[sk] = 0;
      } else {
        data.scores[sk] = Math.min(
          100,
          Math.max(0, Math.round(Number(data.scores[sk]) || 0))
        );
      }
    }
  }

  if (data.code_quality?.score !== undefined) {
    data.code_quality.score = Math.min(
      10,
      Math.max(0, Math.round(Number(data.code_quality.score) || 0))
    );
  }

  if (!['Shortlist', 'Reject'].includes(data.recruiter_decision)) {
    const dec = String(data.recruiter_decision || '').toLowerCase();
    data.recruiter_decision = dec.includes('shortlist') ? 'Shortlist' : 'Reject';
  }

  if (!['gemini', 'fallback'].includes(data.source)) {
    data.source = data.ai_used === false ? 'fallback' : 'gemini';
  }
  if (data.source === 'fallback' && (!data.reason || data.reason === 'insufficient data')) {
    data.reason = 'all_models_failed';
  }
  if (data.source === 'gemini') {
    data.reason = null;
  }
  if (!data.provider) {
    data.provider = 'gemini';
  }
  if (data.source === 'fallback') {
    data.model = null;
  }

  return {
    valid: errors.length === 0,
    data,
    errors,
  };
}
