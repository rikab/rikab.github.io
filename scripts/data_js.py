# data.js build

import hashlib
import re
from datetime import datetime

from .inspire import (
    INSPIRE_RECORD_URL, fetch_bibtex, fetch_citation_dates,
    fetch_inspire_recid_only, parse_yaml_authors,
)
from .timelines import (
    AUTHOR_TIMELINE_START_MONTH,
    build_author_timelines,
    compress_series,
    monthly_cumulative,
)
from .util import (
    GEN_HEADER_JS, OUT_DATA_JS, ROOT, js_value, make_id, parse_date,
)


# paper-talk topics

# exact-topic to paper id
TOPIC_PAPER_MAP = {
    "Pareto Frontier": "pareto",
    "Re-Normalizing Flows": "rdf",
    "SPECTER – Spectral EMD": "specter",
    "Muon Beam Dumps": "muon-beam-dump",
    "Can You Hear the Shape of a Jet?": "shaper",
    "Moment Pooling": "moments",
    "Frequentist Way – Calibration & Correlation": "frequentist-way",
}

# fallback substring matches
TITLE_KEYWORD_PAPER_MAP = [
    ("HD Sense", "hdsense"),
    ("HDSense", "hdsense"),
    ("Resummed Distribution Functions", "rdf"),
    ("Re-Normalizing Flows", "rdf"),
    ("Pareto Frontier", "pareto"),
    ("Unisolated Upsilons", "upsilons"),
    ("Anomaly Detection", "upsilons"),
    ("Moments of Clarity", "moments"),
    ("Moment Pooling", "moments"),
    ("Shape of Jets", "shaper"),
    ("Hear the Shape", "shaper"),
    ("Frequentist Way", "frequentist-way"),
    ("Muon Beam", "muon-beam-dump"),
    ("SPECTER", "specter"),
    ("Vector-Like Quark", "vlq"),
    ("Seeing Double", "seeing-double"),
    ("Bias and Priors", "calibration-priors"),
]


# resolve a talk to a paper id, honoring explicit override
def infer_paper_id(t, pub_ids):
    # explicit paper field wins
    if t.get("paper"):
        return t["paper"] if t["paper"] in pub_ids else None

    # topic-based map
    if t.get("topic") and t["topic"] in TOPIC_PAPER_MAP:
        pid = TOPIC_PAPER_MAP[t["topic"]]
        return pid if pid in pub_ids else None

    # title-keyword fallback
    title = t.get("title", "")
    for needle, pid in TITLE_KEYWORD_PAPER_MAP:
        if needle.lower() in title.lower() and pid in pub_ids:
            return pid
    return None




# id from explicit field or title prefix; dedup via -2 / -3 / ..
def derive_pub_id(p, used):
    if p.get("id"):
        return p["id"]
    base = make_id((p.get("title") or "").split(":")[0]) or make_id(p.get("title") or "")
    base = base.split("-")[0] if base else "paper"
    pid = base
    n = 2
    while pid in used:
        pid = f"{base}-{n}"
        n += 1
    return pid


# per-talk id from title prefix + iso date; dedup via -2 / -3 / ..
def derive_talk_id(t, used):
    if t.get("id"):
        return t["id"]
    base = f"{make_id(t.get('title','talk'))[:40]}-{parse_date(t['date']).isoformat()}"
    tid = base
    n = 2
    while tid in used:
        tid = f"{base}-{n}"
        n += 1
    return tid


# ---- per-publication link list ----

# order: inspire, arxiv, journal, code, extras
def pub_links(p):
    links = []
    ax = str(p["arxiv"]) if p.get("arxiv") else None
    if ax:
        links.append({"text": "INSPIRE-HEP", "href": INSPIRE_RECORD_URL.format(ax)})
        links.append({"text": f"arXiv {ax}", "href": f"https://arxiv.org/abs/{ax}"})
    if p.get("journal") and p["journal"].get("href"):
        links.append({"text": p["journal"].get("name") or "Journal", "href": p["journal"]["href"]})
    if p.get("code") and p["code"].get("href"):
        links.append({"text": p["code"].get("name") or "Code", "href": p["code"]["href"]})
    for extra in p.get("links") or []:
        links.append({"text": extra["text"], "href": extra["href"]})
    return links


# ---- top-level exports ----

