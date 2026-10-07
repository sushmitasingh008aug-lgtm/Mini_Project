"""Engineering Criticality Engine (Blueprint v2 Section 14.2 & 27).

Answers the formal engineering question:
    "If this asset fails, how severe is the consequence?"

Normalized formulation in [0, 1]:
    C_i = 0.30 * S_i + 0.20 * O_i + 0.20 * A_i + 0.10 * F_i + 0.10 * R_i_red + 0.10 * T_i
where:
    S_i: Safety consequence
    O_i: Operational consequence (corridor throughput category)
    A_i: Asset / network importance
    F_i: Historical failure impact (past detention / failure recurrence)
    R_i_red: Redundancy vulnerability (1.0 = non-redundant / single-line, 0.2 = redundant)
    T_i: Traffic exposure (train density / headway load)
"""
import os
import sys
import numpy as np
import pandas as pd

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

SAFETY_LEVEL_MAP = {
    'Critical': 1.0,
    'High': 0.75,
    'Medium': 0.45,
    'Low': 0.20
}

# Corridor Operational Consequence
CORRIDOR_CONSEQUENCE_MAP = {
    'CORR_HWH_DLI': 1.0,     # Howrah - New Delhi Trunk Line (Ultra-High Speed)
    'CORR_BSB_LKO': 0.85,    # Varanasi - Lucknow Mainline
    'CORR_DDU_YARD': 0.70    # Freight Marshalling Yards
}

def compute_criticality_score(task_row: dict) -> tuple[float, dict]:
    """Computes multi-attribute engineering criticality C_i in [0, 1].
    
    Returns:
        (criticality_score, component_breakdown_dict)
    """
    # 1. Safety Consequence S_i
    raw_safety = task_row.get('safety_impact') or task_row.get('criticality', 'Medium')
    s_i = SAFETY_LEVEL_MAP.get(raw_safety, 0.50)
    
    # 2. Operational Consequence O_i
    cid = task_row.get('corridor_id', 'CORR_BSB_LKO')
    o_i = CORRIDOR_CONSEQUENCE_MAP.get(cid, 0.75)
    
    # 3. Asset Importance A_i
    a_imp = task_row.get('asset_importance', 0.80)
    try:
        a_i = float(np.clip(float(a_imp), 0.1, 1.0))
    except Exception:
        a_i = 0.80
        
    # 4. Historical Failure Impact F_i (based on asset condition or past detention)
    cond = task_row.get('condition_score', 75)
    try:
        cond_val = float(cond)
        # Lower condition score means higher historical failure susceptibility
        f_i = float(np.clip((100.0 - cond_val) / 85.0, 0.0, 1.0))
    except Exception:
        f_i = 0.35
        
    # 5. Redundancy Vulnerability R_i_red
    line_aff = task_row.get('affects_line', 'BOTH')
    dept = task_row.get('department', 'Engineering')
    if line_aff == 'BOTH' or dept == 'S&T':
        # S&T circuit drops or double-line possession disable entire section (no redundancy)
        r_i = 1.0
    elif 'Turnout' in str(task_row.get('task_type', '')) or 'Point' in str(task_row.get('task_type', '')):
        r_i = 0.90
    else:
        # Single track possession allows single-line working or diversion
        r_i = 0.55
        
    # 6. Traffic Exposure T_i
    if 'DLI' in str(cid):
        t_i = 0.95
    elif 'BSB' in str(cid):
        t_i = 0.80
    else:
        t_i = 0.60

    # Weighted sum
    c_i = (
        0.30 * s_i +
        0.20 * o_i +
        0.20 * a_i +
        0.10 * f_i +
        0.10 * r_i +
        0.10 * t_i
    )
    c_i = float(np.clip(c_i, 0.0, 1.0))
    
    breakdown = {
        'S_safety': round(s_i, 3),
        'O_operational': round(o_i, 3),
        'A_importance': round(a_i, 3),
        'F_failure_hist': round(f_i, 3),
        'R_redundancy': round(r_i, 3),
        'T_traffic': round(t_i, 3),
        'C_score': round(c_i, 3)
    }
    return c_i, breakdown

def evaluate_tasks_criticality(df_tasks: pd.DataFrame) -> pd.DataFrame:
    """Vectorized calculation of criticality scores for task dataframe."""
    df = df_tasks.copy()
    scores = []
    for _, row in df.iterrows():
        c, _ = compute_criticality_score(row.to_dict())
        scores.append(round(c, 4))
    df['criticality_score'] = scores
    return df

if __name__ == '__main__':
    sample = {
        'task_type': 'Broken Rail Weld',
        'criticality': 'Critical',
        'safety_impact': 'Critical',
        'corridor_id': 'CORR_HWH_DLI',
        'asset_importance': 0.95,
        'condition_score': 35,
        'affects_line': 'BOTH',
        'department': 'Engineering'
    }
    c_score, b_down = compute_criticality_score(sample)
    print("Criticality Engine Test Result:")
    print(f"  C_i = {c_score:.4f}")
    print("  Breakdown:", b_down)
