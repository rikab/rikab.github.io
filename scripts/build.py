import html
import json
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from datetime import date
from pathlib import Path

import yaml

# repo root and the INSPIRE download cache
ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "cache"

# current month and first month of the author charts
THIS_MONTH = date.today().strftime("%Y-%m")
AUTHOR_START_MONTH = "2020-01"

# max age of cached INSPIRE data
CACHE_MAX_AGE_DAYS = 6


# GET a url as text
def fetch(url):
    with urllib.request.urlopen(url, timeout=10) as response:
        return response.read().decode()


# (last name, first initial) from "First Last" or INSPIRE's "Last, First"
def author_key(name):

    # reorder "Last, First"
    if "," in name:
        last, first = name.split(",", 1)
        name = f"{first} {last}"

    # last word and first letter
    words = name.split()
    return (words[-1].lower(), words[0][0].lower())


# month and self-citation flag of each paper citing recid
def citing_papers(recid, authors):

    # date and author names of every citing paper
    own = {author_key(name) for name in authors.split(",")}
    url = f"https://inspirehep.net/api/literature?q=refersto:recid:{recid}&fields=earliest_date,authors.full_name&size=1000"
    hits = json.loads(fetch(url))["hits"]["hits"]

    # month and self flag per citing paper
    citations = []
    for hit in hits:
        names = {author_key(author["full_name"]) for author in hit["metadata"].get("authors", [])}
        citations.append({"month": (hit["metadata"]["earliest_date"] + "-01")[:7], "self": bool(own & names)})
    return sorted(citations, key=lambda citation: (citation["month"], citation["self"]))


# bibtex and citations for an arxiv id
def get_inspire(arxiv, authors):

    # cached copy if fresh
    path = CACHE / "inspire" / f"{arxiv}.json"
    if path.exists():
        cached = json.loads(path.read_text())
        if (date.today() - date.fromisoformat(cached["fetched"])).days < CACHE_MAX_AGE_DAYS:
            return cached

    # INSPIRE record number
    api = "https://inspirehep.net/api/literature"
    hits = json.loads(fetch(f"{api}?q=arxiv:{arxiv}&fields=control_number"))["hits"]["hits"]
    if not hits:
        print(f"arXiv:{arxiv} is not on INSPIRE yet")
        return {"bibtex": "", "citations": []}

    # fetch and cache
    inspire = {
        "fetched": date.today().isoformat(),
        "bibtex": fetch(f"{api}?q=arxiv:{arxiv}&format=bibtex").strip(),
        "citations": citing_papers(hits[0]["metadata"]["control_number"], authors),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(inspire))
    return inspire


# YYYY-MM from start through THIS_MONTH
def months_since(start):

    # months between start and THIS_MONTH
    months = [f"{year}-{month:02d}" for year in range(int(start[:4]), date.today().year + 1) for month in range(1, 13)]
    return [month for month in months if start <= month <= THIS_MONTH]


# running citation count for each month from start to now
def monthly_counts(start, citation_months):
    return [{"month": month, "count": sum(cited <= month for cited in citation_months)} for month in months_since(start)]


# author-wide citations and h-index per month
def author_series(research_data):

    # month-to-count lookup per non-joke paper
    papers = [paper for paper in research_data if not paper["joke"]]
    counts = [{point["month"]: point["count"] for point in paper["citations"]} for paper in papers]
    counts_excl = [{point["month"]: point["count"] for point in paper["citations_excl_self"]} for paper in papers]

    # totals and h = #{r : r-th best count >= r}
    citations = []
    h_index = []
    for month in months_since(AUTHOR_START_MONTH):
        per_paper = sorted((paper.get(month, 0) for paper in counts), reverse=True)
        citations.append({"month": month, "total": sum(per_paper), "excl_self": sum(paper.get(month, 0) for paper in counts_excl)})
        h_index.append({"month": month, "h": sum(count >= rank for rank, count in enumerate(per_paper, 1))})
    return citations, h_index


