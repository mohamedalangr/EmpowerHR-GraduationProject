import logging
import re
import io
import math
from collections import Counter
from difflib import SequenceMatcher
from datetime import datetime, timezone as dt_timezone
from pathlib import Path
import numpy as np
import pandas as pd
from django.conf import settings
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from accounts.permissions import IsHRManager, IsCandidate
from rest_framework.permissions import IsAuthenticated, AllowAny
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import nltk
from nltk.corpus import stopwords, wordnet

from .models import Job, Submission
from .serializers import JobSerializer, SubmissionSerializer, SubmissionUploadSerializer
from .pipeline import run_pipeline, extract_skills, extract_text_from_pdf, compute_semantic_score

# Download stopwords if not already
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

try:
    nltk.data.find('corpora/wordnet')
except LookupError:
    nltk.download('wordnet')

try:
    nltk.data.find('corpora/omw-1.4')
except LookupError:
    nltk.download('omw-1.4')

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
        return extract_text_from_pdf(io.BytesIO(file_bytes))
    if lowered.endswith(".txt"):
        return file_bytes.decode("utf-8", errors="ignore")
    return ""


def _to_skill_set(skills):
    return {normalize_text(s) for s in (skills or []) if str(s).strip()}


def _wordnet_skill_aliases(skill):
    aliases = set()
    normalized_skill = normalize_text(skill)
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
        f"{fit.title()} fit profile with {semantic_score:.1f}% semantic relevance and "
        f"{skill_match_pct:.1f}% required-skill coverage ({len(matched)} matched)."
        f"{mapped_text}{missing_text}{extra_text}"
    )

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
    key_skills = key_skills if key_skills is not None else (job.required_skills or [])
    job_description = job_description if job_description is not None else (job.description or "")

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

    results = []
    for i, cv_data in enumerate(cvs_data):
        cv_text = cv_data.get("cv_text") or ""
        normalized_cv = normalize_text(cv_text)
        skill_evidence = find_skill_evidence(cv_text, skill_map)

        extracted_skills = cv_data.get("candidate_skills") or extract_skills(cv_text)
        candidate_skill_set = _to_skill_set(extracted_skills)
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
            semantic_score = float(compute_semantic_score(cv_text, job_description))
        except Exception:
            semantic_score = tfidf_score

        skill_match_pct = (len(matched_set) / len(required_skill_set)) * 100 if required_skill_set else 0.0
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
        final_score = round(min(100.0, blended_score + semantic_bonus + (0.08 * learned_strength_pct)), 2)

        confidence = round(
            (0.60 * (100 - min(100.0, abs(semantic_score - tfidf_score))))
            + (0.40 * skill_match_pct),
            2,
        )

        results.append({
            "source": cv_data.get("source", "submission"),
            "submission_id": cv_data.get("submission").id if cv_data.get("submission") else None,
            "candidate_email": cv_data.get("candidate_email") or "",
            "file_name": cv_data.get("file_name") or "",
            "candidate_name": cv_data.get("candidate_name") or "Candidate",
            "final_score": final_score,
            "similarity_score": round(tfidf_score, 2),
            "semantic_score": round(semantic_score, 2),
            "skill_match_pct": round(skill_match_pct, 2),
            "matched_skills": matched,
            "missing_skills": missing,
            "extra_skills": extra,
            "required_skills": sorted(required_skill_set),
            "candidate_skills": sorted(candidate_skill_set | inferred_required),
            "semantic_analysis": _build_reasoning_summary(
                final_score=final_score,
                semantic_score=semantic_score,
                skill_match_pct=skill_match_pct,
                matched=matched,
                missing=missing,
                extra=extra,
                semantic_mapped=semantic_mapped,
            ),
            "evidence": [*evidence_text[:4], *context_snippets],
            "concept_coverage_pct": concept_coverage,
            "confidence_score": confidence,
            "historical_strength_score": round(learned_strength_pct, 2),
            "adaptive_weights": {
                "semantic": round(w_semantic, 4),
                "tfidf": round(w_tfidf, 4),
                "skills": round(w_skill, 4),
            },
        })

    results.sort(key=lambda x: x["final_score"], reverse=True)
    return results

def rank_cvs_for_job(job_id):
    try:
        job = Job.objects.get(pk=job_id)
    except Job.DoesNotExist:
        return {"error": "Job not found"}

    submissions = Submission.objects.filter(job=job).order_by("-submitted_at")

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
        })

    media_root = Path(getattr(settings, "MEDIA_ROOT", ""))
    resumes_dir = media_root / "resumes"
    if resumes_dir.exists() and resumes_dir.is_dir():
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


# ── Jobs ──────────────────────────────────────────────────────────────────────


class JobListCreateView(ListCreateAPIView):
    
    queryset         = Job.objects.filter(is_active=True).order_by("-created_at")
    serializer_class = JobSerializer

    def perform_create(self, serializer):
        # Auto-extract required_skills from JD text when job is created
        description = serializer.validated_data.get("description", "")
        required_skills = extract_skills(description)
        serializer.save(required_skills=required_skills)
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsHRManager()] 


class JobDetailView(RetrieveUpdateAPIView):
    permission_classes = [IsHRManager]
    queryset         = Job.objects.all()
    serializer_class = JobSerializer


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


# ── Submissions ───────────────────────────────────────────────────────────────

class SubmitResumeView(APIView):
    """
    POST /api/submit/
    Public endpoint — no auth required.
    Accepts multipart/form-data with: job, candidate_name, candidate_email, resume_file
    Runs the full pipeline synchronously and returns results.
    """
    permission_classes = [IsCandidate]
    def post(self, request):
        serializer = SubmissionUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        submission = serializer.save(status=Submission.Status.PENDING)

        try:
            run_pipeline(submission)
            submission.refresh_from_db()
            return Response(
                SubmissionSerializer(submission).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            return Response(
                {"detail": f"Pipeline failed: {str(exc)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class JobSubmissionsView(APIView):
    """GET /api/jobs/{id}/submissions/ — all results for a job, ranked by ATS score."""
    permission_classes = [IsHRManager]
    def get(self, request, pk):
        submissions = (
            Submission.objects
            .filter(job_id=pk)
            .order_by("-submitted_at")
        )
        serialized = SubmissionSerializer(submissions, many=True).data

        existing_names = {
            (item.get("resume_filename") or "").strip().lower()
            for item in serialized
            if item.get("resume_filename")
        }

        media_entries = []
        media_root = Path(getattr(settings, "MEDIA_ROOT", ""))
        resumes_dir = media_root / "resumes"

        if resumes_dir.exists() and resumes_dir.is_dir():
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
                    "resume_file": f"/media/{relative_path}",
                    "resume_filename": filename,
                    "status": "MEDIA",
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


class JobCVRankingView(APIView):
    """GET /api/recruitment/jobs/{id}/ranking/ — rank CVs for a job using AI."""
    permission_classes = [IsHRManager]

    def get(self, request, pk):
        results = rank_cvs_for_job(pk)
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
