/**
 * review-pr.mjs
 *
 * Runs on every push. If CIRCLE_PR_NUMBER is not set (not a PR build), exits
 * silently. Otherwise:
 *   1. Gets the diff of this branch vs main
 *   2. Sends it to Claude for a code review
 *   3. Posts the review as a GitHub PR comment
 *      (replaces any previous bot comment to keep the PR clean)
 *
 * Required env vars (set in CircleCI project settings):
 *   ANTHROPIC_API_KEY   — Anthropic API key
 *   GITHUB_TOKEN        — GitHub personal access token with repo scope
 *
 * Injected automatically by CircleCI:
 *   CIRCLE_PR_NUMBER, CIRCLE_PROJECT_USERNAME, CIRCLE_PROJECT_REPONAME,
 *   CIRCLE_BRANCH
 */

import { execSync } from 'child_process';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const GITHUB_API    = 'https://api.github.com';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;
const PR_NUMBER     = process.env.CIRCLE_PR_NUMBER;
const REPO_OWNER    = process.env.CIRCLE_PROJECT_USERNAME;
const REPO_NAME     = process.env.CIRCLE_PROJECT_REPONAME;
const BRANCH        = process.env.CIRCLE_BRANCH ?? 'unknown';

const BOT_MARKER = '<!-- claude-review -->';
const MAX_DIFF_CHARS = 12_000; // ~3k tokens — enough for a focused review

// ---------------------------------------------------------------------------
// Git diff
// ---------------------------------------------------------------------------

function getDiff() {
  try {
    execSync('git fetch origin main --depth=1', { stdio: 'pipe' });
    return execSync(
      'git diff origin/main...HEAD -- "*.ts" "*.tsx" "*.mjs"',
      { stdio: 'pipe', maxBuffer: 2 * 1024 * 1024 },
    ).toString();
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Claude review
// ---------------------------------------------------------------------------

async function reviewWithClaude(diff) {
  const truncated = diff.length > MAX_DIFF_CHARS
    ? diff.slice(0, MAX_DIFF_CHARS) + '\n\n[diff truncated — showing first 12 000 chars]'
    : diff;

  const prompt = `You are a senior TypeScript/React engineer reviewing a pull request.

Branch: ${BRANCH}

\`\`\`diff
${truncated}
\`\`\`

Write a concise PR review in markdown with these sections:

## Summary
What does this PR do?

## Issues
Bugs, type errors, or logic problems. If none, say "None found."

## Patterns
React or TypeScript anti-patterns, or improvements worth noting.

## Security
Anything that could be a security concern. If none, say "None found."

## Verdict
One of: ✅ Approve / 🔄 Request Changes / 💬 Comment — with one sentence of justification.

Be direct. Reference specific function names or line context where relevant.
If the diff is empty or trivial, say so briefly.`;

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API → ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.content[0].text;
}

// ---------------------------------------------------------------------------
// GitHub comment (replace previous bot comment if present)
// ---------------------------------------------------------------------------

async function githubFetch(path, method = 'GET', body = undefined) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`GitHub ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

async function postReviewComment(review) {
  const commentsPath = `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${PR_NUMBER}/comments`;

  // Delete any previous bot comment to avoid clutter
  const comments = await githubFetch(commentsPath);
  if (Array.isArray(comments)) {
    const previous = comments.find((c) => c.body?.startsWith(BOT_MARKER));
    if (previous) {
      await githubFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/issues/comments/${previous.id}`, 'DELETE');
      console.log('Deleted previous bot review comment.');
    }
  }

  // Post fresh comment
  await githubFetch(commentsPath, 'POST', {
    body: `${BOT_MARKER}\n🤖 **Claude Code Review** — \`${BRANCH}\`\n\n${review}`,
  });

  console.log(`Posted review to PR #${PR_NUMBER}`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }

  if (!PR_NUMBER) {
    console.log('Not a PR build (CIRCLE_PR_NUMBER not set) — skipping review.');
    process.exit(0);
  }

  if (!GITHUB_TOKEN) { console.error('Missing GITHUB_TOKEN'); process.exit(1); }

  console.log(`Reviewing PR #${PR_NUMBER} (${BRANCH})...`);

  const diff = getDiff();
  if (!diff.trim()) {
    console.log('No TypeScript/React changes in this PR — skipping review.');
    process.exit(0);
  }

  console.log(`Diff: ${diff.length} chars → sending to Claude...`);
  const review = await reviewWithClaude(diff);

  console.log('\n' + review + '\n');
  await postReviewComment(review);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
