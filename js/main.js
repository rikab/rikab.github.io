// main js file

// imports from other js modules and data file (hashed to force cache reloads, from build.py)
import {research_data, talk_data, software_data, author_citations, author_h_index, author_timeline_start, current_month } from '../data.js?v=e97c9f55'; 
import { render_papers, wire_cards, wire_tag_filter } from './papers.js';
import { init_talks } from './talks.js';
import { render_software } from './software.js';
import { draw_author_charts, draw_paper_charts } from './charts.js';
import { start_hero_canvas } from './hero.js';
import { wire_nav, wire_fade_in, open_from_hash, wire_footer_year } from './nav.js';
import { wire_view_mode } from './viewmode.js';

// Look up tables
const pub_by_ID = Object.fromEntries(research_data.map((p) => [p.id, p]));
const talk_by_ID = Object.fromEntries(talk_data.map((t) => [t.id, t]));

function init() {

  // render everything
  render_papers({ research_data, talk_by_ID });
  init_talks({ talk_data, pub_by_ID });
  render_software({ software_data, pub_by_ID });

  // draw charts right away
  draw_author_charts(author_citations, author_h_index, author_timeline_start, current_month);
  draw_paper_charts(research_data, current_month);

  // navigation and interactivity
  wire_cards();
  wire_tag_filter();
  wire_nav();
  wire_fade_in();
  start_hero_canvas();
  wire_view_mode({ research_data, talk_data, software_data, author_citations, author_h_index });
  wire_footer_year();

  setTimeout(open_from_hash, 100);
  window.addEventListener('hashchange', open_from_hash);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