# INSPIRE, arXiv, journal, and code buttons on a paper card
def paper_links(pub):

    # INSPIRE and arXiv
    links = [
        {"text": "INSPIRE-HEP", "href": f"https://inspirehep.net/literature?q=arxiv:{pub['arxiv']}"},
        {"text": f"arXiv {pub['arxiv']}", "href": f"https://arxiv.org/abs/{pub['arxiv']}"},
    ]

    # journal and code
    return links + [{"text": pub[key]["name"], "href": pub[key]["href"]} for key in ("journal", "code") if key in pub]


# one publication for data.js
def publication_entry(pub):

    # INSPIRE bibtex and citations
    inspire = get_inspire(pub["arxiv"], pub["authors"])
    joke = pub.get("joke", False)
    citations = [] if joke else inspire["citations"]
    non_self = [citation["month"] for citation in citations if not citation["self"]]
    start = pub["date"].strftime("%Y-%m")

    # data.js fields
    return {
        "id": pub["id"],
        "title": pub["title"],
        "date": pub["date"].isoformat(),
        "authors": pub["authors"],
        "img": pub["img"],
        "blurb": pub["blurb"].strip(),
        "tags": pub.get("tags", []),
        "featured": pub.get("featured", False),
        "joke": joke,
        "status": pub["status"],
        "bibtex": inspire["bibtex"],
        "links": paper_links(pub),
        "talks": [],
        "citations": [] if joke else monthly_counts(start, [citation["month"] for citation in citations]),
        "citations_excl_self": [] if joke else monthly_counts(start, non_self),
        "citations_total": len(citations),
        "citations_total_excl_self": len(non_self),
        "citation_start": start,
    }


# one talk for data.js
def talk_entry(talk):

    # id from title and date
    talk_id = re.sub("[^a-z0-9]+", "-", talk["title"].lower()).strip("-")[:40] + "-" + talk["date"].isoformat()

    # data.js fields
    return {
        "id": talk_id,
        "title": talk["title"],
        "where": talk.get("where", ""),
        "date": talk["date"].isoformat(),
        "category": talk["category"],
        "topic": talk.get("topic", ""),
        "slides": talk.get("slides"),
        "video": talk.get("video"),
        "featured": talk.get("featured", False),
        "paper": talk.get("paper"),
    }


# one software package for data.js
def software_entry(package):
    return {
        "name": package["name"],
        "role": package["role"],
        "install": package.get("install", ""),
        "github": package["github"],
        "homepage": package.get("homepage", ""),
        "paper": package.get("paper"),
        "blurb": package["blurb"].strip(),
    }


# data.js with one list item per line
def write_data_js(exports):

    # one export statement per name
    statements = ["// generated by scripts/build.py from content.yaml, do not edit"]
    for name, value in exports.items():
        if isinstance(value, list):
            items = ",\n".join(json.dumps(item, ensure_ascii=False) for item in value)
            statements.append(f"export const {name} = [\n{items}\n];")
        else:
            statements.append(f"export const {name} = {json.dumps(value)};")
    (ROOT / "data.js").write_text("\n\n".join(statements) + "\n")


# latex special characters
TEX_ESCAPES = {
    "\\": r"\textbackslash{}",
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}


# plain text with latex special characters escaped
def tex(text):
    return "".join(TEX_ESCAPES.get(character, character) for character in text)


# moderncv \cventry from its six fields
def cventry(*fields):
    return "\\cventry{" + "}{".join(fields) + "}\n\n"


# CV line for one publication
def publication_cventry(pub):

    # arxiv, journal, and code cells
    arxiv = f"\\href{{https://arxiv.org/abs/arXiv:{pub['arxiv']}}}{{arXiv:{pub['arxiv']}}}"
    journal = f"\\href{{{pub['journal']['href']}}}{{{tex(pub['journal']['name'])}}}" if "journal" in pub else ""
    code = f"Associated code: \\url{{{pub['code']['href']}}}" if "code" in pub else ""
    return cventry(pub["date"].strftime("%B %Y"), pub.get("cv_title") or tex(pub["title"]), tex(pub["authors"]), arxiv, journal, code)


