// VHS mode

import { $, $$, escape_HTML, fmt_month_year, render_authors } from './util.js';

// state cleared in remove_VHS
let slide_timer = null;
let key_handler = null;
let broadcast_click_handler = null;
let slides = [];
let slide_index = 0;
let paused = false;
let slide_index_by_ID = {};
let talks_by_ID = {};
let color_bars_timer = null;
let subtitle_timer = null;
let subtitle_phrases = [];
let subtitle_phrase_idx = 0;
let subtitle_char_idx = 0;
let subtitle_hold_frames = 0;

// teardown selectors
const VHS_SELECTORS = [
  '#vhs-broadcast',
  '.vhs-ticker',
  '.vhs-tracking-bar',
  '.vhs-color-bars',
  '.vhs-subtitle',
  '.vhs-channel',
  '.vhs-static-lines',
  '.vhs-chroma-svg',
];

// auto-advance dwell
const SLIDE_MS = 5000;

// color-bars random interval bounds
const COLORBARS_MIN_MS = 9000;
const COLORBARS_MAX_MS = 18000;

// benefit truncation
const BENEFIT_MAX = 140;

// subtitle pacing
const SUBTITLE_TICK_MS = 32;
const SUBTITLE_HOLD_TICKS = 22;
const SUBTITLE_WORDS_PER_PHRASE = 7;

// ##### slide list #####

function primary_link_of(slide) {
  const r = slide.ref;
  if (slide.kind === 'paper') {
    const arxiv = r.links?.find((l) => /arxiv/i.test(l.text));
    if (arxiv) return arxiv.href;
    const inspire = r.links?.find((l) => /inspire/i.test(l.text));
    if (inspire) return inspire.href;
    return r.links?.[0]?.href || '#';
  }
  if (slide.kind === 'talk') return r.video || r.slides || '#';
  return '#';
}

// featured papers, then rest of papers
function build_slides(research_data, talk_data) {
  const out = [];
  const featured = research_data.filter((p) => p.featured && !p.joke);
  for (const p of featured) out.push({ kind: 'paper', ref: p });
  for (const p of research_data) {
    if (p.joke) continue;
    if (featured.includes(p)) continue;
    out.push({ kind: 'paper', ref: p });
  }

  slide_index_by_ID = {};
  out.forEach((s, i) => {
    if (s.kind === 'paper') slide_index_by_ID[s.ref.id] = i;
  });
  talks_by_ID = Object.fromEntries((talk_data || []).map((t) => [t.id, t]));
  return out;
}

// ##### render helpers #####

// pull the hero mailto so slides can reuse the real address
function get_mailto() {
  const a = document.querySelector('.hero-socials a[href^="mailto:"]');
  if (!a) return null;
  const href = a.getAttribute('href') || '';
  const addr = href.replace(/^mailto:/, '').trim();
  return { href, addr };
}

// big mailto at the slide footer
function email_wordart() {
  const m = get_mailto();
  if (!m) return '';
  return `
    <div class="slide-email">
      <a class="slide-email-link" href="${escape_HTML(m.href)}">${escape_HTML(m.addr.toUpperCase())}</a>
    </div>
  `;
}

// word-boundary truncation
function truncate(s, n) {
  const t = (s || '').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const sp = cut.lastIndexOf(' ');
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut) + '…';
}

