"""
prediction_debug.py
====================
Run this from your backend folder to trace the full prediction pipeline:
    python prediction_debug.py

Shows every step from DB fetch -> feature vector -> model output.
"""

import os
import sys
import django

# ── Django setup ──────────────────────────────────────────────────────────
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

# ── Imports (after django setup) ──────────────────────────────────────────
import numpy as np
from feedback.models import FeedbackForm, FeedbackSubmission
from attrition.predictor import (
    load_model, build_feature_vector, get_answer_value,
    QUESTION_MAP, FEATURE_NAMES, MODEL_PATH
)

SEP  = "=" * 65
SEP2 = "-" * 65

# ── STEP 1: Find the latest active form ───────────────────────────────────
print(f"\n{SEP}")
print("  STEP 1: Finding latest active FeedbackForm")
print(SEP)

form = FeedbackForm.objects.filter(isActive=True).order_by('-createdAt').first()
if not form:
    print("  ERROR: No active feedback forms found. Create one in admin first.")
    sys.exit(1)

print(f"  Form ID    : {form.formID}")
print(f"  Form Title : {form.title}")
print(f"  Is Active  : {form.isActive}")
print(f"  Created At : {form.createdAt}")

# ── STEP 2: Find completed submissions ────────────────────────────────────
print(f"\n{SEP}")
print("  STEP 2: Finding completed submissions")
print(SEP)

submissions = FeedbackSubmission.objects.filter(
    formID=form,
    status='Completed'
).select_related('employeeID').prefetch_related('answers__questionID')

print(f"  Completed submissions found: {submissions.count()}")

if not submissions.exists():
    print("  ERROR: No completed submissions. Have an employee fill the form first.")
    sys.exit(1)

# ── STEP 3: Process each submission ───────────────────────────────────────
for submission in submissions:
    employee   = submission.employeeID
    answers_qs = submission.answers.select_related('questionID').all()

    print(f"\n{SEP}")
    print(f"  STEP 3: Employee Profile")
    print(SEP)
    print(f"  Employee ID         : {employee.employeeID}")
    print(f"  Full Name           : {employee.fullName}")
    print(f"  Job Title           : {employee.jobTitle or 'NOT SET'}")
    print(f"  Department          : {employee.department or 'NOT SET'}")
    print(f"  Team                : {employee.team or 'NOT SET'}")
    print(SEP2)
    print(f"  Age                 : {employee.age}")
    print(f"  Gender              : {employee.gender}")
    print(f"  Marital Status      : {employee.maritalStatus}")
    print(f"  Years at Company    : {employee.yearsAtCompany}")
    print(f"  Monthly Income      : {employee.monthlyIncome}")
    print(f"  Job Level           : {employee.jobLevel}")
    print(f"  Company Size        : {employee.companySize}")
    print(f"  Company Tenure      : {employee.companyTenure}")
    print(f"  Education Level     : {employee.educationLevel}")
    print(f"  Num Dependents      : {employee.numberOfDependents}")
    print(f"  Num Promotions      : {employee.numberOfPromotions}")
    print(f"  Performance Rating  : {employee.performanceRating}")
    print(f"  Overtime            : {employee.overtime}")
    print(f"  Remote Work         : {employee.remoteWork}")

    print(f"\n{SEP}")
    print(f"  STEP 4: Feedback Answers ({answers_qs.count()} answers)")
    print(SEP)
    for a in answers_qs:
        val = a.scoreValue if a.scoreValue is not None else \
              a.booleanValue if a.booleanValue is not None else \
              a.decimalValue
        print(f"  [{a.questionID.fieldType:10}] {a.questionID.questionText[:55]:<55} -> {val}")

    print(f"\n{SEP}")
    print(f"  STEP 5: Keyword Matching (QUESTION_MAP -> answer value)")
    print(SEP)
    for key, keyword in QUESTION_MAP.items():
        val = get_answer_value(answers_qs, keyword)
        status = "OK" if val is not None else "NOT MATCHED -- will default to 0"
        print(f"  {key:<25} keyword='{keyword:<25}' -> {val}  {status}")

    print(f"\n{SEP}")
    print(f"  STEP 6: Feature Vector (22 features)")
    print(SEP)
    vector, missing = build_feature_vector(employee, answers_qs)
    print(f"  {'#':<4} {'Feature Name':<35} {'Value':>10}")
    print(f"  {'-'*4} {'-'*35} {'-'*10}")
    for i, (name, val) in enumerate(zip(FEATURE_NAMES, vector)):
        flag = '  <-- MISSING (defaulted to 0)' if name in missing else ''
        print(f"  {i+1:<4} {name:<35} {val:>10.2f}{flag}")

    if missing:
        print(f"\n  WARNING: {len(missing)} fields defaulted to 0:")
        for m in missing:
            print(f"    - {m}")
    else:
        print(f"\n  All 22 features populated successfully.")

    print(f"\n{SEP}")
    print(f"  STEP 7: Model Prediction")
    print(SEP)
    try:
        model  = load_model()
        print(f"  Model loaded from : {MODEL_PATH}")
        proba  = model.predict_proba(vector.reshape(1, -1))[0]
        print(f"  Raw probabilities : Stay={proba[0]:.4f} | Leave={proba[1]:.4f}")
        risk_score = round(float(proba[1]), 4)

        if risk_score >= 0.65:
            risk_level = 'High'
        elif risk_score >= 0.40:
            risk_level = 'Medium'
        else:
            risk_level = 'Low'

        print(f"\n  {'='*40}")
        print(f"  Employee     : {employee.fullName}")
        print(f"  Risk Score   : {risk_score * 100:.1f}%")
        print(f"  Risk Level   : {risk_level}")
        print(f"  {'='*40}")

    except FileNotFoundError as e:
        print(f"  ERROR: {e}")
        print(f"  Place your xgboost_model.json in: backend/attrition/")
    except Exception as e:
        import traceback
        print(f"  ERROR during prediction:")
        traceback.print_exc()

print(f"\n{SEP}")
print("  Done.")
print(SEP)