# role for invited and lecture talks without one
DEFAULT_ROLES = {"invited": "Invited Speaker", "lectures": "Invited Guest Lecturer"}


# CV line for one talk
def talk_cventry(talk):

    # date, place, and virtual tag
    when = talk.get("cv_date_override") or f"{talk['date'].day} {talk['date']:%B %Y}"
    where = tex(talk.get("location") or talk.get("where", ""))
    virtual = " (Virtual)" if talk.get("virtual") else ""

    # description by kind of talk
    if "cv_description" in talk:
        description = tex(talk["cv_description"])
    elif talk["category"] == "contributed" and "event" in talk:
        description = f"{tex(talk['event'])}, {tex(talk.get('event_dates', when))}, {where}{virtual}"
    elif talk["category"] == "contributed":
        description = f"{where}, {tex(when)}{virtual}"
    else:
        description = f"{tex(talk.get('role', DEFAULT_ROLES[talk['category']]))}, {tex(when)}, {where}{virtual}"
    return cventry(when, tex(talk["title"]), tex(talk.get("cv_event_name", "")), talk.get("cv_event_href", ""), "", description)


# cv/publications.tex and cv/talks.tex from newest-first lists
def write_cv_tex(pubs, talks):

    # entries kept on the CV
    header = "% generated by scripts/build.py from content.yaml, do not edit\n\n"
    pubs = [pub for pub in pubs if not pub.get("cv_hidden")]
    talks = [talk for talk in talks if not talk.get("cv_hidden")]

    # refereed then preprint sections
    refereed = "".join(publication_cventry(pub) for pub in pubs if pub["status"] == "refereed")
    preprints = "".join(publication_cventry(pub) for pub in pubs if pub["status"] == "preprint")
    (ROOT / "cv" / "publications.tex").write_text(header + "% Refereed Publications (\\section header is in main.tex)\n" + refereed + "\\section{Preprints}\n\n" + preprints)

    # invited, lecture, and contributed sections
    lines = {category: "".join(talk_cventry(talk) for talk in talks if talk["category"] == category) for category in ("invited", "lectures", "contributed")}
    (ROOT / "cv" / "talks.tex").write_text(header + "% Invited Talks (\\section header is in main.tex)\n\n" + lines["invited"] + "\\section{Lecture Series and Schools}\n\n" + lines["lectures"] + "\\section{Contributed Presentations}\n\n" + lines["contributed"])


# main.tex to assets/pdf/rikab_CV.pdf
def compile_cv():

    # skip without latexmk
    if not shutil.which("latexmk"):
        print("no latexmk, CV pdf not rebuilt")
        return

    # latexmk build and log tail on failure
    with tempfile.TemporaryDirectory() as build_dir:
        result = subprocess.run(["latexmk", "-pdf", "-interaction=nonstopmode", "-halt-on-error", f"-output-directory={build_dir}", "main.tex"], cwd=ROOT, capture_output=True, text=True)
        if result.returncode != 0:
            sys.exit(result.stdout[-2000:])
        shutil.copyfile(Path(build_dir) / "main.pdf", ROOT / "assets" / "pdf" / "rikab_CV.pdf")


# html anchor with a root-relative href for local paths
def link(text, href):

    # html/index.html sits one folder down
    if not href.startswith(("http", "mailto:", "/", "#")):
        href = "/" + href.removeprefix("./")
    return f'<a href="{html.escape(href)}">{html.escape(text)}</a>'


# "2026-06-23" to "23 June 2026"
def day_month_year(iso):

    # .day has no leading zero
    day = date.fromisoformat(iso)
    return f"{day.day} {day:%B %Y}"


