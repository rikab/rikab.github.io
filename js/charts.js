// charts

import { $ } from './util.js';

 
// helper to convert YYYY-MM month string to a single number 
const month_idx = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return y * 12 + (mo - 1);
};


// choose a nice y axis step size. either 1, 2, 5, or 10 times a power of ten, depending on the max value and target number of ticks
function nice_step(max_val, target_ticks) {
  const raw = max_val / Math.max(1, target_ticks);
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw))));
  const norm = raw / pow;
  const niced = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return Math.max(1, Math.round(niced * pow));
}

// draw a line chart in the given SVG element, with the given data and options
export function draw_line_chart(svg, { x_start, x_end, lines, options = {} }) {
  if (!svg) return;

  // set up dimensions and scales
  const W = options.width ?? 460;
  const H = options.height ?? 240;
  const ML = options.ml ?? 38, MR = options.mr ?? 14;
  const MT = options.mt ?? 14, MB = options.mb ?? 28;
  const inner_w = W - ML - MR, inner_h = H - MT - MB;

  // compute x and y scales based on the data and options
  const x_s = month_idx(x_start), x_e = month_idx(x_end);
  const x_range = Math.max(1, x_e - x_s);
  const x = (m) => ML + inner_w * ((month_idx(m) - x_s) / x_range);

  const y_max = Math.max(1, ...lines.flatMap((l) => l.series.map((p) => p[l.key] || 0)));
  const y = (v) => MT + inner_h - inner_h * (v / y_max);

  // compute nice y axis ticks and year ticks
  const step = nice_step(y_max, 5);
  const y_ticks = [];
  for (let v = 0; v <= y_max + 0.001; v += step) y_ticks.push(v);

  // start and end years for x axis ticks 
  const start_y = parseInt(x_start.slice(0, 4), 10);
  const end_y = parseInt(x_end.slice(0, 4), 10);
  const year_ticks = [];
  for (let yr = start_y; yr <= end_y; yr++) {
    const m = `${yr}-01`;
    if (month_idx(m) >= x_s && month_idx(m) <= x_e) year_ticks.push({ x: x(m), label: yr });
  }
  if (!year_ticks.some((t) => Math.abs(t.x - x(x_start)) < 1)) {
    year_ticks.unshift({ x: x(x_start), label: x_start.slice(0, 4) });
  }

  // whether to show labels (default rtue)
  const show_x_labels = options.x_labels !== false;
  const show_y_labels = options.y_labels !== false;

  // svg element for horizontal grid lines and y axis labels
  const grid = y_ticks.map((v) => `
    <line x1="${ML}" x2="${W-MR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"
          stroke="var(--chart-grid)" stroke-width="1" stroke-dasharray="2,3"/>
    ${show_y_labels ? `<text x="${ML-6}" y="${(y(v)+4).toFixed(1)}" font-size="10"
       fill="var(--chart-text)" font-family="var(--font-mono)" text-anchor="end">${v}</text>` : ''}
  `).join('');

  // svg elements for x axis ticks and labels
  const xticks = year_ticks.map(({ x: xp, label }) => `
    <line x1="${xp.toFixed(1)}" x2="${xp.toFixed(1)}" y1="${MT+inner_h}" y2="${MT+inner_h+4}"
          stroke="var(--chart-grid)"/>
    ${show_x_labels ? `<text x="${xp.toFixed(1)}" y="${H-8}" font-size="10"
       fill="var(--chart-text)" font-family="var(--font-mono)" text-anchor="middle">${label}</text>` : ''}
  `).join('');

  // svg elements for the lines and points, with circles at the last point of each line
  const lines_SVG = lines.map((ln) => {
    if (!ln.series.length) return '';
    const pts = ln.series.map((p) => `${x(p.month).toFixed(1)},${y(p[ln.key]).toFixed(1)}`).join(' ');
    const last = ln.series[ln.series.length - 1];
    return `
      <polyline fill="none" stroke="${ln.color}" stroke-width="2" stroke-linejoin="round" points="${pts}"/>
      <circle cx="${x(last.month).toFixed(1)}" cy="${y(last[ln.key]).toFixed(1)}"
              r="3" fill="${ln.color}" stroke="var(--bg)" stroke-width="1.2"/>
    `;
  }).join('');

  // set the SVG content to the grid, ticks, and lines
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.innerHTML = `
    <line x1="${ML}" x2="${ML}" y1="${MT}" y2="${MT+inner_h}" stroke="var(--chart-axis)"/>
    <line x1="${ML}" x2="${W-MR}" y1="${MT+inner_h}" y2="${MT+inner_h}" stroke="var(--chart-axis)"/>
    ${grid}
    ${xticks}
    ${lines_SVG}
  `;
}

// draw citation and h-index plots for the author stats section
export function draw_author_charts(author_citations, author_h_index, x_start, x_end) {
  
  if (!author_citations?.length) return;
  
  // get the latest citation and h-index values
  const last_cites = author_citations[author_citations.length - 1];
  const last_h = author_h_index[author_h_index.length - 1];

  // headline text with total and excl. self citations and h-index
  const headline_HTML = `
    <span><strong>${last_cites.total}</strong> total citations</span>
    <span class="dot">·</span>
    <span><strong>${last_cites.excl_self}</strong> excl. self</span>
    <span class="dot">·</span>
    <span><strong>h-index ${last_h.h}</strong></span>
  `;
  
  const full = $('#statsHeadline');
  const compact = $('#statsHeadlineCompact');

  // set the HTML 
  if (full) full.innerHTML = headline_HTML;
  if (compact) {
    compact.textContent = `${last_cites.total} cites · h-index ${last_h.h}`;
  }

  // draw the line charts for citations and h-index over time
  draw_line_chart($('#chartCitations'), {
    x_start, x_end,
    lines: [
      { series: author_citations, key: 'total', color: 'var(--accent)', label: 'Total' },
      { series: author_citations, key: 'excl_self', color: 'var(--accent-2)', label: 'Excl. self' },
    ],
  });
  draw_line_chart($('#chartHIndex'), {
    x_start, x_end,
    lines: [{ series: author_h_index, key: 'h', color: 'var(--accent)', label: 'h-index' }],
  });
}

// draw citation plot for each paper
export function draw_paper_charts(research_data, current_month) {

  // loop through papers with citation data and draw a line chart for each one in the corresponding SVG element
  for (const p of research_data) {

    if (p.joke || !p.citations?.length) continue;
    const card = document.getElementById(`paper-${p.id}`);
    const svg = card?.querySelector('.paper-chart');
    
    if (!svg) continue;
    
    draw_line_chart(svg, {
      x_start: p.citation_start,
      x_end: current_month,
      lines: [
        { series: p.citations, key: 'count', color: 'var(--accent)', label: 'Total' },
        { series: p.citations_excl_self, key: 'count', color: 'var(--accent-2)', label: 'Excl. self' },
      ],
      options: { width: 380, height: 160, ml: 28, mr: 8, mt: 8, mb: 22 },
    });
  }
}
