// ---------------------------------------------------------------------------
// Rikab Gambhir — site script
// Renders Featured / All Research / Talks / Software from data.js, plus
// expandable cards, talk filters, deep links, scroll-spy nav, hero canvas.
// ---------------------------------------------------------------------------

import { researchData, talkData, softwareData } from '../data.js?v=2d255e37';

const SELF = 'Rikab Gambhir';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const fmtDate = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
const fmtMonthYear = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

// Lookup tables
const pubBySlug = Object.fromEntries(researchData.map((p) => [p.slug, p]));
const talkById = Object.fromEntries(talkData.map((t) => [t.id, t]));

// ---------------------------------------------------------------------------
// Author rendering: bold the user's own name.
function renderAuthors(s) {
  if (!s) return '';
  const re = new RegExp(`\\b(${SELF.replace(/ /g, '\\s+')})\\b`, 'g');
  return escapeHtml(s).replace(re, '<span class="self">$1</span>');
}

// ---------------------------------------------------------------------------
// Paper card (collapsed + expanded states in one element)
function paperCard(p, { featured = false } = {}) {
  const linksHtml = (p.links || []).map((l) => (
    `<a class="btn btn-sm" href="${escapeHtml(l.href)}" target="_blank" rel="noopener">${escapeHtml(l.text)}</a>`
  )).join('');

  const tagsHtml = (p.tags || []).map((t) => (
    `<span class="tag">${escapeHtml(t)}</span>`
  )).join('');

  const star = p.featured && !p.joke ? `<span class="card-star" title="Featured">★</span>` : '';
  const jokeBadge = p.joke
    ? `<span class="joke-badge" title="April Fools paper">🃏 April Fools</span>`
    : '';

  return `
    <article class="card${featured ? ' card-featured' : ''}${p.joke ? ' card-joke' : ''}" id="paper-${escapeHtml(p.slug)}" data-slug="${escapeHtml(p.slug)}">
      ${jokeBadge}
      ${star}
      <div class="card-row">
        <div class="card-thumb">
          ${p.img ? `<img src="${escapeHtml(p.img)}" alt="" loading="lazy">` : ''}
        </div>
        <div class="card-body">
          <h3 class="card-title">${escapeHtml(p.title)}</h3>
          <p class="card-meta">
            ${renderAuthors(p.authors)} &middot; ${escapeHtml(fmtMonthYear(p.date))}
          </p>
          ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ''}
          <p class="card-blurb">${escapeHtml(p.blurb || '')}</p>
          <div class="card-links">${linksHtml}</div>
        </div>
      </div>
      ${(p.abstract || p.bibtex || p.talks?.length) ? `
        <button class="card-expand" aria-expanded="false" aria-controls="detail-${escapeHtml(p.slug)}">
          Read more <span class="chev">▾</span>
        </button>
        <div class="card-detail" id="detail-${escapeHtml(p.slug)}" hidden>
          ${p.abstract ? `<h4>Abstract</h4><p class="card-abstract">${escapeHtml(p.abstract)}</p>` : ''}
          ${p.bibtex ? `
            <h4>BibTeX</h4>
            <div class="card-bibtex"><button class="copy-btn" data-copy>copy</button>${escapeHtml(p.bibtex)}</div>
          ` : ''}
          ${p.talks?.length ? `
            <h4>Talks on this paper (${p.talks.length})</h4>
            <ul class="related-talks">
              ${p.talks.map((tid) => {
                const t = talkById[tid];
                return t ? `<li><a href="#talk-${escapeHtml(t.id)}" data-talk-link>
                  <strong>${escapeHtml(fmtDate(t.date))}</strong> &middot; ${escapeHtml(t.where)}
                </a></li>` : '';
              }).join('')}
            </ul>
          ` : ''}
        </div>
      ` : ''}
    </article>
  `;
}

// ---------------------------------------------------------------------------
// Talks: filter + render
const talkState = {
  view: 'sections',          // 'sections' | 'combined'
  year: '',
  topics: new Set(),
  featuredOnly: false,
};