# one paper in the html page
def paper_html(paper, talks_by_id):

    # title, authors, date, and markers
    lines = [html.escape(paper["title"]), html.escape(paper["authors"]), f"{date.fromisoformat(paper['date']):%B %Y}"]
    if paper["featured"]:
        lines.append("★")
    if paper["joke"]:
        lines.append("🃏 April Fools")

    # links, citations, tags, and talks
    lines.append(" | ".join(link(item["text"], item["href"]) for item in paper["links"]))
    if paper["citations"]:
        lines.append(f"Citations: {paper['citations_total']} total, {paper['citations_total_excl_self']} excl. self")
    if paper["tags"]:
        lines.append("Tags: " + html.escape(", ".join(paper["tags"])))
    if paper["talks"]:
        talks = [talks_by_id[talk_id] for talk_id in paper["talks"]]
        lines.append("Talks: " + " | ".join(link(f"{day_month_year(talk['date'])} · {talk['where']}", f"#talk-{talk['id']}") for talk in talks))

    # image, details, blurb, and bibtex
    bibtex = html.escape(paper["bibtex"]).replace("\n", "<br>\n")
    bibtex_block = f"\n<p>BibTeX:<br>\n{bibtex}</p>" if bibtex else ""
    return f'<p><img src="/{paper["img"]}" width="150" alt=""></p>\n<p id="paper-{paper["id"]}">' + "<br>\n".join(lines) + f'</p>\n<p>{html.escape(paper["blurb"])}</p>{bibtex_block}'


# talk category headings
CATEGORY_LABELS = {"invited": "Invited Talks", "lectures": "Lecture Series & Schools", "contributed": "Contributed Talks"}


# one talk in the html page
def talk_html(talk, papers_by_id):

    # date, title, place, and category
    label = CATEGORY_LABELS[talk["category"]] + (f" · {talk['topic']}" if talk["topic"] else "")
    lines = [f"{day_month_year(talk['date'])}: {html.escape(talk['title'])}", html.escape(f"{talk['where']} ({label})" if talk["where"] else label)]
    if talk["featured"]:
        lines.append("★")

    # slides, video, and paper links
    paper = papers_by_id.get(talk["paper"])
    links = [link(text, href) for text, href in (("Slides", talk["slides"]), ("Video", talk["video"])) if href]
    if paper:
        links.append(link("Paper: " + paper["title"], f"#paper-{paper['id']}"))
    if links:
        lines.append(" | ".join(links))
    if paper:
        lines.append(html.escape(paper["blurb"]))
    return f'<p id="talk-{talk["id"]}">' + "<br>\n".join(lines) + "</p>"


# one software package in the html page
def software_html(package):

    # name, role, blurb, and install command
    lines = [html.escape(f"{package['name']} ({package['role']})"), html.escape(package["blurb"])]
    if package["install"]:
        lines.append("$ " + html.escape(package["install"]))

    # github, homepage, and paper links
    links = [link("GitHub", package["github"])]
    if package["homepage"]:
        links.append(link("Homepage", package["homepage"]))
    if package["paper"]:
        links.append(link("Paper", f"#paper-{package['paper']}"))
    lines.append(" | ".join(links))
    return "<p>" + "<br>\n".join(lines) + "</p>"


# portrait, name, links, about text, and contact line in the html page
def about_html(about):

    # about paragraphs without bold, links, and contact line
    paragraphs = [f'<p>{paragraph.replace("<strong>", "").replace("</strong>", "")}</p>' for paragraph in about["paragraphs"]]
    links = " | ".join(link(item["text"], item["href"]) for item in about["links"])
    contact = '<p>Reach me at <a href="mailto:gambhirb@ucmail.uc.edu">gambhirb@ucmail.uc.edu</a>. Full history is in the <a href="/assets/pdf/rikab_CV.pdf">CV</a>.</p>'
    return [f'<p><img src="/{about["portrait"]}" width="150" alt=""></p>', f'<p>Rikab Gambhir<br>\n{about["tagline"]}</p>', f"<p>{links}</p>", "<p>About</p>"] + paragraphs + [contact]


