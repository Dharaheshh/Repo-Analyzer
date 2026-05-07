import express from 'express';
import rateLimit from 'express-rate-limit';
import { parseGithubUrl } from '../utils/parseGithubUrl.js';
import { validateAnalysis } from '../utils/validateAnalysis.js';
import { fetchRepoData } from '../services/githubService.js';
import { analyzeRepo, getAIHealth } from '../services/aiProviderService.js';
import { numericFallback } from '../services/fallbackService.js';
import Analysis from '../models/Analysis.js';

const router = express.Router();

// Rate limit: 5 analysis requests per minute per IP.
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many requests. Try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/health/ai
router.get('/health/ai', async (_req, res) => {
  try {
    const health = await getAIHealth();
    return res.json(health);
  } catch (err) {
    console.error('[ai] Health check failed:', err.message);
    return res.json({
      status: 'fallback_available',
      working_model: null,
      provider: 'gemini',
      latency: null,
      error: err.message,
    });
  }
});

// POST /api/analyze
router.post('/analyze', analyzeLimiter, async (req, res) => {
  const { repoUrl } = req.body;
  if (!repoUrl) return res.status(400).json({ error: 'repoUrl is required' });

  let owner, repo;
  try {
    ({ owner, repo } = parseGithubUrl(repoUrl));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Fetch GitHub data.
  let repoData;
  try {
    repoData = await fetchRepoData(owner, repo);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }

  // AI analysis now falls back inside the provider service. This catch is a
  // final safety net for unexpected provider-layer exceptions.
  let rawAnalysis;
  try {
    rawAnalysis = await analyzeRepo(repoData);
  } catch (err) {
    console.warn('[analysis] AI provider failed unexpectedly, using numeric fallback:', err.message);
    rawAnalysis = numericFallback(repoData, 'provider_exception');
  }

  // Validate + fix before DB insert.
  const { data: cleanData, errors } = validateAnalysis(rawAnalysis);
  if (errors.length > 0) {
    console.warn('[analysis] Validation fixed issues:', errors);
  }

  // Store in MongoDB.
  try {
    const doc = await Analysis.create({
      repo_url: repoUrl,
      repo_name: repoData.name,
      ...cleanData,
    });
    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    return res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// GET /api/analyses - paginated history
router.get('/analyses', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 12;
  const q = req.query.q?.trim();

  const filter = q ? { $text: { $search: q } } : {};

  try {
    const [docs, total] = await Promise.all([
      Analysis.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('repo_name repo_url scores activity createdAt ai_used source reason provider model'),
      Analysis.countDocuments(filter),
    ]);
    return res.json({ data: docs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/analyses/:id - single analysis
router.get('/analyses/:id', async (req, res) => {
  try {
    const doc = await Analysis.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Analysis not found' });
    return res.json({ data: doc });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
