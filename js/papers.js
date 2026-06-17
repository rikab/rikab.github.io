// paper card rendering 

// 
import { $, $$, escape_HTML, fmt_date, fmt_month_year, render_authors } from './util.js';

// private variables to hold data
let _research_data = [];
let _talk_by_ID = {};
let _active_tag = null;

// given a paper object, return the HTML for its card
function paper_card(p, { featured = false } = {}) {

  // links and tags HTML
  const links_HTML = (p.links || []).map((l) => (
    `<a class="btn btn-sm" href="${escape_HTML(l.href)}" target="_blank" rel="noopener">${escape_HTML(l.text)}</a>`
  )).join('');

  // tags HTML
  const tags_HTML = (p.tags || []).map((t) => (
    `<button type="button" class="tag" data-tag="${escape_HTML(t)}">${escape_HTML(t)}</button>`
  )).join('');

  // star for featured papers, joke badge for april fools papers
  const star = p.featured && !p.joke ? `<span class="card-star" title="Featured">★</span>` : '';
  const joke_badge = p.joke
    ? `<span class="joke-badge" title="April Fools paper">🃏 April Fools</span>`
    : '';

  // chunk of HTML for the card
  // conditions using ?. and || to handle missing data
  return `
    <article class="card${featured ? ' card-featured' : ''}${p.joke ? ' card-joke' : ''}" id="paper-${escape_HTML(p.id)}" data-id="${escape_HTML(p.id)}">
      ${joke_badge}
      ${star}
      <div class="card-row">
        <div class="card-thumb">
          ${p.img ? `<img src="${escape_HTML(p.img)}" alt="" loading="lazy">` : ''}
        </div>
        <div class="card-body">
          <h3 class="card-title">${escape_HTML(p.title)}</h3>
          <p class="card-meta">
            ${render_authors(p.authors)} &middot; ${escape_HTML(fmt_month_year(p.date))}
          </p>
          ${tags_HTML ? `<div class="card-tags">${tags_HTML}</div>` : ''}
          <p class="card-blurb">${escape_HTML(p.blurb || '')}</p>
          <div class="card-links">${links_HTML}</div>
        </div>
      </div>
      ${(p.abstract || p.bibtex || p.talks?.length || p.citations?.length) ? `
        <button class="card-expand" aria-expanded="false" aria-controls="detail-${escape_HTML(p.id)}">
          Read more <span class="chev">▾</span>
        </button>
        <div class="card-detail" id="detail-${escape_HTML(p.id)}" hidden>
          ${p.citations?.length ? `
            <h4>Citations over time
              <span class="cite-total">(${p.citations_total} total &middot; ${p.citations_total_excl_self} excl. self)</span>
            </h4>
            <figure class="paper-chart-wrap">
              <figcaption>
                <span class="legend"><span class="swatch sw-red"></span> Total</span>
                <span class="legend"><span class="swatch sw-amber"></span> Excl. self</span>
              </figcaption>
              <svg class="chart paper-chart" role="img" aria-label="Cumulative citations for ${escape_HTML(p.title)}"></svg>
            </figure>
          ` : ''}
          ${p.abstract ? `<h4>Abstract</h4><p class="card-abstract">${escape_HTML(p.abstract)}</p>` : ''}
          ${p.bibtex ? `
            <h4>BibTeX</h4>
            <div class="card-bibtex"><button class="copy-btn" data-copy>copy</button>${escape_HTML(p.bibtex)}</div>
          ` : ''}
          ${p.talks?.length ? `
            <h4>Talks on this paper (${p.talks.length})</h4>
            <ul class="related-talks">
              ${p.talks.map((tid) => {
                const t = _talk_by_ID[tid];
                return t ? `<li><a href="#talk-${escape_HTML(t.id)}" data-talk-link>
                  <strong>${escape_HTML(fmt_date(t.date))}</strong> &middot; ${escape_HTML(t.where)}
                </a></li>` : '';
              }).join('')}
            </ul>
          ` : ''}
        </div>
      ` : ''}
    </article>
  `;
}

// render all papers into the page
export function render_papers({ research_data, talk_by_ID }) {

  // store data in private variables
  _research_data = research_data;
  _talk_by_ID = talk_by_ID;

  // count real papers (excluding jokes) and put in header
  const real_count = research_data.filter((p) => !p.joke).length;
  $('#researchCount').textContent = `(${real_count})`;

  // featured papers in their own grid, the rest in the main grid, with the paper_card HTML inserted
  const featured = research_data.filter((p) => p.featured && !p.joke);
  $('#featuredCards').innerHTML = featured.map((p) => paper_card(p, { featured: true })).join('');
  $('#researchCards').innerHTML = research_data.map((p) => paper_card(p)).join('');
}

// tag filter for activating a paper
function set_active_tag(tag) {

  _active_tag = tag;
  
  // hide cards that don't carry the tag
  for (const card of $$('#researchCards .card')) {
    const id = card.dataset.id;
    const paper = _research_data.find((p) => p.id === id);
    const tags = paper?.tags || [];
    card.style.display = (!tag || tags.includes(tag)) ? '' : 'none';
  }
  
  // sync the active class across every chip with the same label
  for (const chip of $$('.card-tags .tag')) {
    chip.classList.toggle('is-active', chip.dataset.tag === tag);
  }

  const banner = $('#tagFilterBanner');
  if (!banner) return;
  if (tag) {
    banner.hidden = false;
    banner.innerHTML = `
      Filtered by tag
      <span class="tag-filter-label">${escape_HTML(tag)}</span>
      <button type="button" class="tag-filter-clear" id="tagFilterClearBtn">clear</button>
    `;
  } else {
    banner.hidden = true;
    banner.innerHTML = '';
  }
}

// check for clicks
export function wire_tag_filter() {

  // delegate chip clicks
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.card-tags .tag');
    if (chip) {
      e.stopPropagation();
      const tag = chip.dataset.tag;
      set_active_tag(_active_tag === tag ? null : tag);
      // scroll All Research into view when a featured-grid chip is clicked
      $('#research')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (e.target.closest('#tagFilterClearBtn')) {
      set_active_tag(null);
    }
  });
}

// cards 
export function wire_cards() {

  // Check for click on cards
  const handler = (e) => {
    const exp = e.target.closest('.card-expand');
    if (exp) {
      const card = exp.closest('.card');
      const is_open = card.classList.toggle('is-open');

      // Expand the card
      exp.setAttribute('aria-expanded', is_open ? 'true' : 'false');
      const detail = card.querySelector('.card-detail');
      if (detail) detail.toggleAttribute('hidden', !is_open);
      if (is_open) history.replaceState(null, '', '#paper-' + card.dataset.id);
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
      }, () => {
        copy.textContent = 'copy failed';
        setTimeout(() => { copy.textContent = 'copy'; }, 1500);
      });
    }

    // check for talk link and open the talk if found
    const talk_link = e.target.closest('[data-talk-link]');
    if (talk_link) {
      const id = talk_link.getAttribute('href').slice(1);
      const row = document.getElementById(id);
      if (row) {
        e.preventDefault();
        row.classList.add('is-open');
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        history.replaceState(null, '', '#' + id);
      }
    }

    // check for paper link and open the paper if found
    const paper_link = e.target.closest('[data-paper-link]');
    if (paper_link) {
      const id = paper_link.getAttribute('href').slice(1);
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
