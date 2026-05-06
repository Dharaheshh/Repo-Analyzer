import { Octokit } from 'octokit';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN || undefined,
});

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

  // Languages
  const languages =
    langsRes.status === 'fulfilled' ? langsRes.value.data : {};

  // Recent commits count
  const recentCommits =
    commitsRes.status === 'fulfilled' ? commitsRes.value.data.length : 0;

  // Top contributors
  const contributors =
    contribRes.status === 'fulfilled'
      ? contribRes.value.data
          .slice(0, 5)
          .map((c) => `${c.login} (${c.contributions} commits)`)
          .join(', ')
      : 'insufficient data';

  // Folder structure — top-level files + folders only (keep it short for token efficiency)
  let structure = 'insufficient data';
  if (treeRes.status === 'fulfilled') {
    const topLevel = treeRes.value.data.tree
      .filter((item) => !item.path.includes('/'))
      .map((item) => (item.type === 'tree' ? `${item.path}/` : item.path))
      .slice(0, 20);
    structure = topLevel.join(', ');
  }

  // Closed issues count from Link header (approximate)
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
  };
}
