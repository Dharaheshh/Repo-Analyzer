import { Octokit } from 'octokit';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN || undefined,
});

const SIGNAL_FILE_LIMIT = 14;
const SIGNAL_SNIPPET_LIMIT = 2400;
const SOURCE_SAMPLE_LIMIT = 6;
const SOURCE_SNIPPET_LIMIT = 2200;

const SIGNAL_FILE_NAMES = new Set([
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'requirements.txt',
  'pyproject.toml',
  'pipfile',
  'poetry.lock',
  'go.mod',
  'cargo.toml',
  'composer.json',
  'gemfile',
  'dockerfile',
  'docker-compose.yml',
  'tsconfig.json',
  'vite.config.js',
  'next.config.js',
  'eslint.config.js',
  '.eslintrc',
  '.env.example',
  '.npmrc',
]);

const SOURCE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.py',
  '.go',
  '.java',
  '.rb',
  '.php',
  '.cs',
  '.rs',
]);

function isSignalPath(path) {
  const lower = path.toLowerCase();
  const name = lower.split('/').pop();

  return (
    SIGNAL_FILE_NAMES.has(name) ||
    lower.startsWith('.github/workflows/') ||
    lower.includes('/package.json') ||
    lower.endsWith('.config.js') ||
    lower.endsWith('.config.ts')
  );
}

function isSourcePath(path) {
  const lower = path.toLowerCase();
  const extension = lower.includes('.') ? `.${lower.split('.').pop()}` : '';

  return (
    SOURCE_EXTENSIONS.has(extension) &&
    !lower.includes('node_modules/') &&
    !lower.includes('dist/') &&
    !lower.includes('build/') &&
    !lower.includes('.min.') &&
    !lower.includes('vendor/')
  );
}

function sourcePriority(path) {
  const lower = path.toLowerCase();
  let score = path.split('/').length;

  if (lower.includes('index.') || lower.includes('main.') || lower.includes('app.')) score -= 8;
  if (lower.includes('server') || lower.includes('api') || lower.includes('route')) score -= 6;
  if (lower.includes('auth') || lower.includes('security') || lower.includes('middleware')) score -= 5;
  if (lower.includes('src/') || lower.includes('lib/')) score -= 3;
  if (lower.includes('test') || lower.includes('spec')) score += 3;

  return score;
}

function summarizePackageJson(path, content) {
  try {
    const parsed = JSON.parse(content);
    const dependencies = Object.keys(parsed.dependencies || {});
    const devDependencies = Object.keys(parsed.devDependencies || {});

    return {
      path,
      type: 'package_manifest',
      summary: {
        scripts: parsed.scripts || {},
        engines: parsed.engines || {},
        dependencies: dependencies.slice(0, 40),
        devDependencies: devDependencies.slice(0, 40),
      },
    };
  } catch {
    return {
      path,
      type: 'package_manifest',
      snippet: content.slice(0, SIGNAL_SNIPPET_LIMIT),
    };
  }
}

function summarizeSignalFile(path, content) {
  if (path.toLowerCase().endsWith('package.json')) {
    return summarizePackageJson(path, content);
  }

  return {
    path,
    type: 'config_or_manifest',
    snippet: content.slice(0, SIGNAL_SNIPPET_LIMIT),
  };
}

async function fetchSignalFiles(owner, repo, treeItems) {
  const configCandidates = treeItems
    .filter((item) => item.type === 'blob' && isSignalPath(item.path))
    .sort((a, b) => a.path.length - b.path.length || a.path.localeCompare(b.path))
    .slice(0, SIGNAL_FILE_LIMIT);

  const sourceCandidates = treeItems
    .filter((item) => item.type === 'blob' && isSourcePath(item.path) && !isSignalPath(item.path))
    .sort((a, b) => sourcePriority(a.path) - sourcePriority(b.path) || a.path.localeCompare(b.path))
    .slice(0, SOURCE_SAMPLE_LIMIT);

  const candidates = [...configCandidates, ...sourceCandidates];

  const results = await Promise.allSettled(
    candidates.map(async (item) => {
      const blob = await octokit.rest.git.getBlob({
        owner,
        repo,
        file_sha: item.sha,
      });
      const content = Buffer.from(blob.data.content, 'base64').toString('utf8');
      if (sourceCandidates.some((candidate) => candidate.path === item.path)) {
        return {
          path: item.path,
          type: 'source_sample',
          snippet: content.slice(0, SOURCE_SNIPPET_LIMIT),
        };
      }
      return summarizeSignalFile(item.path, content);
    })
  );

  return results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
}

/**
 * Fetches structured repo data from GitHub API.
 * Returns a normalized object ready to be injected into the Gemini prompt.
 */
export async function fetchRepoData(owner, repo) {
  const [repoRes, langsRes, commitsRes, contribRes, treeRes, closedIssuesRes] =
    await Promise.allSettled([
      octokit.rest.repos.get({ owner, repo }),
      octokit.rest.repos.listLanguages({ owner, repo }),
      octokit.rest.repos.listCommits({
        owner,
        repo,
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        per_page: 100,
      }),
      octokit.rest.repos.listContributors({ owner, repo, per_page: 5 }),
      octokit.rest.git.getTree({ owner, repo, tree_sha: 'HEAD', recursive: '1' }),
      octokit.rest.issues.listForRepo({
        owner,
        repo,
        state: 'closed',
        per_page: 1,
      }),
    ]);

  if (repoRes.status === 'rejected') {
    const status = repoRes.reason?.status;
    if (status === 404) throw new Error('Repository not found. Check the URL.');
    if (status === 403) throw new Error('GitHub rate limit exceeded. Add a GITHUB_TOKEN.');
    throw new Error(`GitHub API error: ${repoRes.reason?.message}`);
  }

  const repoData = repoRes.value.data;
  const treeItems = treeRes.status === 'fulfilled' ? treeRes.value.data.tree : [];

  const languages =
    langsRes.status === 'fulfilled' ? langsRes.value.data : {};

  const recentCommits =
    commitsRes.status === 'fulfilled' ? commitsRes.value.data.length : 0;

  const contributors =
    contribRes.status === 'fulfilled'
      ? contribRes.value.data
          .slice(0, 5)
          .map((c) => `${c.login} (${c.contributions} commits)`)
          .join(', ')
      : 'insufficient data';

  let structure = 'insufficient data';
  if (treeItems.length > 0) {
    const topLevel = treeItems
      .filter((item) => !item.path.includes('/'))
      .map((item) => (item.type === 'tree' ? `${item.path}/` : item.path))
      .slice(0, 20);
    structure = topLevel.join(', ');
  }

  const signalFiles =
    treeItems.length > 0 ? await fetchSignalFiles(owner, repo, treeItems) : [];

  const closedIssues =
    closedIssuesRes.status === 'fulfilled'
      ? (() => {
          const link = closedIssuesRes.value.headers?.link || '';
          const match = link.match(/page=(\d+)>; rel="last"/);
          return match ? parseInt(match[1], 10) : 0;
        })()
      : 0;

  return {
    name: repoData.name,
    description: repoData.description || 'No description provided',
    languages,
    stars: repoData.stargazers_count,
    open_issues: repoData.open_issues_count,
    closed_issues: closedIssues,
    recent_commits: recentCommits,
    contributors,
    structure,
    signals: {
      notable_files: treeItems
        .filter((item) => item.type === 'blob')
        .map((item) => item.path)
        .filter(isSignalPath)
        .slice(0, 30),
      sampled_files: signalFiles,
    },
  };
}
