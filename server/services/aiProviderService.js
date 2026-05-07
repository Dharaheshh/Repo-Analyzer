import { numericFallback } from './fallbackService.js';

const PROVIDER = 'gemini';
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 250;
const PING_TIMEOUT_MS = 5000;
const ANALYSIS_TIMEOUT_MS = 20000;
const DISCOVERY_COOLDOWN_MS = 5 * 60 * 1000;

const LEGACY_GEMINI_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-pro',
  'gemini-2.0-flash-exp',
];

const CURRENT_GEMINI_MODELS = [
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
];

export const GEMINI_MODELS = [...CURRENT_GEMINI_MODELS, ...LEGACY_GEMINI_MODELS];

const SYSTEM_INSTRUCTION = `Your goals:
- Provide a practical engineering audit
- Be specific about evidence and uncertainty
- Return only structured data
- Ensure output is valid JSON for direct MongoDB storage

You must:
- Use short, precise sentences
- Avoid repetition
- Avoid unnecessary explanations
- Never include markdown or extra text

Assume this runs under strict API rate limits and cost constraints.`;

let modernClient;
let legacyClient;
let cachedWorkingModel = null;
let modelDiscoveryPromise = null;
let cachedHealth = {
  status: 'unknown',
  working_model: null,
  provider: PROVIDER,
  latency: null,
  checked_at: null,
  error: null,
};

/**
 * Builds the token-minimal prompt from repo data.
 */
function buildPrompt(data) {
  return `Analyze this GitHub repository as a senior code reviewer and security reviewer.

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
    signals: data.signals,
  })}

TASK:
Provide a detailed, evidence-based repository audit:
1. Tech stack (precise, no guessing)
2. Architecture summary
3. Code quality (score 0-10 + evidence)
4. Activity and maintainability status
5. Specific mistakes or weak spots
6. Security vulnerabilities and exposure risks
7. Positive engineering choices
8. Concrete improvement plan
9. Recruiter decision and score breakdown

IMPORTANT:
- Only claim issues supported by INPUT.
- If evidence is indirect, say "Inferred from metadata".
- Do not invent files, CVEs, line numbers, secrets, or vulnerabilities.
- Prefer more detail over short summaries.

OUTPUT (STRICT JSON):
{
  "tech_stack": { "frontend": "", "backend": "", "database": "", "other": [] },
  "architecture": "",
  "code_quality": { "score": 0, "reason": "" },
  "activity": "",
  "risks": [{ "issue": "", "severity": "Low|Medium|High" }],
  "strengths": [],
  "weaknesses": [],
  "detailed_findings": [
    {
      "title": "",
      "severity": "Low|Medium|High|Critical",
      "category": "Code Quality|Architecture|Maintainability|Testing|Documentation|Security|Dependencies|DevOps",
      "evidence": "",
      "impact": "",
      "recommendation": ""
    }
  ],
  "vulnerabilities": [
    {
      "title": "",
      "severity": "Low|Medium|High|Critical",
      "evidence": "",
      "impact": "",
      "recommendation": ""
    }
  ],
  "positive_findings": [
    {
      "title": "",
      "evidence": "",
      "impact": ""
    }
  ],
  "improvement_plan": [
    {
      "priority": "P0|P1|P2|P3",
      "task": "",
      "why": ""
    }
  ],
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
- Return 5-8 detailed_findings when evidence allows
- Return 3-6 vulnerabilities or exposure risks when evidence allows
- Return 5-8 positive_findings when evidence allows
- Return 5-8 improvement_plan tasks
- Keep each string under 220 characters
- No filler text
- No explanations outside JSON
- If unknown -> "insufficient data"`;
}

function hasGeminiApiKey() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function redactSecrets(message) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return message;
  return String(message).replaceAll(apiKey, '[redacted]');
}

function errorMessage(error) {
  return redactSecrets(error?.message || String(error));
}

