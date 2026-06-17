// popup mode

import { $, $$, escape_HTML, fmt_month_year, render_authors } from './util.js';

// state cleared in remove_popups
let popup_timer = null;
let key_handler = null;
let items = [];
let item_index = 0;
let spawn_count = 0;
let open_popups = new Set();

// scramble state
let scramble_timer = null;
let SCRAMBLED = new WeakMap();
const CORRUPTED = new Set();

// decay state
let popup_mode_started_at = 0;
let decay_level = 0;
let decay_timer = null;
// stuck-forever glitch classes, tracked for teardown
const STUCK_GLITCHES = new Map();

const POP_SELECTORS = ['.pop', '.pop-status-bar', '.pop-tear-strip'];

// zalgo combining marks
const ZALGO = ['́', '̂', '̃', '̄', '̅', '̆', '̇', '̈', '̊', '̋', '̧', '̱'];

// cyrillic lookalikes for latin chars
const CYRILLIC_LOOKALIKES = { a: 'а', e: 'е', o: 'о', c: 'с', p: 'р', x: 'х', y: 'у', A: 'А', E: 'Е', O: 'О', C: 'С', P: 'Р', X: 'Х', Y: 'У', B: 'В', H: 'Н', K: 'К', M: 'М', T: 'Т' };

// popup spawn cadence
const SPAWN_MS = 3500;

// seconds → decay level 1/2/3
const DECAY_THRESHOLDS = [15, 35, 70];
const DECAY_TICK_MS = 2000;

const DIALOG_TITLES = [
  'CONGRATULATIONS!!',
  'BIG NEWS!!',
  'CLAIM YOUR PRIZE!!',
  'SPECIAL OFFER!!',
  'NEW MESSAGE FROM [[ADMIN]]',
  'FREE FOR YOU!!',
  'NOW\'S YOUR CHANCE!!',
];
const ALERT_TITLES = [
  '*** WARNING ***',
  'SECURITY ALERT',
  '*** CRITICAL NOTICE ***',
  'IMPORTANT: PLEASE READ',
  '!!! ACT NOW !!!',
];
const ERROR_TITLES = [
  '[X] CRITICAL ERROR',
  '*** FAULT 0x80004005 ***',
  'APPLICATION ERROR',
  'SYSTEM EXCEPTION',
  '!!! UNHANDLED EXCEPTION !!!',
];
const SWEEPSTAKES_TITLES = [
  'YOU\'VE WON!!',
  '*** TODAY\'S WINNER ***',
  'PRIZE NOTIFICATION!!',
  'YOU ARE ELIGIBLE!!',
];
const DOWNLOAD_TITLES = [
  'DOWNLOAD MANAGER',
  'FILE TRANSFER',
  'TRANSFER IN PROGRESS',
];
const SURVEY_TITLES = [
  'QUICK SURVEY!!',
  '1-QUESTION SWEEPS!!',
  'WIN A FREE PAPER!!',
];
const VIRUS_TITLES = [
  '*** VIRUS SCANNER ***',
  '*** THREAT DETECTED ***',
  '*** SYSTEM SCAN ***',
];
const WIZARD_TITLES = [
  'SETUP WIZARD',
  'INSTALLATION ASSISTANT',
  'CONFIGURATION HELPER',
];

const POPUP_TYPES = ['dialog', 'alert', 'ad', 'error', 'sweepstakes', 'toolbar', 'chat', 'download', 'survey', 'virus', 'wizard', 'balloon'];

// staggered positions
const POSITIONS = [
  { top: '8%',  left: '4%'  },
  { top: '14%', left: '28%' },
  { top: '10%', left: '54%' },
  { top: '32%', left: '8%'  },
  { top: '38%', left: '40%' },
  { top: '26%', left: '70%' },
  { top: '54%', left: '14%' },
  { top: '50%', left: '46%' },
  { top: '60%', left: '70%' },
  { top: '42%', left: '60%' },
];

// CSS filters for paper thumbnails inside popups
const IMG_FILTERS = [
  'hue-rotate(180deg) saturate(2)',
  'invert(1) contrast(1.2)',
  'contrast(2.2) brightness(1.4) saturate(1.6)',
  'blur(1.2px) saturate(3) hue-rotate(60deg)',
  'grayscale(1) contrast(2) brightness(1.1)',
];

// ---- utilities ----

