"""
experience_extractor.py
────────────────────────────────────────────────────────────────────────────
Extracts total years of experience from resume text.

Handles:
  - Multiple roles with date ranges (sums non-overlapping tenure)
  - Formats: MM/YYYY, MM YYYY, MonthName YYYY, YYYY only
  - End dates: present / current / now  →  today
  - Explicit "N years of experience" statements
  - Overlapping roles (e.g. two jobs at once) — deduplicates by merging ranges
────────────────────────────────────────────────────────────────────────────
"""

import re
import datetime
from typing import Optional

TODAY = datetime.date.today()
CURRENT_YEAR = TODAY.year


# ─────────────────────────────────────────────────────────────────────────────
# MONTH NAME → NUMBER
# ─────────────────────────────────────────────────────────────────────────────
MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    # full names
    "january": 1, "february": 2, "march": 3, "april": 4,
    "june": 6, "july": 7, "august": 8, "september": 9,
    "october": 10, "november": 11, "december": 12,
}

IS_CURRENT = re.compile(r"\b(?:present|current|now|today)\b", re.IGNORECASE)


# ─────────────────────────────────────────────────────────────────────────────
# DATE PARSING
# ─────────────────────────────────────────────────────────────────────────────

def _parse_date(raw: str) -> Optional[datetime.date]:
    """
    Try to parse a date string into a datetime.date.
    Accepts formats like:
      06/2018,  06 2018,  062018,  June 2018,  Jun2018,  2018
    Returns the 1st of the month for month-level precision,
    or Jan 1 for year-only.
    Returns None if unparseable.
    """
    raw = raw.strip().lower()

    # "present" / "current" / "now"
    if IS_CURRENT.fullmatch(raw.strip()):
        return TODAY

    # MM/YYYY or MM.YYYY or MM-YYYY
    m = re.fullmatch(r"(\d{1,2})[/\.\-](\d{4})", raw)
    if m:
        month, year = int(m.group(1)), int(m.group(2))
        if 1 <= month <= 12 and 1950 <= year <= CURRENT_YEAR:
            return datetime.date(year, month, 1)

    # MM YYYY (space separated, as seen in dataset: "06 2011")
    m = re.fullmatch(r"(\d{1,2})\s+(\d{4})", raw)
    if m:
        month, year = int(m.group(1)), int(m.group(2))
        if 1 <= month <= 12 and 1950 <= year <= CURRENT_YEAR:
            return datetime.date(year, month, 1)

    # MMYYYY (no separator, as seen: "062011")
    m = re.fullmatch(r"(\d{2})(\d{4})", raw)
    if m:
        month, year = int(m.group(1)), int(m.group(2))
        if 1 <= month <= 12 and 1950 <= year <= CURRENT_YEAR:
            return datetime.date(year, month, 1)

    # MonthName YYYY  or  MonthNameYYYY  (e.g. "april 2016", "june2018")
    m = re.fullmatch(r"([a-z]+)\.?\s*(\d{4})", raw)
    if m:
        mon_str, year = m.group(1), int(m.group(2))
        month = MONTH_MAP.get(mon_str[:3])
        if month and 1950 <= year <= CURRENT_YEAR:
            return datetime.date(year, month, 1)

    # YYYY only
    m = re.fullmatch(r"(\d{4})", raw)
    if m:
        year = int(m.group(1))
        if 1950 <= year <= CURRENT_YEAR:
            return datetime.date(year, 1, 1)

    return None


# ─────────────────────────────────────────────────────────────────────────────
# DATE RANGE EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────

# Matches a "date TOKEN date" pattern where TOKEN is: to / - / – / —
_SEP = r"\s*(?:to|[-–—])\s*"

# A date token — ordered longest to shortest to avoid greedy mis-matches
_DATE_TOKEN = (
    r"(?:"
    r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
    r"\.?\s*\d{4}"           # MonthName YYYY
    r"|\d{1,2}[/\.\-]\d{4}" # MM/YYYY
    r"|\d{1,2}\s+\d{4}"     # MM YYYY
    r"|\d{6}"                # MMYYYY
    r"|\d{4}"                # YYYY
    r")"
)

_CURRENT_TOKEN = r"(?:present|current|now|today)"

RANGE_RE = re.compile(
    rf"({_DATE_TOKEN}){_SEP}({_DATE_TOKEN}|{_CURRENT_TOKEN})",
    re.IGNORECASE,
)

