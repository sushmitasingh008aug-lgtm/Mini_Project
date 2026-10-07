"""Deterministic Compatibility Engine (Master Plan v2 Section 13).

Provides auditable, rule-based verification for multi-department task consolidation:
  "Same section does not mean automatic merging."

8-Point Verification Checks:
  1. Spatial: Same operational section / approved adjacent boundary.
  2. Possession: Compatible possession block requirements.
  3. Isolation: Traction power disconnection vs signal track-circuit isolation compatibility.
  4. Resources: Dedicated machinery and gang availability without saturation.
  5. Dependencies: Precedence / order preservation.
  6. Time: Feasible work duration overlap >= minimum execution threshold.
  7. Safety: Safe physical clearance buffer between simultaneous work activities.
  8. Operations: Absence of prohibited conflicting train movements.

Returns:
  compatible = true / false
  reason_codes = [...]
"""
import os
import sys
import json
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
from coordination_engine import evaluate_pair_compatibility, INCOMPATIBLE_WORK_PAIRS

def check_pair_compatibility(t1: dict, t2: dict) -> tuple[bool, dict, list[str]]:
    """Evaluates 8 deterministic criteria between two maintenance tasks according to MATHEMATICAL_MODEL_V2 Section 7.
    Returns: (is_compatible, check_details, reason_codes)
    """
    res = evaluate_pair_compatibility(t1, t2)
    return res['is_compatible'], res['checks'], res['reason_codes']

def evaluate_all_candidates(db_url=None):
    """Evaluates cross-department pairs within each section and updates task_compatibility table."""
    engine = get_db_engine() if db_url is None else sqlalchemy.create_engine(db_url)
    
    query = """
    SELECT mt.task_id, mt.asset_id, mt.department, mt.task_type, mt.criticality, mt.priority_score,
           mt.section_id, mt.duration_minutes, mt.affects_line, mt.isolation_requirement, mt.required_resources,
           mt.due_date, mt.dependency_ids, a.chainage_km, a.location_lat, a.location_lon
    FROM maintenance_tasks mt
    LEFT JOIN assets a ON mt.asset_id = a.asset_id
    WHERE mt.status = 'Pending'
    ORDER BY mt.priority_score DESC
    """
    df = pd.read_sql(query, engine)
    
    compatibility_records = []
    checked_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # Group tasks by section
    by_section = df.groupby('section_id')
    compatible_count = 0
    total_pairs = 0

    for sid, group in by_section:
        records = group.to_dict('records')
        # Check top priority tasks in each section
        candidates = records[:8]
        for i in range(len(candidates)):
            for j in range(i + 1, len(candidates)):
                t1, t2 = candidates[i], candidates[j]
                if t1['department'] == t2['department']:
                    continue
                total_pairs += 1
                is_compat, checks, reasons = check_pair_compatibility(t1, t2)
                if is_compat:
                    compatible_count += 1
                
                pair_id = f"PAIR_{t1['task_id']}_{t2['task_id']}"
                compatibility_records.append({
                    'pair_id': pair_id,
                    'task_id_1': t1['task_id'],
                    'task_id_2': t2['task_id'],
                    'section_id': sid,
                    'is_compatible': 1 if is_compat else 0,
                    'spatial_compatible': 1 if checks['spatial'] else 0,
                    'possession_compatible': 1 if checks['possession'] else 0,
                    'isolation_compatible': 1 if checks['isolation'] else 0,
                    'resource_compatible': 1 if checks.get('resources', False) else 0,
                    'reason_codes': json.dumps(reasons),
                    'checked_at': checked_at
                })

    print(f"Compatibility Engine Evaluated {total_pairs} candidate cross-department pairs across 12 sections.")
    print(f"  ✓ Valid Coordinated Candidates: {compatible_count} pairs passed all 8 checks.")

    # Save to database
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM task_compatibility;"))
        if compatibility_records:
            pd.DataFrame(compatibility_records).to_sql('task_compatibility', conn, if_exists='append', index=False)

    return compatibility_records

if __name__ == '__main__':
    evaluate_all_candidates()
