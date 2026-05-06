import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_INSTRUCTION = `Your goals:
- Minimize token usage
- Avoid verbose output
- Return only essential structured data
- Ensure output is valid JSON for direct MongoDB storage

You must:
- Use short, precise sentences
- Avoid repetition
- Avoid unnecessary explanations
- Never exceed required fields
- Never include markdown or extra text

Assume this runs under strict API rate limits and cost constraints.`;

/**
 * Builds the token-minimal prompt from repo data.
 */
function buildPrompt(data) {
  return `Analyze this GitHub repository using minimal tokens.

INPUT:
${JSON.stringify({
    name: data.name,
    description: data.description,
    languages: data.languages,
    stars: data.stars,
    open_issues: data.open_issues,
    closed_issues: data.closed_issues,
    recent_commits: data.recent_commits,
    contributors: data.contributors,
    structure: data.structure,
  })}

TASK:
Provide only essential insights:
1. Tech stack (precise, no guessing)
2. Architecture summary (max 2 sentences)
3. Code quality (score 0-10 + 1 reason)
4. Activity status (1 line)
5. Top 3 risks only
6. Top 3 strengths only
7. Top 3 weaknesses only
8. Recruiter decision (1 line + details)
9. Scores (integers 0-100 only)

OUTPUT (STRICT JSON):
{
  "tech_stack": { "frontend": "", "backend": "", "database": "", "other": [] },
  "architecture": "",
  "code_quality": { "score": 0, "reason": "" },
  "activity": "",
  "risks": [{ "issue": "", "severity": "Low|Medium|High" }],
  "strengths": [],
  "weaknesses": [],
  "recruiter_decision": "Shortlist|Reject",
  "recruiter_evaluation": {
    "skills_detected": [],
    "missing_skills": [],
    "decision": "Shortlist|Reject",
    "reason": ""
  },
  "scores": { "code_quality": 0, "maintainability": 0, "activity": 0, "overall": 0 }
}

RULES:
- Max 3 items per list
- Keep sentences short
- No filler text
- No explanations outside JSON
- If unknown → "insufficient data"`;
}

/**
 * Runs AI analysis with Gemini. Returns structured JSON.
 * Throws on failure so caller can invoke numeric fallback.
 */
export async function analyzeRepo(repoData) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 1024,
      temperature: 0.2,
    },
  });

  const prompt = buildPrompt(repoData);
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 200)}`);
  }

  return { ...parsed, ai_used: true };
}
