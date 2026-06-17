// nav

import { $, $$ } from './util.js';

// navigation bar 
export function wire_nav() {

  // get the nav and hero elements, return early if not found
  const nav = $('#topnav');
  const hero = $('.hero');
  if (!nav || !hero) return;

  // observe the hero, turn on is-visible if hero is less htan 10% visible
  const ob = new IntersectionObserver((entries) => {
    nav.classList.toggle('is-visible', !entries[0].isIntersecting);
  }, { threshold: 0.1 });
  ob.observe(hero);


  // get links and sections links from hrefs
  const links = $$('.topnav-links a');
  const sections = links
    .map((a) => a.getAttribute('href'))
    .filter((h) => h && h.startsWith('#'))
    .map((h) => document.querySelector(h))
    .filter(Boolean);

  // observe the sections, see whih is most visible, and toggle is-active on the corresponding link
  const sect_obs = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        const id = '#' + e.target.id;
        links.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === id));
      }
    }
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach((s) => sect_obs.observe(s));
}

// fade in sections as they come into view
export function wire_fade_in() {

  // observe sections and add is-visible when they are 10% visible
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

// open paper or talk from hash, eg #paper-123 or #talk-456
export function open_from_hash() {

  // get the hash
  const h = location.hash.slice(1);
  if (!h) return;

  // find the element with the id of the hash, return if not found
  const el = document.getElementById(h);
  if (!el) return;

  // scroll to the element and open it if it's a paper or talk
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

// set the footer year to current year
export function wire_footer_year() {
  const el = $('#footerYear');
  if (el) el.textContent = new Date().getFullYear();
}
