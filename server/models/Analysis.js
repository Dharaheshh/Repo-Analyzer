import mongoose from 'mongoose';

const riskSchema = new mongoose.Schema(
  {
    issue: { type: String, required: true },
    severity: { type: String, enum: ['Low', 'Medium', 'High'], required: true },
  },
  { _id: false }
);

const recruiterSchema = new mongoose.Schema(
  {
    skills_detected: [{ type: String }],
    missing_skills: [{ type: String }],
    decision: { type: String, enum: ['Shortlist', 'Reject'], required: true },
    reason: { type: String, required: true },
  },
  { _id: false }
);

const scoresSchema = new mongoose.Schema(
  {
    code_quality: { type: Number, min: 0, max: 100, required: true },
    maintainability: { type: Number, min: 0, max: 100, required: true },
    activity: { type: Number, min: 0, max: 100, required: true },
    overall: { type: Number, min: 0, max: 100, required: true },
  },
  { _id: false }
);

const auditFindingSchema = new mongoose.Schema(
  {
    title: { type: String, default: 'insufficient data' },
    severity: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Low',
    },
    category: { type: String, default: 'General' },
    evidence: { type: String, default: 'insufficient data' },
    impact: { type: String, default: 'insufficient data' },
    recommendation: { type: String, default: 'insufficient data' },
  },
  { _id: false }
);

const positiveFindingSchema = new mongoose.Schema(
  {
    title: { type: String, default: 'insufficient data' },
    evidence: { type: String, default: 'insufficient data' },
    impact: { type: String, default: 'insufficient data' },
  },
  { _id: false }
);

const improvementTaskSchema = new mongoose.Schema(
  {
    priority: {
      type: String,
      enum: ['P0', 'P1', 'P2', 'P3'],
      default: 'P2',
    },
    task: { type: String, default: 'insufficient data' },
    why: { type: String, default: 'insufficient data' },
  },
  { _id: false }
);

const analysisSchema = new mongoose.Schema(
  {
    repo_url: { type: String, required: true },
    repo_name: { type: String, required: true },
    tech_stack: {
      frontend: { type: String, default: 'insufficient data' },
      backend: { type: String, default: 'insufficient data' },
      database: { type: String, default: 'insufficient data' },
      other: [{ type: String }],
    },
    architecture: { type: String, required: true },
    code_quality: {
      score: { type: Number, min: 0, max: 10, required: true },
      reason: { type: String, required: true },
    },
    activity: { type: String, required: true },
    risks: [riskSchema],
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    detailed_findings: [auditFindingSchema],
    vulnerabilities: [auditFindingSchema],
    positive_findings: [positiveFindingSchema],
    improvement_plan: [improvementTaskSchema],
    recruiter_decision: { type: String, required: true },
    recruiter_evaluation: recruiterSchema,
    scores: scoresSchema,
    ai_used: { type: Boolean, default: true },
    source: { type: String, enum: ['gemini', 'fallback'], default: 'gemini' },
    reason: { type: String, default: null },
    provider: { type: String, default: 'gemini' },
    model: { type: String, default: null },
  },
  { timestamps: true }
);

// Index for fast search by name and date
analysisSchema.index({ repo_name: 'text' });
analysisSchema.index({ createdAt: -1 });

export default mongoose.model('Analysis', analysisSchema);