def build_publications(pubs):
    # newest first, hidden filtered
    visible = [p for p in pubs if not p.get("hidden")]
    visible.sort(key=lambda p: parse_date(p["date"]), reverse=True)

    used = set()
    out = []
    for p in visible:
        # id + parsed date
        pid = derive_pub_id(p, used)
        used.add(pid)
        d = parse_date(p["date"])

        # bibtex from yaml override or inspire cache
        bibtex = (p.get("bibtex") or "").strip()
        ax = str(p["arxiv"]) if p.get("arxiv") else None
        if not bibtex and ax:
            bibtex = fetch_bibtex(ax)

        # citation defaults
        citations = []
        citations_excl = []
        citations_total = 0
        citations_total_excl = 0
        citation_start = d.strftime("%Y-%m")

        # citation timeline for non-joke arxiv papers
        if ax and not p.get("joke"):
            recid = fetch_inspire_recid_only(ax)
            cited_keys = parse_yaml_authors(p.get("authors"))
            entries = fetch_citation_dates(ax, recid, cited_keys)
            paper_min_date = d.isoformat()
            all_dates = [max(e["date"], paper_min_date) for e in entries]
            non_self_dates = [
                max(e["date"], paper_min_date)
                for e in entries if not e.get("self")
            ]
            citations = compress_series(monthly_cumulative(all_dates, start_month=citation_start))
            citations_excl = compress_series(monthly_cumulative(non_self_dates, start_month=citation_start))
            citations_total = len(all_dates)
            citations_total_excl = len(non_self_dates)

        out.append({
            "id": pid,
            "title": p["title"],
            "date": d.isoformat(),
            "authors": p["authors"],
            "img": p.get("img", ""),
            "blurb": (p.get("blurb") or "").strip(),
            "abstract": (p.get("abstract") or "").strip(),
            "tags": p.get("tags") or [],
            "featured": bool(p.get("featured")),
            "joke": bool(p.get("joke")),
            "status": p.get("status", "preprint"),
            "bibtex": bibtex,
            "links": pub_links(p),
            "talks": [],
            "citations": citations,
            "citations_excl_self": citations_excl,
            "citations_total": citations_total,
            "citations_total_excl_self": citations_total_excl,
            "citation_start": citation_start,
        })
    return out


# talk_data export, opt out per entry with site_show: false
def build_talks(talks, pub_ids):
    visible = [t for t in talks if t.get("site_show") is not False]
    used_ids = set()
    out = []
    for t in sorted(visible, key=lambda t: parse_date(t["date"]), reverse=True):
        d = parse_date(t["date"])
        tid = derive_talk_id(t, used_ids)
        used_ids.add(tid)
        paper = infer_paper_id(t, pub_ids)

        out.append({
            "id": tid,
            "title": t["title"],
            "where": t.get("where", ""),
            "date": d.isoformat(),
            "category": t.get("category", "contributed"),
            "topic": t.get("topic", ""),
            "slides": t.get("slides") or None,
            "video": t.get("video") or None,
            "featured": bool(t.get("featured")),
            "paper": paper,
            "abstract": (t.get("abstract") or "").strip(),
        })
    return out


# push talk ids onto the owning publication's `talks` list
def attach_talks_to_pubs(pubs_out, talks_out):
    by_id = {p["id"]: p for p in pubs_out}
    for t in talks_out:
        if t["paper"] and t["paper"] in by_id:
            by_id[t["paper"]]["talks"].append(t["id"])


def build_software(software):
    out = []
    for s in software or []:
        out.append({
            "name": s["name"],
            "role": s.get("role", ""),
            "install": s.get("install", ""),
            "github": s.get("github", ""),
            "homepage": s.get("homepage", ""),
            "paper": s.get("paper") or None,
            "blurb": (s.get("blurb") or "").strip(),
        })
    return out


# ---- render data.js ----

def render_data_js(pubs_out, talks_out, software_out, author_cites, author_h):
    today = datetime.utcnow().strftime("%Y-%m")
    return (
        GEN_HEADER_JS
        + "export const research_data = " + js_value(pubs_out) + ";\n\n"
        + "export const talk_data = " + js_value(talks_out) + ";\n\n"
        + "export const software_data = " + js_value(software_out) + ";\n\n"
        + "export const author_citations = " + js_value(author_cites) + ";\n\n"
        + "export const author_h_index = " + js_value(author_h) + ";\n\n"
        + "export const author_timeline_start = " + js_value(AUTHOR_TIMELINE_START_MONTH) + ";\n\n"
        + "export const current_month = " + js_value(today) + ";\n"
    )


# rewrite ?v=... on the data.js import in js/main.js
def bump_main_js_cachebust(version):
    main_js = ROOT / "js" / "main.js"
    s = main_js.read_text()
    new = re.sub(
        r"from '\.\./data\.js(?:\?v=[^']*)?';",
        f"from '../data.js?v={version}';",
        s,
        count=1,
    )
    if new != s:
        main_js.write_text(new)


# write data.js and propagate the cache-bust hash to main.js
def write_data_js(pubs_out, talks_out, software_out, author_cites, author_h):
    js_text = render_data_js(pubs_out, talks_out, software_out, author_cites, author_h)
    OUT_DATA_JS.write_text(js_text)
    version = hashlib.md5(js_text.encode()).hexdigest()[:8]
    bump_main_js_cachebust(version)
    return version
