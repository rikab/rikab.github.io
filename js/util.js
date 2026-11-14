// querySelector shortcuts
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// html escape
export const escape_HTML = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// date formatting
const format = (iso, options) => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, options);
export const fmt_date = (iso) => format(iso, { month: 'short', day: 'numeric', year: 'numeric' });
export const fmt_month_year = (iso) => format(iso, { month: 'short', year: 'numeric' });

// bold my own name in an authors string
export const render_authors = (s) => escape_HTML(s).replace('Rikab Gambhir', '<span class="self">Rikab Gambhir</span>');