const CATEGORY_ORDER = ['invited', 'lectures', 'contributed'];
const CATEGORY_LABEL = {
  invited:     'Invited Talks',
  lectures:    'Lecture Series & Schools',
  contributed: 'Contributed Talks',
};

function topicOf(t) {
  return t.topic || (t.category === 'invited' ? 'Invited Talks' : '');
}

function rowPasses(t) {
  if (talkState.year && !t.date.startsWith(talkState.year)) return false;
  if (talkState.featuredOnly && !t.featured) return false;
  if (talkState.topics.size && !talkState.topics.has(topicOf(t))) return false;
  return true;
}

function applyFilters() {
  const visible = talkData.filter(rowPasses);
  console.log('[talks]', {
    total: talkData.length,
    visibleAfterFilters: visible.length,
    view: talkState.view,
    activeFilters: {
      year: talkState.year || null,
      topics: [...talkState.topics],
      featuredOnly: talkState.featuredOnly,
    },
    perCategory: ['invited','lectures','contributed'].reduce((o,c) => {
      o[c] = visible.filter(t => t.category === c).length;
      return o;
    }, {}),
  });
  renderTalkList(visible);
  syncFilterUrl();
}

function buildTalkRow(t, { withCategory = false } = {}) {
  const row = document.createElement('div');
  row.className = `talk-row${t.featured ? ' is-featured' : ''}`;
  row.id = `talk-${t.id}`;
  row.dataset.id = t.id;
  row.tabIndex = 0;
  row.setAttribute('role', 'button');
  row.setAttribute('aria-expanded', 'false');

  const slidesIcon = t.slides
    ? `<a class="talk-icon" href="${escapeHtml(t.slides)}" target="_blank" rel="noopener" title="Slides" onclick="event.stopPropagation()"><i class="fa fa-file-pdf-o"></i></a>`
    : '';
  const videoIcon = t.video
    ? `<a class="talk-icon" href="${escapeHtml(t.video)}" target="_blank" rel="noopener" title="Video" onclick="event.stopPropagation()"><i class="fa fa-play"></i></a>`
    : '';

  const paper = t.paper ? pubBySlug[t.paper] : null;
  const paperLink = paper
    ? `Paper: <a href="#paper-${escapeHtml(paper.slug)}" data-paper-link>${escapeHtml(paper.title)}</a>`
    : '';

  const catBadge = withCategory
    ? `<span class="cat-badge cat-${t.category}">${escapeHtml(CATEGORY_LABEL[t.category] || t.category).replace(/ Talks?$/i,'')}</span>`
    : '';

  row.innerHTML = `
    <div class="talk-date">${escapeHtml(fmtDate(t.date))}</div>
    <div class="talk-main">
      <div class="talk-title">${catBadge}${escapeHtml(t.title)}</div>
      <div class="talk-where">${escapeHtml(t.where || '')}</div>
    </div>
    <div class="talk-icons">${slidesIcon}${videoIcon}</div>
    <div class="talk-detail">
      <div class="meta-line">
        ${escapeHtml((CATEGORY_LABEL[t.category] || t.category))}${t.topic ? ` &middot; ${escapeHtml(t.topic)}` : ''}
      </div>
      ${t.abstract || (paper && paper.blurb)
        ? `<p>${escapeHtml(t.abstract || paper.blurb)}</p>` : ''}
      ${paperLink ? `<p style="font-size:.85rem;color:var(--muted);margin:.4rem 0 0;">${paperLink}</p>` : ''}
    </div>
  `;
  return row;
}

function renderYearGroups(items, root, { withCategory = false } = {}) {
  let lastYear = null;
  for (const t of items) {
    const year = t.date.slice(0, 4);
    if (year !== lastYear) {
      const h = document.createElement('div');
      h.className = 'year-header';
      h.textContent = year;
      root.appendChild(h);
      lastYear = year;
    }
    root.appendChild(buildTalkRow(t, { withCategory }));
  }
}

