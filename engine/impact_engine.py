"""Operational Consequence & Impact Engine (Blueprint v2 Section 14.5 & 27).

Calculates consequence/impact score I_i in [0, 1]:
    I_i = 0.40 * C_i + 0.25 * D_i + 0.20 * T_impact + 0.15 * A_impact
where:
    C_i: Engineering criticality score
    D_i: Expected downtime consequence (normalized work duration)
    T_impact: Train impact consequence (traffic exposure and detention vulnerability)
    A_impact: Asset availability impact (fraction of network throughput impacted)
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

def compute_impact_score(c_i: float, duration_minutes: int, corridor_id: str, affects_line: str = 'BOTH', freight_count: int = 0) -> tuple[float, dict]:
    """Computes operational consequence I_i in [0, 1].
    
    Returns:
        (impact_score, component_breakdown_dict)
    """
    # 1. Downtime Consequence D_i: 360 min work is heavy possession (1.0) (spec MATHEMATICAL_MODEL_V2.md)
    dur = float(duration_minutes or 60)
    d_i = float(np.clip(dur / 360.0, 0.20, 1.0))
    
    # 2. Train Impact Consequence T_impact (passenger corridor baseline + goods train forecast penalty)
    if 'DLI' in str(corridor_id):
        t_base = 0.90
    elif 'BSB' in str(corridor_id):
        t_base = 0.75
    else:
        t_base = 0.60
    t_impact = float(np.clip(t_base + 0.02 * min(float(freight_count or 0), 10.0), 0.0, 1.0))
        
    # 3. Asset Availability Consequence A_impact
    if affects_line == 'BOTH':
        a_impact = 1.0   # Both tracks blocked -> complete line availability loss
    else:
        a_impact = 0.60  # Single track possession allows single-line bypass (spec MATHEMATICAL_MODEL_V2.md)
        
    # Weighted composite
    i_score = (
        0.40 * float(c_i) +
        0.25 * d_i +
        0.20 * t_impact +
        0.15 * a_impact
    )
    i_score = float(np.clip(i_score, 0.0, 1.0))
    
    breakdown = {
        'C_criticality': round(float(c_i), 3),
        'D_downtime': round(d_i, 3),
        'T_train_impact': round(t_impact, 3),
        'A_avail_loss': round(a_impact, 3),
        'I_score': round(i_score, 3)
    }
    return i_score, breakdown

def evaluate_tasks_impact(df_tasks: pd.DataFrame) -> pd.DataFrame:
    """Vectorized calculation of consequence/impact scores."""
    df = df_tasks.copy()
    impacts = []
    for _, row in df.iterrows():
        c_val = row.get('criticality_score', 0.5)
        dur = row.get('duration_minutes', 60)
        cid = row.get('corridor_id', 'CORR_BSB_LKO')
        aff = row.get('affects_line', 'BOTH')
        fc = row.get('expected_goods_trains', 0)
        score, _ = compute_impact_score(c_val, dur, cid, aff, freight_count=fc)
        impacts.append(round(score, 4))
    df['impact_score'] = impacts
    return df

if __name__ == '__main__':
    score, bd = compute_impact_score(c_i=0.85, duration_minutes=90, corridor_id='CORR_HWH_DLI', affects_line='BOTH')
    print("Impact Engine Test Output:")
    print(f"  I_i = {score:.4f}")
    print("  Breakdown:", bd)