function classifyGeminiError(error) {
  if (error?.reason) return error.reason;

  const status = Number(error?.status || error?.code || error?.response?.status);
  const message = errorMessage(error).toLowerCase();

  if (
    message.includes('api key not valid') ||
    message.includes('invalid api key') ||
    message.includes('api_key_invalid') ||
    message.includes('permission_denied')
  ) {
    return 'invalid_api_key';
  }

  if (
    status === 429 ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('resource_exhausted')
  ) {
    return 'quota_exceeded';
  }

  if (
    status === 404 ||
    (message.includes('model') &&
      (message.includes('not found') ||
        message.includes('not supported') ||
        message.includes('not available')))
  ) {
    return 'model_not_found';
  }

  if (
    error?.name === 'AbortError' ||
    message.includes('timeout') ||
    message.includes('timed out')
  ) {
    return 'timeout';
  }

  if (
    message.includes('sdk') ||
    message.includes('googlegenai is not a constructor') ||
    message.includes('generatecontent is not a function')
  ) {
    return 'sdk_incompatibility';
  }

  if (message.includes('empty response') || message.includes('no response text')) {
    return 'empty_response';
  }

  if (status === 400 || message.includes('bad request') || message.includes('invalid argument')) {
    return 'bad_request';
  }

  return status ? `http_${status}` : 'unknown_error';
}

function normalizeProviderError(error) {
  if (error?.isProviderError) return error;

  const reason = classifyGeminiError(error);
  const detail = errorMessage(error).slice(0, 300);
  const providerError = new Error(detail ? `${reason}: ${detail}` : reason);
  providerError.reason = reason;
  providerError.status = error?.status || error?.code || error?.response?.status;
  providerError.isProviderError = true;
  providerError.cause = error;
  return providerError;
}

function createProviderError(reason, message) {
  const error = new Error(message || reason);
  error.reason = reason;
  error.isProviderError = true;
  return error;
}

function isRetryable(error) {
  const reason = classifyGeminiError(error);
  return ![
    'invalid_api_key',
    'bad_request',
    'model_not_found',
    'sdk_incompatibility',
    'quota_exceeded',
  ].includes(reason);
}

function logAttempt({ model, success, latency, error }) {
  console.log(
    JSON.stringify({
      provider: PROVIDER,
      model,
      success,
      latency,
      error: error || null,
    })
  );
}

