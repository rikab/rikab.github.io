# cv .tex render

import shutil
import subprocess
import tempfile
from pathlib import Path

from .util import (
    CV_MAIN_TEX, CV_PDF_OUT, GEN_HEADER_TEX, OUT_PUBS_TEX, OUT_TALKS_TEX, ROOT,
    parse_date, pretty_day_month_year, pretty_month_year, tex_escape,
)


# fallback role per talk category
DEFAULT_ROLE = {
    "invited": "Invited Speaker",
    "lectures": "Invited Guest Lecturer",
    "contributed": "",
}

# talks.tex section order; None header = it's in main.tex
CV_TALK_SECTIONS = [
    ("invited", None),
    ("lectures", "Lecture Series and Schools"),
    ("contributed", "Contributed Presentations"),
]



# Write the tex file for a single publication p
def pub_cventry(p):

    # get date
    d = parse_date(p["date"])
    col1 = pretty_month_year(d)

    # title + authors
    col2 = p["cv_title"] if p.get("cv_title") else tex_escape(p["title"])
    col3 = tex_escape(p["authors"])

    # arxiv link
    if p.get("arxiv"):
        ax = str(p["arxiv"])
        col4 = f"\\href{{https://arxiv.org/abs/arXiv:{ax}}}{{arXiv:{ax}}}"
    else:
        col4 = ""

    # journal cell
    j = p.get("journal") or {}
    if j.get("href") and j.get("name"):
        col5 = f"\\href{{{j['href']}}}{{{tex_escape(j['name'])}}}"
    elif j.get("name"):
        col5 = tex_escape(j["name"])
    else:
        col5 = ""

    # notes / code link
    c = p.get("code") or {}
    if c.get("href"):
        col6 = f"Associated code: \\url{{{c['href']}}}"
    elif p.get("cv_note"):
        col6 = tex_escape(p["cv_note"])
    else:
        col6 = ""

    return ("\\cventry{" + col1 + "}{" + col2 + "}{" + col3 + "}{"
            + col4 + "}{" + col5 + "}{" + col6 + "}")


# render the .tex for all publications
def render_publications_tex(pubs):

    # filter and split by status
    in_cv = [p for p in pubs if not p.get("cv_hidden")]
    refereed = [p for p in in_cv if p.get("status") == "refereed"]
    preprints = [p for p in in_cv if p.get("status") == "preprint"]
    refereed.sort(key=lambda p: parse_date(p["date"]), reverse=True)
    preprints.sort(key=lambda p: parse_date(p["date"]), reverse=True)

    # refereed first, preprints below
    out = [GEN_HEADER_TEX]
    out.append("% Refereed Publications (\\section header is in main.tex)\n")
    for p in refereed:
        out.append(pub_cventry(p) + "\n\n")
    out.append("\\section{Preprints}\n\n")
    for p in preprints:
        out.append(pub_cventry(p) + "\n\n")
    return "".join(out)



# Write the tex file for a single talk t
def talk_cventry(t):

    # date + title + event
    d = parse_date(t["date"])
    col1 = t.get("cv_date_override") or pretty_day_month_year(d)
    col2 = tex_escape(t["title"])
    col3 = tex_escape(t.get("cv_event_name", ""))
    col4 = t.get("cv_event_href", "") or ""
    col5 = ""

    # role default by category
    role = t.get("role")
    if role is None:
        role = DEFAULT_ROLE.get(t.get("category", ""), "")
    location = t.get("location") or t.get("where") or ""
    virtual_suffix = " (Virtual)" if t.get("virtual") else ""
    pretty = t.get("cv_date_override") or pretty_day_month_year(d)

    # description has 3 shapes: override, contributed, default
    if t.get("cv_description"):
        col6 = tex_escape(t["cv_description"])
    elif t.get("category") == "contributed":
        event = t.get("event")
        event_dates = t.get("event_dates") or pretty
        if event:
            col6 = f"{tex_escape(event)}, {tex_escape(event_dates)}, {tex_escape(location)}{virtual_suffix}"
        else:
            col6 = f"{tex_escape(location)}, {tex_escape(pretty)}{virtual_suffix}"
    else:
        prefix = f"{tex_escape(role)}, " if role else ""
        col6 = f"{prefix}{tex_escape(pretty)}, {tex_escape(location)}{virtual_suffix}"

    return ("\\cventry{" + col1 + "}{" + col2 + "}{" + col3 + "}{"
            + col4 + "}{" + col5 + "}{" + col6 + "}")


# render the .tex for all talks
def render_talks_tex(talks):

    # cv-visible talks
    in_cv = [t for t in talks if not t.get("cv_hidden") and t.get("category") in DEFAULT_ROLE]
    out = [GEN_HEADER_TEX]

    # one block per section
    for cat, header in CV_TALK_SECTIONS:
        items = [t for t in in_cv if t.get("category") == cat]
        items.sort(key=lambda t: parse_date(t["date"]), reverse=True)
        if header:
            out.append(f"\\section{{{header}}}\n\n")
        else:
            out.append("% Invited Talks (\\section header is in main.tex)\n\n")
        for t in items:
            out.append(talk_cventry(t) + "\n\n")
    return "".join(out)

# write the .tex files for pubs and talks
def write_cv_tex(pubs_raw, talks_raw):
    OUT_PUBS_TEX.parent.mkdir(parents=True, exist_ok=True)
    OUT_PUBS_TEX.write_text(render_publications_tex(pubs_raw))
    OUT_TALKS_TEX.write_text(render_talks_tex(talks_raw))


# compile main.tex and copy the pdf to assets/pdf; skip if no tex engine
def compile_cv_pdf():

    # need latexmk or pdflatex; skip cleanly so the CI build with no TeX still works
    engine = shutil.which("latexmk") or shutil.which("pdflatex")
    if engine is None:
        print("Skipping CV pdf: no latexmk/pdflatex on PATH")
        return False

    # build in a scratch dir so aux files never touch the repo
    with tempfile.TemporaryDirectory() as build_dir:

        # latexmk resolves its own pass count; plain pdflatex needs two
        using_latexmk = engine.endswith("latexmk")
        if using_latexmk:
            cmd = [engine, "-pdf", "-interaction=nonstopmode", "-halt-on-error", "-output-directory=" + build_dir, CV_MAIN_TEX.name]
        else:
            cmd = [engine, "-interaction=nonstopmode", "-halt-on-error", "-output-directory=" + build_dir, CV_MAIN_TEX.name]
        passes = 1 if using_latexmk else 2

        # run from repo root so \input{cv/...} and the photo resolve
        for pass_number in range(passes):
            result = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
            if result.returncode != 0:
                print("CV pdf compile failed; tail of latex output:")
                print(result.stdout[-2000:])
                return False

        # overwrite the served pdf with the freshly built one
        built_pdf = Path(build_dir) / (CV_MAIN_TEX.stem + ".pdf")
        CV_PDF_OUT.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(built_pdf, CV_PDF_OUT)

    return True
