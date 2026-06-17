// talks

import { $, $$, escape_HTML, fmt_date } from './util.js';

// labels and names
const CATEGORY_ORDER = ['invited', 'lectures', 'contributed'];
const CATEGORY_LABEL = {
  invited: 'Invited Talks',
  lectures: 'Lecture Series & Schools',
  contributed: 'Contributed Talks',
};

// current filter state
const state = {
  view: 'sections',
  year: '',
  topics: new Set(),
  featured_only: false,
};

// private variables for data and lookups
let _talk_data = [];
let _pub_by_ID = {};

// get the topic of a talk
function topic_of(t) {
  return t.topic || (t.category === 'invited' ? 'Invited Talks' : '');
}

// check if a talk passes the current filters in state
function row_passes(t) {
  if (state.year && !t.date.startsWith(state.year)) return false;
  if (state.featured_only && !t.featured) return false;
  if (state.topics.size && !state.topics.has(topic_of(t))) return false;
  return true;
}

// apply the current filters to the talk data and re-render the list
function apply_filters() {
  const visible = _talk_data.filter(row_passes);

  // render the talks list
  render_talk_list(visible);
  
  // drop stale query strings 
  if (location.search) {
    history.replaceState(null, '', location.pathname + location.hash);
  }
}

// build a talk row element from a talk object
function build_talk_row(t, { with_category = false } = {}) {
  
  // create an HTML element for the talk row
  const row = document.createElement('div');
  row.className = `talk-row${t.featured ? ' is-featured' : ''}`;
  row.id = `talk-${t.id}`;
  row.dataset.id = t.id;
  row.tabIndex = 0;
  row.setAttribute('role', 'button');
  row.setAttribute('aria-expanded', 'false');

  // icons for slides and video if available
  const slides_icon = t.slides
    ? `<a class="talk-icon" href="${escape_HTML(t.slides)}" target="_blank" rel="noopener" title="Slides" onclick="event.stopPropagation()"><i class="fa fa-file-pdf-o"></i></a>`
    : '';
  const video_icon = t.video
    ? `<a class="talk-icon" href="${escape_HTML(t.video)}" target="_blank" rel="noopener" title="Video" onclick="event.stopPropagation()"><i class="fa fa-play"></i></a>`
    : '';

  // link to paper if available
  const paper = t.paper ? _pub_by_ID[t.paper] : null;
  const paper_link = paper
    ? `Paper: <a href="#paper-${escape_HTML(paper.id)}" data-paper-link>${escape_HTML(paper.title)}</a>`
    : '';

  // category badge if in combined view
  const cat_badge = with_category
    ? `<span class="cat-badge cat-${t.category}">${escape_HTML(CATEGORY_LABEL[t.category] || t.category).replace(/ Talks?$/i,'')}</span>`
    : '';

  // chunk of HTML for the talk with conditionals
  row.innerHTML = `
    <div class="talk-date">${escape_HTML(fmt_date(t.date))}</div>
    <div class="talk-main">
      <div class="talk-title">${cat_badge}${escape_HTML(t.title)}</div>
      <div class="talk-where">${escape_HTML(t.where || '')}</div>
    </div>
    <div class="talk-icons">${slides_icon}${video_icon}</div>
    <div class="talk-detail">
      <div class="meta-line">
        ${escape_HTML((CATEGORY_LABEL[t.category] || t.category))}${t.topic ? ` &middot; ${escape_HTML(t.topic)}` : ''}
      </div>
      ${t.abstract || (paper && paper.blurb)
        ? `<p>${escape_HTML(t.abstract || paper.blurb)}</p>` : ''}
      ${paper_link ? `<p style="font-size:.85rem;color:var(--muted);margin:.4rem 0 0;">${paper_link}</p>` : ''}
    </div>
  `;
  return row;
}

