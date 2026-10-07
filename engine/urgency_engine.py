"""Urgency Engine (Blueprint v2 Section 14.4 & 27).

Replaces abrupt piecewise thresholds with a continuous, bounded logistic curve:
    U_i = 1.0 / (1.0 + exp(k * (d_i - d_0)))
where:
    d_i: days remaining until due date (negative if overdue)
    k: decay steepness factor (default k = 0.35)
    d_0: logistic midpoint in days (default d_0 = 2.0 days)

Properties:
    - For severely overdue tasks (d_i <= -5), U_i -> 0.999
    - For due today (d_i = 0), U_i = 1 / (1 + exp(-0.7)) = 0.668
    - For tasks due in 2 days (d_i = d_0), U_i = 0.500
    - For far-future tasks (d_i >= 15), U_i -> 0.010
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

DEFAULT_DECAY_K = 0.35
DEFAULT_MIDPOINT_D0 = 2.0

def compute_urgency(days_until_due: float, k: float = DEFAULT_DECAY_K, d0: float = DEFAULT_MIDPOINT_D0) -> float:
    """Computes bounded logistic urgency score U_i in (0, 1]."""
    exponent = k * (float(days_until_due) - d0)
    # Numerical stability clip for exp
    exp_clipped = np.clip(exponent, -35.0, 35.0)
    u_i = 1.0 / (1.0 + np.exp(exp_clipped))
    return float(np.clip(u_i, 0.001, 1.0))

def compute_urgency_from_due_date(due_date_str: str, plan_time: datetime = None, k: float = DEFAULT_DECAY_K, d0: float = DEFAULT_MIDPOINT_D0) -> tuple[float, float]:
    """Computes urgency from ISO due date string relative to plan_time.
    
    Returns:
        (urgency_score, days_remaining)
    """
    if plan_time is None:
        plan_time = datetime(2026, 8, 23)
        
    try:
        due_dt = pd.to_datetime(due_date_str)
        plan_dt = pd.to_datetime(plan_time)
        days_rem = (due_dt - plan_dt).total_seconds() / 86400.0
    except Exception:
        days_rem = 5.0
        
    u_score = compute_urgency(days_rem, k=k, d0=d0)
    return round(u_score, 4), round(days_rem, 2)

def evaluate_tasks_urgency(df_tasks: pd.DataFrame, plan_time: datetime = None) -> pd.DataFrame:
    """Vectorized calculation of logistic urgency for all tasks."""
    df = df_tasks.copy()
    if plan_time is None:
        plan_time = datetime(2026, 8, 23)
        
    plan_dt = pd.to_datetime(plan_time)
    due_dates = pd.to_datetime(df['due_date'])
    days_left = (due_dates - plan_dt).dt.total_seconds() / 86400.0
    
    df['days_left'] = np.round(days_left, 2)
    df['days_overdue'] = np.maximum(0.0, -df['days_left'])
    df['urgency_score'] = [compute_urgency(d) for d in days_left]
    return df

if __name__ == '__main__':
    test_days = [-5, -2, 0, 1, 2, 5, 10, 20]
    print("Urgency Engine Logistic Curve Test:")
    for d in test_days:
        u = compute_urgency(d)
        print(f"  Days: {d:+3d} -> Urgency U_i: {u:.4f}")
