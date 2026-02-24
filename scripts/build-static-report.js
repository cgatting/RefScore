import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

function readXml(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    return null;
  }
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function parseJUnit(xml) {
  if (!xml) return { tests: 0, failures: 0, errors: 0, skipped: 0, time: 0 };
  const getAttr = (name) => {
    const m = xml.match(new RegExp(`${name}="([^"]+)"`));
    return m ? m[1] : '0';
  };
  return {
    tests: parseInt(getAttr('tests'), 10),
    failures: parseInt(getAttr('failures'), 10),
    errors: parseInt(getAttr('errors'), 10),
    skipped: parseInt(getAttr('skipped'), 10),
    time: parseFloat(getAttr('time'))
  };
}

function generateHtml(e2e, coverage, backend) {
  const css = `
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 2rem; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { margin-bottom: 2rem; border-bottom: 1px solid #334155; padding-bottom: 1rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .card { background: #1e293b; border-radius: 0.5rem; padding: 1.5rem; border: 1px solid #334155; }
    .card h2 { margin-top: 0; font-size: 1.25rem; color: #94a3b8; border-bottom: 1px solid #334155; padding-bottom: 0.5rem; }
    .stat { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
    .stat label { color: #94a3b8; }
    .stat value { font-weight: bold; font-family: monospace; }
    .links { display: flex; gap: 1rem; flex-wrap: wrap; }
    a.btn { display: inline-block; padding: 0.75rem 1.5rem; background: #3b82f6; color: white; text-decoration: none; border-radius: 0.25rem; font-weight: 500; transition: background 0.2s; }
    a.btn:hover { background: #2563eb; }
    .status-pass { color: #4ade80; }
    .status-fail { color: #f87171; }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RefScore Test Report</title>
  <style>${css}</style>
</head>
<body>
  <div class="container">
    <h1>RefScore Comprehensive Test Report</h1>
    
    <div class="grid">
      <div class="card">
        <h2>Frontend Unit Tests</h2>
        ${coverage ? `
          <div class="stat"><label>Statements</label><value>${coverage.statements.pct}%</value></div>
          <div class="stat"><label>Branches</label><value>${coverage.branches.pct}%</value></div>
          <div class="stat"><label>Functions</label><value>${coverage.functions.pct}%</value></div>
          <div class="stat"><label>Lines</label><value>${coverage.lines.pct}%</value></div>
        ` : '<p>No coverage data available</p>'}
      </div>

      <div class="card">
        <h2>Backend Tests</h2>
        <div class="stat"><label>Total Tests</label><value>${backend.tests}</value></div>
        <div class="stat"><label>Failures</label><value class="${backend.failures > 0 ? 'status-fail' : ''}">${backend.failures}</value></div>
        <div class="stat"><label>Errors</label><value class="${backend.errors > 0 ? 'status-fail' : ''}">${backend.errors}</value></div>
        <div class="stat"><label>Time</label><value>${backend.time.toFixed(2)}s</value></div>
      </div>

      <div class="card">
        <h2>E2E Tests</h2>
        <div class="stat"><label>Total Tests</label><value>${e2e.total}</value></div>
        <div class="stat"><label>Passed</label><value class="status-pass">${e2e.passed}</value></div>
        <div class="stat"><label>Failed</label><value class="${e2e.failed > 0 ? 'status-fail' : ''}">${e2e.failed}</value></div>
        <div class="stat"><label>Skipped</label><value>${e2e.skipped}</value></div>
        <div class="stat"><label>Duration</label><value>${(e2e.duration / 1000).toFixed(2)}s</value></div>
      </div>
    </div>

    <h2>Detailed Reports</h2>
    <div class="links">
      <a href="unit-coverage/index.html" class="btn" target="_blank">Frontend Coverage Report</a>
      <a href="backend-report/index.html" class="btn" target="_blank">Backend Test Report</a>
      <a href="e2e-report/index.html" class="btn" target="_blank">E2E Test Report</a>
    </div>
  </div>
</body>
</html>`;
}

function main() {
  const artifactsDir = path.resolve(__dirname, '../artifacts');
  ensureDir(artifactsDir);

  // Read Coverage
  const covPath = path.join(artifactsDir, '../coverage/coverage-summary.json');
  const covData = readJson(covPath);
  const coverage = covData ? covData.total : null;

  // Read Backend
  const junitPath = path.join(artifactsDir, 'backend-junit.xml');
  const backendXml = readXml(junitPath);
  const backend = parseJUnit(backendXml);

  // Read E2E
  const e2ePath = path.join(artifactsDir, 'e2e-report.json');
  const e2eData = readJson(e2ePath);
  let e2e = { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0 };
  
  if (e2eData && e2eData.suites) {
    const processSuite = (suite) => {
      suite.specs.forEach(spec => {
        e2e.total++;
        // Check outcome of the last run
        const result = spec.tests[0].results[0];
        if (result) {
            e2e.duration += result.duration;
            if (result.status === 'passed') e2e.passed++;
            else if (result.status === 'skipped') e2e.skipped++;
            else e2e.failed++;
        }
      });
      if (suite.suites) suite.suites.forEach(processSuite);
    };
    e2eData.suites.forEach(processSuite);
  }

  const html = generateHtml(e2e, coverage, backend);
  fs.writeFileSync(path.join(artifactsDir, 'index.html'), html);
  console.log('Static report generated at artifacts/index.html');
}

main();