function renderTalkList(items) {
  const root = $('#talkList');
  root.innerHTML = '';

  if (!items.length) {
    root.innerHTML = `<p class="section-blurb" style="margin:2rem 0;">No talks match these filters.</p>`;
    return;
  }

  if (talkState.view === 'combined') {
    renderYearGroups(items, root, { withCategory: true });
    return;
  }

  // 'sections' view: one block per category, each with its own year groupings
  for (const cat of CATEGORY_ORDER) {
    const slice = items.filter((t) => t.category === cat);
    if (!slice.length) continue;
    const block = document.createElement('div');
    block.className = 'talk-cat-block';
    block.innerHTML = `<h3 class="cat-header">${escapeHtml(CATEGORY_LABEL[cat])}
      <span class="count">(${slice.length})</span></h3>`;
    root.appendChild(block);
    renderYearGroups(slice, block);
  }
}

function buildFilterControls() {
  // Year dropdown
  const years = [...new Set(talkData.map((t) => t.date.slice(0, 4)))].sort().reverse();
  const yearSel = $('#yearFilter');
  for (const y of years) {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y;
    yearSel.appendChild(opt);
  }

  // Topic chips
  const topics = [...new Set(talkData.map(topicOf).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const chipRoot = $('#topicFilter');
  for (const top of topics) {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'chip';
    c.textContent = top;
    c.dataset.topic = top;
    chipRoot.appendChild(c);
  }
}

function wireFilterEvents() {
  $$('.filter-segmented .seg').forEach((b) => {
    b.addEventListener('click', () => {
      talkState.view = b.dataset.view;
      $$('.filter-segmented .seg').forEach((x) => x.classList.toggle('is-active', x === b));
      applyFilters();
    });
  });
  $('#yearFilter').addEventListener('change', (e) => {
    talkState.year = e.target.value;
    applyFilters();
  });
  $('#featuredOnly').addEventListener('change', (e) => {
    talkState.featuredOnly = e.target.checked;
    applyFilters();
  });
  $('#topicFilter').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    const t = c.dataset.topic;
    if (talkState.topics.has(t)) talkState.topics.delete(t);
    else talkState.topics.add(t);
    c.classList.toggle('is-active');
    applyFilters();
  });
  $('#clearFilters').addEventListener('click', () => {
    talkState.view = 'sections';
    talkState.year = '';
    talkState.topics.clear();
    talkState.featuredOnly = false;
    $('#yearFilter').value = '';
    $('#featuredOnly').checked = false;
    $$('#topicFilter .chip').forEach((c) => c.classList.remove('is-active'));
    $$('.filter-segmented .seg').forEach((b) => b.classList.toggle('is-active', b.dataset.view === 'sections'));
    applyFilters();
  });

  // Talk row click: expand inline
  $('#talkList').addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    const row = e.target.closest('.talk-row');
    if (!row) return;
    const open = row.classList.toggle('is-open');
    row.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) history.replaceState(null, '', '#talk-' + row.dataset.id);
  });
  $('#talkList').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('.talk-row');
    if (!row) return;
    e.preventDefault();
    row.click();
  });
}

// Filter state is in-memory only; deep links (#paper-x, #talk-y) still work.
function syncFilterUrl() {
  // Strip any stale ?year/topics/view/featured from older sessions.
  if (location.search) {
    history.replaceState(null, '', location.pathname + location.hash);
  }
}

function readFilterUrl() {
  // Intentionally a no-op. Filters always start cleared.
}

// ---------------------------------------------------------------------------
// Software cards
function softwareCard(s) {
  const paper = s.paper ? pubBySlug[s.paper] : null;
  const links = [];
  if (s.github) links.push(`<a class="btn btn-sm" href="${escapeHtml(s.github)}" target="_blank" rel="noopener">GitHub</a>`);
  if (s.homepage) links.push(`<a class="btn btn-sm" href="${escapeHtml(s.homepage)}" target="_blank" rel="noopener">Homepage</a>`);
  if (paper) links.push(`<a class="btn btn-sm btn-ghost" href="#paper-${escapeHtml(paper.slug)}">Paper</a>`);
  return `
    <article class="sw-card">
      <h3 class="sw-name">${escapeHtml(s.name)}</h3>
      <div class="sw-role">${escapeHtml(s.role || '')}</div>
      <p class="sw-blurb">${escapeHtml(s.blurb || '')}</p>
      ${s.install ? `
        <div class="sw-install">
          <code style="background:transparent;border:none;padding:0;">$ ${escapeHtml(s.install)}</code>
          <button class="copy-btn" data-copy data-copy-text="${escapeHtml(s.install)}">copy</button>
        </div>` : ''}
      <div class="sw-links">${links.join('')}</div>
    </article>
  `;
}

