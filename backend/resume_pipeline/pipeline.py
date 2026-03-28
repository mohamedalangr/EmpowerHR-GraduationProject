"""
pipeline.py  —  your notebook logic, adapted for Django
────────────────────────────────────────────────────────
Functions are taken DIRECTLY from the notebook, unchanged.
Only the I/O layer is different (Django file → text, not DataFrame).
"""

import re
import logging
from pathlib import Path
from django.conf import settings

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# 1. PDF & TXT TEXT EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────

def extract_text_from_pdf(django_file) -> str:
    import fitz  # PyMuPDF
    data = django_file.read()
    doc  = fitz.open(stream=data, filetype="pdf")
    return "\n".join(page.get_text("text") for page in doc).strip()


def extract_text_from_file(django_file) -> str:
    """Extract text from PDF or TXT file."""
    filename = django_file.name.lower()
    
    if filename.endswith('.pdf'):
        return extract_text_from_pdf(django_file)
    elif filename.endswith('.txt'):
        # For TXT files, read as text
        data = django_file.read()
        if isinstance(data, bytes):
            return data.decode('utf-8', errors='replace')
        return str(data)
    else:
        raise ValueError(f"Unsupported file type: {filename}")


# ─────────────────────────────────────────────────────────────────────────────
# 2. SKILLS EXTRACTION  (notebook Cell 6 — exact logic)
# ─────────────────────────────────────────────────────────────────────────────

_skill_set = None  # loaded once per process

def _load_skill_set():
    global _skill_set
    if _skill_set is not None:
        return _skill_set

    import pandas as pd
    csv_path = getattr(settings, "SKILLS_TAXONOMY_CSV", "")
    if not csv_path or not Path(csv_path).exists():
        logger.warning("SKILLS_TAXONOMY_CSV not found at '%s'. Skill matching disabled.", csv_path)
        _skill_set = set()
        return _skill_set

    df_skills = pd.read_csv(csv_path)
    skills = set(
        skill.strip().lower()
        for row in df_skills["Skills"].dropna()
        for skill in row.split(",")
        if skill.strip()
    )
    # Your manual additions from the notebook
    skills.update(["user stories", "api", "backend", "ba",
                   "business analyst", "data management", "data analysis"])
    _skill_set = skills
    logger.info("Skills taxonomy: %d skills loaded.", len(_skill_set))
    return _skill_set


def extract_skills(text: str) -> list:
    """Notebook Cell 6 — exact function."""
    if not isinstance(text, str) or not text.strip():
        return []
    skill_set = _load_skill_set()
    text = text.lower()
    return [skill for skill in skill_set
            if re.search(r"\b" + re.escape(skill) + r"\b", text)]


# ─────────────────────────────────────────────────────────────────────────────
# 3. EDUCATION EXTRACTION  (notebook Cell 8 — exact logic)
# ─────────────────────────────────────────────────────────────────────────────

import nltk
nltk.download("punkt",     quiet=True)
nltk.download("punkt_tab", quiet=True)
from nltk.tokenize import sent_tokenize

_EDU_KEYWORDS = ["bachelor", "master", "phd", "bsc", "msc",
                 "mba", "degree", "university", "college", "graduated"]


def extract_education_sentences(text: str) -> str:
    """Notebook Cell 8 — exact function."""
    if not isinstance(text, str) or not text.strip():
        return ""
    sentences = sent_tokenize(text.lower())
    return " ".join(s for s in sentences if any(kw in s for kw in _EDU_KEYWORDS))


def extract_degree_level(text: str) -> str:
    """Notebook Cell 8 — exact function."""
    if not isinstance(text, str):
        return "Unknown"
    t = text.lower()
    if "phd" in t or "doctorate" in t:
        return "PhD"
    elif any(k in t for k in ["master", "msc", "mba", "m.s", "m.e"]):
        return "Master"
    elif any(k in t for k in ["bachelor", "bsc", "b.s", "b.e", "undergraduate"]):
        return "Bachelor"
    elif "associate" in t:
        return "Associate"
    return "Unknown"


# ─────────────────────────────────────────────────────────────────────────────
# 4. EXPERIENCE EXTRACTION  (your experience_extractor.py)
# ─────────────────────────────────────────────────────────────────────────────

def extract_experience_years(text: str) -> tuple[float, str]:
    """
    Returns (total_years, method).
    Imports your experience_extractor at call time so Django can start
    even if the file isn't on the path yet.
    """
    try:
        from experience_extractor import extract_experience
        result = extract_experience(str(text) if text else "")
        return float(result["total_years"]), result["method"]
    except ImportError:
        logger.error("experience_extractor.py not found on Python path.")
        return 0.0, "not_found"


