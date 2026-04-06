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
    'work_life_balance': 'work-life balance',
    'job_satisfaction': 'job satisfaction',
    'distance_from_home': 'distance from home',
    'leadership': 'leadership opportunities',
    'innovation': 'innovation opportunities',
    'company_reputation': 'company reputation',
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

SEVERITY_ORDER = {'high': 3, 'medium': 2, 'low': 1}

_model = None


def load_model():
    global _model
    if _model is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"Model file not found at {MODEL_PATH}. "
                "Place your xgboost_model.json in the attrition/ app folder."
            )
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
            if answer.scoreValue is not None:
                return answer.scoreValue
            if answer.booleanValue is not None:
                return int(answer.booleanValue)
            if answer.decimalValue is not None:
                return float(answer.decimalValue)
    return None


def _safe_number(value):
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def collect_answer_signals(answers_qs):
    answers = list(answers_qs or [])
    return {
        'work_life_balance': _safe_number(get_answer_value(answers, QUESTION_MAP['work_life_balance'])),
        'job_satisfaction': _safe_number(get_answer_value(answers, QUESTION_MAP['job_satisfaction'])),
        'distance_from_home': _safe_number(get_answer_value(answers, QUESTION_MAP['distance_from_home'])),
        'leadership': _safe_number(get_answer_value(answers, QUESTION_MAP['leadership'])),
        'innovation': _safe_number(get_answer_value(answers, QUESTION_MAP['innovation'])),
        'company_reputation': _safe_number(get_answer_value(answers, QUESTION_MAP['company_reputation'])),
        'employee_recognition': _safe_number(get_answer_value(answers, QUESTION_MAP['employee_recognition'])),
    }


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

    answer_values = collect_answer_signals(answers_qs)

    # Marital status one-hot
    marital_married = 1 if employee.maritalStatus == 'Married' else 0
    marital_single = 1 if employee.maritalStatus == 'Single' else 0

    # Gender encoding (Male=1, Female=0)
    gender = 1 if employee.gender == 'Male' else 0

    # Feedback answers
    wlb = get(answer_values['work_life_balance'], 'Work-Life Balance')
    job_sat = get(answer_values['job_satisfaction'], 'Job Satisfaction')
    distance = get(answer_values['distance_from_home'], 'Distance from Home')
    leadership = get(answer_values['leadership'], 'Leadership Opportunities')
    innovation = get(answer_values['innovation'], 'Innovation Opportunities')
    reputation = get(answer_values['company_reputation'], 'Company Reputation')
    recognition = get(answer_values['employee_recognition'], 'Employee Recognition')

    vector = [
        get(employee.age, 'Age'),
        gender,
        get(employee.yearsAtCompany, 'Years at Company'),
        get(employee.monthlyIncome, 'Monthly Income'),
        wlb,
        job_sat,
        get(employee.performanceRating, 'Performance Rating'),
        get(employee.numberOfPromotions, 'Number of Promotions'),
        int(employee.overtime) if employee.overtime is not None else get(None, 'Overtime'),
        distance,
        get(employee.educationLevel, 'Education Level'),
        get(employee.numberOfDependents, 'Number of Dependents'),
        get(employee.jobLevel, 'Job Level'),
        get(employee.companySize, 'Company Size'),
        get(employee.companyTenure, 'Company Tenure'),
        int(employee.remoteWork) if employee.remoteWork is not None else get(None, 'Remote Work'),
        leadership,
        innovation,
        reputation,
        recognition,
        marital_married,
        marital_single,
    ]

    return np.array(vector, dtype=float), missing


