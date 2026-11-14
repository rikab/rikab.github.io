import { $, escape_HTML } from './util.js';

// function to initialize retro mode
export function install_retro(research_data) {

  // welcome banner
  const w = document.createElement('div');
  w.className = 'retro-welcome';
  w.textContent = '✦ Welcome to my home page! ✦';
  document.body.insertBefore(w, $('.topnav'));

  // top marquee
  const tagline = $('.hero-tagline').textContent.trim();
  const m = document.createElement('marquee');
  m.className = 'retro-marquee';
  m.scrollAmount = 6;
  m.innerHTML = `★ ${escape_HTML(tagline)} ★ &nbsp; &nbsp; thanks for visiting! &nbsp; &nbsp; ★`;
  document.body.insertBefore(m, $('.hero').nextSibling);

  // NEW! badge on the most recent non-joke paper
  const newest = research_data.find((p) => !p.joke);
  const badge = document.createElement('div');
  badge.className = 'new-badge';
  badge.textContent = 'NEW!';
  document.getElementById(`paper-${newest.id}`).querySelector('.card-body').prepend(badge);

  // under-construction banner + visitor counter
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
  setInterval(() => {
    count += 1 + Math.floor(Math.random() * 3);
    document.getElementById('retro-counter').textContent = count.toString().padStart(8, '0');
  }, 2400);

  // prev / random / next paper-nav linking to INSPIRE
  const reals = research_data.filter((p) => !p.joke);
  const pick = (excluding = []) => {
    const pool = reals.filter((p) => !excluding.includes(p));
    return pool[Math.floor(Math.random() * pool.length)];
  };
  const a = pick();
  const b = pick([a]);
  const c = pick([a, b]);
  const nav = document.createElement('div');
  nav.className = 'retro-papernav';
  nav.innerHTML = `
    <div class="nav-title">~ Browse my papers on INSPIRE ~</div>
    <a href="${escape_HTML(a.links[0].href)}" target="_blank" rel="noopener">← prev</a>
    |
    <a href="${escape_HTML(b.links[0].href)}" target="_blank" rel="noopener">random</a>
    |
    <a href="${escape_HTML(c.links[0].href)}" target="_blank" rel="noopener">next →</a>
  `;
  document.querySelector('.site-footer').prepend(nav);

  // last-updated stamp
  const stamp = document.createElement('div');
  stamp.className = 'retro-lastupdated';
  stamp.textContent = `Last updated: ${new Date().toDateString()}`;
  document.querySelector('.site-footer .section-inner').appendChild(stamp);
}
