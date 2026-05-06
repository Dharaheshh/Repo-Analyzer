/**
 * Parses a GitHub URL and returns { owner, repo }
 * Handles formats:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo.git
 *   https://github.com/owner/repo/tree/main
 *   github.com/owner/repo
 *   owner/repo (shorthand)
 */
export function parseGithubUrl(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid input: expected a non-empty string');
  }

  const cleaned = input.trim().replace(/\.git$/, '').replace(/\/$/, '');

  // Full URL format
  const urlMatch = cleaned.match(
    /(?:https?:\/\/)?github\.com\/([^/]+)\/([^/]+)/
  );
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }

  // Shorthand: owner/repo
  const shortMatch = cleaned.match(/^([^/]+)\/([^/]+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] };
  }

  throw new Error(
    'Could not parse GitHub URL. Use format: https://github.com/owner/repo'
  );
}
