"""Expected-Loss Priority Engine v2 (Blueprint v2 Section 14.6, 21 & 27).

Calculates mathematically grounded Expected-Loss Priority:
    Priority_i = 100 * R_i * I_i(C_i) * U_i
where:
    R_i: ML 30-day failure probability in [0, 1] (from risk_service.py)
    I_i(C_i): Operational consequence / impact in [0, 1] (from impact_engine.py,
        which itself contains C_i as I_i = 0.40*C_i + 0.25*D_i + 0.20*T_i + 0.15*A_i)
    C_i: Engineering criticality in [0, 1] (from criticality_engine.py, folded into I_i
        to avoid double-counting — NOT multiplied a second time)
    U_i: Bounded logistic urgency in (0, 1] (from urgency_engine.py)

Non-Negotiable Safety Override (Indian Railways Permanent-Way / OHE / Signalling Rules):
    - Severe defects (Broken Rail Weld, Track Circuit Short, OHE Dropper Break, Point Failure)
      MUST NEVER be deprioritized by statistical minimization.
    - Automatically assigned to the EMERGENCY / CRITICAL band (Score >= 92.5).
"""
import os
import sys
import json
import zlib
import numpy as np
import pandas as pd
import sqlalchemy
from sqlalchemy import text
from datetime import datetime

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from db_helper import get_db_engine
from criticality_engine import compute_criticality_score
from urgency_engine import compute_urgency_from_due_date
from impact_engine import compute_impact_score
from risk_service import predict_task_risk
from baseline_priority import compute_baseline_priority
from explainability import get_explainer

SAFETY_CRITICAL_TYPES = {
    'Broken Rail Weld',
    'Broken Rail Weld Repair',
    'Track Circuit Short',
    'Track Circuit Failure',
    'OHE Dropper Broken',
    'Signal Aspect Lamp Fail',
    'Point Machine Detection Fault',
    'Point Machine Mechanical Fault'
}

def calculate_task_priority(task_row: dict, plan_time: datetime = None) -> dict:
    """Calculates all component scores and final expected-loss priority for a single task."""
    if plan_time is None:
        plan_time = datetime(2026, 8, 23)
        
    t_dict = dict(task_row)

    # 0. Urgency first: derive days_overdue so the risk model sees it (B1 fix —
    #    previously predict_task_risk ran before urgency and days_overdue was
    #    always the 0.0 default, killing the overdue*0.12 risk term).
    due_str = t_dict.get('due_date', '2026-08-25')
    u_i, days_rem = compute_urgency_from_due_date(due_str, plan_time=plan_time)
    try:
        days_overdue = float(max(0.0, -float(days_rem)))
    except Exception:
        days_overdue = 0.0
    t_dict['days_overdue'] = days_overdue

    # 1. ML Failure Probability R_i in [0, 1] (now overdue-aware)
    risk_res = predict_task_risk(t_dict)
    r_i = risk_res['risk_probability']

    # 2. Engineering Criticality C_i in [0, 1]
    c_i, c_breakdown = compute_criticality_score(t_dict)
    
    # 4. Operational Impact I_i in [0, 1]
    dur = int(t_dict.get('duration_minutes', 60))
    cid = t_dict.get('corridor_id', 'CORR_BSB_LKO')
    aff = t_dict.get('affects_line', 'BOTH')
    i_i, i_breakdown = compute_impact_score(c_i, dur, cid, aff)
    
    # 5. Expected-Loss Priority Formula: 100 * R_i * I_i * U_i
    raw_priority = round(max(0.1, 100.0 * r_i * i_i * u_i), 2)
    
    # 6. Safety Override Check
    ttype = str(t_dict.get('task_type', ''))
    raw_crit = str(t_dict.get('criticality', 'Medium'))
    raw_safety = str(t_dict.get('safety_impact', 'Medium'))
    is_safety_critical = (
        (raw_safety == 'Critical') or
        (ttype in SAFETY_CRITICAL_TYPES) or
        any(k in ttype.lower() for k in ['broken rail', 'dropper broken', 'circuit short', 'circuit failure', 'point machine']) or
        (raw_crit == 'Critical')
    )
    
    final_score = raw_priority
    override_active = False
    override_reason = ""
    
    if is_safety_critical:
        # Mandatory minimum score 92.5 for life/derailment safety risks
        if final_score < 92.5:
            final_score = round(max(final_score, 92.5 + (0.05 * float(t_dict.get('condition_score', 50)))), 2)
            override_active = True
            override_reason = f"MANDATORY_SAFETY_OVERRIDE: {ttype} requires zero-delay track possession."
        band = 'Critical'
    else:
        # Final Priority Band (strictly partitioned per MATHEMATICAL_MODEL_V2.md)
        if final_score >= 80.0:
            band = 'Critical'
        elif final_score >= 60.0:
            band = 'High'
        elif final_score >= 35.0:
            band = 'Medium'
        else:
            band = 'Low'
        
    return {
        'task_id': t_dict.get('task_id'),
        'risk_probability': r_i,
        'criticality_score': c_i,
        'urgency_score': u_i,
        'impact_score': i_i,
        'raw_priority': raw_priority,
        'priority_score': final_score,
        'priority_band': band,
        'days_remaining': days_rem,
        'days_overdue': round(days_overdue, 2),
        'safety_override': 1 if override_active else 0,
        'override_reason': override_reason,
        'model_version': risk_res.get('model_version'),
        'breakdowns': {
            'criticality': c_breakdown,
            'impact': i_breakdown,
            'risk': risk_res
        }
    }

