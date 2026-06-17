// software cards

import { $, escape_HTML } from './util.js';


function software_card(s, pub_by_ID) {

  // look up the linked paper, if any, to show a paper link button
  const paper = s.paper ? pub_by_ID[s.paper] : null;
  const links = [];

  // conditionally add buttons for GitHub, homepage, and linked paper
  if (s.github) links.push(`<a class="btn btn-sm" href="${escape_HTML(s.github)}" target="_blank" rel="noopener">GitHub</a>`);
  if (s.homepage) links.push(`<a class="btn btn-sm" href="${escape_HTML(s.homepage)}" target="_blank" rel="noopener">Homepage</a>`);
  if (paper) links.push(`<a class="btn btn-sm btn-ghost" href="#paper-${escape_HTML(paper.id)}">Paper</a>`);
  
  // chunk of HTML for the software card
  return `
    <article class="sw-card">
      <h3 class="sw-name">${escape_HTML(s.name)}</h3>
      <div class="sw-role">${escape_HTML(s.role || '')}</div>
      <p class="sw-blurb">${escape_HTML(s.blurb || '')}</p>
      ${s.install ? `
        <div class="sw-install">
          <code style="background:transparent;border:none;padding:0;">$ ${escape_HTML(s.install)}</code>
          <button class="copy-btn" data-copy data-copy-text="${escape_HTML(s.install)}">copy</button>
        </div>` : ''}
      <div class="sw-links">${links.join('')}</div>
    </article>
  `;
}

// render the software cards
export function render_software({ software_data, pub_by_ID }) {
  $('#softwareCards').innerHTML = (software_data || [])
    .map((s) => software_card(s, pub_by_ID)).join('');
}
