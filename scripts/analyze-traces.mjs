/**
 * analyze-traces.mjs
 *
 * Runs after the simulate job in CircleCI:
 *   1. Reads simulation-results.json written by simulate.mjs
 *   2. Sends the results to Claude for analysis
 *   3. Writes analysis.md — stored as a CircleCI artifact
 *
 * Required env vars (set in CircleCI project settings):
 *   ANTHROPIC_API_KEY   — Anthropic API key
 *
 * Injected automatically by CircleCI:
 *   CIRCLE_BUILD_NUM, CIRCLE_BRANCH, CIRCLE_WORKFLOW_ID
 */

import { readFileSync, writeFileSync } from 'fs';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const BUILD_NUM     = process.env.CIRCLE_BUILD_NUM  ?? 'local';
const BRANCH        = process.env.CIRCLE_BRANCH     ?? 'unknown';
const WORKFLOW_ID   = process.env.CIRCLE_WORKFLOW_ID ?? 'unknown';

// ---------------------------------------------------------------------------
// Claude analysis
// ---------------------------------------------------------------------------

async function analyzeWithClaude(summary) {
  const { results, elapsedMs, totalScenarios } = summary;

  // Compute derived stats to give Claude richer context
  const succeeded  = results.filter((r) => r.outcome === 'success').length;
  const failed     = results.filter((r) => r.outcome === 'failed').length;
  const errored    = results.filter((r) => r.outcome === 'error').length;
  const durations  = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const p50        = durations[Math.floor(durations.length * 0.5)];
  const p95        = durations[Math.floor(durations.length * 0.95)];
  const slowest    = results.slice().sort((a, b) => b.durationMs - a.durationMs).slice(0, 3);
  const flaky      = results.filter((r) => r.behavior === 'flaky');
  const flakyFails = flaky.filter((r) => r.outcome === 'failed').length;

  const prompt = `You are an observability engineer reviewing a CI pipeline simulation run.

Context:
- Branch: ${BRANCH}
- CircleCI build: ${BUILD_NUM}
- Workflow: ${WORKFLOW_ID}
- Total scenarios: ${totalScenarios}
- Wall-clock time: ${(elapsedMs / 1000).toFixed(1)}s
- Outcomes: ${succeeded} succeeded, ${failed} failed, ${errored} errored
- Latency: P50 ${p50}ms, P95 ${p95}ms
- Flaky scenarios: ${flakyFails}/${flaky.length} failed (expected ~45%)
- 3 slowest runs: ${slowest.map((r) => `${r.name} on ${r.branch} (${r.durationMs}ms, ${r.outcome})`).join(' | ')}

Full results:
${JSON.stringify(results, null, 2)}

Write a concise analysis in markdown with these sections:

## Summary
2-3 sentences on what happened overall.

## Performance
Highlight latency outliers. Flag anything with P95 > 5000ms. Compare slow vs fast job types.

## Failures
Which jobs failed, on which branches, and whether it was expected (flaky) or not.

## Patterns
Anything interesting about the distribution — e.g. which branches are most active, which job types are most error-prone.

## Recommendation
One concrete, actionable suggestion.`;

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
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
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }

  let summary;
  try {
    summary = JSON.parse(readFileSync('simulation-results.json', 'utf8'));
  } catch {
    console.error('simulation-results.json not found — did the simulate job run and persist the workspace?');
    process.exit(1);
  }

  console.log(`Analyzing ${summary.totalScenarios} scenarios from build #${BUILD_NUM}...`);

  const analysis = await analyzeWithClaude(summary);

  const markdown = `# Simulation Analysis — Build #${BUILD_NUM}

**Branch:** \`${BRANCH}\`
**Workflow:** \`${WORKFLOW_ID}\`
**Generated:** ${new Date().toISOString()}

---

${analysis}
`;

  writeFileSync('analysis.md', markdown);

  console.log('\n' + analysis);
  console.log('\nWritten to analysis.md (stored as CircleCI artifact)');
}

main().catch((err) => { console.error(err.message); process.exit(1); });