# Extra pattern: MM YYYY MM YYYY with space-only separator (no "to" or dash)
# e.g. "12 2014 02 2016" or "12 2014 02 2016work" (no trailing space required)
# Leading space/start enforced; trailing \b removed since date can butt up against text
RANGE_RE_SPACE = re.compile(
    r"(?<!\d)((?:0?[1-9]|1[0-2])\s+(?:19|20)\d{2})\s+((?:0?[1-9]|1[0-2])\s+(?:19|20)\d{2}|present|current|now|today)",
    re.IGNORECASE,
)

# Extra pattern: YYYY YYYY with space-only separator
# e.g. "2010 2013", "2008 2010" — year-only ranges common in older resumes
RANGE_RE_YEAR_SPACE = re.compile(
    r"(?<!\d)((?:19|20)\d{2})\s+((?:19|20)\d{2}|present|current|now|today)(?!\d)",
    re.IGNORECASE,
)


def _extract_date_ranges(text: str) -> list[tuple[datetime.date, datetime.date]]:
    """
    Find all date ranges in the text and return list of (start, end) date pairs.
    """
    ranges = []
    for m in RANGE_RE.finditer(text):
        start_raw = m.group(1).strip()
        end_raw   = m.group(2).strip()

        start = _parse_date(start_raw)
        end   = _parse_date(end_raw) if not IS_CURRENT.fullmatch(end_raw.strip()) else TODAY

        if start and end and start <= end:
            # Sanity: ignore ranges where start is in the future
            if start <= TODAY:
                ranges.append((start, end))

    return ranges


# ─────────────────────────────────────────────────────────────────────────────
# EDUCATION DATE FILTER  — must be defined before _extract_roles uses it
# ─────────────────────────────────────────────────────────────────────────────
_EDU_CONTEXT_RE = re.compile(
    r"(?:bachelor|master|phd|doctorate|university|college"
    r"|degree|graduated|graduation|b\.s|m\.s|m\.b\.a|mba|b\.e|m\.e"
    r"|expected\s+in|certification|institute|faculty)\b",
    re.IGNORECASE,
)

_CONTEXT_WINDOW = 80  # chars before a date range to check for edu context


# ─────────────────────────────────────────────────────────────────────────────
# ROLE PARSING  — each role block = title + date range + description
# ─────────────────────────────────────────────────────────────────────────────

def _extract_roles(text: str) -> list[dict]:
    """
    Try to identify individual job roles and their date ranges.
    Filters out date ranges that appear in an education context.
    Handles both standard separators (to / - / –) and space-only (MM YYYY MM YYYY).
    """
    roles = []
    seen_ranges = set()

    # Combine matches from all patterns, sorted by position
    all_matches = (
        list(RANGE_RE.finditer(text)) +
        list(RANGE_RE_SPACE.finditer(text)) +
        list(RANGE_RE_YEAR_SPACE.finditer(text))
    )

    for m in all_matches:
        # Check context BEFORE the match for education keywords (not after —
        # the text after a date range is job description, not education header)
        ctx_start = max(0, m.start() - _CONTEXT_WINDOW)
        context   = text[ctx_start:m.start()]
        if _EDU_CONTEXT_RE.search(context):
            continue

        start_raw = m.group(1).strip()
        end_raw   = m.group(2).strip()

        start = _parse_date(start_raw)
        end   = _parse_date(end_raw) if not IS_CURRENT.fullmatch(end_raw.strip()) else TODAY

        if not (start and end and start <= end <= TODAY):
            continue

        key = (start, end)
        if key in seen_ranges:
            continue
        # Also skip if a nearly-identical range already exists (within 1 month)
        is_near_dup = any(
            abs((start.year - s.year) * 12 + (start.month - s.month)) <= 1
            and abs((end.year - e.year) * 12 + (end.month - e.month)) <= 1
            for s, e in seen_ranges
        )
        if is_near_dup:
            continue
        seen_ranges.add(key)

        pre_text = text[max(0, m.start() - 80): m.start()].strip()
        title_match = re.search(r"([a-z][a-z\s/&\-,\.]{3,60})$", pre_text, re.IGNORECASE)
        title = title_match.group(1).strip() if title_match else "Unknown Role"

        duration_months = (
            (end.year - start.year) * 12 + (end.month - start.month)
        )

        roles.append({
            "title": title,
            "start": start,
            "end": end,
            "duration_months": max(0, duration_months),
        })

    roles.sort(key=lambda r: r["start"])
    return roles


# ─────────────────────────────────────────────────────────────────────────────
# OVERLAP-AWARE TOTAL EXPERIENCE CALCULATION
# ─────────────────────────────────────────────────────────────────────────────

