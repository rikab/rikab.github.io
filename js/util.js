// DOM + formatting helpers

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// htmk escape characters
export const escape_HTML = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// date formatting
export const fmt_date = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const fmt_month_year = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

// bold my own name in an authors string with regex
const SELF = 'Rikab Gambhir';
export function render_authors(s) {
  if (!s) return '';
  const re = new RegExp(`\\b(${SELF.replace(/ /g, '\\s+')})\\b`, 'g');
  return escape_HTML(s).replace(re, '<span class="self">$1</span>');
}