// "Phys. Rev. Lett. 135, 021902" → "PRL", etc
function short_journal_name(raw) {
  if (!raw) return '';
  // drop volume + page (everything from the first digit on)
  const head = raw.replace(/\s*\d.*$/, '').trim();
  const lower = head.toLowerCase();
  if (/phys.*rev.*lett/.test(lower)) return 'PRL';
  if (/phys.*rev.*d/.test(lower)) return 'PRD';
  if (/phys.*rev.*c/.test(lower)) return 'PRC';
  if (/phys.*rev.*x/.test(lower)) return 'PRX';
  if (/phys.*rev/.test(lower)) return 'PR';
  if (/jhep/.test(lower)) return 'JHEP';
  if (/jcap/.test(lower)) return 'JCAP';
  if (/scipost/.test(lower)) return 'SciPost';
  if (/eur.*phys.*j/.test(lower)) return 'EPJ';
  if (/nature/.test(lower)) return 'Nature';
  if (/science/.test(lower)) return 'Science';
  // acronym fallback, max 5 chars
  const acro = head.split(/[\s.]+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase();
  return acro.slice(0, 5) || head.slice(0, 5);
}

// payment-style badge wrapping a link
function pay_badge(href, inner, opts = {}) {
  const cls = opts.text ? 'slide-pay-badge slide-pay-text' : 'slide-pay-badge';
  const title = opts.title ? ` title="${escape_HTML(opts.title)}"` : '';
  return `<a class="${cls}" href="${escape_HTML(href)}" target="_blank" rel="noopener"${title}>${inner}</a>`;
}

// ##### slide rendering #####

function render_slide() {
  const screen = $('#vhs-broadcast');
  if (!screen) return;
  const slide = slides[slide_index];
  if (!slide) return;
  screen.innerHTML = `<div class="slide" data-kind="${slide.kind}">${render_paper_slide(slide.ref)}</div>`;

  // brief SMPTE flash between slides
  trigger_color_bars(260);

  update_channel(slide);

  // subtitle scrolls through the slide's abstract / blurb
  set_subtitle(slide.ref.abstract || slide.ref.blurb || slide.ref.title || '');
}

function render_paper_slide(p) {
  const image_inner = p.img
    ? `<img src="${escape_HTML(p.img)}" alt="" loading="lazy">`
    : `<div class="slide-image-fallback">📚</div>`;

  const subtitle = p.status === 'refereed' ? 'PEER-REVIEWED!' : 'NEW PREPRINT!';

  // publication date doubles as the "price"
  const price = fmt_month_year(p.date);
  const price_unit = p.status === 'refereed' ? 'PUBLISHED' : 'PREPRINT';

  const benefit = truncate(p.blurb || p.abstract || '', BENEFIT_MAX);

  // sort the links that exist into badge slots
  const links = p.links || [];
  const arxiv = links.find((l) => /arxiv/i.test(l.text));
  const inspire = links.find((l) => /inspire/i.test(l.text));
  const code = links.find((l) => /github|code/i.test(l.text));
  const journal_link = (p.status === 'refereed')
    ? links.find((l) => !/arxiv|inspire|github|code/i.test(l.text))
    : null;
  const journal_short = journal_link ? short_journal_name(journal_link.text) : '';

  const badges = [];
  if (arxiv) badges.push(pay_badge(arxiv.href, '<i class="ai ai-arxiv"></i>', { title: 'arXiv' }));
  if (inspire) badges.push(pay_badge(inspire.href, '<i class="ai ai-inspire"></i>', { title: 'INSPIRE-HEP' }));
  if (journal_link) badges.push(pay_badge(journal_link.href, escape_HTML(journal_short), { text: true, title: journal_link.text }));
  if (code) badges.push(pay_badge(code.href, '<i class="fa fa-github"></i>', { title: 'Code' }));

  // guarantee line: FREE first, then metadata bits
  const cites = p.citations_total || 0;
  const guarantee_bits = ['100% FREE'];
  if (cites > 0) guarantee_bits.push(`${cites} CITATION${cites === 1 ? '' : 'S'}!`);
  if (p.status === 'refereed' && journal_short) guarantee_bits.push(`PEER-REVIEWED IN ${journal_short}`);
  else if (p.status !== 'refereed') guarantee_bits.push('FRESH PREPRINT');
  const guarantee = '★ ' + guarantee_bits.join(' · ') + ' ★';

  // bonus-talks callout: video > slides for the pill href
  const linked_talks = (p.talks || [])
    .map((tid) => talks_by_ID[tid])
    .filter(Boolean);
  let bonus_HTML = '';
  if (linked_talks.length) {
    const noun = linked_talks.length === 1 ? 'TALK' : 'TALKS';
    const pills = linked_talks.map((t) => {
      const href = t.video || t.slides || '#';
      // "MAR 26" date stub
      const stub = (fmt_month_year(t.date) || '').replace(/\s+/, ' ').toUpperCase().replace(/ 20/, ' ');
      const icon = t.video ? '▶' : '⬇';
      return `<a class="slide-bonus-pill" href="${escape_HTML(href)}" target="_blank" rel="noopener" title="${escape_HTML(t.title)}">${icon} ${escape_HTML(stub)}</a>`;
    }).join('');
    bonus_HTML = `
      <div class="slide-bonus">
        <span class="slide-bonus-header">+ ${linked_talks.length} BONUS ${noun} FREE!</span>
        <span class="slide-bonus-pills">${pills}</span>
      </div>
    `;
  }

  return `
    <div class="slide-image">
      ${image_inner}
    </div>
    <div class="slide-info">
      <h2 class="slide-title">${escape_HTML(p.title)}</h2>
      <div class="slide-authors">${render_authors(p.authors)}</div>
      <div class="slide-subtitle">${escape_HTML(subtitle)}</div>
      <div class="slide-price-block">
        <span class="slide-price">${escape_HTML(price)}</span>
        <span class="slide-price-unit">${escape_HTML(price_unit)}</span>
      </div>
      ${benefit ? `<div class="slide-benefit">${escape_HTML(benefit)}</div>` : ''}
      ${bonus_HTML}
    </div>
    <div class="slide-payments">
      <div class="slide-payments-row"><span class="slide-pay-price">$0.00 <em>(FREE!)</em></span>${badges.join('')}</div>
      <div class="slide-guarantee">${escape_HTML(guarantee)}</div>
    </div>
    ${email_wordart()}
  `;
}

// advance with wrap
function advance(delta = 1) {
  if (!slides.length) return;
  slide_index = (slide_index + delta + slides.length) % slides.length;
  render_slide();
}

// jump to absolute index (F1)
function jump_to(i) {
  if (!slides.length) return;
  slide_index = ((i % slides.length) + slides.length) % slides.length;
  render_slide();
}

// ##### decorations #####

// top ticker of paper titles + cite counts
function install_ticker(papers) {
  if ($('.vhs-ticker')) return;
  const items = papers
    .filter((p) => !p.joke)
    .map((p) => `★ "${p.title}" — ${p.citations_total} CITATION${p.citations_total === 1 ? '' : 'S'} ★`)
    .join(' &nbsp; ');
  const el = document.createElement('div');
  el.className = 'vhs-ticker';
  el.innerHTML = `<div class="vhs-ticker-track">${items} &nbsp; ${items}</div>`;
  document.body.insertBefore(el, document.body.firstChild);
}

// SVG chromatic-aberration filter
function install_chroma_filter() {

  if ($('.vhs-chroma-svg')) return;

  // SVG filter
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'vhs-chroma-svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  
  // R, B, G filters + offsets + screen mode blend
  svg.innerHTML = `
    <filter id="vhs-chroma" x="-5%" y="-5%" width="110%" height="110%">
      <feColorMatrix in="SourceGraphic" type="matrix" result="r"
        values="1 0 0 0 0
                0 0 0 0 0
                0 0 0 0 0
                0 0 0 1 0"/>
      <feOffset in="r" dx="-3" dy="0" result="r-shift"/>
      <feColorMatrix in="SourceGraphic" type="matrix" result="g"
        values="0 0 0 0 0
                0 1 0 0 0
                0 0 0 0 0
                0 0 0 1 0"/>
      <feColorMatrix in="SourceGraphic" type="matrix" result="b"
        values="0 0 0 0 0
                0 0 0 0 0
                0 0 1 0 0
                0 0 0 1 0"/>
      <feOffset in="b" dx="3" dy="0" result="b-shift"/>
      <feBlend in="r-shift" in2="g" mode="screen" result="rg"/>
      <feBlend in="rg" in2="b-shift" mode="screen"/>
    </filter>
  `;
  document.body.appendChild(svg);
}

// secondary tracking band layered over the CSS ::after band
function install_tracking_bar() {
  if ($('.vhs-tracking-bar')) return;
  const el = document.createElement('div');
  el.className = 'vhs-tracking-bar';
  document.body.prepend(el);
}

// fixed full-viewport SMPTE no-signal overlay
function install_color_bars() {
  if ($('.vhs-color-bars')) return;
  const el = document.createElement('div');
  el.className = 'vhs-color-bars';
  el.innerHTML = `
    <span class="vhs-cb-play">PLAY ▶</span>
    <span class="vhs-cb-sp">SP</span>
  `;
  document.body.appendChild(el);
}

// flash color bars for ms then hide
function trigger_color_bars(ms = 500) {
  const bars = $('.vhs-color-bars');
  if (!bars) return;
  bars.classList.add('is-active');
  setTimeout(() => bars.classList.remove('is-active'), ms);
}

// recurring random-interval color-bars flash
function schedule_next_color_bars() {
  const delay = COLORBARS_MIN_MS + Math.random() * (COLORBARS_MAX_MS - COLORBARS_MIN_MS);
  color_bars_timer = setTimeout(() => {
    trigger_color_bars(700);
    schedule_next_color_bars();
  }, delay);
}

// subtitle container
function install_subtitle() {
  if ($('.vhs-subtitle')) return;
  const el = document.createElement('div');
  el.className = 'vhs-subtitle';
  el.innerHTML = '<span class="vhs-subtitle-text"></span>';
  document.body.appendChild(el);
}

// split into ~7-word phrases, preferring sentence boundaries
function split_into_phrases(text) {
  const t = (text || '').trim();
  if (!t) return [];
  const parts = t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const part of parts) {
    const words = part.split(/\s+/).filter(Boolean);
    if (words.length <= SUBTITLE_WORDS_PER_PHRASE) {
      out.push(words.join(' '));
    } else {
      // chunk long sentences into caption-sized lines
      for (let i = 0; i < words.length; i += SUBTITLE_WORDS_PER_PHRASE) {
        out.push(words.slice(i, i + SUBTITLE_WORDS_PER_PHRASE).join(' '));
      }
    }
  }
  return out;
}