def _merge_overlapping_ranges(
    ranges: list[tuple[datetime.date, datetime.date]]
) -> list[tuple[datetime.date, datetime.date]]:
    """
    Merge overlapping or adjacent date ranges so we don't double-count
    time when someone held two jobs simultaneously.
    """
    if not ranges:
        return []

    sorted_ranges = sorted(ranges, key=lambda x: x[0])
    merged = [sorted_ranges[0]]

    for start, end in sorted_ranges[1:]:
        prev_start, prev_end = merged[-1]
        if start <= prev_end:          # overlap or touching
            merged[-1] = (prev_start, max(prev_end, end))
        else:
            merged.append((start, end))

    return merged


def _total_years_from_ranges(
    ranges: list[tuple[datetime.date, datetime.date]]
) -> float:
    """Sum up total months across merged ranges, return as fractional years."""
    merged = _merge_overlapping_ranges(ranges)
    total_months = sum(
        max(0, (end.year - start.year) * 12 + (end.month - start.month))
        for start, end in merged
    )
    return round(total_months / 12, 1)


# ─────────────────────────────────────────────────────────────────────────────
# EXPLICIT "N years" EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────

_EXPLICIT_EXP_RE = re.compile(
    r"(?:"
    r"(\d{1,2})\s*\+?\s*years?\s*of\s+(?:\w+\s+){0,3}(?:experience|exp(?:osure)?|work(?:ing)?)"
    r"|(?:over|more\s+than|nearly|almost|about)\s+(\d{1,2})\s*years?"
    r"|(\d{1,2})\s*years?\s*(?:of\s+)?(?:professional|relevant|industry|hands.on|dedicated|extensive|it\b)"
    r"|summary(\d{1,2})\s*years?\s*of"
    r"|career\s+overview(\d{1,2})\s*years?"
    r"|(\d{1,2})\s*years?\s*(?:experience|exp)\b"
    r")",
    re.IGNORECASE,
)


def _extract_explicit_years(text: str) -> list[int]:
    results = []
    for m in _EXPLICIT_EXP_RE.finditer(text):
        # Pick whichever capture group matched (groups 1-6)
        val = next((g for g in m.groups() if g is not None), None)
        if val:
            yr = int(val)
            if 0 < yr < 50:
                results.append(yr)
    return results


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────────────────────────────────────

def extract_experience(text: str) -> dict:
    """
    Main entry point. Parses a resume text and returns:

    {
        "total_years":      float,        # total non-overlapping years
        "roles":            list[dict],   # individual roles with dates
        "method":           str,          # how we got the number
        "explicit_mention": int | None,   # "N years of experience" if stated
    }

    Decision logic:
      1. Parse all date ranges → sum non-overlapping months → convert to years
      2. Also check for explicit "N years" statement
      3. If both exist, trust explicit mention if it roughly agrees (within 3 yrs)
         otherwise prefer the date-range sum (more objective)
      4. If only explicit mention exists, use that
      5. If neither, return 0
    """
    text_lower = text.lower()

    # Step 1: date-range sum
    roles       = _extract_roles(text_lower)
    all_ranges  = [(r["start"], r["end"]) for r in roles]
    range_years = _total_years_from_ranges(all_ranges)

    # Step 2: explicit mention
    explicit    = _extract_explicit_years(text_lower)
    explicit_max = max(explicit) if explicit else None

    # Step 3: reconcile
    if range_years > 0 and explicit_max:
        # If they broadly agree, prefer explicit (more intentional)
        if abs(range_years - explicit_max) <= 3:
            total  = explicit_max
            method = "explicit_confirmed_by_dates"
        else:
            # Big disagreement — trust date ranges (explicit may refer to
            # a specific technology, not total career)
            total  = range_years
            method = "date_ranges_sum"
    elif range_years > 0:
        total  = range_years
        method = "date_ranges_sum"
    elif explicit_max:
        total  = explicit_max
        method = "explicit_only"
    else:
        total  = 0
        method = "not_found"

    return {
        "total_years":      total,
        "roles":            roles,
        "method":           method,
        "explicit_mention": explicit_max,
    }


def get_years(text: str) -> float:
    """Convenience wrapper — returns just the total years as a float."""
    return extract_experience(text)["total_years"]


# ─────────────────────────────────────────────────────────────────────────────
# CLI TEST
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys, json

    if len(sys.argv) > 1 and sys.argv[1].endswith(".pdf"):
        import pdfplumber
        with pdfplumber.open(sys.argv[1]) as pdf:
            text = "\n".join(p.extract_text() or "" for p in pdf.pages)
    else:
        text = sys.stdin.read()

    result = extract_experience(text)
    result["roles"] = [
        {**r, "start": str(r["start"]), "end": str(r["end"])}
        for r in result["roles"]
    ]
    print(json.dumps(result, indent=2))