// render a list of talks grouped by year by looping build_talk_row and inserting year headers
function render_year_groups(items, root, { with_category = false } = {}) {
  let last_year = null;
  for (const t of items) {
    const year = t.date.slice(0, 4);
    if (year !== last_year) {
      const h = document.createElement('div');
      h.className = 'year-header';
      h.textContent = year;
      root.appendChild(h);
      last_year = year;
    }
    root.appendChild(build_talk_row(t, { with_category }));
  }
}

// Render the full list of talks
function render_talk_list(items) {

  const root = $('#talkList');
  root.innerHTML = '';

  // if no talks to show, display a message instead of an empty list
  if (!items.length) {
    root.innerHTML = `<p class="section-blurb" style="margin:2rem 0;">No talks match these filters.</p>`;
    return;
  }

  // if in combined view, render all talks together with category badges, otherwise group by category
  if (state.view === 'combined') {
    render_year_groups(items, root, { with_category: true });
    return;
  }

  // group talks by category and render each group with a header for the category and count of talks in that category
  for (const cat of CATEGORY_ORDER) {
    const slice = items.filter((t) => t.category === cat);
    if (!slice.length) continue;
    const block = document.createElement('div');
    block.className = 'talk-cat-block';
    block.innerHTML = `<h3 class="cat-header">${escape_HTML(CATEGORY_LABEL[cat])}
      <span class="count">(${slice.length})</span></h3>`;
    root.appendChild(block);
    render_year_groups(slice, block);
  }
}

// build the filter controls (year dropdown, topic chips) based on the talk data
function build_filter_controls() {

  // populate the year dropdown with unique years from the talk data
  const years = [...new Set(_talk_data.map((t) => t.date.slice(0, 4)))].sort().reverse();
  const year_sel = $('#yearFilter');
  for (const y of years) {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y;
    year_sel.appendChild(opt);
  }

  // populate the topics with unique topics from the talk data, using the topic_of function
  const topics = [...new Set(_talk_data.map(topic_of).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const chip_root = $('#topicFilter');
  for (const top of topics) {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'chip';
    c.textContent = top;
    c.dataset.topic = top;
    chip_root.appendChild(c);
  }
}

// Event listeners for filter controls and talk row expansion
function wire_filter_events() {

  // view mode segmented control
  $$('.filter-segmented .seg').forEach((b) => {
    b.addEventListener('click', () => {
      state.view = b.dataset.view;
      $$('.filter-segmented .seg').forEach((x) => x.classList.toggle('is-active', x === b));
      apply_filters();
    });
  });

  // year filter
  $('#yearFilter').addEventListener('change', (e) => {
    state.year = e.target.value;
    apply_filters();
  });

  // featured only filter
  $('#featuredOnly').addEventListener('change', (e) => {
    state.featured_only = e.target.checked;
    apply_filters();
  });

  // topic filter
  $('#topicFilter').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    const t = c.dataset.topic;
    if (state.topics.has(t)) state.topics.delete(t);
    else state.topics.add(t);
    c.classList.toggle('is-active');
    apply_filters();
  });

  // clear filters button
  $('#clearFilters').addEventListener('click', () => {
    state.view = 'sections';
    state.year = '';
    state.topics.clear();
    state.featured_only = false;
    $('#yearFilter').value = '';
    $('#featuredOnly').checked = false;
    $$('#topicFilter .chip').forEach((c) => c.classList.remove('is-active'));
    $$('.filter-segmented .seg').forEach((b) => b.classList.toggle('is-active', b.dataset.view === 'sections'));
    apply_filters();
  });

  // click or enter on a talk row to expand it and show the details
  $('#talkList').addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    const row = e.target.closest('.talk-row');
    if (!row) return;
    const open = row.classList.toggle('is-open');
    row.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) history.replaceState(null, '', '#talk-' + row.dataset.id);
  });


}

// run everything
export function init_talks({ talk_data, pub_by_ID }) {
  _talk_data = talk_data;
  _pub_by_ID = pub_by_ID;
  $('#talkCount').textContent = `(${talk_data.length})`;
  build_filter_controls();
  wire_filter_events();
  apply_filters();
}

