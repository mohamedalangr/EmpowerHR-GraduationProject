import logging
import re
import io
import math
from collections import Counter
from difflib import SequenceMatcher
from datetime import datetime, timezone as dt_timezone
from pathlib import Path
from threading import Timer
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from accounts.models import User
from accounts.permissions import IsHRManager, IsCandidate
from feedback.models import Employee, EmployeeJobHistory
from rest_framework.permissions import IsAuthenticated, AllowAny
import nltk
from nltk.corpus import stopwords, wordnet

from .models import Job, Submission
from .serializers import JobSerializer, SubmissionSerializer, SubmissionUploadSerializer, SubmissionStageUpdateSerializer

_PIPELINE_FUNCS = None


def _get_pipeline_functions():
    global _PIPELINE_FUNCS
    if _PIPELINE_FUNCS is None:
        from .pipeline import (
            run_pipeline,
            extract_skills,
            extract_text_from_pdf,
            compute_semantic_score,
            extract_education_sentences,
            extract_degree_level,
            extract_experience_years,
            experience_score,
            education_score,
            weighted_ats_score,
        )

        _PIPELINE_FUNCS = {
            "run_pipeline": run_pipeline,
            "extract_skills": extract_skills,
            "extract_text_from_pdf": extract_text_from_pdf,
            "compute_semantic_score": compute_semantic_score,
            "extract_education_sentences": extract_education_sentences,
            "extract_degree_level": extract_degree_level,
            "extract_experience_years": extract_experience_years,
            "experience_score": experience_score,
            "education_score": education_score,
            "weighted_ats_score": weighted_ats_score,
        }
    return _PIPELINE_FUNCS


def _enqueue_resume_pipeline(submission_id):
    def _runner():
        try:
            submission = Submission.objects.get(pk=submission_id)
            _get_pipeline_functions()["run_pipeline"](submission)
        except Exception:
            logging.getLogger(__name__).exception("Async resume pipeline failed for submission %s", submission_id)

    Timer(0.1, _runner).start()


def _ensure_nltk_resource(resource_path, download_name):
    try:
        nltk.data.find(resource_path)
    except LookupError:
        nltk.download(download_name, quiet=True)


def _as_bool(value, default=False):
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def _parse_submission_history_filters(request):
    requested_stage = (request.query_params.get("review_stage") or "").strip()
    valid_stages = {choice for choice, _ in Submission.ReviewStage.choices}
    review_stage = requested_stage if requested_stage in valid_stages else ""
    include_hired = _as_bool(
        request.query_params.get("include_hired"),
        default=review_stage == Submission.ReviewStage.HIRED,
    )
    return review_stage, include_hired


def _job_submission_queryset(job_or_id, *, review_stage="", include_hired=False):
    lookup = {"job": job_or_id} if isinstance(job_or_id, Job) else {"job_id": job_or_id}
    submissions = Submission.objects.filter(**lookup)
    if review_stage:
        submissions = submissions.filter(review_stage=review_stage)
    elif not include_hired:
        submissions = submissions.exclude(review_stage=Submission.ReviewStage.HIRED)
    return submissions.order_by("-stage_updated_at", "-submitted_at")


def _candidate_display_name(submission):
    name = (submission.candidate_name or '').strip()
    if name:
        return name

    email = (submission.candidate_email or '').strip()
    if email and '@' in email:
        local_part = email.split('@', 1)[0].replace('.', ' ').replace('_', ' ').strip()
        if local_part:
            return ' '.join(part.capitalize() for part in local_part.split())

    return f'Hired Candidate {submission.pk}'


def _candidate_contact_email(submission):
    email = (submission.candidate_email or '').strip().lower()
    if email:
        return email
    tracking = (submission.tracking_code or f'submission{submission.pk}').lower()
    return f'{tracking}@candidate.empowerhr.local'


def _promote_candidate_to_employee(submission, actor):
    candidate_name = _candidate_display_name(submission)
    candidate_email = _candidate_contact_email(submission)
    actor_name = getattr(actor, 'full_name', '') or getattr(actor, 'email', '') or 'HR team'

    user = User.objects.filter(email__iexact=candidate_email).first()
    previous_role = User.Role.CANDIDATE

    if user:
        previous_role = user.role or User.Role.CANDIDATE
        user.full_name = candidate_name or user.full_name
        user.role = User.Role.TEAM_MEMBER
        user.is_active = True
        user.save()
    else:
        user = User.objects.create_user(
            email=candidate_email,
            password=None,
            full_name=candidate_name,
            role=User.Role.TEAM_MEMBER,
        )

    employee = Employee.objects.filter(email__iexact=candidate_email, isDeleted=False).first()
    if employee and user.employee_id != employee.employeeID:
        user.employee_id = employee.employeeID
        user.save(update_fields=['employee_id'])

    employee_id = user.employee_id
    previous_job_title = ''
    previous_employee_role = previous_role

    if employee:
        previous_job_title = employee.jobTitle or ''
        previous_employee_role = employee.role or previous_role
        update_fields = []

        if employee.fullName != candidate_name:
            employee.fullName = candidate_name
            update_fields.append('fullName')
        if employee.jobTitle != submission.job.title:
            employee.jobTitle = submission.job.title
            update_fields.append('jobTitle')
        if employee.role != User.Role.TEAM_MEMBER:
            employee.role = User.Role.TEAM_MEMBER
            update_fields.append('role')
        if employee.employmentStatus != 'Active':
            employee.employmentStatus = 'Active'
            update_fields.append('employmentStatus')

        if update_fields:
            employee.save(update_fields=update_fields)
    else:
        employee = Employee.objects.create(
            employeeID=employee_id,
            fullName=candidate_name,
            email=candidate_email,
            jobTitle=submission.job.title,
            role=User.Role.TEAM_MEMBER,
            employmentStatus='Active',
        )

    EmployeeJobHistory.objects.create(
        employee=employee,
        action='Role Change',
        previousJobTitle=previous_job_title,
        newJobTitle=employee.jobTitle or submission.job.title,
        previousRole=previous_employee_role or User.Role.CANDIDATE,
        newRole=employee.role or User.Role.TEAM_MEMBER,
        changedBy=actor_name,
        notes=(
            f'Candidate hired from recruitment pipeline for {submission.job.title}.'
            + (f' HR note: {submission.stage_notes.strip()}' if (submission.stage_notes or '').strip() else '')
        ),
    )

    return {
        'employeeID': employee.employeeID,
        'employeeName': employee.fullName,
        'employeeEmail': employee.email,
        'jobTitle': employee.jobTitle,
        'employmentEvent': 'Candidate converted to employee',
    }

