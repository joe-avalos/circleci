/**
 * analyze-traces.mjs
 *
 * Runs after the simulate job in CircleCI:
 *   1. Queries Honeycomb for all spans tagged with this workflow's ID
 *   2. Sends the aggregated results to Claude for analysis
 *   3. Writes analysis.md — stored as a CircleCI artifact
 *
 * Required env vars (set in CircleCI project settings):
 *   HONEYCOMB_API_KEY   — Honeycomb ingest / API key
 *   ANTHROPIC_API_KEY   — Anthropic API key
 *   CIRCLE_WORKFLOW_ID  — injected automatically by CircleCI
 *   CIRCLE_BUILD_NUM    — injected automatically by CircleCI
 *   CIRCLE_BRANCH       — injected automatically by CircleCI
 */

import { writeFileSync } from 'fs';

const HONEYCOMB_ROOT = 'https://api.honeycomb.io';
const ANTHROPIC_API  = 'https://api.anthropic.com/v1/messages';
const DATASET        = 'circleci-api';

const HONEYCOMB_KEY  = process.env.HONEYCOMB_API_KEY;
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
const WORKFLOW_ID    = process.env.CIRCLE_WORKFLOW_ID;
const BUILD_NUM      = process.env.CIRCLE_BUILD_NUM;
const BRANCH         = process.env.CIRCLE_BRANCH ?? 'unknown';

// ---------------------------------------------------------------------------
// Honeycomb Query API (3-step: create → run → poll)
// ---------------------------------------------------------------------------

async function honeycombFetch(path, method = 'GET', body = undefined) {
  const res = await fetch(`${HONEYCOMB_ROOT}${path}`, {
    method,
    headers: {
      'X-Honeycomb-Team': HONEYCOMB_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Honeycomb ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function queryHoneycomb() {
  // 1. Create the query
  const { id: queryId } = await honeycombFetch(`/1/queries/${DATASET}`, 'POST', {
    calculations: [
      { op: 'COUNT' },
      { op: 'P95',  column: 'duration_ms' },
      { op: 'MAX',  column: 'duration_ms' },
      { op: 'AVG',  column: 'duration_ms' },
    ],
    filters: [
      { column: 'circleci.workflow_id', op: '=', value: WORKFLOW_ID },
    ],
    breakdowns: ['http.method', 'http.target', 'http.status_code'],
    time_range: 3600,
    limit: 100,
  });

  // 2. Run the query
  const { id: resultId } = await honeycombFetch(`/1/query_results/${DATASET}`, 'POST', {
    query_id: queryId,
    disable_series: false,
    limit: 100,
  });

  // 3. Poll until complete (max 30s)
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const result = await honeycombFetch(`/1/query_results/${DATASET}/${resultId}`);
    if (result.complete) return result.data?.results ?? [];
  }

  throw new Error('Honeycomb query timed out after 30s');
}

// ---------------------------------------------------------------------------
// Claude analysis
// ---------------------------------------------------------------------------

async function analyzeWithClaude(results) {
  const prompt = `You are an observability engineer reviewing CI pipeline traces.

Context:
- Service: circleci-api (NestJS Pipeline Run Simulator)
- Branch: ${BRANCH}
- CircleCI build: ${BUILD_NUM}
- Workflow: ${WORKFLOW_ID}

The data below is aggregated from Honeycomb. Each row is a unique combination
of HTTP method, target endpoint, and status code. Metrics are COUNT, P95/MAX/AVG
of duration_ms.

${JSON.stringify(results, null, 2)}

Write a concise analysis in markdown with these sections:
## Summary
2-3 sentences on what the simulation did.

## Performance
Call out any latency outliers. Flag P95 > 3000ms as slow.

## Error Rate
Non-2xx responses, failed status transitions, anything unexpected.

## Notable Patterns
Anything interesting about the request distribution.

## Recommendation
One concrete, actionable suggestion based on this data.`;

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
  if (!HONEYCOMB_KEY) { console.error('Missing HONEYCOMB_API_KEY'); process.exit(1); }
  if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }
  if (!WORKFLOW_ID)   { console.error('Missing CIRCLE_WORKFLOW_ID'); process.exit(1); }

  console.log(`Querying Honeycomb for workflow ${WORKFLOW_ID}...`);
  const results = await queryHoneycomb();

  if (results.length === 0) {
    console.log('No spans found for this workflow. Check that HONEYCOMB_API_KEY is correct and traces have been exported.');
    process.exit(0);
  }

  console.log(`Got ${results.length} result rows. Sending to Claude...`);
  const analysis = await analyzeWithClaude(results);

  const markdown = `# Trace Analysis — Build #${BUILD_NUM}

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
