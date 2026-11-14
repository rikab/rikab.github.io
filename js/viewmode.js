import { install_retro } from './retro.js';
import { install_VHS } from './vhs.js';
import { install_popups } from './popup.js';

// mode number is the index in this list
const MODES = ['modern', 'vhs', 'retro', 'popup', 'html'];

// random landing modes when the URL has no ?mode=
const LANDING_POOL = ['modern', 'modern', 'modern', 'vhs', 'retro', 'html'];

// modes excluded from the browser window in popup mode
const POPUP_INNER_EXCLUDE = ['vhs', 'popup'];

// ?mode=N wins, else roll the dice
function pick_mode() {

  const n = new URLSearchParams(location.search).get('mode');
  const random = LANDING_POOL[Math.floor(Math.random() * LANDING_POOL.length)];
  return (n !== null && MODES[Number(n)]) || random;
}

// set up the page for the chosen mode and return its name
export function wire_view_mode(data) {

  // plain html page from scripts/build.py
  const mode = pick_mode();
  if (mode === 'html') {
    location.replace('html/');
    return mode;
  }

  // body classes for css selectors (e.g. <body class="retro"> completely overrides to retro mode)
  document.body.classList.toggle('retro', mode === 'retro');
  document.body.classList.toggle('vhs', mode === 'vhs');
  document.body.classList.toggle('popup', mode === 'popup');

  // install the extra elements for the chosen mode
  if (mode === 'retro') install_retro(data.research_data);
  if (mode === 'vhs') install_VHS(data);
  if (mode === 'popup') {
    const choices = LANDING_POOL.filter((name) => !POPUP_INNER_EXCLUDE.includes(name));
    install_popups(MODES.indexOf(choices[Math.floor(Math.random() * choices.length)]));
  }
  return mode;
}