# CV Ranking Logic
SKILL_SYNONYMS = {
    "sql": ["sql", "mysql", "postgresql", "postgres", "sqlite", "sql server", "database", "databases"],
    "python": ["python", "pandas", "numpy", "scikit learn", "scikit-learn", "jupyter", "python scripting"],
    "power bi": ["power bi", "powerbi", "business intelligence", "bi dashboard", "dashboard", "data visualization"],
    "tableau": ["tableau", "dashboard", "data visualization", "business intelligence"],
    "excel": ["excel", "microsoft excel", "spreadsheet", "spreadsheets", "pivot table"],
    "data cleaning": ["data cleaning", "data cleansing", "data wrangling", "data preprocessing", "etl"],
    "machine learning": ["machine learning", "ml", "predictive modeling", "modeling", "supervised learning"],
    "deep learning": ["deep learning", "neural networks", "cnn", "rnn", "transformers"],
    "natural language processing": ["natural language processing", "nlp", "text mining", "text analytics", "language model"],
    "data analysis": ["data analysis", "analytics", "insights", "kpi analysis", "reporting"],
    "data visualization": ["data visualization", "dashboards", "storytelling", "bi", "charting"],
    "aws": ["aws", "amazon web services", "ec2", "s3", "lambda", "cloud"],
    "azure": ["azure", "microsoft azure", "cloud", "data factory", "synapse"],
    "communication": ["communication", "stakeholder management", "presentation", "collaboration"],
}

GENERIC_SKILL_TERMS = {
    "skill", "skills", "tool", "tools", "technology", "technologies", "system", "systems",
    "analysis", "analytics", "experience", "knowledge", "business", "data",
}


def _skill_tokens(skill):
    return {tok for tok in normalize_text(skill).split() if len(tok) > 2 and tok not in GENERIC_SKILL_TERMS}


def _token_overlap(a, b):
    ta = _skill_tokens(a)
    tb = _skill_tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def _conceptually_similar(a, b):
    ratio = SequenceMatcher(None, normalize_text(a), normalize_text(b)).ratio()
    overlap = _token_overlap(a, b)
    return ratio >= 0.86 or overlap >= 0.60


def _extract_evidence_snippets(cv_text, target_terms, max_snippets=3):
    if not cv_text:
        return []
    sentences = re.split(r"(?<=[.!?])\s+", cv_text)
    snippets = []
    normalized_terms = [normalize_text(t) for t in target_terms if t]
    for sent in sentences:
        n_sent = normalize_text(sent)
        if any(term and term in n_sent for term in normalized_terms):
            compact = re.sub(r"\s+", " ", sent).strip()
            if compact:
                snippets.append(compact[:220])
        if len(snippets) >= max_snippets:
            break
    return snippets


def _map_candidate_to_required(required_skill_set, skill_map, candidate_skill_set, normalized_cv):
    matched = set()
    semantic_mapped = {}

    for candidate_skill in candidate_skill_set:
        for required in required_skill_set:
            aliases = skill_map.get(required, [])
            if candidate_skill == required:
                matched.add(required)
                semantic_mapped.setdefault(required, set()).add(candidate_skill)
                continue
            if candidate_skill in aliases:
                matched.add(required)
                semantic_mapped.setdefault(required, set()).add(candidate_skill)
                continue
            if _conceptually_similar(candidate_skill, required):
                matched.add(required)
                semantic_mapped.setdefault(required, set()).add(candidate_skill)

    # Detect required-skill aliases directly in CV text for phrase-level coverage.
    for required in required_skill_set:
        if required in matched:
            continue
        aliases = skill_map.get(required, [])
        if any(alias and alias in normalized_cv for alias in aliases):
            matched.add(required)
            semantic_mapped.setdefault(required, set()).add("alias-in-text")

    return matched, semantic_mapped