// ---------------------------------------------------------------------------
// Card expand + clipboard
function wireCards() {
  const handler = (e) => {
    const exp = e.target.closest('.card-expand');
    if (exp) {
      const card = exp.closest('.card');
      const isOpen = card.classList.toggle('is-open');
      exp.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      const detail = card.querySelector('.card-detail');
      if (detail) detail.toggleAttribute('hidden', !isOpen);
      if (isOpen) history.replaceState(null, '', '#paper-' + card.dataset.slug);
      return;
    }
    const copy = e.target.closest('[data-copy]');
    if (copy) {
      const txt = copy.dataset.copyText
        || copy.parentElement.textContent.replace(/^\s*copy\s*/i, '').trim();
      navigator.clipboard?.writeText(txt).then(() => {
        copy.textContent = 'copied';
        copy.classList.add('copied');
        setTimeout(() => {
          copy.textContent = 'copy';
          copy.classList.remove('copied');
        }, 1500);
      });
    }
    // intra-page links to talks: expand the talk row
    const talkLink = e.target.closest('[data-talk-link]');
    if (talkLink) {
      const id = talkLink.getAttribute('href').slice(1);
      const row = document.getElementById(id);
      if (row) {
        e.preventDefault();
        row.classList.add('is-open');
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        history.replaceState(null, '', '#' + id);
      }
    }
    // intra-page links to papers: expand + scroll
    const paperLink = e.target.closest('[data-paper-link]');
    if (paperLink) {
      const id = paperLink.getAttribute('href').slice(1);
      const card = document.getElementById(id);
      if (card) {
        e.preventDefault();
        card.classList.add('is-open');
        const detail = card.querySelector('.card-detail');
        if (detail) detail.removeAttribute('hidden');
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', '#' + id);
      }
    }
  };
  document.addEventListener('click', handler);
}

function openFromHash() {
  const h = location.hash.slice(1);
  if (!h) return;
  const el = document.getElementById(h);
  if (!el) return;
  if (h.startsWith('paper-')) {
    el.classList.add('is-open');
    const detail = el.querySelector('.card-detail');
    if (detail) detail.removeAttribute('hidden');
  } else if (h.startsWith('talk-')) {
    el.classList.add('is-open');
    el.setAttribute('aria-expanded', 'true');
  }
  setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

// ---------------------------------------------------------------------------
// Sticky nav reveal + scroll-spy
function wireNav() {
  const nav = $('#topnav');
  const hero = $('.hero');
  const ob = new IntersectionObserver((entries) => {
    nav.classList.toggle('is-visible', !entries[0].isIntersecting);
  }, { threshold: 0.1 });
  ob.observe(hero);

  const links = $$('.topnav-links a');
  const sections = links
    .map((a) => a.getAttribute('href'))
    .filter((h) => h && h.startsWith('#'))
    .map((h) => document.querySelector(h))
    .filter(Boolean);
  const sectObs = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        const id = '#' + e.target.id;
        links.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === id));
      }
    }
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach((s) => sectObs.observe(s));
}

// ---------------------------------------------------------------------------
// Fade-in on scroll
function wireFadeIn() {
  const ob = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        ob.unobserve(e.target);
      }
    }
  }, { threshold: 0.1 });
  $$('.section').forEach((s) => {
    s.classList.add('fade-in');
    ob.observe(s);
  });
}

