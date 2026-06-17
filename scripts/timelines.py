import json
import re
from datetime import datetime

from .inspire import INSPIRE_CITATION_CACHE
from .util import month_range

# series start
AUTHOR_TIMELINE_START_MONTH = "2020-01"


# monthly cumulative cite count
def monthly_cumulative(dates, start_month=None, end_month=None):
    
    # nothing to show
    if not dates and not start_month:
        return []

    # sort + resolve window
    dates = sorted(dates or [])
    today = datetime.utcnow().strftime("%Y-%m")
    end = end_month or today
    start = start_month or (dates[0][:7] if dates else end)
    months = month_range(start, end)

    # fold pre-start dates into the initial total
    series = []
    cum = 0
    di = 0
    while di < len(dates) and dates[di][:7] < start:
        cum += 1
        di += 1

    # walk months, advance pointer
    for m in months:
        while di < len(dates) and dates[di][:7] <= m:
            cum += 1
            di += 1
        series.append({"month": m, "count": cum})
    return series


# drop intermediate same-value points
def compress_series(series, keys=("count",)):
    if not series:
        return []
    out = [series[0]]
    for i in range(1, len(series)):
        if any(series[i][k] != series[i-1][k] for k in keys):
            out.append(series[i])
    return out


# build author timelines from per-paper citation timelines
def build_author_timelines(pubs_out_with_cites):
    
    # month grid
    today = datetime.utcnow().strftime("%Y-%m")
    months = month_range(AUTHOR_TIMELINE_START_MONTH, today)

    # per-paper monthly totals; april fools paper excluded
    paper_tables_total = []
    paper_tables_excl = []
    for p in pubs_out_with_cites:
        if p.get("joke"):
            continue

        # recover arxiv id from the link list
        ax = None
        for l in p.get("links") or []:
            mch = re.search(r"arxiv\.org/abs/(\S+)$", l.get("href", ""))
            if mch:
                ax = mch.group(1)
                break

        # load cached citation entries
        cache_file = INSPIRE_CITATION_CACHE / f"{ax}.json" if ax else None
        paper_min_date = p.get("date") or "1900-01-01"
        if cache_file and cache_file.exists():
            try:
                cached = json.loads(cache_file.read_text())
                cited_keyset = {tuple(k) for k in (cached.get("cited_keys") or [])}
                all_dates = [max(e["date"], paper_min_date) for e in cached.get("entries") or []]
                non_self_dates = []
                for e in cached.get("entries") or []:
                    ck = {tuple(k) for k in (e.get("author_keys") or [])}
                    if not (cited_keyset & ck):
                        non_self_dates.append(max(e["date"], paper_min_date))
            except (ValueError, KeyError, json.JSONDecodeError):
                all_dates, non_self_dates = [], []
        else:
            all_dates, non_self_dates = [], []

        # monthly cumulative for both variants
        full = monthly_cumulative(all_dates, start_month=AUTHOR_TIMELINE_START_MONTH, end_month=today)
        excl = monthly_cumulative(non_self_dates, start_month=AUTHOR_TIMELINE_START_MONTH, end_month=today)
        paper_tables_total.append({e["month"]: e["count"] for e in full})
        paper_tables_excl.append({e["month"]: e["count"] for e in excl})

    # author totals + h-index per month
    citations = []
    h_index = []
    for m in months:
        totals = [t.get(m, 0) for t in paper_tables_total]
        excls = [t.get(m, 0) for t in paper_tables_excl]
        total = sum(totals)
        excl_self = sum(excls)

        # h = largest k with k papers ≥ k cites
        sorted_desc = sorted(totals, reverse=True)
        h = 0
        for i, c in enumerate(sorted_desc, start=1):
            if c >= i:
                h = i
            else:
                break
        citations.append({"month": m, "total": total, "excl_self": excl_self})
        h_index.append({"month": m, "h": h})

    # drop flat segments
    citations_compressed = compress_series(citations, keys=("total", "excl_self"))
    h_compressed = compress_series(h_index, keys=("h",))
    return citations_compressed, h_compressed