// stable string hash
function hash_str(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

// stable key for hashing dice-rolls per item
function item_key(item) {
  return item.ref.id || item.ref.name || item.ref.title || '';
}

// CTA URL
function primary_link_of(item) {
  const r = item.ref;
  if (item.kind === 'paper') {
    const arxiv = r.links?.find((l) => /arxiv/i.test(l.text));
    if (arxiv) return arxiv.href;
    const inspire = r.links?.find((l) => /inspire/i.test(l.text));
    if (inspire) return inspire.href;
    return r.links?.[0]?.href || '#';
  }
  if (item.kind === 'talk') return r.video || r.slides || '#';
  if (item.kind === 'software') return r.github || r.homepage || '#';
  return '#';
}

// CTA label
function primary_link_text(item) {
  const r = item.ref;
  if (item.kind === 'paper') {
    const arxiv = r.links?.find((l) => /arxiv/i.test(l.text));
    return arxiv ? arxiv.text : (r.links?.[0]?.text || 'CLICK HERE');
  }
  if (item.kind === 'talk') return r.video ? 'STREAM' : (r.slides ? 'SLIDES' : 'CLICK HERE');
  if (item.kind === 'software') return r.github ? 'GITHUB' : (r.homepage ? 'HOMEPAGE' : 'CLICK HERE');
  return 'CLICK HERE';
}

function popup_type_for(item) {
  return POPUP_TYPES[hash_str(item_key(item)) % POPUP_TYPES.length];
}

function title_for(item, type) {
  const key = item_key(item);
  if (type === 'toolbar' || type === 'balloon') return '';
  if (type === 'chat') return 'INSTANT MESSAGE FROM [[ADMIN]]';
  if (type === 'download') return DOWNLOAD_TITLES[hash_str(key) % DOWNLOAD_TITLES.length];
  if (type === 'survey') return SURVEY_TITLES[hash_str(key) % SURVEY_TITLES.length];
  if (type === 'virus') return VIRUS_TITLES[hash_str(key) % VIRUS_TITLES.length];
  if (type === 'wizard') return WIZARD_TITLES[hash_str(key) % WIZARD_TITLES.length];
  if (type === 'alert') return ALERT_TITLES[hash_str(key) % ALERT_TITLES.length];
  if (type === 'error') return ERROR_TITLES[hash_str(key) % ERROR_TITLES.length];
  if (type === 'sweepstakes') return SWEEPSTAKES_TITLES[hash_str(key) % SWEEPSTAKES_TITLES.length];
  return DIALOG_TITLES[hash_str(key) % DIALOG_TITLES.length];
}

function filter_for(item) {
  return IMG_FILTERS[hash_str(item_key(item)) % IMG_FILTERS.length];
}

// 1-in-6 popups get the static overlay
function is_glitched(item) {
  return (hash_str(item_key(item)) % 6) === 0;
}

// ---- flat item list ----

function build_items(research_data, talk_data, software_data) {
  const out = [];
  for (const p of research_data) { if (p.featured && !p.joke) out.push({ kind: 'paper', ref: p }); }
  for (const p of research_data) { if (!p.featured && !p.joke) out.push({ kind: 'paper', ref: p }); }
  for (const t of talk_data) out.push({ kind: 'talk', ref: t });
  for (const s of software_data) out.push({ kind: 'software', ref: s });
  return out;
}

// ---- body fragments ----

// distorted paper thumbnail
function thumb_HTML(item) {
  if (item.kind !== 'paper' || !item.ref.img) return '';
  return `<img class="pop-img" src="${escape_HTML(item.ref.img)}" alt="" loading="lazy" style="filter:${filter_for(item)}">`;
}

// title in the product line
function title_HTML(item) {
  const t = item.ref.title || item.ref.name || '';
  return `<div class="pop-product">"${escape_HTML(t)}"</div>`;
}

// per-kind metadata block
function meta_HTML(item) {
  const r = item.ref;
  if (item.kind === 'paper') {
    const bits = [];
    bits.push(`by ${render_authors(r.authors)}`);
    bits.push(`★ ${escape_HTML(fmt_month_year(r.date))} ★`);
    if (r.status === 'refereed') bits.push('★ [[PEER-REVIEWED]] ★');
    else bits.push('★ [[PRE-RELEASE]] ★');
    if (r.citations_total > 0) bits.push(`[[ ${r.citations_total} CITES!! ]]`);
    return `<div class="pop-meta">${bits.join('<br>')}</div>`;
  }
  if (item.kind === 'talk') {
    const where = r.where ? `at [[${escape_HTML(r.where)}]]` : '';
    return `<div class="pop-meta">${where}<br>★ ${escape_HTML(fmt_month_year(r.date))} ★</div>`;
  }
  if (item.kind === 'software') {
    const blurb = r.blurb ? escape_HTML(r.blurb) : '';
    return `<div class="pop-meta">${blurb}</div>`;
  }
  return '';
}

// install command for software items
function install_HTML(item) {
  if (item.kind !== 'software' || !item.ref.install) return '';
  return `<div class="pop-install"><code>${escape_HTML(item.ref.install)}</code></div>`;
}

function cta_HTML(item) {
  const href = primary_link_of(item);
  const link_text = primary_link_text(item);
  return `<a class="pop-cta" href="${escape_HTML(href)}" target="_blank" rel="noopener">[[ CLICK HERE!! ${escape_HTML(link_text)} ]]</a>`;
}

// ---- per-type body markup ----

function body_for_type(item, type) {
  if (type === 'alert') {
    return `
      <div class="pop-icon">⚠</div>
      <div class="pop-banner">PROBLEM DETECTED!!</div>
      ${title_HTML(item)}
      ${meta_HTML(item)}
      ${install_HTML(item)}
      ${thumb_HTML(item)}
      ${cta_HTML(item)}
    `;
  }
  if (type === 'error') {
    return `
      <div class="pop-icon pop-icon-error">✕</div>
      <div class="pop-error-line">Application could not be opened:</div>
      ${title_HTML(item)}
      <div class="pop-error-line pop-error-faint">Reason: [[insufficient_citations]]</div>
      ${meta_HTML(item)}
      ${cta_HTML(item)}
    `;
  }
  if (type === 'ad') {
    return `
      <div class="pop-banner">🔥 HOT [[ITEM]] 🔥</div>
      ${thumb_HTML(item)}
      ${title_HTML(item)}
      ${meta_HTML(item)}
      ${cta_HTML(item)}
    `;
  }
  if (type === 'sweepstakes') {
    return `
      <div class="pop-banner">🎉 TODAY'S WINNING [[ITEM]] 🎉</div>
      ${title_HTML(item)}
      ${meta_HTML(item)}
      <div class="pop-confetti">✦ ★ ✦ ★ ✦ ★ ✦ ★ ✦</div>
      ${cta_HTML(item)}
    `;
  }
  if (type === 'toolbar') {
    const title = escape_HTML(item.ref.title || item.ref.name || '');
    const href = escape_HTML(primary_link_of(item));
    return `
      <div class="pop-tb-icon">⚙</div>
      <div class="pop-tb-text">Install <strong>"${title}"</strong>Bar™ for free!</div>
      <button class="pop-tb-btn">[YES]</button>
      <button class="pop-tb-btn pop-tb-btn-secondary">[NO]</button>
      <a class="pop-cta pop-cta-mini" href="${href}" target="_blank" rel="noopener">[GET IT NOW]</a>
    `;
  }
  if (type === 'chat') {
    const title = escape_HTML(item.ref.title || item.ref.name || '');
    return `
      <div class="pop-chat-tabs"><span class="active">CHAT</span><span>BUDDIES</span><span>AWAY</span></div>
      <div class="pop-chat-log">
        <div class="pop-chat-msg pop-chat-you">you: hi??</div>
        <div class="pop-chat-msg pop-chat-them"><strong>[ADMIN]:</strong> HI!! YOU QUALIFY for FREE access to "${title}"!!! click here:</div>
      </div>
      ${cta_HTML(item)}
    `;
  }
  if (type === 'download') {
    const safe = (item.ref.title || item.ref.name || '').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 24);
    const h = hash_str(item_key(item));
    const pct = h % 80 + 10;
    const kb = h % 900 + 100;
    const secs = h % 30 + 5;
    const href = escape_HTML(primary_link_of(item));
    return `
      <div class="pop-dl-filename">Free_${escape_HTML(safe)}.exe</div>
      <div class="pop-dl-bar"><div class="pop-dl-fill" style="width:${pct}%"></div></div>
      <div class="pop-dl-info">${kb} KB / 1024 KB — ~${secs}s remaining</div>
      <a class="pop-cta" href="${href}" target="_blank" rel="noopener">[[ ACCEPT DOWNLOAD ]]</a>
    `;
  }
  if (type === 'survey') {
    const title = escape_HTML(item.ref.title || item.ref.name || '');
    const rid = hash_str(item_key(item));
    const href = escape_HTML(primary_link_of(item));
    return `
      <div class="pop-survey-q">Have you read "${title}" yet??</div>
      <label class="pop-survey-opt"><input type="radio" name="q-${rid}"> Yes</label>
      <label class="pop-survey-opt"><input type="radio" name="q-${rid}" checked> No, [[I NEED IT]]!!</label>
      <a class="pop-cta" href="${href}" target="_blank" rel="noopener">[[ SUBMIT TO WIN ]]</a>
    `;
  }
  if (type === 'virus') {
    const safe = (item.ref.title || item.ref.name || '').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 24);
    const href = escape_HTML(primary_link_of(item));
    return `
      <pre class="pop-virus-screen">C:\\&gt; SCAN.EXE
*** VIRUS_DETECTED ***

File:   ${escape_HTML(safe)}.dll
Threat: HIGH
Action: [C]lean  [I]gnore

&gt; _</pre>
      <a class="pop-cta" href="${href}" target="_blank" rel="noopener">[[ CLEAN NOW ]]</a>
    `;
  }
  if (type === 'wizard') {
    const title = escape_HTML(item.ref.title || item.ref.name || '');
    const steps = hash_str(item_key(item)) % 6 + 3;
    const href = escape_HTML(primary_link_of(item));
    return `
      <div class="pop-wiz-step">Step 1 of ${steps}</div>
      <div class="pop-wiz-banner">Welcome to the "${title}" Setup Wizard</div>
      <div class="pop-wiz-text">This wizard will install <strong>"${title}"</strong> to your reading list. Click Next to continue or Cancel to exit.</div>
      <a class="pop-cta" href="${href}" target="_blank" rel="noopener">[[ [ NEXT &gt; ] ]]</a>
    `;
  }
  if (type === 'balloon') {
    const title = escape_HTML(item.ref.title || item.ref.name || '');
    const href = escape_HTML(primary_link_of(item));
    return `
      <div class="pop-balloon-icon">🔔</div>
      <div class="pop-balloon-text"><strong>New update available!</strong><br>"${title}" is ready for review.</div>
      <a class="pop-cta pop-cta-mini" href="${href}" target="_blank" rel="noopener">[ DETAILS ]</a>
    `;
  }
  // default: dialog
  return `
    <div class="pop-banner">★★★ FREE OFFER!! ★★★</div>
    ${thumb_HTML(item)}
    ${title_HTML(item)}
    ${meta_HTML(item)}
    ${install_HTML(item)}
    ${cta_HTML(item)}
  `;
}

