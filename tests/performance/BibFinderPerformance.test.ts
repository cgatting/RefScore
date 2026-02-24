
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BibTexParser } from '../../src/services/parsers/BibTexParser';
import { LatexParser } from '../../src/services/parsers/LatexParser';

// --- Helper Functions for Generating Content ---

function generateRandomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateBibEntry(id: string): string {
  const types = ['article', 'book', 'inproceedings', 'phdthesis'];
  const type = types[Math.floor(Math.random() * types.length)];
  return `@${type}{${id},
  author = {${generateRandomString(15)} and ${generateRandomString(15)}},
  title = {${generateRandomString(50)}},
  journal = {${generateRandomString(30)}},
  year = {20${Math.floor(Math.random() * 24)}},
  abstract = {${generateRandomString(200)}},
  doi = {10.${Math.floor(Math.random() * 10000)}/${generateRandomString(10)}}
}`;
}

function generateBibFile(count: number): { content: string, ids: string[] } {
  const ids: string[] = [];
  let content = '';
  for (let i = 0; i < count; i++) {
    const id = `ref_${i}`;
    ids.push(id);
    content += generateBibEntry(id) + '\n\n';
  }
  return { content, ids };
}

function generateLatexContent(wordCount: number, citations: string[]): string {
  let content = '';
  const sentencesPerPara = 5;
  const wordsPerSentence = 20;
  
  const numSentences = Math.ceil(wordCount / wordsPerSentence);
  
  for (let i = 0; i < numSentences; i++) {
    content += generateRandomString(wordsPerSentence * 5); // Approximate words
    
    // Add citation randomly
    if (citations.length > 0 && Math.random() > 0.7) {
      const numCites = Math.floor(Math.random() * 3) + 1;
      const keys: string[] = [];
      for (let j = 0; j < numCites; j++) {
        keys.push(citations[Math.floor(Math.random() * citations.length)]);
      }
      content += ` \\cite{${keys.join(', ')}}`;
    }
    
    content += '. ';
    
    if ((i + 1) % sentencesPerPara === 0) {
      content += '\n\n';
    }
  }
  
  return content;
}

// --- Test Suite ---

