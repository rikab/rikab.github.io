# INSPIRE-HE

import json
import urllib.error
import urllib.request
from datetime import datetime

from .util import ROOT, http_get_json

# caches
INSPIRE_CACHE = ROOT / "cache" / "inspire-bibtex"
INSPIRE_CITATION_CACHE = ROOT / "cache" / "inspire-citations"

# endpoints
INSPIRE_BIBTEX_URL = "https://inspirehep.net/api/literature?q=arxiv:{}&format=bibtex"
INSPIRE_RECORD_URL = "https://inspirehep.net/literature?q=arxiv:{}"
INSPIRE_LOOKUP_URL = (
    "https://inspirehep.net/api/literature?q=arxiv:{}"
    "&fields=control_number,authors.full_name"
)
INSPIRE_REFERSTO_URL = (
    "https://inspirehep.net/api/literature"
    "?q=refersto:recid:{recid}"
    "&fields=earliest_date,preprint_date,authors.full_name"
    "&size=250&page={page}"
)

# citation-cache knobs
CITATION_CACHE_MAX_AGE_DAYS = 6
CITATION_CACHE_SCHEMA = 3


# ---- bibtex ----

# fetch bibtex with on-disk cache; "" on failure
def fetch_bibtex(arxiv_id):
    if not arxiv_id:
        return ""

    # serve from cache when present
    INSPIRE_CACHE.mkdir(parents=True, exist_ok=True)
    cache_file = INSPIRE_CACHE / f"{arxiv_id}.bib"
    if cache_file.exists():
        return cache_file.read_text().strip()

    # fetch then cache
    url = INSPIRE_BIBTEX_URL.format(arxiv_id)
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/x-bibtex"})
        with urllib.request.urlopen(req, timeout=8) as r:
            text = r.read().decode("utf-8", errors="replace").strip()
        if text and text.startswith("@"):
            cache_file.write_text(text + "\n")
            return text
        print(f"  [bibtex] empty/invalid response for arXiv:{arxiv_id}")
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        print(f"  [bibtex] fetch failed for arXiv:{arxiv_id} ({e})")
    return ""


# ---- author normalisation ----

# [last_lower, first_initial_lower]; None for collaborations
def author_key(name):
    name = (name or "").strip()
    if not name:
        return None

    # drop corporate / collaboration entries
    low = name.lower()
    if "collaboration" in low or "collab." in low or low.endswith(" team"):
        return None

    # split "Last, First" or "First Last"
    if "," in name:
        last, first = name.split(",", 1)
    else:
        parts = name.split()
        if len(parts) >= 2:
            last = parts[-1]
            first = " ".join(parts[:-1])
        else:
            last, first = name, ""

    # normalise
    last = last.strip().lower().rstrip(".")
    first = first.strip()
    fi = first[:1].lower() if first else ""
    return [last, fi]


# yaml "A, B, C" → list of author_key tuples
def parse_yaml_authors(s):
    return [k for k in (author_key(p) for p in (s or "").split(",")) if k]


# ---- recid + citation timeline ----

# inspire control_number for an arxiv id, or None
def fetch_inspire_recid_only(arxiv_id):
    if not arxiv_id:
        return None
    try:
        d = http_get_json(INSPIRE_LOOKUP_URL.format(arxiv_id))
        hits = d.get("hits", {}).get("hits", [])
        if hits:
            return hits[0].get("metadata", {}).get("control_number")
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as e:
        print(f"  [recid] fetch failed for arXiv:{arxiv_id} ({e})")
    return None


# list of {date, self} for every paper citing recid; self = last+first-initial match
def fetch_citation_dates(arxiv_id, recid, cited_keys):
    INSPIRE_CITATION_CACHE.mkdir(parents=True, exist_ok=True)
    cache_file = INSPIRE_CITATION_CACHE / f"{arxiv_id}.json"
    cited_keyset = {tuple(k) for k in cited_keys}

    # serve from cache when fresh and recid/schema still match
    if cache_file.exists():
        try:
            cached = json.loads(cache_file.read_text())
            fetched = datetime.fromisoformat(cached.get("fetched", ""))
            age_days = (datetime.utcnow() - fetched).total_seconds() / 86400.0
            if (age_days < CITATION_CACHE_MAX_AGE_DAYS
                    and cached.get("recid") == recid
                    and cached.get("schema") == CITATION_CACHE_SCHEMA):
                return self_flag_from_cached(cached, cited_keyset)
        except (ValueError, KeyError, json.JSONDecodeError):
            pass

    # no recid → nothing to fetch
    if not recid:
        return []

    # page through refersto results
    entries_full = []
    page = 1
    print(f"  [citations] fetching arXiv:{arxiv_id} (recid {recid})...")
    while True:
        try:
            d = http_get_json(INSPIRE_REFERSTO_URL.format(recid=recid, page=page))
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as e:
            print(f"  [citations] fetch failed page {page}: {e}")
            break
        hits = d.get("hits", {}).get("hits", [])
        if not hits:
            break

        # extract date + author keys per hit
        for h in hits:
            md = h.get("metadata", {})
            date = md.get("earliest_date") or md.get("preprint_date")
            if not date:
                continue
            # pad partial dates to YYYY-MM-DD
            if len(date) == 4:
                date = f"{date}-01-01"
            elif len(date) == 7:
                date = f"{date}-01"
            keys = []
            for a in md.get("authors") or []:
                k = author_key(a.get("full_name", ""))
                if k:
                    keys.append(k)
            entries_full.append({"date": date, "author_keys": keys})

        # short page = last page
        if len(hits) < 250:
            break
        page += 1

    # write cache
    entries_full.sort(key=lambda e: e["date"])
    cache_file.write_text(json.dumps({
        "schema": CITATION_CACHE_SCHEMA,
        "fetched": datetime.utcnow().isoformat(timespec="seconds"),
        "recid": recid,
        "cited_keys": sorted([list(k) for k in cited_keyset]),
        "entries": entries_full,
    }, indent=2))
    print(f"  [citations] arXiv:{arxiv_id}: {len(entries_full)} citation(s)")
    return self_flag_from_cached({"entries": entries_full}, cited_keyset)


# {date, self} list built from a cached entry blob
def self_flag_from_cached(cached, cited_keyset):
    out = []
    for e in cached.get("entries") or []:
        ck = {tuple(k) for k in (e.get("author_keys") or [])}
        out.append({"date": e["date"], "self": bool(cited_keyset & ck)})
    return out
