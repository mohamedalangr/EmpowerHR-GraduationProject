"""
predictor.py
============
Loads the XGBoost model and builds the feature vector
from an Employee record + their FeedbackAnswers.

Place your model JSON file at:
    backend/attrition/xgboost_model.json
"""

import os
import numpy as np
import xgboost as xgb

# Path to the saved model JSON file
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'xgboost_model.json')

# Question text keywords used to identify which answer maps to which feature
# These must match the questionText values you entered in admin
QUESTION_MAP = {
    'work_life_balance':    'work-life balance',
    'job_satisfaction':     'job satisfaction',
    'distance_from_home':   'distance from home',
    'leadership':           'leadership opportunities',
    'innovation':           'innovation opportunities',
    'company_reputation':   'company reputation',
    'employee_recognition': 'employee recognition',
}

# Feature order must match exactly what the model was trained on
FEATURE_NAMES = [
    'Age',
    'Gender',
    'Years at Company',
    'Monthly Income',
    'Work-Life Balance',
    'Job Satisfaction',
    'Performance Rating',
    'Number of Promotions',
    'Overtime',
    'Distance from Home',
    'Education Level',
    'Number of Dependents',
    'Job Level',
    'Company Size',
    'Company Tenure',
    'Remote Work',
    'Leadership Opportunities',
    'Innovation Opportunities',
    'Company Reputation',
    'Employee Recognition',
    'Marital Status_Married',
    'Marital Status_Single',
]

_model = None

def load_model():
    global _model
    if _model is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"Model file not found at {MODEL_PATH}. "
                "Place your xgboost_model.json in the attrition/ app folder.")
        _model = xgb.XGBClassifier()
        _model.load_model(MODEL_PATH)
    return _model


def get_answer_value(answers_qs, keyword):
    """
    Find the answer whose question text contains the keyword (case-insensitive).
    Returns the appropriate value field.
    """
    for answer in answers_qs:
        q_text = answer.questionID.questionText.lower()
        if keyword.lower() in q_text:
            if answer.scoreValue   is not None: return answer.scoreValue
            if answer.booleanValue is not None: return int(answer.booleanValue)
            if answer.decimalValue is not None: return float(answer.decimalValue)
    return None


def build_feature_vector(employee, answers_qs):
    """
    Build a single feature vector (numpy array) from an employee record
    and their feedback answers.

    Returns (feature_vector, missing_fields) where missing_fields is a list
    of field names that could not be populated.
    """
    missing = []

    def get(value, name):
        if value is None:
            missing.append(name)
            return 0  # default to 0 for missing values
        return value

    # Marital status one-hot
    marital_married = 1 if employee.maritalStatus == 'Married'  else 0
    marital_single  = 1 if employee.maritalStatus == 'Single'   else 0

    # Gender encoding (Male=1, Female=0)
    gender = 1 if employee.gender == 'Male' else 0

    # Feedback answers
    wlb        = get(get_answer_value(answers_qs, QUESTION_MAP['work_life_balance']),  'Work-Life Balance')
    job_sat    = get(get_answer_value(answers_qs, QUESTION_MAP['job_satisfaction']),   'Job Satisfaction')
    distance   = get(get_answer_value(answers_qs, QUESTION_MAP['distance_from_home']), 'Distance from Home')
    leadership = get(get_answer_value(answers_qs, QUESTION_MAP['leadership']),         'Leadership Opportunities')
    innovation = get(get_answer_value(answers_qs, QUESTION_MAP['innovation']),         'Innovation Opportunities')
    reputation = get(get_answer_value(answers_qs, QUESTION_MAP['company_reputation']), 'Company Reputation')
    recognition= get(get_answer_value(answers_qs, QUESTION_MAP['employee_recognition']),'Employee Recognition')

    vector = [
        get(employee.age,                'Age'),
        gender,
        get(employee.yearsAtCompany,     'Years at Company'),
        get(employee.monthlyIncome,      'Monthly Income'),
        wlb,
        job_sat,
        get(employee.performanceRating,  'Performance Rating'),
        get(employee.numberOfPromotions, 'Number of Promotions'),
        int(employee.overtime) if employee.overtime is not None else get(None, 'Overtime'),
        distance,
        get(employee.educationLevel,     'Education Level'),
        get(employee.numberOfDependents, 'Number of Dependents'),
        get(employee.jobLevel,           'Job Level'),
        get(employee.companySize,        'Company Size'),
        get(employee.companyTenure,      'Company Tenure'),
        int(employee.remoteWork) if employee.remoteWork is not None else get(None, 'Remote Work'),
        leadership,
        innovation,
        reputation,
        recognition,
        marital_married,
        marital_single,
    ]

    return np.array(vector, dtype=float), missing


def predict_risk(employee, answers_qs):
    """
    Run attrition prediction for one employee.

    Returns:
        {
            'employeeID':  str,
            'fullName':    str,
            'riskScore':   float (0.0 - 1.0),
            'riskLevel':   'High' | 'Medium' | 'Low',
            'missingFields': list of field names that defaulted to 0
        }
    """
    model  = load_model()
    vector, missing = build_feature_vector(employee, answers_qs)

    # XGBoost expects a 2D array
    proba      = model.predict_proba(vector.reshape(1, -1))[0][1]
    risk_score = round(float(proba), 4)

    if risk_score >= 0.65:
        risk_level = 'High'
    elif risk_score >= 0.40:
        risk_level = 'Medium'
    else:
        risk_level = 'Low'

    return {
        'employeeID':    employee.employeeID,
        'fullName':      employee.fullName,
        'riskScore':     risk_score,
        'riskLevel':     risk_level,
        'missingFields': missing,
    }
