// retro mode

import { $, escape_HTML } from './util.js';

// Visitor counter timer variable
let counter_timer = null;

// function to initialize retro mode 
export function install_retro(research_data) {


  // welcome banner
  if (!$('.retro-welcome')) {
    const w = document.createElement('div');
    w.className = 'retro-welcome';
    w.textContent = '✦ Welcome to my home page! ✦';
    document.body.insertBefore(w, $('.topnav') || $('.hero'));
  }

  // top marquee
  if (!$('.retro-marquee')) {
    const tagline = $('.hero-tagline')?.textContent.trim() || 'Welcome!';
    const m = document.createElement('marquee');
    m.className = 'retro-marquee';
    m.scroll_amount = 6;
    m.innerHTML = `★ ${escape_HTML(tagline)} ★ &nbsp; &nbsp; thanks for visiting! &nbsp; &nbsp; ★`;
    document.body.insertBefore(m, $('.hero').nextSibling);
  }

  // NEW! badge on the most recent non-joke paper
  if (!$('.new-badge')) {
    const newest = research_data
      .filter((p) => !p.joke)
      .reduce((a, b) => (a && a.date > b.date ? a : b), null);
    if (newest) {
      const card = document.getElementById(`paper-${newest.id}`);
      if (card) {
        const badge = document.createElement('div');
        badge.className = 'new-badge';
        badge.textContent = 'NEW!';
        card.querySelector('.card-body')?.prepend(badge);
      }
    }
  }

  // under-construction banner + visitor counter
  if (!$('.retro-decor')) {
    const decor = document.createElement('div');
    decor.className = 'retro-decor';
    let count = 3141 + Math.floor(Math.random() * 1000);
    decor.innerHTML = `
      <div><span class="construction"><span>🚧 UNDER CONSTRUCTION 🚧</span></span></div>
      <div>You are visitor <span class="counter" id="retro-counter">${count.toString().padStart(8,'0')}</span></div>
      <div style="margin-top:8px;">
        <a href="mailto:gambhirb@ucmail.uc.edu" class="btn">📧 Email Me!</a>
        <button class="btn" type="button" onclick="alert('Thanks for signing my guestbook!')">📖 Sign My Guestbook!</button>
      </div>
    `;
    document.querySelector('.site-footer').before(decor);
    counter_timer = setInterval(() => {
      count += 1 + Math.floor(Math.random() * 3);
      const el = document.getElementById('retro-counter');
      if (el) el.textContent = count.toString().padStart(8, '0');
    }, 2400);
  }

  // prev / random / next paper-nav linking to INSPIRE
  if (!$('.retro-papernav')) {
    const reals = research_data.filter((p) => !p.joke);
    if (reals.length >= 3) {
      const pick = (excluding = []) => {
        const pool = reals.filter((p) => !excluding.includes(p));
        return pool[Math.floor(Math.random() * pool.length)];
      };
      const a = pick();
      const b = pick([a]);
      const c = pick([a, b]);
      const inspire_of = (p) => p.links.find((l) => /inspire/i.test(l.text))?.href || p.links[0]?.href;
      const nav = document.createElement('div');
      nav.className = 'retro-papernav';
      nav.innerHTML = `
        <div class="nav-title">~ Browse my papers on INSPIRE ~</div>
        <a href="${escape_HTML(inspire_of(a))}" target="_blank" rel="noopener">← prev</a>
        |
        <a href="${escape_HTML(inspire_of(b))}" target="_blank" rel="noopener">random</a>
        |
        <a href="${escape_HTML(inspire_of(c))}" target="_blank" rel="noopener">next →</a>
      `;
      document.querySelector('.site-footer').prepend(nav);
    }
  }

  // last-updated stamp
  if (!$('.retro-lastupdated')) {
    const stamp = document.createElement('div');
    stamp.className = 'retro-lastupdated';
    const d = new Date();
    stamp.textContent = `Last updated: ${d.toDateString()}`;
    document.querySelector('.site-footer .section-inner')?.appendChild(stamp);
  }
}

// function to remove retro mode elements and timers
export function remove_retro() {
  $('.retro-welcome')?.remove();
  $('.retro-marquee')?.remove();
  $('.retro-decor')?.remove();
  $('.retro-papernav')?.remove();
  $('.retro-lastupdated')?.remove();
  $('.new-badge')?.remove();
  if (counter_timer) { clearInterval(counter_timer); counter_timer = null; }
}
