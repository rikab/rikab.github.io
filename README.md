# rikabgambhir.com

Personal academic website for Rikab Gambhir, served by GitHub Pages.

## Adding a paper or talk

Edit [content.yaml](content.yaml) and run:

```
python3 scripts/build.py
```

That regenerates [data.js](data.js) (website) and [cv/publications.tex](cv/publications.tex) / [cv/talks.tex](cv/talks.tex) (CV). Never edit those by hand.

## Local preview

```
python3 -m http.server 8000
```

Open http://localhost:8000.

## Layout

- [index.html](index.html), [css/style.css](css/style.css), [js/main.js](js/main.js) — the site (vanilla; no Bootstrap or jQuery).
- [content.yaml](content.yaml) — single source of truth for publications, talks, software.
- [scripts/build.py](scripts/build.py) — generator (Python + PyYAML).
- [main.tex](main.tex) — CV source (`moderncv`); compile with `pdflatex main.tex` then `cp main.pdf assets/pdf/rikab_CV.pdf`.