// ---- popup spawning + closing ----

const TITLEBAR_ICONS = {
  alert: '⚠',
  error: '✕',
  sweepstakes: '🎉',
  dialog: '⚠',
  chat: '💬',
  download: '⬇',
  survey: '?',
  virus: '☠',
  wizard: '🧙',
};

function spawn_popup() {
  if (!items.length) return;

  const item = items[item_index];
  item_index = (item_index + 1) % items.length;
  const type = popup_type_for(item);
  const glitched = is_glitched(item);

  const el = document.createElement('div');
  el.className = `pop pop-${type} pop-${item.kind}${glitched ? ' pop-glitched' : ''}`;

  // ad / toolbar / balloon skip the Win95 title bar
  const no_title_bar = type === 'ad' || type === 'toolbar' || type === 'balloon';

  const icon = TITLEBAR_ICONS[type] || '⚠';
  const title_bar_HTML = no_title_bar ? '' : `
    <div class="pop-titlebar">
      <span class="pop-titlebar-icon">${icon}</span>
      <span class="pop-title">${escape_HTML(title_for(item, type))}</span>
      <button type="button" class="pop-close" aria-label="close">×</button>
    </div>
  `;
  const close_standalone = no_title_bar
    ? '<button type="button" class="pop-close pop-close-floating" aria-label="close">×</button>'
    : '';
  const static_overlay = glitched ? '<div class="pop-static"></div>' : '';

  el.innerHTML = `
    ${title_bar_HTML}
    ${close_standalone}
    <div class="pop-body">${body_for_type(item, type)}</div>
    ${static_overlay}
  `;

  // cycle through stacking positions
  const pos = POSITIONS[spawn_count % POSITIONS.length];
  el.style.top = pos.top;
  el.style.left = pos.left;
  el.style.zIndex = String(20000 + spawn_count);
  spawn_count++;

  el.querySelector('.pop-close')?.addEventListener('click', () => {
    el.remove();
    open_popups.delete(el);
  });

  // raise to front on mousedown
  el.addEventListener('mousedown', () => {
    spawn_count++;
    el.style.zIndex = String(20000 + spawn_count);
  });

  document.body.appendChild(el);
  open_popups.add(el);
}