def calculate_priorities(db_url=None, use_ml=True, plan_time: datetime = None):
    """Executes Priority Engine v2 across all pending maintenance tasks in the database."""
    engine = get_db_engine() if db_url is None else sqlalchemy.create_engine(db_url)
    if plan_time is None:
        plan_time = datetime(2026, 8, 23)
        
    print("=" * 75)
    print("🚀 EXECUTING MATHEMATICAL DECISION ENGINE v2: EXPECTED-LOSS PRIORITY")
    print("=" * 75)

    query = """
    SELECT mt.task_id, mt.task_type, mt.criticality, mt.due_date, mt.duration_minutes,
           mt.safety_impact, mt.urgency, COALESCE(mt.affects_line, 'BOTH') AS affects_line,
           a.asset_id, a.department, a.asset_type, a.condition_score, a.health_index,
           a.asset_age_years, a.asset_importance, a.section_id, s.name as section_name, s.corridor_id,
           a.location_lat, a.location_lon
    FROM maintenance_tasks mt
    JOIN assets a ON mt.asset_id = a.asset_id
    JOIN sections s ON a.section_id = s.section_id
    WHERE mt.status = 'Pending'
    """
    df = pd.read_sql(query, engine)
    print(f"  Ingested {len(df)} pending maintenance tasks from database.")

    # Calculate baseline rule scores for comparative auditing
    df_baseline = compute_baseline_priority(df, plan_time=plan_time)
    
    explainer = get_explainer()
    results = []
    
    with engine.begin() as conn:
        for idx, row in df.iterrows():
            row_dict = row.to_dict()
            res = calculate_task_priority(row_dict, plan_time=plan_time)
            
            # Baseline score for comparison
            base_score = float(df_baseline.loc[idx, 'baseline_priority_score'])
            res['baseline_score'] = base_score
            
            # TreeSHAP feature explanation
            exp_data = None
            if explainer is not None:
                exp_data = explainer.explain_task(row_dict)
                
            # Update maintenance_tasks table
            conn.execute(text("""
                UPDATE maintenance_tasks
                SET priority_score = :pscore,
                    criticality = :crit,
                    risk_probability = :rprob,
                    urgency = :urg,
                    updated_at = CURRENT_TIMESTAMP
                WHERE task_id = :tid
            """), {
                'pscore': res['priority_score'],
                'crit': res['priority_band'],
                'rprob': res['risk_probability'],
                'urg': res['priority_band'],
                'tid': res['task_id']
            })
            
            # Update or insert ml_predictions table
            shap_json = json.dumps(exp_data.get('shap_values', {})) if exp_data else "{}"
            conn.execute(text("""
                INSERT INTO ml_predictions (
                    prediction_id, task_id, model_version, prediction_timestamp,
                    risk_probability, priority_score, safety_override, shap_values_json
                ) VALUES (
                    :pid, :tid, :mver, CURRENT_TIMESTAMP,
                    :rprob, :pscore, :sover, :shap
                )
                ON CONFLICT (prediction_id) DO UPDATE SET
                    risk_probability = EXCLUDED.risk_probability,
                    priority_score = EXCLUDED.priority_score,
                    safety_override = EXCLUDED.safety_override,
                    shap_values_json = EXCLUDED.shap_values_json,
                    prediction_timestamp = CURRENT_TIMESTAMP
            """), {
                'pid': f"PRED_{res['task_id']}",
                'tid': res['task_id'],
                'mver': res['model_version'] or 'v2.1-champion',
                'rprob': res['risk_probability'],
                'pscore': res['priority_score'],
                'sover': res['safety_override'],
                'shap': shap_json
            })
            results.append(res)
            
    print(f"  ✓ Processed and enriched {len(results)} tasks with calibrated Priority, Risk, and Criticality.")
    overrides_count = sum(1 for r in results if r['safety_override'] == 1)
    print(f"  ✓ Enforced {overrides_count} Non-Negotiable Safety Overrides for critical defects.")
    return pd.DataFrame(results)

if __name__ == '__main__':
    res_df = calculate_priorities()
    print("\nTop 5 Tasks by Priority v2:")
    cols = ['task_id', 'risk_probability', 'criticality_score', 'urgency_score', 'impact_score', 'priority_score', 'priority_band', 'safety_override']
    print(res_df.sort_values(by='priority_score', ascending=False)[cols].head(5).to_string(index=False))
