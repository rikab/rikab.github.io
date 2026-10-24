// view mode, set by ?mode=N in the URL

import { install_retro, remove_retro } from './retro.js';
import { install_VHS, remove_VHS } from './vhs.js';
import { install_popups, remove_popups } from './popup.js';

// mode number is the index in this list
const MODES = ['modern', 'vhs', 'retro', 'popup', 'html'];

// read at module load, before talks.js clears the query string
const URL_MODE = new URLSearchParams(window.location.search).get('mode');

// landing-page odds when the URL has no ?mode=
const LANDING_WEIGHTS = {
  modern: 3,
  vhs: 1,
  retro: 1,
  html: 1,
};

// weighted random pick over LANDING_WEIGHTS, restricted to live MODES
function pick_landing_mode() {

  // sum the weights of modes that are actually enabled
  const entries = MODES.map((m) => [m, LANDING_WEIGHTS[m] || 0]);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return 'modern';

  // walk the cumulative distribution
  let roll = Math.random() * total;
  for (const [name, weight] of entries) {
    roll -= weight;
    if (roll < 0) return name;
  }
  return 'modern';
}

// ?mode=N wins, else roll the dice
function mode_from_url() {

  // accept only a plain index into MODES
  if (URL_MODE !== null && /^\d+$/.test(URL_MODE) && Number(URL_MODE) < MODES.length) return MODES[Number(URL_MODE)];
  return pick_landing_mode();
}

// replace the whole page with html/index.html, built by scripts/html_theme_build.py
function show_html_page() {
  fetch('html/index.html').then((response) => response.text()).then((page) => {
    document.open();
    document.write(page);
    document.close();
  });
}

export function wire_view_mode(data) {

  // drop the mode saved by the old toggle button
  try { localStorage.removeItem('viewMode'); } catch (error) {}

  // tear down others first so body never carries two themes
  const apply = (next) => {

    // Remove all themes
    remove_retro();
    remove_VHS();
    remove_popups();

    // Apply the next theme, and set body classes for css selectors (e.g. <body class="retro"> completely overrides to retro mode)
    document.body.classList.toggle('retro', next === 'retro' || next === 'popup');
    document.body.classList.toggle('vhs', next === 'vhs');
    document.body.classList.toggle('popup', next === 'popup');
    if (next === 'retro') install_retro(data.research_data);
    if (next === 'vhs') install_VHS(data);

    // Special popup mode (TODO: try this for all modes?)
    if (next === 'popup') {
      // popups overlay the retro page
      install_retro(data.research_data);
      install_popups(data);
    }

    // plain page with no css or js
    if (next === 'html') show_html_page();
  };

  // apply the mode from the URL
  apply(mode_from_url());

  // Esc inside vhs/popup drops back to modern
  document.body.addEventListener('vhs-exit', () => apply('modern'));
}