def build_prediction_insights(employee, answers_qs=None, risk_score=None, risk_level=None, missing_fields=None):
    missing_fields = list(missing_fields or [])
    answer_values = collect_answer_signals(answers_qs)
    drivers = []
    actions = []

    def add_driver(title, detail, severity='medium', weight=0.5, action=None):
        drivers.append({
            'title': title,
            'detail': detail,
            'severity': severity,
            'weight': round(float(weight), 2),
        })
        if action and action not in actions:
            actions.append(action)

    if not risk_level:
        score = float(risk_score or 0)
        if score >= 0.65:
            risk_level = 'High'
        elif score >= 0.40:
            risk_level = 'Medium'
        else:
            risk_level = 'Low'

    if (answer_values['work_life_balance'] or 0) <= 2 and answer_values['work_life_balance'] is not None:
        add_driver(
            'Low work-life balance',
            'Recent pulse feedback suggests the employee is struggling to maintain a sustainable work rhythm.',
            severity='high' if answer_values['work_life_balance'] <= 1 else 'medium',
            weight=0.92 if answer_values['work_life_balance'] <= 1 else 0.72,
            action='Review workload balance and manager support this week.',
        )

    if (answer_values['job_satisfaction'] or 0) <= 2 and answer_values['job_satisfaction'] is not None:
        add_driver(
            'Low job satisfaction',
            'The latest feedback indicates disengagement with the current role or daily work experience.',
            severity='high' if answer_values['job_satisfaction'] <= 1 else 'medium',
            weight=0.95 if answer_values['job_satisfaction'] <= 1 else 0.76,
            action='Schedule a stay conversation to understand immediate concerns and blockers.',
        )

    if employee.overtime:
        add_driver(
            'Frequent overtime pressure',
            'Extended workload demands can increase fatigue and raise the chance of attrition.',
            severity='medium',
            weight=0.66,
            action='Review workload allocation and rebalance urgent tasks where possible.',
        )

    if employee.performanceRating is not None and employee.performanceRating <= 2:
        add_driver(
            'Low recent performance trend',
            'A weaker performance rating can reflect disengagement, burnout, or a role-fit gap.',
            severity='medium',
            weight=0.58,
            action='Pair coaching support with a clear short-term improvement plan.',
        )

    if employee.yearsAtCompany is not None and employee.yearsAtCompany >= 5 and (employee.numberOfPromotions or 0) == 0:
        add_driver(
            'Career progression feels stalled',
            'Longer tenure without promotion can signal growth frustration or limited advancement paths.',
            severity='medium',
            weight=0.64,
            action='Create a development roadmap with promotion or stretch opportunities.',
        )

    if (answer_values['leadership'] or 0) <= 2 and answer_values['leadership'] is not None:
        add_driver(
            'Limited leadership opportunity',
            'The employee does not currently see enough room to grow into broader responsibility.',
            severity='medium',
            weight=0.57,
            action='Discuss mentoring, ownership, or leadership-track opportunities.',
        )

    if (answer_values['innovation'] or 0) <= 2 and answer_values['innovation'] is not None:
        add_driver(
            'Low innovation exposure',
            'A lack of fresh challenges or problem-solving opportunities may reduce engagement.',
            severity='medium',
            weight=0.49,
            action='Assign a stretch project or rotation to re-energize engagement.',
        )

    if (answer_values['employee_recognition'] or 0) <= 2 and answer_values['employee_recognition'] is not None:
        add_driver(
            'Recognition feels low',
            'The employee may feel their work is not being noticed or rewarded consistently.',
            severity='medium',
            weight=0.61,
            action='Increase recognition frequency and reinforce impact in the next 1:1.',
        )

    if (answer_values['company_reputation'] or 0) <= 2 and answer_values['company_reputation'] is not None:
        add_driver(
            'Weaker company confidence',
            'Lower confidence in the company experience can reduce long-term commitment.',
            severity='low' if answer_values['company_reputation'] > 1 else 'medium',
            weight=0.46,
            action='Share team direction, business context, and how the employee contributes to outcomes.',
        )

    if (answer_values['distance_from_home'] or 0) >= 20:
        add_driver(
            'Long commute burden',
            'Commute distance may be adding friction to the day-to-day employee experience.',
            severity='medium' if not employee.remoteWork else 'low',
            weight=0.55,
            action='Consider hybrid flexibility or schedule adjustments if the role allows.',
        )

    if not drivers:
        if risk_level == 'High':
            add_driver(
                'Elevated combined risk',
                'The model sees several moderate issues contributing to a higher overall resignation probability.',
                severity='high',
                weight=0.65,
                action='Run a focused retention review with HR and the direct manager.',
            )
        elif risk_level == 'Medium':
            add_driver(
                'Mixed retention signals',
                'The employee profile shows moderate attrition indicators that should be monitored proactively.',
                severity='medium',
                weight=0.45,
                action='Plan a proactive check-in before the next feedback cycle.',
            )
        else:
            add_driver(
                'Stable engagement pattern',
                'Current employee and survey data do not show a strong attrition concern right now.',
                severity='low',
                weight=0.25,
                action='Keep regular recognition and development check-ins in place.',
            )

    priority_action = {
        'High': 'Arrange an HR-manager retention conversation within the next 7 days.',
        'Medium': 'Review this employee in the next manager 1:1 and monitor the next pulse survey.',
        'Low': 'Maintain the current engagement plan and continue routine follow-up.',
    }.get(risk_level)
    if priority_action and priority_action not in actions:
        actions.insert(0, priority_action)

    if missing_fields:
        missing_action = 'Complete the missing profile and survey fields to improve prediction confidence.'
        if missing_action not in actions:
            actions.append(missing_action)

    drivers.sort(key=lambda item: (SEVERITY_ORDER.get(item['severity'], 0), item.get('weight', 0)), reverse=True)
    top_drivers = drivers[:3]
    driver_titles = ', '.join(driver['title'].lower() for driver in top_drivers)

    if risk_level == 'High':
        summary = f"High attrition risk driven mainly by {driver_titles}. Immediate manager follow-up is recommended."
    elif risk_level == 'Medium':
        summary = f"Medium attrition risk influenced by {driver_titles}. A proactive check-in could reduce disengagement."
    else:
        summary = f"Low attrition risk overall. Current signals look stable, with {driver_titles} worth light monitoring."

    if missing_fields:
        summary += f" Prediction confidence is slightly reduced because {len(missing_fields)} input field(s) were missing."

    return {
        'explanationSummary': summary,
        'riskDrivers': top_drivers,
        'recommendedActions': actions[:4],
    }


def predict_risk(employee, answers_qs):
    """
    Run attrition prediction for one employee.

    Returns:
        {
            'employeeID': str,
            'fullName': str,
            'riskScore': float (0.0 - 1.0),
            'riskLevel': 'High' | 'Medium' | 'Low',
            'missingFields': list of field names that defaulted to 0,
            'explanationSummary': str,
            'riskDrivers': list,
            'recommendedActions': list,
        }
    """
    model = load_model()
    vector, missing = build_feature_vector(employee, answers_qs)

    # XGBoost expects a 2D array
    proba = model.predict_proba(vector.reshape(1, -1))[0][1]
    risk_score = round(float(proba), 4)

    if risk_score >= 0.65:
        risk_level = 'High'
    elif risk_score >= 0.40:
        risk_level = 'Medium'
    else:
        risk_level = 'Low'

    insights = build_prediction_insights(
        employee=employee,
        answers_qs=answers_qs,
        risk_score=risk_score,
        risk_level=risk_level,
        missing_fields=missing,
    )

    return {
        'employeeID': employee.employeeID,
        'fullName': employee.fullName,
        'riskScore': risk_score,
        'riskLevel': risk_level,
        'missingFields': missing,
        **insights,
    }
