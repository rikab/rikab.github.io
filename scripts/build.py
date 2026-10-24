#!/usr/bin/env python3

# Python script to build data.js and cv tex files from data.yaml.
import sys
from pathlib import Path

if __name__ == "__main__" and __package__ is None:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    __package__ = "scripts"

import yaml

# local modules
from .cv_tex import compile_cv_pdf, write_cv_tex
from .data_js import attach_talks_to_pubs, build_publications, build_software, build_talks, write_data_js
from .html_theme_build import write_html_theme, write_index_about
from .timelines import build_author_timelines
from .util import CV_PDF_OUT, OUT_DATA_JS, OUT_PUBS_TEX, OUT_TALKS_TEX, SRC


# build summary
def print_outputs(version, html_path):

    # written files and cache-bust
    print(f"Wrote {OUT_DATA_JS.relative_to(OUT_DATA_JS.parent.parent)}")
    print(f"Wrote {OUT_PUBS_TEX.relative_to(OUT_DATA_JS.parent.parent)}")
    print(f"Wrote {OUT_TALKS_TEX.relative_to(OUT_DATA_JS.parent.parent)}")
    print(f"Wrote {html_path.relative_to(OUT_DATA_JS.parent.parent)}")
    print(f"Cache-bust: data.js?v={version}")


def main():

    # parse yaml
    with SRC.open() as f:
        data = yaml.safe_load(f)

    # top-level sections
    pubs = data.get("publications") or []
    talks = data.get("talks") or []
    software = data.get("software") or []

    # assemble web-side structures
    pubs_out = build_publications(pubs)
    talks_out = build_talks(talks, {p["id"] for p in pubs_out})
    attach_talks_to_pubs(pubs_out, talks_out)
    software_out = build_software(software)
    author_cites, author_h = build_author_timelines(pubs_out)

    # write data.js and cv tex
    version = write_data_js(pubs_out, talks_out, software_out, author_cites, author_h)
    write_cv_tex(pubs, talks)

    # html mode page and the About section of index.html
    html_path = write_html_theme(data["about"], pubs_out, talks_out, software_out, author_cites, author_h)
    write_index_about(data["about"])

    # report outputs
    print_outputs(version, html_path)

    # compile main.tex and refresh the served pdf unless told not to
    if "--no-cv" not in sys.argv:
        if compile_cv_pdf():
            print(f"Wrote {CV_PDF_OUT.relative_to(CV_PDF_OUT.parent.parent.parent)}")


if __name__ == "__main__":
    main()