async function withTimeout(factory, timeoutMs) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(createProviderError('timeout', `Gemini request timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  try {
    return await Promise.race([factory(), timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getModernClient() {
  if (!modernClient) {
    const { GoogleGenAI } = await import('@google/genai');
    modernClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return modernClient;
}

async function getLegacyClient() {
  if (!legacyClient) {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    legacyClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return legacyClient;
}

function extractText(response) {
  if (typeof response?.text === 'function') return response.text().trim();
  if (typeof response?.text === 'string') return response.text.trim();
  if (typeof response?.response?.text === 'function') return response.response.text().trim();
  if (typeof response?.response?.text === 'string') return response.response.text.trim();

  const candidateText = response?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();

  if (candidateText) return candidateText;
  throw createProviderError('empty_response', 'Gemini returned no response text');
}

async function generateWithModernSdk({ model, contents, config, timeoutMs }) {
  const ai = await getModernClient();
  const response = await withTimeout(
    () =>
      ai.models.generateContent({
        model,
        contents,
        config,
      }),
    timeoutMs
  );
  return extractText(response);
}

async function generateWithLegacySdk({ model, contents, config, timeoutMs }) {
  const ai = await getLegacyClient();
  const legacyModel = ai.getGenerativeModel({
    model,
    systemInstruction: config?.systemInstruction,
    generationConfig: {
      responseMimeType: config?.responseMimeType,
      maxOutputTokens: config?.maxOutputTokens,
      temperature: config?.temperature,
    },
  });

  const response = await withTimeout(() => legacyModel.generateContent(contents), timeoutMs);
  return extractText(response);
}

async function generateContent({ model, contents, config, timeoutMs }) {
  try {
    return await generateWithModernSdk({ model, contents, config, timeoutMs });
  } catch (error) {
    const providerError = normalizeProviderError(error);

    // SDK failures are different from model/API failures. If the modern SDK
    // cannot execute in this runtime, try the older installed SDK once so the
    // app can keep analyzing instead of crashing on an integration mismatch.
    if (providerError.reason === 'sdk_incompatibility') {
      return generateWithLegacySdk({ model, contents, config, timeoutMs });
    }

    throw providerError;
  }
}

async function generateTextWithRetries({ model, contents, config, timeoutMs, maxRetries = MAX_RETRIES }) {
  let lastError;

  // Retry flow: each model gets the original attempt plus two retries. Retryable
  // failures use exponential backoff; permanent failures move immediately to the
  // next model so failover stays fast under bad keys or unsupported model names.
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const startedAt = Date.now();

    try {
      const text = await generateContent({ model, contents, config, timeoutMs });
      const latency = Date.now() - startedAt;
      logAttempt({ model, success: true, latency });
      return { text, latency };
    } catch (error) {
      const providerError = normalizeProviderError(error);
      const latency = Date.now() - startedAt;
      lastError = providerError;

      logAttempt({
        model,
        success: false,
        latency,
        error: providerError.message,
      });

      if (!isRetryable(providerError) || attempt === maxRetries) break;
      await sleep(BASE_BACKOFF_MS * 2 ** attempt);
    }
  }

  throw lastError;
}

async function generateJsonWithRetries({ model, contents, config, timeoutMs, maxRetries = MAX_RETRIES }) {
  let lastError;

  // Analysis retry flow includes JSON parsing. A syntactically successful model
  // response is still a failed attempt if it cannot be stored as structured
  // analysis data.
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const startedAt = Date.now();

    try {
      const text = await generateContent({ model, contents, config, timeoutMs });
      const parsed = parseJsonResponse(text);
      const latency = Date.now() - startedAt;
      logAttempt({ model, success: true, latency });
      return { parsed, latency };
    } catch (error) {
      const providerError = normalizeProviderError(error);
      const latency = Date.now() - startedAt;
      lastError = providerError;

      logAttempt({
        model,
        success: false,
        latency,
        error: providerError.message,
      });

      if (!isRetryable(providerError) || attempt === maxRetries) break;
      await sleep(BASE_BACKOFF_MS * 2 ** attempt);
    }
  }

  throw lastError;
}

function parseJsonResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');

    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        // Fall through to the concise provider error below.
      }
    }

    throw createProviderError('bad_response_json', `Gemini returned invalid JSON: ${text.slice(0, 200)}`);
  }
}

function getModelOrder(preferredModel) {
  return [...new Set([preferredModel, ...GEMINI_MODELS].filter(Boolean))];
}

function fallbackAnalysis(repoData, reason = 'all_models_failed') {
  return {
    ...numericFallback(repoData, reason),
    source: 'fallback',
    reason,
    provider: PROVIDER,
    model: null,
  };
}

/**
 * Model testing and caching:
 * - Ping models in the configured order with a tiny prompt.
 * - Cache the first working model in memory to avoid repeated startup probes.
 * - Share an in-flight discovery promise so concurrent requests do not stampede
 *   all models at once.
 */
export async function findWorkingModel({ forceRefresh = false } = {}) {
  if (!hasGeminiApiKey()) {
    cachedWorkingModel = null;
    cachedHealth = {
      status: 'unconfigured',
      working_model: null,
      provider: PROVIDER,
      latency: null,
      checked_at: Date.now(),
      error: 'missing_api_key',
    };
    return null;
  }

  if (cachedWorkingModel && !forceRefresh) return cachedWorkingModel;
  if (modelDiscoveryPromise && !forceRefresh) return modelDiscoveryPromise;
  if (
    !forceRefresh &&
    cachedHealth.status !== 'unknown' &&
    cachedHealth.checked_at &&
    Date.now() - cachedHealth.checked_at < DISCOVERY_COOLDOWN_MS
  ) {
    return cachedHealth.working_model;
  }

  modelDiscoveryPromise = (async () => {
    const failures = [];

    for (const model of GEMINI_MODELS) {
      try {
        const { latency } = await generateTextWithRetries({
          model,
          contents: 'Respond with the word OK',
          config: {
            temperature: 0,
            maxOutputTokens: 8,
          },
          timeoutMs: PING_TIMEOUT_MS,
          maxRetries: 0,
        });

        cachedWorkingModel = model;
        cachedHealth = {
          status: 'ok',
          working_model: model,
          provider: PROVIDER,
          latency,
          checked_at: Date.now(),
          error: null,
        };
        return model;
      } catch (error) {
        const providerError = normalizeProviderError(error);
        failures.push({ model, reason: providerError.reason });

        if (providerError.reason === 'invalid_api_key') break;
      }
    }

    cachedWorkingModel = null;
    cachedHealth = {
      status: 'unavailable',
      working_model: null,
      provider: PROVIDER,
      latency: null,
      checked_at: Date.now(),
      error: failures.at(-1)?.reason || 'all_models_failed',
      failures,
    };
    return null;
  })();

  try {
    return await modelDiscoveryPromise;
  } finally {
    modelDiscoveryPromise = null;
  }
}

/**
 * Analysis failover:
 * - Validate connectivity by finding a working model before AI analysis.
 * - Try the cached model first, then every configured model in order.
 * - If every Gemini model fails, return numeric fallback data instead of
 *   throwing, which keeps API responses and MongoDB writes stable.
 */
export async function analyzeRepo(repoData) {
  if (!hasGeminiApiKey()) {
    return fallbackAnalysis(repoData, 'missing_api_key');
  }

  const workingModel = cachedWorkingModel || (await findWorkingModel());
  if (!workingModel) {
    return fallbackAnalysis(repoData, 'all_models_failed');
  }

  for (const model of getModelOrder(workingModel)) {
    try {
      const { parsed, latency } = await generateJsonWithRetries({
        model,
        contents: buildPrompt(repoData),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          maxOutputTokens: 4096,
          temperature: 0.2,
        },
        timeoutMs: ANALYSIS_TIMEOUT_MS,
      });

      cachedWorkingModel = model;
      cachedHealth = {
        status: 'ok',
        working_model: model,
        provider: PROVIDER,
        latency,
        checked_at: Date.now(),
        error: null,
      };

      return {
        ...parsed,
        ai_used: true,
        source: PROVIDER,
        reason: null,
        provider: PROVIDER,
        model,
      };
    } catch (error) {
      const providerError = normalizeProviderError(error);

      if (providerError.reason === 'quota_exceeded') {
        cachedHealth = {
          status: 'limited',
          working_model: cachedWorkingModel || model,
          provider: PROVIDER,
          latency: null,
          checked_at: Date.now(),
          error: providerError.reason,
        };
        return fallbackAnalysis(repoData, 'quota_exceeded');
      }

      if (providerError.reason === 'invalid_api_key') break;

      if (model === cachedWorkingModel) {
        cachedWorkingModel = null;
      }
    }
  }

  cachedHealth = {
    status: 'unavailable',
    working_model: null,
    provider: PROVIDER,
    latency: null,
    checked_at: Date.now(),
    error: 'all_models_failed',
  };

  return fallbackAnalysis(repoData, 'all_models_failed');
}

export async function getAIHealth() {
  if (cachedHealth.status === 'ok' || cachedHealth.status === 'limited') {
    return {
      status: cachedHealth.status,
      working_model: cachedHealth.working_model,
      provider: PROVIDER,
      latency: cachedHealth.latency,
      error: cachedHealth.error,
    };
  }

  const model = await findWorkingModel();

  if (model) {
    return {
      status: 'ok',
      working_model: model,
      provider: PROVIDER,
      latency: cachedHealth.latency,
      error: cachedHealth.error,
    };
  }

  return {
    status: cachedHealth.status === 'unconfigured' ? 'unconfigured' : 'fallback_available',
    working_model: null,
    provider: PROVIDER,
    latency: cachedHealth.latency,
    error: cachedHealth.error,
  };
}

export async function validateAIProviderOnStartup() {
  if (!hasGeminiApiKey()) {
    console.warn('[ai] GEMINI_API_KEY is missing. Numeric fallback analysis is enabled.');
    return {
      status: 'unconfigured',
      working_model: null,
    provider: PROVIDER,
    latency: null,
    error: 'missing_api_key',
    };
  }

  const model = await findWorkingModel({ forceRefresh: true });
  if (model) {
    console.log(`[ai] Gemini provider ready. Working model: ${model}`);
  } else {
    console.warn('[ai] Gemini unavailable at startup. Numeric fallback analysis is enabled.');
  }

  return {
    status: model ? 'ok' : 'unavailable',
    working_model: model,
    provider: PROVIDER,
    latency: cachedHealth.latency,
    error: cachedHealth.error,
  };
}