describe('Performance Benchmarks', () => {
  const bibParser = new BibTexParser();
  const latexParser = new LatexParser();

  const sourceCounts = [1, 50, 100, 250, 500, 1000];
  
  // Approximate word counts for different paper types
  const paperTypes = [
    { name: 'Abstract', words: 200 },
    { name: 'Short Paper', words: 2000 },
    { name: 'Full Paper', words: 6000 },
    { name: 'Review', words: 12000 },
    { name: 'Thesis', words: 30000 },
  ];

  it('runs performance tests', async () => {
    const results: any[] = [];
    const iterations = 20;

    console.log(`\nStarting Performance Tests (${iterations} iterations per scenario)...\n`);

    // Warmup
    {
      const { content, ids } = generateBibFile(100);
      const tex = generateLatexContent(1000, ids);
      for(let i=0; i<10; i++) {
        bibParser.parse(content);
        latexParser.extractCitations(tex);
        latexParser.parse(tex);
      }
    }

    for (const paper of paperTypes) {
      for (const count of sourceCounts) {
        let totalBibTime = 0;
        let totalExtractTime = 0;
        let totalParseTime = 0;

        for (let i = 0; i < iterations; i++) {
          // 1. Generate Data (included in measurement? No, we want algorithm speed)
          // Actually, generating data might take time, so let's pre-generate if possible.
          // But random data prevents caching optimizations (unlikely here but good practice).
          // For stability, let's generate ONCE per scenario to measure the same content processing.
          const { content: bibContent, ids } = generateBibFile(count);
          const texContent = generateLatexContent(paper.words, ids);

          // 2. Measure BibTex Parsing
          const startBib = performance.now();
          bibParser.parse(bibContent);
          const endBib = performance.now();
          totalBibTime += (endBib - startBib);

          // 3. Measure Latex Citation Extraction
          const startExtract = performance.now();
          latexParser.extractCitations(texContent);
          const endExtract = performance.now();
          totalExtractTime += (endExtract - startExtract);

          // 4. Measure Latex Full Parsing (Sentence Splitting)
          const startParse = performance.now();
          latexParser.parse(texContent);
          const endParse = performance.now();
          totalParseTime += (endParse - startParse);
        }

        results.push({
          PaperType: paper.name,
          WordCount: paper.words,
          SourceCount: count,
          BibParseTimeMs: (totalBibTime / iterations).toFixed(3),
          ExtractTimeMs: (totalExtractTime / iterations).toFixed(3),
          LatexParseTimeMs: (totalParseTime / iterations).toFixed(3),
          TotalTimeMs: ((totalBibTime + totalExtractTime + totalParseTime) / iterations).toFixed(3)
        });
      }
    }

    // Print Results Table
    console.table(results);
    
    // Also log in Markdown format for easier reading in the chat
    console.log('\n### Performance Results Table\n');
    console.log('| Paper Type | Word Count | Source Count | Bib Parse (ms) | Extract Citations (ms) | Latex Parse (ms) | Total (ms) |');
    console.log('|---|---|---|---|---|---|---|');
    results.forEach(r => {
      console.log(`| ${r.PaperType} | ${r.WordCount} | ${r.SourceCount} | ${r.BibParseTimeMs} | ${r.ExtractTimeMs} | ${r.LatexParseTimeMs} | ${r.TotalTimeMs} |`);
    });

    const outDir = path.join(process.cwd(), 'artifacts', 'performance');
    fs.mkdirSync(outDir, { recursive: true });
    const jsonPath = path.join(outDir, 'results.json');
    const csvPath = path.join(outDir, 'results.csv');
    const htmlPath = path.join(outDir, 'results.html');

    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8');

    const header = ['PaperType','WordCount','SourceCount','BibParseTimeMs','ExtractTimeMs','LatexParseTimeMs','TotalTimeMs'];
    const toCsvVal = (v: any) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      header.join(','),
      ...results.map(r => header.map(h => toCsvVal((r as any)[h])).join(','))
    ].join('\n');
    fs.writeFileSync(csvPath, csv, 'utf-8');

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RefScore Performance Results</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: ui-sans-serif, system-ui, Segoe UI, Arial, sans-serif; margin: 24px; color: #111; }
    h1 { margin: 0 0 8px; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
    .row { display: grid; grid-template-columns: 1fr; gap: 16px; }
    @media (min-width: 1000px) {
      .row { grid-template-columns: 1fr 1fr; }
    }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { padding: 6px 8px; border: 1px solid #e5e7eb; text-align: right; }
    th:first-child, td:first-child { text-align: left; }
    .controls { display: flex; align-items: center; gap: 12px; }
    .muted { color: #6b7280; font-size: 12px; }
    .btn { padding: 6px 10px; border: 1px solid #d1d5db; background: #f9fafb; border-radius: 6px; cursor: pointer; }
    .btn:hover { background: #f3f4f6; }
    canvas { background: #fff; }
  </style>
</head>
<body>
  <h1>RefScore Performance Results</h1>
  <div class="muted">Generated from tests/performance/BibFinderPerformance.test.ts</div>
  <div class="grid">
    <div class="row">
      <div class="card">
        <div class="controls">
          <div><strong>Total Time vs Source Count</strong></div>
          <button id="dl-line" class="btn">Download PNG</button>
        </div>
        <canvas id="lineChart" height="280"></canvas>
      </div>
      <div class="card">
        <div class="controls">
          <div><strong>Time Breakdown by Paper Type</strong></div>
          <label>
            Source Count:
            <select id="countSelect"></select>
          </label>
          <button id="dl-bar" class="btn">Download PNG</button>
        </div>
        <canvas id="barChart" height="280"></canvas>
      </div>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div><strong>Detailed Results</strong></div>
        <div>
          <a class="btn" href="./results.csv" download>Download CSV</a>
          <a class="btn" href="./results.json" download>Download JSON</a>
        </div>
      </div>
      <div id="tableWrap"></div>
    </div>
  </div>
  <script>
    const RESULTS = ${JSON.stringify(results)};
    const counts = Array.from(new Set(RESULTS.map(r => r.SourceCount))).sort((a,b)=>a-b);
    const paperTypes = Array.from(new Set(RESULTS.map(r => r.PaperType)));

    const colorPool = [
      '#2563eb','#16a34a','#dc2626','#ca8a04','#7c3aed','#0ea5e9','#f97316'
    ];
    const colorFor = (i) => colorPool[i % colorPool.length];

    const totalsByType = paperTypes.map((pt, idx) => ({
      label: pt,
      borderColor: colorFor(idx),
      backgroundColor: colorFor(idx) + '55',
      tension: 0.2,
      data: counts.map(c => {
        const rec = RESULTS.find(r => r.PaperType === pt && r.SourceCount === c);
        return rec ? Number(rec.TotalTimeMs) : 0;
      })
    }));

    const lineCtx = document.getElementById('lineChart').getContext('2d');
    const lineChart = new Chart(lineCtx, {
      type: 'line',
      data: {
        labels: counts,
        datasets: totalsByType
      },
      options: {
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { mode: 'nearest', intersect: false }
        },
        scales: {
          x: { title: { display: true, text: 'Source Count' } },
          y: { title: { display: true, text: 'Total Time (ms)' }, beginAtZero: true }
        }
      }
    });

    const select = document.getElementById('countSelect');
    counts.forEach(c => {
      const opt = document.createElement('option');
      opt.value = String(c);
      opt.textContent = String(c);
      select.appendChild(opt);
    });
    select.value = String(counts[counts.length - 1]);

    const mkBreakdownDatasets = (sourceCount) => {
      const cat = ['BibParseTimeMs','ExtractTimeMs','LatexParseTimeMs'];
      return cat.map((k, i) => ({
        label: k.replace('TimeMs',''),
        backgroundColor: colorFor(i),
        data: paperTypes.map(pt => {
          const rec = RESULTS.find(r => r.PaperType === pt && r.SourceCount === sourceCount);
          return rec ? Number(rec[k]) : 0;
        })
      }));
    };

    const barCtx = document.getElementById('barChart').getContext('2d');
    let barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: paperTypes,
        datasets: mkBreakdownDatasets(Number(select.value))
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Time (ms)' } }
        }
      }
    });

    select.addEventListener('change', () => {
      barChart.data.datasets = mkBreakdownDatasets(Number(select.value));
      barChart.update();
    });

    document.getElementById('dl-line').addEventListener('click', () => {
      const url = lineChart.toBase64Image('image/png', 1);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'refscore_line_chart.png';
      a.click();
    });
    document.getElementById('dl-bar').addEventListener('click', () => {
      const url = barChart.toBase64Image('image/png', 1);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'refscore_breakdown_chart.png';
      a.click();
    });

    const wrap = document.getElementById('tableWrap');
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    const cols = ['PaperType','WordCount','SourceCount','BibParseTimeMs','ExtractTimeMs','LatexParseTimeMs','TotalTimeMs'];
    const trh = document.createElement('tr');
    cols.forEach(c => { const th = document.createElement('th'); th.textContent = c; trh.appendChild(th); });
    thead.appendChild(trh);
    RESULTS.forEach(r => {
      const tr = document.createElement('tr');
      cols.forEach(c => { const td = document.createElement('td'); td.textContent = r[c]; tr.appendChild(td); });
      tbody.appendChild(tr);
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    wrap.appendChild(table);
  </script>
</body>
</html>`;
    fs.writeFileSync(htmlPath, html, 'utf-8');

    // Basic assertions to ensure things are working
    expect(results.length).toBe(paperTypes.length * sourceCounts.length);
  }, 60000); // 60s timeout
});