# ─────────────────────────────────────────────────────────────────────────────
# 5. SEMANTIC SIMILARITY  (notebook Cell 12 — exact logic)
# ─────────────────────────────────────────────────────────────────────────────

_transformer_model = None

def _get_model():
    global _transformer_model
    if _transformer_model is None:
        from sentence_transformers import SentenceTransformer
        name = getattr(settings, "SENTENCE_TRANSFORMER_MODEL",
                       "anass1209/resume-job-matcher-all-MiniLM-L6-v2")
        logger.info("Loading SentenceTransformer: %s", name)
        _transformer_model = SentenceTransformer(name)
    return _transformer_model


def compute_semantic_score(resume_text: str, jd_text: str) -> float:
    """Cosine similarity × 100. Notebook Cell 12 logic."""
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np
    model = _get_model()
    embs  = model.encode([resume_text or "", jd_text or ""])
    sim   = cosine_similarity([embs[0]], [embs[1]])[0][0]
    return round(float(sim) * 100, 2)


# ─────────────────────────────────────────────────────────────────────────────
# 6. SCORING FUNCTIONS  (notebook Cell 14 — exact functions)
# ─────────────────────────────────────────────────────────────────────────────

_DEGREE_RANK = {"Unknown": 0, "High School": 1, "Associate": 2,
                "Bachelor": 3, "Master": 4, "PhD": 5}


def skills_score(required: list, candidate: list) -> float:
    """Notebook Cell 14 — exact function."""
    if not required or len(required) == 0:
        return 0.0
    req  = set(str(s).lower() for s in required)
    cand = set(str(s).lower() for s in candidate)
    return round((len(req & cand) / len(req)) * 100, 2)


def experience_score(required: float, candidate: float) -> float:
    """Notebook Cell 14 — exact function."""
    required  = float(required  or 0)
    candidate = float(candidate or 0)
    if required == 0:
        return 100.0
    return round(min(100.0, (candidate / required) * 100), 2)


def education_score(required: str, candidate: str) -> float:
    """Notebook Cell 14 — exact function."""
    req  = _DEGREE_RANK.get(str(required),  0)
    cand = _DEGREE_RANK.get(str(candidate), 0)
    if req == 0:
        return 100.0
    return 100.0 if cand >= req else round((cand / req) * 100, 2)


def weighted_ats_score(s_skills, s_experience, s_education, s_semantic, job) -> float:
    """Notebook Cell 16 — weighted sum using job weights."""
    return round(
        job.weight_skills     * s_skills     +
        job.weight_experience * s_experience +
        job.weight_education  * s_education  +
        job.weight_semantic   * s_semantic,
        2
    )


# ─────────────────────────────────────────────────────────────────────────────
# 7. MAIN PIPELINE RUNNER
# ─────────────────────────────────────────────────────────────────────────────

def run_pipeline(submission):
    """
    Runs the full pipeline for a Submission instance.
    Mirrors the notebook flow: extract → score → save.
    """
    from django.utils import timezone
    from resume_pipeline.models import Submission

    submission.status = Submission.Status.PROCESSING
    submission.save(update_fields=["status"])

    try:
        job = submission.job

        # ── Extract text ──────────────────────────────────────────────────────
        with submission.resume_file.open("rb") as f:
            raw_text = extract_text_from_file(submission.resume_file)
        submission.raw_text = raw_text

        # ── Skills ───────────────────────────────────────────────────────────
        candidate_skills = extract_skills(raw_text)
        submission.candidate_skills = candidate_skills

        # ── Education ────────────────────────────────────────────────────────
        edu_text = extract_education_sentences(raw_text)
        submission.candidate_degree = extract_degree_level(edu_text)

        # ── Experience ───────────────────────────────────────────────────────
        years, method = extract_experience_years(raw_text)
        submission.candidate_years_exp   = years
        submission.exp_extraction_method = method

        # ── Semantic similarity ───────────────────────────────────────────────
        sem = compute_semantic_score(raw_text, job.description)
        submission.semantic_score = sem

        # ── Dimension scores ──────────────────────────────────────────────────
        s_skills = skills_score(job.required_skills, candidate_skills)
        s_exp    = experience_score(job.min_experience_years, years)
        s_edu    = education_score(job.required_degree, submission.candidate_degree)

        submission.skills_score     = s_skills
        submission.experience_score = s_exp
        submission.education_score  = s_edu

        # ── Final ATS score ───────────────────────────────────────────────────
        submission.ats_score = weighted_ats_score(s_skills, s_exp, s_edu, sem, job)

        submission.status    = Submission.Status.DONE
        submission.scored_at = timezone.now()
        submission.save()

    except Exception as exc:
        logger.exception("Pipeline failed for submission %s", submission.pk)
        submission.status        = Submission.Status.FAILED
        submission.error_message = str(exc)
        submission.save(update_fields=["status", "error_message"])
        raise