def normalize_text(text):
    text = text.lower()
    text = text.replace("-", " ")
    text = re.sub(r"[^a-z0-9\s]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _safe_extract_resume_text(file_bytes, file_name):
    if not file_bytes:
        return ""
    lowered = (file_name or "").lower()
    if lowered.endswith(".pdf"):
        return _get_pipeline_functions()["extract_text_from_pdf"](io.BytesIO(file_bytes))
    if lowered.endswith(".txt"):
        return file_bytes.decode("utf-8", errors="ignore")
    return ""


def _to_skill_set(skills):
    return {normalize_text(s) for s in (skills or []) if str(s).strip()}


def _wordnet_skill_aliases(skill):
    aliases = set()
    normalized_skill = normalize_text(skill)
    _ensure_nltk_resource('corpora/wordnet', 'wordnet')
    _ensure_nltk_resource('corpora/omw-1.4', 'omw-1.4')
    for token in normalized_skill.split():
        if len(token) < 3:
            continue
        try:
            synsets = wordnet.synsets(token)
        except LookupError:
            synsets = []
        for syn in synsets[:6]:
            for lemma in syn.lemmas()[:6]:
                candidate = normalize_text(lemma.name().replace("_", " "))
                if 2 < len(candidate) <= 30 and candidate not in GENERIC_SKILL_TERMS:
                    aliases.add(candidate)
    return aliases


def _build_semantic_analysis(final_score, semantic_score, skill_match_pct, matched_count, required_count):
    quality = "Strong"
    if final_score < 50:
        quality = "Low"
    elif final_score < 70:
        quality = "Moderate"

    return (
        f"{quality} fit candidate. Semantic alignment is {semantic_score:.2f}%. "
        f"Skill coverage is {skill_match_pct:.2f}% ({matched_count}/{required_count} required skills matched)."
    )


def _build_reasoning_summary(
    final_score,
    semantic_score,
    skill_match_pct,
    experience_fit,
    education_fit,
    matched,
    missing,
    extra,
    semantic_mapped,
):
    fit = "strong"
    if final_score < 50:
        fit = "low"
    elif final_score < 70:
        fit = "moderate"

    mapped_phrases = []
    for required_skill, mapped_values in semantic_mapped.items():
        mapped_values = [v for v in mapped_values if v != "alias-in-text"]
        if mapped_values:
            mapped_phrases.append(f"{required_skill} ({', '.join(sorted(mapped_values)[:2])})")

    mapped_text = "; synonym-aware matches: " + ", ".join(mapped_phrases[:3]) if mapped_phrases else ""
    missing_text = f" Missing critical areas: {', '.join(missing[:4])}." if missing else ""
    extra_text = f" Extra strengths: {', '.join(extra[:4])}." if extra else ""

    return (
        f"{fit.title()} fit profile with {semantic_score:.1f}% semantic relevance, "
        f"{skill_match_pct:.1f}% required-skill coverage, {experience_fit:.1f}% experience fit, "
        f"and {education_fit:.1f}% education fit ({len(matched)} required skills matched)."
        f"{mapped_text}{missing_text}{extra_text}"
    )


def _build_decision_factors(
    *,
    matched,
    missing,
    extra,
    candidate_years,
    required_years,
    candidate_degree,
    required_degree,
    experience_fit,
    education_fit,
    semantic_score,
    confidence,
):
    strengths = []
    watchouts = []

    if matched:
        strengths.append(f"Matched {len(matched)} required skills: {', '.join(matched[:3])}")

    if required_years and required_years > 0:
        if candidate_years >= required_years:
            strengths.append(
                f"Meets experience target with {candidate_years:.1f} years vs {required_years:.1f} required"
            )
        else:
            watchouts.append(
                f"Experience is below target by {max(required_years - candidate_years, 0):.1f} years"
            )
    else:
        strengths.append("No minimum experience threshold is defined for this role")

    normalized_required_degree = (required_degree or "Unknown").strip() or "Unknown"
    normalized_candidate_degree = (candidate_degree or "Unknown").strip() or "Unknown"
    if normalized_required_degree != "Unknown":
        if education_fit >= 99.9:
            strengths.append(f"Education level meets the {normalized_required_degree} requirement")
        else:
            watchouts.append(
                f"Education fit is {education_fit:.0f}% ({normalized_candidate_degree} vs {normalized_required_degree})"
            )

    if semantic_score >= 70:
        strengths.append(f"Resume language aligns strongly with the job description ({semantic_score:.0f}% semantic match)")
    elif semantic_score < 45:
        watchouts.append(f"Semantic alignment is limited at {semantic_score:.0f}% and needs manual review")

    if missing:
        watchouts.append(f"Missing skill coverage in: {', '.join(missing[:4])}")

    if extra:
        strengths.append(f"Extra strengths include {', '.join(extra[:3])}")

    if confidence < 55:
        watchouts.append(f"Model confidence is {confidence:.0f}%, so interviewer validation is recommended")
    elif confidence >= 80:
        strengths.append(f"High ranking confidence ({confidence:.0f}%) across multiple scoring signals")

    return {
        "strengths": strengths[:4],
        "watchouts": watchouts[:4],
    }

def build_skill_map(key_skills, learned_aliases=None):
    learned_aliases = learned_aliases or {}
    skill_map = {}
    for skill in key_skills:
        normalized_skill = normalize_text(skill)
        aliases = set(SKILL_SYNONYMS.get(normalized_skill, []))
        aliases.update(learned_aliases.get(normalized_skill, []))
        aliases.update(_wordnet_skill_aliases(normalized_skill))
        aliases.add(skill)
        aliases.add(normalized_skill)
        skill_map[skill] = sorted({normalize_text(alias) for alias in aliases if alias and alias.strip()})
    return skill_map

def find_skill_evidence(cv_text, skill_map):
    normalized_cv = normalize_text(cv_text)
    evidence = {}
    for skill, aliases in skill_map.items():
        matches = [alias for alias in aliases if alias and alias in normalized_cv]
        evidence[skill] = sorted(set(matches))
    return evidence


def _learn_job_intelligence(job, required_skill_set):
    """Learn role-specific related skills and aliases from historically strong submissions."""
    done_submissions = list(
        Submission.objects.filter(
            job=job,
            status=Submission.Status.DONE,
            ats_score__isnull=False,
        )
        .order_by("-ats_score")
        .values("candidate_skills", "ats_score")[:60]
    )

    if len(done_submissions) < 3:
        return {"learned_related": set(), "learned_aliases": {}}

    top_count = max(3, math.ceil(len(done_submissions) * 0.35))
    top_submissions = done_submissions[:top_count]

    learned_counter = Counter()
    for row in top_submissions:
        for skill in row.get("candidate_skills") or []:
            normalized = normalize_text(skill)
            if not normalized or normalized in GENERIC_SKILL_TERMS:
                continue
            learned_counter[normalized] += 1

    learned_related = {
        skill for skill, count in learned_counter.items()
        if count >= 2 and skill not in required_skill_set
    }

    learned_aliases = {skill: set() for skill in required_skill_set}
    for required_skill in required_skill_set:
        for skill, count in learned_counter.items():
            if count < 2:
                continue
            if required_skill in skill or skill in required_skill:
                learned_aliases[required_skill].add(skill)
                continue
            ratio = SequenceMatcher(None, required_skill, skill).ratio()
            if ratio >= 0.84:
                learned_aliases[required_skill].add(skill)

    return {
        "learned_related": learned_related,
        "learned_aliases": learned_aliases,
    }


def _adaptive_weights(semantic_score, tfidf_score, skill_match_pct, required_count):
    """Dynamically rebalance semantic/lexical/skill weights for more stable ranking."""
    w_semantic, w_tfidf, w_skill = 0.65, 0.20, 0.15

    disagreement = abs(semantic_score - tfidf_score)
    if disagreement > 35:
        # If semantic and lexical disagree strongly, lean more on explicit skills.
        w_semantic -= 0.08
        w_tfidf += 0.03
        w_skill += 0.05

    if required_count >= 8 and skill_match_pct < 50:
        # For skill-heavy roles, penalize low explicit coverage more.
        w_semantic -= 0.05
        w_skill += 0.05

    total = max(0.0001, w_semantic + w_tfidf + w_skill)
    return w_semantic / total, w_tfidf / total, w_skill / total


def _score_cvs(job, cvs_data, key_skills=None, job_description=None):
    import numpy as np
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    key_skills = key_skills if key_skills is not None else (job.required_skills or [])
    job_description = job_description if job_description is not None else (job.description or "")

    _ensure_nltk_resource('corpora/stopwords', 'stopwords')
    required_skill_set = _to_skill_set(key_skills)
    intelligence = _learn_job_intelligence(job, required_skill_set)
    skill_map = build_skill_map(key_skills, learned_aliases=intelligence["learned_aliases"])

    documents = [job_description]
    for cv_data in cvs_data:
        documents.append(cv_data.get("cv_text") or "")

    similarities = np.zeros((len(cvs_data), 1), dtype=float)
    if len(documents) > 1:
        try:
            stop_words = stopwords.words('english')
            vectorizer = TfidfVectorizer(
                stop_words=stop_words,
                lowercase=True,
                ngram_range=(1, 2),
                sublinear_tf=True,
            )
            tfidf_matrix = vectorizer.fit_transform(documents)
            similarities = cosine_similarity(tfidf_matrix[1:], tfidf_matrix[0])
        except ValueError:
            similarities = np.zeros((len(cvs_data), 1), dtype=float)

    pipeline_funcs = _get_pipeline_functions()
    results = []
    for i, cv_data in enumerate(cvs_data):
        cv_text = cv_data.get("cv_text") or ""
        normalized_cv = normalize_text(cv_text)
        skill_evidence = find_skill_evidence(cv_text, skill_map)

        extracted_skills = cv_data.get("candidate_skills") or pipeline_funcs["extract_skills"](cv_text)
        candidate_skill_set = _to_skill_set(extracted_skills)

        candidate_years = cv_data.get("candidate_years_exp")
        exp_method = cv_data.get("exp_extraction_method") or ""
        if candidate_years is None:
            candidate_years, exp_method = pipeline_funcs["extract_experience_years"](cv_text)
        candidate_years = round(float(candidate_years or 0.0), 2)

        candidate_degree = (cv_data.get("candidate_degree") or "").strip() or "Unknown"
        if candidate_degree == "Unknown":
            education_text = pipeline_funcs["extract_education_sentences"](cv_text)
            candidate_degree = pipeline_funcs["extract_degree_level"](education_text)

        matched_set, semantic_mapped = _map_candidate_to_required(
            required_skill_set,
            skill_map,
            candidate_skill_set,
            normalized_cv,
        )

        # Add candidate terms appearing in text that are close to required concepts.
        for required in required_skill_set:
            if required in matched_set:
                continue
            for token in _skill_tokens(required):
                if token and token in normalized_cv:
                    matched_set.add(required)
                    semantic_mapped.setdefault(required, set()).add("concept-in-text")
                    break

        matched = sorted(matched_set)
        missing = sorted(required_skill_set - matched_set)
        inferred_required = {skill for skill in matched_set if skill not in candidate_skill_set}
        extra = sorted(candidate_skill_set - required_skill_set)

        learned_related = intelligence["learned_related"]
        learned_strength_pct = 0.0
        if learned_related:
            learned_hits = len(candidate_skill_set & learned_related)
            learned_strength_pct = (learned_hits / len(learned_related)) * 100

        evidence_text = [
            f"{skill}: {', '.join(evidence[:3])}"
            for skill, evidence in skill_evidence.items()
            if evidence
        ]

        context_snippets = _extract_evidence_snippets(
            cv_text,
            [*matched[:4], *extra[:2]],
            max_snippets=3,
        )

        tfidf_score = float(similarities[i][0] * 100) if i < len(similarities) else 0.0
        try:
            semantic_score = float(pipeline_funcs["compute_semantic_score"](cv_text, job_description))
        except Exception:
            semantic_score = tfidf_score

        skill_match_pct = (len(matched_set) / len(required_skill_set)) * 100 if required_skill_set else 0.0
        experience_fit = float(pipeline_funcs["experience_score"](job.min_experience_years, candidate_years))
        education_fit = float(pipeline_funcs["education_score"](job.required_degree, candidate_degree))
        job_weighted_score = float(
            pipeline_funcs["weighted_ats_score"](
                skill_match_pct,
                experience_fit,
                education_fit,
                semantic_score,
                job,
            )
        )

        concept_coverage = round(
            100.0 * len([s for s in semantic_mapped if semantic_mapped.get(s)]) / len(required_skill_set),
            2,
        ) if required_skill_set else 0.0
        w_semantic, w_tfidf, w_skill = _adaptive_weights(
            semantic_score,
            tfidf_score,
            skill_match_pct,
            len(required_skill_set),
        )

        blended_score = (
            (w_semantic * semantic_score)
            + (w_tfidf * tfidf_score)
            + (w_skill * skill_match_pct)
        )
        semantic_bonus = 0.07 * concept_coverage
        insight_blend_score = round(min(100.0, blended_score + semantic_bonus + (0.08 * learned_strength_pct)), 2)
        final_score = round(min(100.0, (0.72 * job_weighted_score) + (0.28 * insight_blend_score)), 2)

        confidence = round(
            (0.45 * (100 - min(100.0, abs(semantic_score - tfidf_score))))
            + (0.25 * skill_match_pct)
            + (0.20 * experience_fit)
            + (0.10 * education_fit),
            2,
        )

        score_contributions = {
            "skills": round(job.weight_skills * skill_match_pct, 2),
            "experience": round(job.weight_experience * experience_fit, 2),
            "education": round(job.weight_education * education_fit, 2),
            "semantic": round(job.weight_semantic * semantic_score, 2),
        }
        decision_factors = _build_decision_factors(
            matched=matched,
            missing=missing,
            extra=extra,
            candidate_years=candidate_years,
            required_years=float(job.min_experience_years or 0),
            candidate_degree=candidate_degree,
            required_degree=job.required_degree or "Unknown",
            experience_fit=experience_fit,
            education_fit=education_fit,
            semantic_score=semantic_score,
            confidence=confidence,
        )

        results.append({
            "source": cv_data.get("source", "submission"),
            "submission_id": cv_data.get("submission").id if cv_data.get("submission") else None,
            "candidate_email": cv_data.get("candidate_email") or "",
            "file_name": cv_data.get("file_name") or "",
            "candidate_name": cv_data.get("candidate_name") or "Candidate",
            "final_score": final_score,
            "job_weighted_score": round(job_weighted_score, 2),
            "insight_blend_score": insight_blend_score,
            "similarity_score": round(tfidf_score, 2),
            "semantic_score": round(semantic_score, 2),
            "skill_match_pct": round(skill_match_pct, 2),
            "experience_fit_pct": round(experience_fit, 2),
            "education_fit_pct": round(education_fit, 2),
            "candidate_years_exp": candidate_years,
            "required_experience_years": round(float(job.min_experience_years or 0), 2),
            "experience_extraction_method": exp_method or "resume-analysis",
            "candidate_degree": candidate_degree,
            "required_degree": job.required_degree or "Unknown",
            "matched_skills": matched,
            "missing_skills": missing,
            "extra_skills": extra,
            "required_skills": sorted(required_skill_set),
            "candidate_skills": sorted(candidate_skill_set | inferred_required),
            "semantic_analysis": _build_reasoning_summary(
                final_score=final_score,
                semantic_score=semantic_score,
                skill_match_pct=skill_match_pct,
                experience_fit=experience_fit,
                education_fit=education_fit,
                matched=matched,
                missing=missing,
                extra=extra,
                semantic_mapped=semantic_mapped,
            ),
            "decision_factors": decision_factors,
            "score_breakdown": {
                "job_weighted_fit": round(job_weighted_score, 2),
                "insight_blend_fit": insight_blend_score,
                "semantic_alignment": round(semantic_score, 2),
                "lexical_alignment": round(tfidf_score, 2),
                "skill_coverage": round(skill_match_pct, 2),
                "experience_fit": round(experience_fit, 2),
                "education_fit": round(education_fit, 2),
                "concept_coverage": concept_coverage,
                "historical_strength": round(learned_strength_pct, 2),
            },
            "score_contributions": score_contributions,
            "evidence": [*evidence_text[:4], *context_snippets],
            "concept_coverage_pct": concept_coverage,
            "confidence_score": confidence,
            "historical_strength_score": round(learned_strength_pct, 2),
            "adaptive_weights": {
                "semantic": round(w_semantic, 4),
                "tfidf": round(w_tfidf, 4),
                "skills": round(w_skill, 4),
            },
            "job_weights": {
                "skills": round(job.weight_skills, 4),
                "experience": round(job.weight_experience, 4),
                "education": round(job.weight_education, 4),
                "semantic": round(job.weight_semantic, 4),
            },
        })

    results.sort(key=lambda x: x["final_score"], reverse=True)
    return results

def rank_cvs_for_job(job_id, review_stage="", include_hired=False):
    try:
        job = Job.objects.get(pk=job_id)
    except Job.DoesNotExist:
        return {"error": "Job not found"}

    submissions = _job_submission_queryset(job, review_stage=review_stage, include_hired=include_hired)

    key_skills = job.required_skills or []
    job_description = job.description or ""

    cvs_data = []
    seen_resume_names = set()

    for sub in submissions:
        cv_text = sub.raw_text or ""
        if not cv_text and sub.resume_file:
            try:
                with sub.resume_file.open("rb") as f:
                    file_bytes = f.read()
                cv_text = _safe_extract_resume_text(file_bytes, sub.resume_file.name)
            except Exception:
                cv_text = ""

        resume_name = (sub.resume_file.name or "").split("/")[-1] if sub.resume_file else ""
        if resume_name:
            seen_resume_names.add(resume_name.lower())
        
        cvs_data.append({
            'source': 'submission',
            'submission': sub,
            'cv_text': cv_text,
            'candidate_name': sub.candidate_name or f"Submission {sub.id}",
            'candidate_email': sub.candidate_email or '',
            'file_name': resume_name,
            'candidate_skills': sub.candidate_skills or [],
            'candidate_years_exp': sub.candidate_years_exp,
            'candidate_degree': sub.candidate_degree or 'Unknown',
            'exp_extraction_method': sub.exp_extraction_method or '',
        })

    include_media_entries = not review_stage or review_stage == Submission.ReviewStage.APPLIED
    media_root = Path(getattr(settings, "MEDIA_ROOT", ""))
    resumes_dir = media_root / "resumes"
    if include_media_entries and resumes_dir.exists() and resumes_dir.is_dir():
        for path in sorted(resumes_dir.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in {".pdf", ".txt"}:
                continue

            if path.name.lower() in seen_resume_names:
                continue

            try:
                file_bytes = path.read_bytes()
                cv_text = _safe_extract_resume_text(file_bytes, path.name)
            except Exception:
                cv_text = ""

            candidate_name = re.sub(r"[_\-]+", " ", path.stem).strip() or path.stem
            cvs_data.append({
                'source': 'media',
                'submission': None,
                'cv_text': cv_text,
                'candidate_name': candidate_name,
                'candidate_email': '',
                'file_name': path.name,
                'candidate_skills': [],
            })

    if not cvs_data:
        return {"error": "No CV files found in submissions or media/resumes"}
    return _score_cvs(job, cvs_data, key_skills=key_skills, job_description=job_description)

logger = logging.getLogger(__name__)


def _build_stage_history_entry(*, from_stage, to_stage, note='', talent_pool=True, actor_name='System', actor_role='System', occurred_at=None):
    event_time = occurred_at or timezone.now()
    return {
        'from_stage': from_stage,
        'to_stage': to_stage,
        'note': (note or '').strip(),
        'talent_pool': bool(talent_pool),
        'updated_by': actor_name,
        'updated_by_role': actor_role,
        'updated_at': event_time.isoformat(),
    }


# ── Jobs ──────────────────────────────────────────────────────────────────────


class JobListCreateView(ListCreateAPIView):
    
    queryset         = Job.objects.filter(is_active=True).order_by("-created_at")
    serializer_class = JobSerializer

    def perform_create(self, serializer):
        # Auto-extract required_skills from JD text when job is created
        description = serializer.validated_data.get("description", "")
        required_skills = _get_pipeline_functions()["extract_skills"](description)
        serializer.save(required_skills=required_skills)

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsHRManager()] 


class JobDetailView(RetrieveUpdateAPIView):
    queryset         = Job.objects.all()
    serializer_class = JobSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsHRManager()]