// ---------------------------------------------------------------------------
// Hero canvas: sparse particle vertex with radiating tracks (jet/Feynman vibe)
function startHeroCanvas() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = $('.hero-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  let w, h, dpr;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = c.offsetWidth; h = c.offsetHeight;
    c.width = w * dpr; c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  const N = Math.min(70, Math.floor((w * h) / 20000));
  const parts = Array.from({ length: N }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.18,
    vy: (Math.random() - 0.5) * 0.18,
    r: Math.random() * 1.6 + 0.4,
  }));

  const vertex = { x: w / 2, y: h * 0.55 };
  function frame() {
    ctx.clearRect(0, 0, w, h);

    // edges to vertex (sparse, faint) — Feynman-line vibe
    for (const p of parts) {
      const dx = p.x - vertex.x;
      const dy = p.y - vertex.y;
      const d = Math.hypot(dx, dy);
      if (d > 320) continue;
      const a = 0.12 * (1 - d / 320);
      ctx.strokeStyle = `rgba(230,57,70,${a})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(vertex.x, vertex.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    // particles
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.fillStyle = 'rgba(244,162,97,0.55)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // central vertex glow
    const grd = ctx.createRadialGradient(vertex.x, vertex.y, 0, vertex.x, vertex.y, 80);
    grd.addColorStop(0, 'rgba(230,57,70,0.35)');
    grd.addColorStop(1, 'rgba(230,57,70,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(vertex.x, vertex.y, 80, 0, Math.PI * 2);
    ctx.fill();

    requestAnimationFrame(frame);
  }
  frame();
}

// ---------------------------------------------------------------------------
// 1990s viewing-mode toggle. Adds/removes body.retro and persists the choice
// in localStorage. When retro is on, sprinkle a few period-appropriate
// decorations (marquee, "under construction", hit counter, guestbook button)
// — all of which get removed when toggling back to modern.
function wireViewMode() {
  const btn = $('#viewmode-toggle');
  if (!btn) return;
  const KEY = 'viewMode';

  const apply = (mode) => {
    const retro = mode === 'retro';
    document.body.classList.toggle('retro', retro);
    btn.textContent = retro ? '🪩 Postmodern mode' : '📟 Modern mode';
    if (retro) installRetroDecorations(); else removeRetroDecorations();
  };

  apply(localStorage.getItem(KEY) === 'retro' ? 'retro' : 'modern');

  btn.addEventListener('click', () => {
    const next = document.body.classList.contains('retro') ? 'modern' : 'retro';
    localStorage.setItem(KEY, next);
    apply(next);
  });
}

// Tracks the timer that ticks the fake visitor counter. Cleared on toggle off.
let retroCounterTimer = null;

function installRetroDecorations() {
  // 1. "Welcome!" wiggle banner above the hero
  if (!$('.retro-welcome')) {
    const w = document.createElement('div');
    w.className = 'retro-welcome';
    w.textContent = '✦ Welcome to my home page! ✦';
    document.body.insertBefore(w, $('.topnav') || $('.hero'));
  }

  // 2. Top marquee
  if (!$('.retro-marquee')) {
    const tagline = $('.hero-tagline')?.textContent.trim() || 'Welcome!';
    const m = document.createElement('marquee');
    m.className = 'retro-marquee';
    m.scrollAmount = 6;
    m.innerHTML = `★ ${escapeHtml(tagline)} ★ &nbsp; &nbsp; sign my guestbook! &nbsp; &nbsp; thanks for visiting! &nbsp; &nbsp; ★`;
    document.body.insertBefore(m, $('.hero').nextSibling);
  }

  // 3. NEW! badge on the most recent (non-joke) paper card
  if (!$('.new-badge')) {
    const newest = researchData
      .filter((p) => !p.joke)
      .reduce((a, b) => (a && a.date > b.date ? a : b), null);
    if (newest) {
      const card = document.getElementById(`paper-${newest.slug}`);
      if (card) {
        const badge = document.createElement('div');
        badge.className = 'new-badge';
        badge.textContent = 'NEW!';
        card.querySelector('.card-body')?.prepend(badge);
      }
    }
  }

  // 4. Under-construction + LIVE-incrementing counter banner above the footer
  if (!$('.retro-decor')) {
    const decor = document.createElement('div');
    decor.className = 'retro-decor';
    let count = 3_141_592 + Math.floor(Math.random() * 1000);
    decor.innerHTML = `
      <div><span class="construction"><span>🚧 UNDER CONSTRUCTION 🚧</span></span></div>
      <div class="netscape">★ Best viewed in Netscape Navigator 4.0 at 800×600 ★</div>
      <div>You are visitor <span class="counter" id="retro-counter">${count.toString().padStart(8,'0')}</span></div>
      <div style="margin-top:8px;">
        <a href="mailto:gambhirb@ucmail.uc.edu" class="btn">📧 Email Me!</a>
        <button class="btn" type="button" onclick="alert('Thanks for signing my guestbook!')">📖 Sign My Guestbook!</button>
      </div>
    `;
    document.querySelector('.site-footer').before(decor);
    retroCounterTimer = setInterval(() => {
      count += 1 + Math.floor(Math.random() * 3);
      const el = document.getElementById('retro-counter');
      if (el) el.textContent = count.toString().padStart(8, '0');
    }, 2400);
  }

  // 5. prev / random / next — actual links to INSPIRE pages of the user's papers
  if (!$('.retro-papernav')) {
    const reals = researchData.filter((p) => !p.joke);
    if (reals.length >= 3) {
      const pick = (excluding = []) => {
        const pool = reals.filter((p) => !excluding.includes(p));
        return pool[Math.floor(Math.random() * pool.length)];
      };
      const a = pick();
      const b = pick([a]);
      const c = pick([a, b]);
      const inspireUrl = (p) => `https://inspirehep.net/literature?q=arxiv:${p.links[0]?.href.match(/arxiv:(\S+)$/)?.[1] || ''}`;
      // Use the paper's actual INSPIRE link (already first in p.links)
      const inspireOf = (p) => p.links.find((l) => /inspire/i.test(l.text))?.href || p.links[0]?.href;
      const nav = document.createElement('div');
      nav.className = 'retro-papernav';
      nav.innerHTML = `
        <div class="nav-title">~ Browse my papers on INSPIRE ~</div>
        <a href="${escapeHtml(inspireOf(a))}" target="_blank" rel="noopener">← prev</a>
        |
        <a href="${escapeHtml(inspireOf(b))}" target="_blank" rel="noopener">random</a>
        |
        <a href="${escapeHtml(inspireOf(c))}" target="_blank" rel="noopener">next →</a>
      `;
      document.querySelector('.site-footer').prepend(nav);
    }
  }

  // 6. Last-updated stamp in footer
  if (!$('.retro-lastupdated')) {
    const stamp = document.createElement('div');
    stamp.className = 'retro-lastupdated';
    const d = new Date();
    stamp.textContent = `Last updated: ${d.toDateString()}`;
    document.querySelector('.site-footer .section-inner')?.appendChild(stamp);
  }
}

