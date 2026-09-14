# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Repository purpose

Personal academic website for Rikab Gambhir, served by GitHub Pages at the custom domain in [CNAME](CNAME) (`rikabgambhir.com`). Single-page static site, no build step or test suite for the site itself. Pushing to `master` deploys.

## Adding a paper, talk, or piece of software

**Edit [content.yaml](content.yaml) and run `python3 scripts/build.py`.** That regenerates [data.js](data.js), [cv/publications.tex](cv/publications.tex), and [cv/talks.tex](cv/talks.tex), and rewrites the `?v=<hash>` cache-bust query on the `data.js` import line inside [js/main.js](js/main.js). The three generated files carry "AUTO-GENERATED, DO NOT EDIT" headers — don't edit them by hand. The cache-bust line in `main.js` (the `from '../data.js?v=...'` import) is also auto-rewritten, so commit the modified `main.js` alongside `data.js`.

If a TeX engine (`latexmk`, else `pdflatex`) is on `PATH`, the build also compiles [main.tex](main.tex) and overwrites [assets/pdf/rikab_CV.pdf](assets/pdf/rikab_CV.pdf) — so adding a paper refreshes the served CV in one step. The compile runs in a temp dir (no `.aux`/`.log` litter in the repo). Pass `--no-cv` to skip it for a fast rebuild; if no TeX engine is found it skips gracefully (this is why CI, which has no LaTeX, still runs `build.py` fine).

The script depends on `pyyaml` (`pip install pyyaml`).

## Local preview

```
python3 -m http.server 8000
```

[data.js](data.js) loads as an ES module via [js/main.js](js/main.js), so a local server is required (browsing via `file://` is blocked by CORS).

## Architecture

The site is a single page driven entirely by [content.yaml](content.yaml). Both the Python build pipeline and the JS frontend are split into single-purpose modules — [scripts/build.py](scripts/build.py) and [js/main.js](js/main.js) are thin entry points only.

- [content.yaml](content.yaml) — source of truth. Three top-level keys: `publications:`, `talks:`, `software:`.
- [index.html](index.html) — markup only. Sticky nav, hero, About, Featured Research, All Research, Stats (`<details>`, holds author-level citation + h-index charts), Talks (with filter bar), Software, footer. Vanilla — **no Bootstrap, no jQuery**.
- [css/style.css](css/style.css) — design-token-driven. All colors live in `:root` custom properties (`--bg`, `--accent`, `--accent-2`, `--surface`, etc.); change them in one place to retheme.
- [css/retro.css](css/retro.css) — every rule scoped under `body.retro`. The "📟 Retro mode" toggle (top-left) flips that class; see [js/retro.js](js/retro.js). The `body.retro` rules + the injected decorations (marquee, counter, paper nav, "NEW!" badge, last-updated stamp) are entirely additive — modern styles untouched. State persists in `localStorage['viewMode']`.
- [main.tex](main.tex) — CV source (moderncv). Pulls in `cv/publications.tex` and `cv/talks.tex` via `\input{}`. Compile with `pdflatex main.tex` and overwrite [assets/pdf/rikab_CV.pdf](assets/pdf/rikab_CV.pdf).

### Python build pipeline (`scripts/`)

[scripts/build.py](scripts/build.py) is a ~60-line orchestrator. Real work lives in:

- [scripts/util.py](scripts/util.py) — paths, date parsing, LaTeX escaping, JSON-as-JS serialization, `slugify`, `month_range`.
- [scripts/inspire.py](scripts/inspire.py) — INSPIRE-HEP HTTP + on-disk caching for BibTeX (`cache/inspire-bibtex/<arxiv>.bib`) and citation timelines (`cache/inspire-citations/<arxiv>.json`, `schema=3`). `CITATION_CACHE_MAX_AGE_DAYS` and self-citation detection (last-name + first-initial matching against `content.yaml`'s `authors` string) live here.
- [scripts/timelines.py](scripts/timelines.py) — pure citation math: `monthly_cumulative`, `compress_series` (drops redundant horizontal points before serialization), and `build_author_timelines` (aggregates per-paper tables into author totals and the running h-index). `AUTHOR_TIMELINE_START_MONTH` lives here.
- [scripts/data_js.py](scripts/data_js.py) — assembles the publication / talk / software dicts, runs the paper↔talk cross-ref heuristic (`TOPIC_PAPER_MAP` and `TITLE_KEYWORD_PAPER_MAP` — edit here to teach the inference about a new paper), emits `data.js`, and rewrites the `?v=<hash>` cache-bust on `js/main.js`.
- [scripts/cv_tex.py](scripts/cv_tex.py) — renders `cv/publications.tex` and `cv/talks.tex` as moderncv `\cventry{...}` lines.

Modules use relative imports (`from .util import ...`), and `build.py` patches `sys.path` so `python3 scripts/build.py` works without `-m scripts.build`.

### JS frontend (`js/`)

[js/main.js](js/main.js) is a 49-line boot that imports from [data.js](data.js) (with the `?v=<hash>` cache-bust) and wires the modules:

- [js/util.js](js/util.js) — `$` / `$$` DOM helpers, `escapeHtml`, date formatters, `renderAuthors` (bolds the user's own name).
- [js/papers.js](js/papers.js) — paper-card rendering, expand/collapse, BibTeX clipboard copy, tag-chip filter (chips delegate-listen across both the Featured and All Research grids).
- [js/talks.js](js/talks.js) — talk list rendering, filter bar, URL sync (`?year=`, `?topics=`, `?featured=1`).
- [js/software.js](js/software.js) — software cards.
- [js/charts.js](js/charts.js) — SVG line charts: author-level citations + h-index timelines, plus per-paper expanded-card charts. The Stats `<details>` is collapsed by default, but the charts are drawn at boot anyway (cheap).
- [js/hero.js](js/hero.js) — Feynman-canvas hero animation (sparse particle vertex, respects `prefers-reduced-motion`).
- [js/nav.js](js/nav.js) — sticky-nav reveal, scroll-spy active highlighting, fade-in-on-scroll, hash-based deep-link openers.
- [js/retro.js](js/retro.js) — retro-mode toggle + decoration injection/teardown.

## YAML schema (the bits worth knowing)

### `publications:`
Required: `title`, `date`, `authors`, `status` (`refereed` | `preprint`).
Common optional: `arxiv` (string), `journal: {name, href}`, `code: {name, href}`, `img`, `blurb`.
Site-only optional:
- `slug` — URL fragment (default derived from title's first word). Used for `#paper-<slug>` deep links and as the cross-ref key from talks/software.
- `featured: true` — surfaces the paper in the "Featured Research" grid.
- `tags: [...]` — chips shown on the card.
- `abstract: |` — long form; appears in the expanded card. Falls back to `blurb` if absent.
- `bibtex: |` — appears with a "copy" button in the expanded card.
- `hidden: true` — skip on site (still in CV unless `cv_hidden`).
- `joke: true` — April Fools paper. Excluded from author-level totals + h-index and skips INSPIRE fetches; the site shows it with a "🃏 April Fools" badge and a `card-joke` style.
CV-only overrides: `cv_title`, `cv_note`, `cv_hidden: true`.

### `talks:`
Required: `title`, `date`, `category` (`invited` | `lectures` | `contributed`).
Common optional: `where`, `slides`, `video`, `featured`, `topic`, `location`, `event`, `event_dates`, `virtual`, `role`.
Site-only optional:
- `paper: <slug>` — explicit cross-reference to a publication. If absent, [scripts/data_js.py](scripts/data_js.py) auto-infers via `TOPIC_PAPER_MAP` and `TITLE_KEYWORD_PAPER_MAP` (edit those constants to teach the inference about a new paper).
- `abstract: |` — overrides the default talk-detail text (which falls back to the linked paper's `blurb`).
- `site_show: false` — hide on site (still in CV).
CV-only overrides: `cv_description`, `cv_date_override`, `cv_event_name`, `cv_event_href`, `cv_hidden`.

### `software:`
`name`, `role`, `install` (optional `pip install …`), `github`, `homepage` (optional), `paper: <slug>` (optional cross-link to a publication), `blurb`.

## Theme tweaks

Edit `:root` in [css/style.css](css/style.css). The relevant tokens are `--accent` (red), `--accent-2` (warm amber for tags / featured stars), `--bg`, `--surface`, `--text`, `--muted`. Everything else cascades from those. Retro mode is a wholly separate cascade — [css/retro.css](css/retro.css), scoped under `body.retro` — so tweaks to `--accent` etc. don't affect it.

## Deep links

- `#paper-<slug>` opens that paper's expanded card and scrolls to it.
- `#talk-<id>` opens that talk's expanded row and scrolls to it.
- `?year=2025`, `?topics=SPECTER%20%E2%80%93%20Spectral%20EMD`, `?featured=1` filter the talk list. Filter state syncs to the URL while you toggle.

## Citations from INSPIRE-HEP

Each paper's citation timeline (one cumulative count per month, derived by
querying citing-paper dates) is fetched from INSPIRE-HEP and cached at
`cache/inspire-citations/<arxiv>.json`. Tracked in git so the GitHub Actions
weekly cron can persist updates between runs.

The build script's `CITATION_CACHE_MAX_AGE_DAYS` (default 6) controls how stale
the cache may be before a local rebuild re-fetches. To force a clean refetch,
delete `cache/inspire-citations/`.

Self-citations are flagged by matching each citing paper's authors
(last-name + first-initial) against the cited paper's `authors` YAML string;
the cache stores the per-citation author keys so the flag can be recomputed
later without re-fetching when the cited author list changes. Bumping the
schema → bump `CITATION_CACHE_SCHEMA` in [scripts/inspire.py](scripts/inspire.py).

Author-level series (`authorCitations` and `authorHIndex` in `data.js`) are
derived from the per-paper timelines in pure Python — the h-index at month T
is the largest h such that ≥ h papers have ≥ h citations by T. Papers
marked `joke: true` (the April Fools entry) are excluded from both totals and
h-index.

The weekly refresh runs via [.github/workflows/refresh-inspire.yml](.github/workflows/refresh-inspire.yml)
(Mondays 09:00 UTC) and can also be triggered on demand from the GitHub UI.
The workflow deletes the citation cache, runs `python3 scripts/build.py`, and
commits any diff (including the rewritten `js/main.js` cache-bust line) back
to `master` as the github-actions[bot].

## CV compile

`python3 scripts/build.py` now compiles the CV automatically when a TeX engine is present (see "Adding a paper" above), so the manual route below is only needed for debugging the LaTeX itself:

```
pdflatex main.tex
cp main.pdf assets/pdf/rikab_CV.pdf
```

CI does not build the CV — the GitHub Actions runner has no LaTeX, so `build.py`'s CV step skips there and the weekly cron only commits `data.js`/`cache`/`main.js`. The previous `hyperref` option-clash issue is fixed (moderncv's hyperref is now configured via `\AtBeginDocument{\hypersetup{...}}`).