class JobWeightsView(APIView):
    """PATCH /api/jobs/{id}/weights/ — update only the four weights."""
    permission_classes = [IsHRManager]

    def patch(self, request, pk):
        try:
            job = Job.objects.get(pk=pk)
        except Job.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        fields = ["weight_skills", "weight_experience", "weight_education", "weight_semantic"]
        for f in fields:
            if f in request.data:
                setattr(job, f, float(request.data[f]))

        total = round(job.weight_skills + job.weight_experience +
                      job.weight_education + job.weight_semantic, 10)
        if abs(total - 1.0) > 0.001:
            return Response(
                {"detail": f"Weights must sum to 1.0. Got: {total:.3f}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        job.save()
        return Response(JobSerializer(job).data)


class JobPipelineHealthView(APIView):
    """GET /api/recruitment/jobs/health/ — hiring funnel and stale follow-up visibility for HR."""
    permission_classes = [IsAuthenticated, IsHRManager]

    STAGE_THRESHOLDS = {
        Submission.ReviewStage.APPLIED: (3, 7),
        Submission.ReviewStage.SHORTLISTED: (2, 5),
        Submission.ReviewStage.INTERVIEW: (4, 7),
        Submission.ReviewStage.HIRED: (3, 6),
        Submission.ReviewStage.REJECTED: (2, 4),
    }

    def _classify_sla(self, stage, waiting_days):
        at_risk_after, overdue_after = self.STAGE_THRESHOLDS.get(stage, (4, 7))
        if waiting_days >= overdue_after:
            return 'Overdue'
        if waiting_days >= at_risk_after:
            return 'At Risk'
        return 'On Track'

    def get(self, request):
        now = timezone.now()
        jobs = list(Job.objects.all().order_by('-created_at'))
        submissions = list(
            Submission.objects.select_related('job').order_by('-stage_updated_at', '-submitted_at')
        )

        funnel_summary = {
            'appliedCount': 0,
            'shortlistedCount': 0,
            'interviewCount': 0,
            'hiredCount': 0,
            'rejectedCount': 0,
        }
        stage_to_key = {
            Submission.ReviewStage.APPLIED: 'appliedCount',
            Submission.ReviewStage.SHORTLISTED: 'shortlistedCount',
            Submission.ReviewStage.INTERVIEW: 'interviewCount',
            Submission.ReviewStage.HIRED: 'hiredCount',
            Submission.ReviewStage.REJECTED: 'rejectedCount',
        }

        job_summary = {
            job.id: {
                'jobID': job.id,
                'jobTitle': job.title,
                'isActive': job.is_active,
                'applicantCount': 0,
                'inReviewCount': 0,
                'interviewCount': 0,
                'hiredCount': 0,
                'rejectedCount': 0,
                'talentPoolCount': 0,
                'staleCandidates': 0,
                'averageAtsScore': 0,
                'daysOpen': max((now - job.created_at).days, 0) if job.created_at else 0,
                'followUpState': 'On Track',
                'lastActivityAt': job.created_at.isoformat() if job.created_at else None,
                '_score_values': [],
                '_has_overdue': False,
            }
            for job in jobs
        }

        follow_up_items = []

        for submission in submissions:
            stage = submission.review_stage or Submission.ReviewStage.APPLIED
            stage_key = stage_to_key.get(stage)
            if stage_key:
                funnel_summary[stage_key] += 1

            job = submission.job
            job_entry = job_summary.setdefault(
                job.id,
                {
                    'jobID': job.id,
                    'jobTitle': job.title,
                    'isActive': job.is_active,
                    'applicantCount': 0,
                    'inReviewCount': 0,
                    'interviewCount': 0,
                    'hiredCount': 0,
                    'rejectedCount': 0,
                    'talentPoolCount': 0,
                    'staleCandidates': 0,
                    'averageAtsScore': 0,
                    'daysOpen': max((now - job.created_at).days, 0) if job.created_at else 0,
                    'followUpState': 'On Track',
                    'lastActivityAt': job.created_at.isoformat() if job.created_at else None,
                    '_score_values': [],
                    '_has_overdue': False,
                },
            )
            job_entry['applicantCount'] += 1

            if stage in [Submission.ReviewStage.APPLIED, Submission.ReviewStage.SHORTLISTED]:
                job_entry['inReviewCount'] += 1
            if stage == Submission.ReviewStage.INTERVIEW:
                job_entry['interviewCount'] += 1
            elif stage == Submission.ReviewStage.HIRED:
                job_entry['hiredCount'] += 1
            elif stage == Submission.ReviewStage.REJECTED:
                job_entry['rejectedCount'] += 1

            if submission.talent_pool:
                job_entry['talentPoolCount'] += 1
            if submission.ats_score is not None:
                job_entry['_score_values'].append(float(submission.ats_score))

            activity_time = submission.stage_updated_at or submission.submitted_at or now
            waiting_days = max((now - activity_time).days, 0)
            job_entry['lastActivityAt'] = activity_time.isoformat()

            sla_state = self._classify_sla(stage, waiting_days)
            if sla_state != 'On Track' and stage not in [Submission.ReviewStage.HIRED, Submission.ReviewStage.REJECTED]:
                job_entry['staleCandidates'] += 1
                if sla_state == 'Overdue':
                    job_entry['_has_overdue'] = True
                follow_up_items.append({
                    'id': f'candidate-{submission.pk}',
                    'type': 'Candidate Follow-Up',
                    'jobTitle': job.title,
                    'candidateName': submission.candidate_name or 'Candidate',
                    'reviewStage': stage,
                    'waitingDays': waiting_days,
                    'slaState': sla_state,
                    'summary': submission.stage_notes or 'Awaiting the next hiring decision.',
                    'path': f'/hr/cv-ranking?job={job.id}',
                })

        for job in jobs:
            entry = job_summary[job.id]
            if entry['_score_values']:
                entry['averageAtsScore'] = round(sum(entry['_score_values']) / len(entry['_score_values']), 1)

            if not entry['applicantCount'] and job.is_active and entry['daysOpen'] >= 7:
                entry['followUpState'] = 'At Risk'
                follow_up_items.append({
                    'id': f'role-{job.id}',
                    'type': 'Role Coverage',
                    'jobTitle': job.title,
                    'candidateName': '',
                    'reviewStage': 'Open Requisition',
                    'waitingDays': entry['daysOpen'],
                    'slaState': 'At Risk',
                    'summary': 'Active role has no applicants in the pipeline yet.',
                    'path': '/hr/jobs',
                })
            elif entry['_has_overdue']:
                entry['followUpState'] = 'Overdue'
            elif entry['staleCandidates']:
                entry['followUpState'] = 'At Risk'
            elif not job.is_active:
                entry['followUpState'] = 'Paused'

            entry.pop('_score_values', None)
            entry.pop('_has_overdue', None)

        state_rank = {'Overdue': 0, 'At Risk': 1, 'On Track': 2, 'Paused': 3}
        job_breakdown = sorted(
            job_summary.values(),
            key=lambda item: (
                state_rank.get(item['followUpState'], 4),
                -item['staleCandidates'],
                -item['applicantCount'],
                -item['daysOpen'],
            ),
        )
        sorted_follow_up = sorted(
            follow_up_items,
            key=lambda item: ((item['slaState'] == 'Overdue'), item['waitingDays']),
            reverse=True,
        )[:8]

        return Response({
            'totals': {
                'activeJobs': sum(1 for job in jobs if job.is_active),
                'totalCandidates': len(submissions),
                'staleCandidates': sum(item['staleCandidates'] for item in job_breakdown),
                'jobsWithoutApplicants': sum(1 for item in job_breakdown if item['isActive'] and item['applicantCount'] == 0),
                'talentPoolCandidates': sum(1 for submission in submissions if submission.talent_pool),
            },
            'funnelSummary': funnel_summary,
            'jobBreakdown': job_breakdown,
            'followUpItems': sorted_follow_up,
        })


# ── Submissions ───────────────────────────────────────────────────────────────

class SubmitResumeView(APIView):
    """
    POST /api/submit/
    Public endpoint — no auth required.
    Accepts multipart/form-data with: job, candidate_name, candidate_email, resume_file
    Runs the full pipeline synchronously and returns results.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SubmissionUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        submission = serializer.save(status=Submission.Status.PENDING)
        created_at = timezone.now()
        if not submission.stage_history:
            submission.stage_updated_at = created_at
            submission.stage_history = [
                _build_stage_history_entry(
                    from_stage=Submission.ReviewStage.APPLIED,
                    to_stage=Submission.ReviewStage.APPLIED,
                    note='Application submitted and queued for HR review.',
                    talent_pool=submission.talent_pool,
                    actor_name='System',
                    actor_role='System',
                    occurred_at=created_at,
                )
            ]
            submission.save(update_fields=['stage_updated_at', 'stage_history'])

        decision_support_payload = {
            'decisionSupportOnly': getattr(settings, 'AI_DECISION_SUPPORT_ONLY', True),
            'recommendationNotice': getattr(
                settings,
                'AI_GOVERNANCE_NOTICE',
                'AI outputs are advisory only and must be reviewed by HR before any employment decision.',
            ),
        }

        if getattr(settings, 'AI_PIPELINE_ASYNC', False):
            submission.status = Submission.Status.PROCESSING
            submission.save(update_fields=['status'])
            transaction.on_commit(lambda: _enqueue_resume_pipeline(submission.pk))
            return Response(
                {
                    **SubmissionSerializer(submission).data,
                    'processingMode': 'async',
                    **decision_support_payload,
                    'detail': 'Application received and queued for AI screening.',
                },
                status=status.HTTP_202_ACCEPTED,
            )

        try:
            _get_pipeline_functions()["run_pipeline"](submission)
            submission.refresh_from_db()
            return Response(
                {
                    **SubmissionSerializer(submission).data,
                    'processingMode': 'sync',
                    **decision_support_payload,
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return Response(
                {"detail": f"Pipeline failed: {str(exc)}", **decision_support_payload},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class CandidateApplicationListView(APIView):
    """GET /api/recruitment/applications/?email=...&tracking_code=... — safely view candidate application updates."""
    permission_classes = [AllowAny]

    def get(self, request):
        email = (request.query_params.get("email") or "").strip().lower()
        tracking_code = (request.query_params.get("tracking_code") or "").strip().upper()
        is_authenticated_candidate = bool(
            request.user and request.user.is_authenticated and getattr(request.user, 'role', '') == 'Candidate'
        )

        if is_authenticated_candidate:
            owner_email = (getattr(request.user, "email", "") or "").strip().lower()
            if not email:
                email = owner_email
            elif email != owner_email:
                return Response(
                    {"detail": "You can only view your own applications from this account."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif not tracking_code:
            return Response(
                {"detail": "A tracking code is required to view application updates."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not email:
            return Response(
                {"detail": "Candidate email is required to track applications."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        submissions = Submission.objects.select_related("job").filter(candidate_email__iexact=email)
        if not is_authenticated_candidate:
            submissions = submissions.filter(tracking_code__iexact=tracking_code)

        submissions = submissions.order_by("-stage_updated_at", "-submitted_at")
        return Response(SubmissionSerializer(submissions, many=True).data)


class JobSubmissionsView(APIView):
    """GET /api/jobs/{id}/submissions/ — active job applications by default, with optional history filters."""
    permission_classes = [IsHRManager]

    def get(self, request, pk):
        review_stage, include_hired = _parse_submission_history_filters(request)
        submissions = _job_submission_queryset(pk, review_stage=review_stage, include_hired=include_hired)
        serialized = SubmissionSerializer(submissions, many=True).data

        existing_names = {
            (item.get("resume_filename") or "").strip().lower()
            for item in serialized
            if item.get("resume_filename")
        }

        media_entries = []
        include_media_entries = not review_stage or review_stage == Submission.ReviewStage.APPLIED
        media_root = Path(getattr(settings, "MEDIA_ROOT", ""))
        resumes_dir = media_root / "resumes"

        if include_media_entries and resumes_dir.exists() and resumes_dir.is_dir():
            media_files = [
                p for p in resumes_dir.rglob("*")
                if p.is_file() and p.suffix.lower() in {".pdf", ".txt"}
            ]
            media_files.sort(key=lambda p: p.stat().st_mtime, reverse=True)

            for path in media_files:
                filename = path.name
                lower_name = filename.lower()
                if lower_name in existing_names:
                    continue

                relative_path = path.relative_to(media_root).as_posix()
                candidate_name = re.sub(r"[_\-]+", " ", path.stem).strip() or path.stem
                modified_iso = datetime.fromtimestamp(path.stat().st_mtime, tz=dt_timezone.utc).isoformat()

                media_entries.append({
                    "id": f"media-{path.stem}-{int(path.stat().st_mtime)}",
                    "job": int(pk),
                    "job_title": "",
                    "candidate_name": candidate_name,
                    "candidate_email": "",
                    "tracking_code": "",
                    "resume_file": f"/media/{relative_path}",
                    "resume_filename": filename,
                    "status": "MEDIA",
                    "review_stage": "Applied",
                    "stage_notes": "Imported from media library",
                    "stage_updated_at": modified_iso,
                    "talent_pool": False,
                    "stage_history": [],
                    "error_message": "",
                    "candidate_skills": [],
                    "candidate_degree": "",
                    "candidate_years_exp": 0,
                    "skills_score": None,
                    "experience_score": None,
                    "education_score": None,
                    "semantic_score": None,
                    "ats_score": None,
                    "submitted_at": modified_iso,
                    "scored_at": None,
                })

        return Response([*serialized, *media_entries])


class SubmissionDetailView(APIView):
    """GET /api/submissions/{id}/"""
    permission_classes = [IsHRManager]

    def get(self, request, pk):
        try:
            sub = Submission.objects.get(pk=pk)
        except Submission.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(SubmissionSerializer(sub).data)


ALLOWED_STAGE_TRANSITIONS = {
    Submission.ReviewStage.APPLIED: {
        Submission.ReviewStage.APPLIED,
        Submission.ReviewStage.SHORTLISTED,
        Submission.ReviewStage.INTERVIEW,
        Submission.ReviewStage.REJECTED,
    },
    Submission.ReviewStage.SHORTLISTED: {
        Submission.ReviewStage.SHORTLISTED,
        Submission.ReviewStage.INTERVIEW,
        Submission.ReviewStage.REJECTED,
    },
    Submission.ReviewStage.INTERVIEW: {
        Submission.ReviewStage.INTERVIEW,
        Submission.ReviewStage.SHORTLISTED,
        Submission.ReviewStage.HIRED,
        Submission.ReviewStage.REJECTED,
    },
    Submission.ReviewStage.HIRED: {Submission.ReviewStage.HIRED},
    Submission.ReviewStage.REJECTED: {Submission.ReviewStage.REJECTED},
}


class SubmissionStageUpdateView(APIView):
    """POST /api/recruitment/submissions/{id}/stage/ — update a candidate's hiring stage."""
    permission_classes = [IsHRManager]

    def post(self, request, pk):
        try:
            submission = Submission.objects.get(pk=pk)
        except Submission.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = SubmissionStageUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        next_stage = serializer.validated_data['review_stage']
        current_stage = submission.review_stage or Submission.ReviewStage.APPLIED
        allowed_next = ALLOWED_STAGE_TRANSITIONS.get(current_stage, {current_stage})
        if next_stage not in allowed_next:
            return Response(
                {"detail": f"Invalid hiring stage transition from {current_stage} to {next_stage}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        submission.review_stage = next_stage
        if 'stage_notes' in serializer.validated_data:
            submission.stage_notes = serializer.validated_data['stage_notes']
        if 'talent_pool' in serializer.validated_data:
            submission.talent_pool = serializer.validated_data['talent_pool']

        updated_at = timezone.now()
        linked_employee = None

        with transaction.atomic():
            if next_stage == Submission.ReviewStage.HIRED and current_stage != Submission.ReviewStage.HIRED:
                linked_employee = _promote_candidate_to_employee(submission, request.user)

            history = list(submission.stage_history or [])
            history_entry = _build_stage_history_entry(
                from_stage=current_stage,
                to_stage=next_stage,
                note=submission.stage_notes,
                talent_pool=submission.talent_pool,
                actor_name=getattr(request.user, 'full_name', '') or getattr(request.user, 'email', '') or 'HR team',
                actor_role=getattr(request.user, 'role', '') or 'HRManager',
                occurred_at=updated_at,
            )
            if linked_employee:
                history_entry['employee_id'] = linked_employee['employeeID']
                history_entry['employment_event'] = linked_employee['employmentEvent']

            history.append(history_entry)
            submission.stage_history = history
            submission.stage_updated_at = updated_at
            submission.save(update_fields=['review_stage', 'stage_notes', 'talent_pool', 'stage_history', 'stage_updated_at'])

        response_data = SubmissionSerializer(submission).data
        if linked_employee:
            response_data['linkedEmployee'] = linked_employee
        return Response(response_data)


class JobCVRankingView(APIView):
    """GET /api/recruitment/jobs/{id}/ranking/ — rank CVs for a job using AI."""
    permission_classes = [IsHRManager]

    def get(self, request, pk):
        review_stage, include_hired = _parse_submission_history_filters(request)
        results = rank_cvs_for_job(pk, review_stage=review_stage, include_hired=include_hired)
        if "error" in results:
            return Response({"detail": results["error"]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(results)

    def post(self, request, pk):
        """POST /api/recruitment/jobs/{id}/ranking/ — upload and rank additional CVs.

        Returns a combined ranking list that includes:
        - existing CVs already linked to the selected job (and media CVs from the current ranking logic)
        - newly uploaded CV files from this request
        """
        try:
            job = Job.objects.get(pk=pk)
        except Job.DoesNotExist:
            return Response({"detail": "Job not found"}, status=status.HTTP_404_NOT_FOUND)

        uploaded_files = request.FILES.getlist('cvs')
        if not uploaded_files:
            return Response({"detail": "No CV files provided"}, status=status.HTTP_400_BAD_REQUEST)

        key_skills = job.required_skills or []
        job_description = job.description or ""

        # Start with current ranking set so uploaded CVs are added, not replacing existing job CVs.
        existing_results = rank_cvs_for_job(pk)
        if isinstance(existing_results, dict) and "error" in existing_results:
            existing_results = []

        cvs_data = []

        for file in uploaded_files:
            if not file.name.lower().endswith((".pdf", ".txt")):
                return Response(
                    {"detail": f"Unsupported file type: {file.name}. Only PDF and TXT are allowed."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            file_bytes = file.read()
            cv_text = _safe_extract_resume_text(file_bytes, file.name)
            
            cvs_data.append({
                'source': 'upload',
                'file_name': file.name,
                'cv_text': cv_text,
                'candidate_name': file.name.replace('.pdf', '').replace('.txt', '')
            })

        if not cvs_data:
            return Response({"detail": "No valid CV text found"}, status=status.HTTP_400_BAD_REQUEST)

        results = _score_cvs(job, cvs_data, key_skills=key_skills, job_description=job_description)

        combined_results = [*existing_results, *results]

        # Sort by final score descending
        combined_results.sort(key=lambda x: x['final_score'], reverse=True)
        return Response(combined_results)
