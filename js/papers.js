import { $, $$, escape_HTML, fmt_date, fmt_month_year, render_authors } from './util.js';

// tag filtering All Research
let active_tag = null;

// html for one paper card
function paper_card(p, talk_by_ID, featured) {

  // link buttons, tag chips, star, and joke badge
  const links_HTML = p.links.map((l) => `<a class="btn btn-sm" href="${escape_HTML(l.href)}" target="_blank" rel="noopener">${escape_HTML(l.text)}</a>`).join('');
  const tags_HTML = p.tags.map((t) => `<button type="button" class="tag" data-tag="${escape_HTML(t)}">${escape_HTML(t)}</button>`).join('');
  const star = p.featured ? '<span class="card-star" title="Featured">★</span>' : '';
  const joke_badge = p.joke ? '<span class="joke-badge" title="April Fools paper">🃏 April Fools</span>' : '';

  // id prefix for the featured copy
  const prefix = featured ? 'featured-' : '';

  // card markup
  return `
    <article class="card${p.joke ? ' card-joke' : ''}" id="${prefix}paper-${escape_HTML(p.id)}" data-id="${escape_HTML(p.id)}">
      ${joke_badge}
      ${star}
      <div class="card-row">
        <div class="card-thumb">
          <img src="${escape_HTML(p.img)}" alt="" loading="lazy">
        </div>
        <div class="card-body">
          <h3 class="card-title">${escape_HTML(p.title)}</h3>
          <p class="card-meta">
            ${render_authors(p.authors)} &middot; ${escape_HTML(fmt_month_year(p.date))}
          </p>
          ${tags_HTML ? `<div class="card-tags">${tags_HTML}</div>` : ''}
          <p class="card-blurb">${escape_HTML(p.blurb)}</p>
          <div class="card-links">${links_HTML}</div>
        </div>
      </div>
      ${(p.bibtex || p.talks.length || p.citations.length) ? `
        <button class="card-expand" aria-expanded="false" aria-controls="${prefix}detail-${escape_HTML(p.id)}">
          Read more <span class="chev">▾</span>
        </button>
        <div class="card-detail" id="${prefix}detail-${escape_HTML(p.id)}">
          ${p.citations.length ? `
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
          ${p.bibtex ? `
            <h4>BibTeX</h4>
            <div class="card-bibtex"><button class="copy-btn" data-copy>copy</button>${escape_HTML(p.bibtex)}</div>
          ` : ''}
          ${p.talks.length ? `
            <h4>Talks on this paper (${p.talks.length})</h4>
            <ul class="related-talks">
              ${p.talks.map((id) => talk_by_ID[id]).map((t) => `<li><a href="#talk-${escape_HTML(t.id)}">
                <strong>${escape_HTML(fmt_date(t.date))}</strong> &middot; ${escape_HTML(t.where)}
              </a></li>`).join('')}
            </ul>
          ` : ''}
        </div>
      ` : ''}
    </article>
  `;
}

// paper count, featured grid, and All Research grid
export function render_papers({ research_data, talk_by_ID }) {
  $('#researchCount').textContent = `(${research_data.filter((p) => !p.joke).length})`;
  $('#featuredCards').innerHTML = research_data.filter((p) => p.featured).map((p) => paper_card(p, talk_by_ID, true)).join('');
  $('#researchCards').innerHTML = research_data.map((p) => paper_card(p, talk_by_ID, false)).join('');
}

// All Research tag filter
function set_active_tag(tag) {

  // hide cards without the tag and mark matching chips
  active_tag = tag;
  for (const card of $$('#researchCards .card')) {
    card.style.display = !tag || card.querySelector(`.tag[data-tag="${tag}"]`) ? '' : 'none';
  }
  for (const chip of $$('.card-tags .tag')) {
    chip.classList.toggle('is-active', chip.dataset.tag === tag);
  }

  // banner with the tag and a clear button
  const banner = $('#tagFilterBanner');
  banner.hidden = !tag;
  banner.innerHTML = tag ? `Filtered by tag <span class="tag-filter-label">${escape_HTML(tag)}</span> <button type="button" class="tag-filter-clear" id="tagFilterClearBtn">clear</button>` : '';
}

// tag chip and clear button clicks
export function wire_tag_filter() {
  document.addEventListener('click', (e) => {

    // chip toggle and scroll to All Research
    const chip = e.target.closest('.card-tags .tag');
    if (chip) {
      set_active_tag(active_tag === chip.dataset.tag ? null : chip.dataset.tag);
      $('#research').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // clear button
    if (e.target.closest('#tagFilterClearBtn')) set_active_tag(null);
  });
}

// expand and bibtex copy buttons
export function wire_cards() {
  document.addEventListener('click', (e) => {

    // expand toggle and URL hash
    const expand = e.target.closest('.card-expand');
    if (expand) {
      const card = expand.closest('.card');
      const is_open = card.classList.toggle('is-open');
      expand.setAttribute('aria-expanded', is_open);
      if (is_open) history.replaceState(null, '', '#paper-' + card.dataset.id);
    }

    // copy bibtex or an install command
    const copy = e.target.closest('[data-copy]');
    if (copy) {
      const text = copy.dataset.copyText || copy.parentElement.textContent.replace(/^\s*copy\s*/i, '').trim();
      navigator.clipboard?.writeText(text).then(() => {
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
  });
}
