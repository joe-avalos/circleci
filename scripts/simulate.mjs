/**
 * simulate.mjs — generates a realistic burst of pipeline activity so you
 * get rich, queryable data in Honeycomb.
 *
 * Run:  npm run simulate
 *       (or directly: node scripts/simulate.mjs)
 *
 * Interesting things to look at in Honeycomb after running:
 *   • Heatmap of POST /api/runs latency by branch
 *   • BREAKDOWN BY branch → COUNT — which branches are busiest?
 *   • WHERE status=failed BREAKDOWN BY name → which jobs fail most?
 *   • Trace waterfall for a single run: create → running → success/failed
 *   • P95 latency of PATCH /api/runs/:id/status over time
 */

const API = process.env.API_URL ?? 'http://localhost:3001/api';

// ---------------------------------------------------------------------------
// Scenarios — each represents a type of pipeline job across various branches.
// "behavior" controls the outcome; "runningMs" controls how long it stays in
// the running state, giving you variance in latency distributions.
// ---------------------------------------------------------------------------
const SCENARIOS = [
  // Main branch — healthy, mostly fast
  { name: 'lint',            branch: 'main',                    behavior: 'success', runningMs: 400  },
  { name: 'unit-tests',      branch: 'main',                    behavior: 'success', runningMs: 900  },
  { name: 'build',           branch: 'main',                    behavior: 'success', runningMs: 1200 },
  { name: 'deploy-staging',  branch: 'main',                    behavior: 'success', runningMs: 3500 },
  { name: 'deploy-prod',     branch: 'main',                    behavior: 'success', runningMs: 5000 },

  // Feature branches — mixed outcomes, slower tests
  { name: 'lint',            branch: 'feature/auth-refactor',   behavior: 'success', runningMs: 500  },
  { name: 'unit-tests',      branch: 'feature/auth-refactor',   behavior: 'flaky',   runningMs: 1400 },
  { name: 'e2e-tests',       branch: 'feature/auth-refactor',   behavior: 'fail',    runningMs: 4200 },
  { name: 'unit-tests',      branch: 'feature/dashboard-v2',    behavior: 'success', runningMs: 800  },
  { name: 'build',           branch: 'feature/dashboard-v2',    behavior: 'flaky',   runningMs: 1100 },
  { name: 'unit-tests',      branch: 'feature/perf-overhaul',   behavior: 'success', runningMs: 1600 },
  { name: 'e2e-tests',       branch: 'feature/perf-overhaul',   behavior: 'flaky',   runningMs: 5500 },

  // Hotfixes — urgent, fast, must succeed
  { name: 'build',           branch: 'hotfix/login-500',        behavior: 'success', runningMs: 600  },
  { name: 'unit-tests',      branch: 'hotfix/login-500',        behavior: 'success', runningMs: 700  },
  { name: 'deploy-prod',     branch: 'hotfix/login-500',        behavior: 'success', runningMs: 2800 },

  // Dependabot — often fine, occasionally breaks something
  { name: 'unit-tests',      branch: 'dependabot/npm/react-19', behavior: 'flaky',   runningMs: 1000 },
  { name: 'build',           branch: 'dependabot/npm/react-19', behavior: 'success', runningMs: 1300 },

  // Chore / release branches
  { name: 'build',           branch: 'release/v2.4.0',          behavior: 'success', runningMs: 1500 },
  { name: 'e2e-tests',       branch: 'release/v2.4.0',          behavior: 'flaky',   runningMs: 6000 },
  { name: 'deploy-prod',     branch: 'release/v2.4.0',          behavior: 'slow',    runningMs: 8000 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Returns the final status for a scenario, injecting randomness for 'flaky'. */
function finalStatus(behavior) {
  if (behavior === 'fail') return 'failed';
  if (behavior === 'flaky') return Math.random() < 0.45 ? 'failed' : 'success';
  return 'success'; // 'success' and 'slow'
}

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json();
}

async function patch(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Core simulation
// ---------------------------------------------------------------------------

async function runScenario(scenario) {
  const tag = `${scenario.branch}  ${scenario.name}`.padEnd(52);
  const t0 = Date.now();

  try {
    // 1. Create
    const run = await post('/runs', { name: scenario.name, branch: scenario.branch });

    // 2. Short pause in "queued" (realistic queue wait)
    await sleep(150 + Math.random() * 350);

    // 3. Start running
    await patch(`/runs/${run.id}/status`, { status: 'running' });

    // 4. Simulate work duration (jitter ±20%)
    const jitter = (Math.random() * 0.4 - 0.2) * scenario.runningMs;
    await sleep(scenario.runningMs + jitter);

    // 5. Resolve
    const outcome = finalStatus(scenario.behavior);
    await patch(`/runs/${run.id}/status`, { status: outcome });

    const durationMs = Date.now() - t0;
    const icon = outcome === 'success' ? '✓' : '✗';
    console.log(`  ${icon}  ${tag}  ${outcome}  (${durationMs}ms)`);

    return { name: scenario.name, branch: scenario.branch, behavior: scenario.behavior, outcome, durationMs };
  } catch (err) {
    console.log(`  !  ${tag}  ERROR: ${err.message}`);
    return { name: scenario.name, branch: scenario.branch, behavior: scenario.behavior, outcome: 'error', durationMs: Date.now() - t0, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n  Pipeline Run Simulator\n');
  console.log(`  Target : ${API}`);
  console.log(`  Runs   : ${SCENARIOS.length} concurrent scenarios\n`);

  // Verify the API is reachable before starting
  try {
    const res = await fetch(`${API}/runs`);
    if (!res.ok) throw new Error(res.status);
  } catch {
    console.error('  API is not reachable. Start it first:\n');
    console.error('    npm run dev --workspace=apps/api\n');
    process.exit(1);
  }

  console.log(`  ${'branch  job'.padEnd(52)}  outcome`);
  console.log(`  ${'-'.repeat(62)}`);

  const t0 = Date.now();

  // Fire all scenarios in parallel — this is the interesting part for Honeycomb:
  // concurrent spans in the same trace window, competing for SQLite writes.
  const settled = await Promise.allSettled(SCENARIOS.map(runScenario));
  const results = settled.map((r) => r.value).filter(Boolean);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n  ${'-'.repeat(62)}`);
  console.log(`  Finished in ${elapsed}s\n`);

  // Write results for the analyze-traces job to consume
  const { writeFileSync } = await import('fs');
  const summary = {
    completedAt: new Date().toISOString(),
    totalScenarios: SCENARIOS.length,
    elapsedMs: Date.now() - t0,
    results,
  };
  writeFileSync('simulation-results.json', JSON.stringify(summary, null, 2));
  console.log('  Written simulation-results.json for downstream analysis.\n');
}

main();
