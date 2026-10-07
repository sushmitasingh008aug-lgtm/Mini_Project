"""Traditional Rule-Based Baseline Priority Engine (Blueprint v2 Section 14.1 & 27).

Preserved as BASELINE_RULE_PRIORITY for rigorous Before-vs-After KPI comparison.
Implements:
    Priority_rule = 0.6 * C_rule + 0.4 * U_rule
where:
    C_rule in {100 (Critical), 75 (High), 50 (Medium), 25 (Low)}
    U_rule = max(15, 100 - 8.5 * days_left) if days_left > 0 else 100
"""
import os
import sys
import numpy as np
import pandas as pd
from datetime import datetime

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

CRITICALITY_RULE_WEIGHTS = {
    'Critical': 100.0,
    'High': 75.0,
    'Medium': 50.0,
    'Low': 25.0
}

def compute_baseline_priority(df_tasks: pd.DataFrame, plan_time: datetime = None) -> pd.DataFrame:
    """Computes traditional rule-based priority scores for a dataframe of maintenance tasks.
    
    Parameters:
        df_tasks: DataFrame containing at least 'criticality' and 'due_date' columns.
        plan_time: Reference planning timestamp (defaults to 2026-08-23).
        
    Returns:
        DataFrame copy with added 'baseline_priority_score' and 'baseline_urgency' columns.
    """
    df = df_tasks.copy()
    if plan_time is None:
        plan_time = datetime(2026, 8, 23)
        
    plan_dt = pd.to_datetime(plan_time)
    due_dates = pd.to_datetime(df['due_date'])
    days_left = (due_dates - plan_dt).dt.total_seconds() / 86400.0
    
    # 1. Traditional piecewise linear urgency
    u_rule = np.where(
        days_left <= 0,
        100.0,
        np.maximum(15.0, 100.0 - (days_left.clip(lower=0, upper=10) * 8.5))
    )
    
    # 2. Criticality weights
    crit_scores = df['criticality'].map(CRITICALITY_RULE_WEIGHTS).fillna(50.0).values
    
    # 3. 60/40 combination
    priority_rule = np.round(0.60 * crit_scores + 0.40 * u_rule, 2)
    
    df['baseline_urgency'] = np.round(u_rule, 2)
    df['baseline_criticality'] = np.round(crit_scores, 2)
    df['baseline_priority_score'] = priority_rule
    return df

if __name__ == '__main__':
    sample_data = pd.DataFrame([
        {'task_id': 'T1', 'criticality': 'Critical', 'due_date': '2026-08-22'},
        {'task_id': 'T2', 'criticality': 'High', 'due_date': '2026-08-25'},
        {'task_id': 'T3', 'criticality': 'Low', 'due_date': '2026-09-05'}
    ])
    res = compute_baseline_priority(sample_data)
    print("Baseline Priority Engine Test Output:")
    print(res[['task_id', 'criticality', 'baseline_urgency', 'baseline_priority_score']])
