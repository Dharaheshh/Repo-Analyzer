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
  'recruiter_decision',
  'scores',
];

const SCORE_KEYS = ['code_quality', 'maintainability', 'activity', 'overall'];

export function validateAnalysis(raw) {
  const errors = [];
  const data = structuredClone(raw);

  // 1. Check required top-level keys
  for (const key of REQUIRED_KEYS) {
    if (!(key in data)) {
      errors.push(`Missing key: ${key}`);
      data[key] = key === 'scores' ? {} : key.endsWith('s') ? [] : 'insufficient data';
    }
  }

  // 2. Replace null / undefined leaf values
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

  // 3. Enforce non-empty arrays (max 3 items enforced upstream by prompt)
  for (const arrKey of ['risks', 'strengths', 'weaknesses']) {
    if (!Array.isArray(data[arrKey]) || data[arrKey].length === 0) {
      errors.push(`Empty array: ${arrKey} — injecting fallback`);
      data[arrKey] = arrKey === 'risks'
        ? [{ issue: 'insufficient data', severity: 'Low' }]
        : ['insufficient data'];
    }
  }

  // 4. Validate and clamp scores (must be integers 0–100)
  if (data.scores && typeof data.scores === 'object') {
    for (const sk of SCORE_KEYS) {
      if (!(sk in data.scores)) {
        errors.push(`Missing score: scores.${sk}`);
        data.scores[sk] = 0;
      } else {
        const clamped = Math.min(100, Math.max(0, Math.round(Number(data.scores[sk]) || 0)));
        data.scores[sk] = clamped;
      }
    }
  }

  // 5. Validate code_quality.score (0–10)
  if (data.code_quality?.score !== undefined) {
    data.code_quality.score = Math.min(10, Math.max(0, Math.round(Number(data.code_quality.score) || 0)));
  }

  // 6. Validate recruiter_decision
  if (!['Shortlist', 'Reject'].includes(data.recruiter_decision)) {
    const dec = String(data.recruiter_decision || '').toLowerCase();
    data.recruiter_decision = dec.includes('shortlist') ? 'Shortlist' : 'Reject';
  }

  return {
    valid: errors.length === 0,
    data,
    errors,
  };
}