function set_subtitle(text) {
  if (subtitle_timer) { clearInterval(subtitle_timer); subtitle_timer = null; }
  const el = $('.vhs-subtitle-text');
  if (!el) return;
  subtitle_phrases = split_into_phrases(text);
  subtitle_phrase_idx = 0;
  subtitle_char_idx = 0;
  subtitle_hold_frames = 0;
  el.textContent = '';
  if (!subtitle_phrases.length) return;
  subtitle_timer = setInterval(() => {
    const el2 = $('.vhs-subtitle-text');
    if (!el2) return;
    const phrase = subtitle_phrases[subtitle_phrase_idx];
    if (subtitle_char_idx < phrase.length) {
      subtitle_char_idx += 1;
      el2.textContent = phrase.slice(0, subtitle_char_idx);
      return;
    }
    // hold the scanned phrase, then advance
    if (subtitle_hold_frames < SUBTITLE_HOLD_TICKS) {
      subtitle_hold_frames += 1;
      return;
    }
    subtitle_hold_frames = 0;
    subtitle_char_idx = 0;
    subtitle_phrase_idx = (subtitle_phrase_idx + 1) % subtitle_phrases.length;
    el2.textContent = '';
  }, SUBTITLE_TICK_MS);
}

// CH indicator
function install_channel() {
  if ($('.vhs-channel')) return;
  const el = document.createElement('div');
  el.className = 'vhs-channel';
  document.body.appendChild(el);
}

