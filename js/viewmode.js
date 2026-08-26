// view-mode toggle

import { $ } from './util.js';
import { install_retro, remove_retro } from './retro.js';
import { install_VHS, remove_VHS } from './vhs.js';
import { install_popups, remove_popups } from './popup.js';

// cycle order
const MODES = ['modern', 
                'vhs', 
                'popup', 
                'retro'];

// button label = NEXT mode
const LABELS = {
  modern: 'Switch Mode',
  vhs: 'Switch Mode',
  popup: 'Switch Mode',
  retro: 'Switch Mode',
};


const STORAGE_KEY = 'viewMode';

// landing-page odds for a visitor who has never clicked the toggle
const LANDING_WEIGHTS = {
  modern: 0.9,
  vhs: 0.10,
  retro: 0.0,
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

// stored value wins else roll the dice
function normalize_mode(raw) {
  if (MODES.includes(raw)) return raw;
  return pick_landing_mode();
}

export function wire_view_mode(data) {

  // Get the button
  const btn = $('#viewmode-toggle');
  if (!btn) return;

  // read mode from localStorage, default to modern
  let mode = normalize_mode(localStorage.getItem(STORAGE_KEY));

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

    // Update button to next mode in cycle
    btn.textContent = LABELS[next];
    mode = next;
  };

  // run the apply function
  apply(mode);

  // on click, cycle to next mode in list, store in localStorage, and apply
  btn.addEventListener('click', () => {
    const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    localStorage.setItem(STORAGE_KEY, next);
    apply(next);
  });

  // Esc inside vhs/popup drops back to modern
  document.body.addEventListener('vhs-exit', () => {
    localStorage.setItem(STORAGE_KEY, 'modern');
    apply('modern');
  });
}