function removeRetroDecorations() {
  $('.retro-welcome')?.remove();
  $('.retro-marquee')?.remove();
  $('.retro-decor')?.remove();
  $('.retro-papernav')?.remove();
  $('.retro-lastupdated')?.remove();
  $('.new-badge')?.remove();
  if (retroCounterTimer) { clearInterval(retroCounterTimer); retroCounterTimer = null; }
}

// ---------------------------------------------------------------------------
// Boot
function init() {
  // counts (exclude joke papers from the headline number)
  const realCount = researchData.filter((p) => !p.joke).length;
  $('#researchCount').textContent = `(${realCount})`;
  $('#talkCount').textContent = `(${talkData.length})`;

  // featured (exclude joke papers from featured grid)
  const featured = researchData.filter((p) => p.featured && !p.joke);
  $('#featuredCards').innerHTML = featured.map((p) => paperCard(p, { featured: true })).join('');

  // all research (joke paper is included, slotted in by date)
  $('#researchCards').innerHTML = researchData.map((p) => paperCard(p)).join('');

  // talks: build filters first, then list
  buildFilterControls();
  wireFilterEvents();
  readFilterUrl();
  applyFilters();

  // software
  $('#softwareCards').innerHTML = (softwareData || []).map(softwareCard).join('');

  // wire cards & nav & misc
  wireCards();
  wireNav();
  wireFadeIn();
  startHeroCanvas();
  wireViewMode();

  // footer year
  $('#footerYear').textContent = new Date().getFullYear();

  // initial deep link
  setTimeout(openFromHash, 100);
  window.addEventListener('hashchange', openFromHash);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