// CH XX = 1-indexed, 2-digit slide number
function update_channel(/* slide */) {
  const el = $('.vhs-channel');
  if (!el) return;
  const n = (slide_index + 1).toString().padStart(2, '0');
  el.textContent = `CH ${n}`;
}

// static-lines overlay band near the bottom
function install_static_lines() {
  if ($('.vhs-static-lines')) return;
  const el = document.createElement('div');
  el.className = 'vhs-static-lines';
  document.body.appendChild(el);
}

// screen container + click-to-advance handler
function install_broadcast() {
  if ($('#vhs-broadcast')) return;
  const el = document.createElement('div');
  el.id = 'vhs-broadcast';
  el.addEventListener('mouseenter', () => { paused = true; });
  el.addEventListener('mouseleave', () => { paused = false; });
  const main = document.querySelector('main');
  if (main) main.insertBefore(el, main.firstChild);
  else document.body.appendChild(el);

  // bare clicks advance; links bleed through
  broadcast_click_handler = (e) => {
    if (e.target.closest('a, button')) return;
    advance(+1);
  };
  el.addEventListener('click', broadcast_click_handler);
}

// ##### keyboard #####

function make_key_handler() {
  return (e) => {
    if (e.key === 'ArrowLeft') { advance(-1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { advance(+1); e.preventDefault(); }
    else if (e.key === ' ') {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'button' || tag === 'select' || tag === 'input' || tag === 'textarea') return;
      paused = !paused;
      e.preventDefault();
    }
    else if (e.key === 'F1') { jump_to(0); e.preventDefault(); }
    else if (e.key === 'Escape') {
      document.body.dispatchEvent(new CustomEvent('vhs-exit'));
      e.preventDefault();
    }
  };
}

// ##### install / remove #####

export function install_VHS({ research_data, talk_data }) {
  slides = build_slides(research_data, talk_data);
  slide_index = 0;
  paused = false;

  install_chroma_filter();
  install_ticker(research_data);
  install_tracking_bar();
  install_color_bars();
  install_subtitle();
  install_channel();
  install_static_lines();
  install_broadcast();

  render_slide();

  slide_timer = setInterval(() => { if (!paused) advance(+1); }, SLIDE_MS);

  key_handler = make_key_handler();
  document.addEventListener('keydown', key_handler);

  // big SMPTE flash on enter
  trigger_color_bars(1400);

  schedule_next_color_bars();
}

export function remove_VHS() {
  if (slide_timer) { clearInterval(slide_timer); slide_timer = null; }
  if (color_bars_timer) { clearTimeout(color_bars_timer); color_bars_timer = null; }
  if (subtitle_timer) { clearInterval(subtitle_timer); subtitle_timer = null; }
  if (key_handler) { document.removeEventListener('keydown', key_handler); key_handler = null; }
  broadcast_click_handler = null;
  for (const sel of VHS_SELECTORS) {
    for (const el of $$(sel)) el.remove();
  }
  slides = [];
  slide_index = 0;
  paused = false;
}