# html/index.html for ?mode=4
def write_html_page(about, research_data, talk_data, software_data, author_citations, author_h_index):

    # id lookups and page head
    papers_by_id = {paper["id"]: paper for paper in research_data}
    talks_by_id = {talk["id"]: talk for talk in talk_data}
    parts = ['<!-- generated by scripts/build.py from content.yaml, do not edit -->\n<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Rikab Gambhir</title>\n</head>\n<body>']

    # about, featured papers, author totals, and papers
    parts += about_html(about)
    featured = [link(paper["title"], f"#paper-{paper['id']}") for paper in research_data if paper["featured"]]
    parts.append("<p>" + "<br>\n".join(["Featured Research", "A few papers I'd recommend starting with."] + featured) + "</p>")
    parts.append(f"<p>Research ({sum(not paper['joke'] for paper in research_data)})</p>")
    parts.append(f"<p>Citations: {author_citations[-1]['total']} total, {author_citations[-1]['excl_self']} excl. self<br>\nh-index: {author_h_index[-1]['h']}<br>\nLive from <a href=\"https://inspirehep.net\">INSPIRE-HEP</a>. Refreshed weekly.</p>")
    parts += [paper_html(paper, talks_by_id) for paper in research_data]

    # talks, software, and footer
    parts += [f"<p>Talks ({len(talk_data)})</p>", "<p>Selected presentations. ★ marks my recommended version of a given talk.</p>"]
    parts += [talk_html(talk, papers_by_id) for talk in talk_data]
    parts += ["<p>Software</p>", "<p>Open-source libraries I develop or maintain. Most have an associated paper.</p>"]
    parts += [software_html(package) for package in software_data]
    parts += [f"<p>&copy; 2022&ndash;{date.today().year} Rikab Gambhir.<br>\n{about['footer']}</p>", "</body>\n</html>"]
    (ROOT / "html" / "index.html").write_text("\n\n".join(parts) + "\n")


# about paragraphs into index.html between its about markers
def write_index_about(about):

    # text around the markers and the new paragraphs
    page = (ROOT / "index.html").read_text()
    before, rest = page.split("<!-- about:start -->\n")
    after = rest.split("        <!-- about:end -->")[1]
    paragraphs = "".join(f"        <p>{paragraph}</p>\n" for paragraph in about["paragraphs"])
    (ROOT / "index.html").write_text(before + "<!-- about:start -->\n" + paragraphs + "        <!-- about:end -->" + after)


def main():

    # content.yaml newest first
    content = yaml.safe_load((ROOT / "content.yaml").read_text())
    pubs = sorted(content["publications"], key=lambda pub: pub["date"], reverse=True)
    talks = sorted(content["talks"], key=lambda talk: talk["date"], reverse=True)

    # data.js entries and talks on their papers
    research_data = [publication_entry(pub) for pub in pubs]
    talk_data = [talk_entry(talk) for talk in talks]
    software_data = [software_entry(package) for package in content["software"]]
    papers_by_id = {paper["id"]: paper for paper in research_data}
    for talk in talk_data:
        if talk["paper"]:
            papers_by_id[talk["paper"]]["talks"].append(talk["id"])
    author_citations, author_h_index = author_series(research_data)

    # outputs
    write_data_js({
        "research_data": research_data,
        "talk_data": talk_data,
        "software_data": software_data,
        "author_citations": author_citations,
        "author_h_index": author_h_index,
        "author_timeline_start": AUTHOR_START_MONTH,
        "current_month": THIS_MONTH,
    })
    write_cv_tex(pubs, talks)
    write_html_page(content["about"], research_data, talk_data, software_data, author_citations, author_h_index)
    write_index_about(content["about"])
    if "--no-cv" not in sys.argv:
        compile_cv()


if __name__ == "__main__":
    main()