function install_status_bar() {
  if ($('.pop-status-bar')) return;
  const el = document.createElement('div');
  el.className = 'pop-status-bar';
  el.textContent = '[X] = close popup ★ Esc = exit popup mode';
  document.body.appendChild(el);
}

// Esc hands off to viewmode.js
function make_key_handler() {
  return (e) => {
    if (e.key === 'Escape') {
      document.body.dispatchEvent(new CustomEvent('vhs-exit'));
      e.preventDefault();
    }
  };
}

// ---- text scramble ----

// corrupt a string at intensity 0..1
function corrupt(s, intensity) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    // skip whitespace
    if (/\s/.test(ch)) { out += ch; continue; }

    if (Math.random() < intensity) {
      // 1-in-6 full-block / asterisk
      if (Math.random() < 1/6) {
        out += Math.random() < 0.5 ? '█' : '*';
        continue;
      }

      // cyrillic lookalike
      const look = CYRILLIC_LOOKALIKES[ch];
      if (look) { out += look; continue; }

      // keep char + zalgo mark
      out += ch + ZALGO[Math.floor(Math.random() * ZALGO.length)];
      continue;
    }

    out += ch;
  }
  return out;
}

function pick_scramble_target() {
  const candidates = $$('h2, h3, h4, p, a, li, .card-title');

  const ALLOW = ['#about', '#featured', '#research', '#talks', '#software'];
  const DENY = '.pop, .pop-status-bar, .pop-tear-strip, #viewmode-toggle, script, style';

  const eligible = candidates.filter((el) => {
    if (el.textContent.trim().length < 6) return false;
    if (SCRAMBLED.has(el)) return false;
    if (el.closest(DENY)) return false;
    return ALLOW.some((sel) => el.closest(sel));
  });

  if (!eligible.length) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

// scan in corruption → hold → scan out revert
function scramble_once() {
  const target = pick_scramble_target();
  if (!target) return;

  const original = target.textContent;
  SCRAMBLED.set(target, original);
  CORRUPTED.add(target);

  const CORRUPT_MS = 350;
  const HOLD_MS = 1400;
  const REVERT_MS = 350;

  // sweep a head pointer left-to-right, corrupting the prefix
  const corrupt_start = performance.now();
  function corrupt_step(now) {
    if (!scramble_timer || !SCRAMBLED.has(target)) return;

    const t = Math.min(1, (now - corrupt_start) / CORRUPT_MS);
    const head = Math.floor(t * original.length);
    const prefix = corrupt(original.slice(0, head), 0.85);
    const suffix = original.slice(head);
    target.textContent = prefix + suffix;

    if (t < 1) {
      requestAnimationFrame(corrupt_step);
    } else {
      target.textContent = corrupt(original, 0.85);
      setTimeout(hold_end, HOLD_MS);
    }
  }

  // chance the corruption sticks forever, scales with decay
  function sticky_scramble_chance() {
    return decay_level === 0 ? 0
         : decay_level === 1 ? 0.05
         : decay_level === 2 ? 0.18
         : 0.40;
  }

  function hold_end() {
    if (!scramble_timer || !SCRAMBLED.has(target)) return;
    // sticky corruption
    if (Math.random() < sticky_scramble_chance()) {
      target.textContent = corrupt(original, 0.85);
      return;
    }
    // scan out left-to-right
    const revert_start = performance.now();
    requestAnimationFrame(function revert_step(now) {
      if (!scramble_timer || !SCRAMBLED.has(target)) return;

      const t = Math.min(1, (now - revert_start) / REVERT_MS);
      const head = Math.floor(t * original.length);
      const prefix = original.slice(0, head);
      const suffix = corrupt(original.slice(head), 0.85);
      target.textContent = prefix + suffix;

      if (t < 1) {
        requestAnimationFrame(revert_step);
      } else {
        target.textContent = original;
        SCRAMBLED.delete(target);
        CORRUPTED.delete(target);
      }
    });
  }

  requestAnimationFrame(corrupt_step);
}

function start_text_scramble() {
  scramble_timer = setInterval(scramble_once, 1800);
}

// ---- per-element graphical glitches ----

let glitch_timer = null;

// classes defined in popup.css
const FX_CLASSES = [
  'pop-fx-cliptop',
  'pop-fx-clipbot',
  'pop-fx-clipband',
  'pop-fx-shift',
  'pop-fx-pixel',
  'pop-fx-blank',
  'pop-fx-blackblock',
];

// retro-page element to glitch, excluding popups and nav
function pick_glitch_target() {
  const candidates = $$('main .card, main .talk-row, main .sw-card, main h2, main h3, main img:not(.pop-img)')
    .filter((el) => !el.closest('.pop, .pop-tear-strip, .pop-status-bar, #viewmode-toggle'));
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// stick-forever chance scaling with decay
function sticky_glitch_chance() {
  return decay_level === 0 ? 0
       : decay_level === 1 ? 0.04
       : decay_level === 2 ? 0.10
       : 0.20;
}

// add a glitch class for ~180-500ms, or permanently
function glitch_once() {
  const target = pick_glitch_target();
  if (!target) return;
  const cls = FX_CLASSES[Math.floor(Math.random() * FX_CLASSES.length)];
  target.classList.add(cls);

  if (Math.random() < sticky_glitch_chance()) {
    STUCK_GLITCHES.set(target, cls);
    return;
  }
  const lifespan = 180 + Math.floor(Math.random() * 320);
  setTimeout(() => {
    if (!STUCK_GLITCHES.has(target)) target.classList.remove(cls);
  }, lifespan);
}

function start_glitch_loop() {
  glitch_timer = setInterval(glitch_once, 900);
}

// ---- decay loop ----

function update_decay_level() {
  const elapsed = (Date.now() - popup_mode_started_at) / 1000;
  let target = 0;
  for (let i = 0; i < DECAY_THRESHOLDS.length; i++) {
    if (elapsed >= DECAY_THRESHOLDS[i]) target = i + 1;
  }
  if (target === decay_level) return;
  document.body.classList.remove(`popup-decay-${decay_level}`);
  document.body.classList.remove('popup-decay-1', 'popup-decay-2', 'popup-decay-3');
  if (target > 0) document.body.classList.add(`popup-decay-${target}`);
  decay_level = target;
}

function start_decay_loop() {
  popup_mode_started_at = Date.now();
  decay_level = 0;
  decay_timer = setInterval(update_decay_level, DECAY_TICK_MS);
}

// ---- install / remove ----

export function install_popups({ research_data, talk_data, software_data }) {
  items = build_items(research_data, talk_data, software_data);
  item_index = 0;
  spawn_count = 0;
  open_popups = new Set();

  // 5 tear strips driven by CSS animations
  for (let i = 1; i <= 5; i++) {
    const strip = document.createElement('div');
    strip.className = `pop-tear-strip pop-tear-strip-${i}`;
    document.body.appendChild(strip);
  }

  install_status_bar();

  // seed 3 popups so the first tick isn't empty
  for (let i = 0; i < 3 && i < items.length; i++) spawn_popup();

  popup_timer = setInterval(spawn_popup, SPAWN_MS);

  start_text_scramble();
  start_glitch_loop();
  start_decay_loop();

  key_handler = make_key_handler();
  document.addEventListener('keydown', key_handler);
}

export function remove_popups() {
  if (popup_timer) { clearInterval(popup_timer); popup_timer = null; }
  if (key_handler) { document.removeEventListener('keydown', key_handler); key_handler = null; }

  // restore any currently-corrupted text
  if (scramble_timer) { clearInterval(scramble_timer); scramble_timer = null; }
  for (const el of CORRUPTED) {
    const original = SCRAMBLED.get(el);
    if (original != null) el.textContent = original;
  }
  CORRUPTED.clear();
  SCRAMBLED = new WeakMap();

  // strip lingering glitch classes
  if (glitch_timer) { clearInterval(glitch_timer); glitch_timer = null; }
  for (const cls of FX_CLASSES) {
    for (const el of $$('.' + cls)) el.classList.remove(cls);
  }
  STUCK_GLITCHES.clear();

  // strip decay classes
  if (decay_timer) { clearInterval(decay_timer); decay_timer = null; }
  document.body.classList.remove('popup-decay-1', 'popup-decay-2', 'popup-decay-3');
  decay_level = 0;
  popup_mode_started_at = 0;

  for (const sel of POP_SELECTORS) {
    for (const el of $$(sel)) el.remove();
  }
  open_popups = new Set();
  items = [];
  item_index = 0;
  spawn_count = 0;
}
