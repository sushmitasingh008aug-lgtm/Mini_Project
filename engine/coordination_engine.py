"""Deterministic Coordination & Shadow-Block Engine (Blueprint v2 Section 14.11, 14.12, 15 & 21).

"Same section does not mean automatic merging."

Provides:
  1. 8-Point Compatibility Verification:
     Compat_ij = S_ij and T_ij and Iso_ij and Res_ij and Dir_ij and Dep_ij and Safety_ij
     Returns: ELIGIBLE, CONDITIONAL, REJECTED, or UNKNOWN with machine-readable reason codes.

  2. Shadow-Block Candidate Generation:
     Bundles compatible Engineering + Traction + S&T tasks into candidate unified possessions.
     Calculates:
       - Merged block duration: D_combined = max(d_i, d_j)
       - Possession time saved: Saving = sum(d_i) - D_combined
       - Multi-department coordination value
"""
import os
import sys
import json
import pandas as pd
import numpy as np
import sqlalchemy
from sqlalchemy import text

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from db_helper import get_db_engine

# Explicit safety-prohibited simultaneous operations
INCOMPATIBLE_WORK_PAIRS = [
    ('Ballast Deep Screening', 'Signal Aspect Lamp Fail'), # Heavy ballast dust/vibration impairs optical signal calibration
    ('Broken Rail Weld', 'Contact Wire Sag'),             # Severe track hydraulic lifting destabilizes tower wagon staging
    ('Track Tamper Machine', 'Signal Testing Rig'),        # Heavy track vibration disrupts electronic axle counters
    ('Flash Butt Welding Plant', 'USFD Machine'),          # Thermal rail distortion invalidates ultrasonic flaw detection
    ('Flash Butt Welding', 'Ultrasonic Testing'),          # Thermal rail distortion invalidates ultrasonic flaw detection
    ('Track Tamper Machine', 'Axle Counter Reset'),        # Vibration invalidates magnetic axle sensors
]

STATUS_ELIGIBLE = 'ELIGIBLE'
STATUS_CONDITIONAL = 'CONDITIONAL'
STATUS_REJECTED = 'REJECTED'
STATUS_UNKNOWN = 'UNKNOWN'

def evaluate_pair_compatibility(t1: dict, t2: dict) -> dict:
    """Evaluates 8 deterministic criteria between two maintenance tasks according to MATHEMATICAL_MODEL_V2 Section 7.
    
    Returns structured compatibility evaluation:
        {
            'pair_id': str,
            'status': 'ELIGIBLE' | 'CONDITIONAL' | 'REJECTED' | 'UNKNOWN',
            'is_compatible': bool,
            'saving_minutes': int,
            'reason_codes': list[str],
            'checks': dict[str, bool]
        }
    """
    reasons = []
    checks = {
        'spatial': False,
        'possession': False,
        'direction': False,
        'isolation': True,
        'resources': True,
        'dependencies': True,
        'precedence': True,
        'time': True,
        'duration_ratio': True,
        'safety': True,
        'operations': True
    }

    # 1. Spatial Check (S_ij): Must belong to the exact same operational corridor section
    s1 = t1.get('section_id')
    s2 = t2.get('section_id')
    if s1 and s2 and s1 == s2:
        checks['spatial'] = True
    else:
        checks['spatial'] = False
        reasons.append("SPATIAL_MISMATCH: Tasks belong to different operational corridor sections.")

    # 1b. Longitudinal chainage check (within 20km section boundary)
    km1 = t1.get('chainage_km')
    km2 = t2.get('chainage_km')
    if km1 is not None and km2 is not None:
        try:
            delta_km = abs(float(km1) - float(km2))
            if delta_km > 20.0:
                checks['spatial'] = False
                reasons.append(f"SPATIAL_SPAN_EXCEEDED: Distance between tasks ({delta_km:.1f} km) exceeds 20 km section limit.")
        except (ValueError, TypeError):
            pass

    # 2. Possession / Direction Check (Dir_ij)
    l1 = t1.get('affects_line', 'BOTH')
    l2 = t2.get('affects_line', 'BOTH')
    dept1 = t1.get('department', '')
    dept2 = t2.get('department', '')
    
    if l1 == 'BOTH' or l2 == 'BOTH' or l1 == l2:
        checks['direction'] = True
        checks['possession'] = True
    else:
        checks['direction'] = False
        checks['possession'] = False
        reasons.append(f"DIRECTION_DISJUNCTION: Line {l1} and {l2} cannot share a single track possession.")

    # 3. Electrical Isolation Check (Iso_ij): Power block vs live electrical work
    iso1 = str(t1.get('isolation_requirement', 'None'))
    iso2 = str(t2.get('isolation_requirement', 'None'))
    type1 = str(t1.get('task_type', ''))
    type2 = str(t2.get('task_type', ''))
    
    needs_cut_1 = any(k in iso1.upper() for k in ['POWER_BLOCK', 'OHE', 'TRACTION', 'ISOLATION']) or dept1 in ['Traction', 'TRD']
    needs_cut_2 = any(k in iso2.upper() for k in ['POWER_BLOCK', 'OHE', 'TRACTION', 'ISOLATION']) or dept2 in ['Traction', 'TRD']
    needs_live_1 = any(k in type1 for k in ['Testing Rig', 'Live', 'Signal Testing', 'Electrification Test'])
    needs_live_2 = any(k in type2 for k in ['Testing Rig', 'Live', 'Signal Testing', 'Electrification Test'])
    
    if (needs_cut_1 and needs_live_2) or (needs_cut_2 and needs_live_1):
        checks['isolation'] = False
        reasons.append("ISOLATION_CONFLICT: Work requiring traction power de-energization cannot co-occur with live electrical testing.")

    # 4. Machine / Resource Exclusivity Check (Res_ij)
    res1 = str(t1.get('required_resources', ''))
    res2 = str(t2.get('required_resources', ''))
    heavy_machines = ['Tamper', 'Tower', 'Cleaner', 'Crane', 'BCM', 'DTS', 'USFD', 'Grinding']
    if res1 and res2 and res1 == res2 and any(k in res1 for k in heavy_machines):
        checks['resources'] = False
        reasons.append(f"RESOURCE_CONTENTION: Both tasks contend for exclusive machinery ({res1}).")

    # 5. Precedence / Dependency Check (Dep_ij)
    dep1 = [d.strip() for d in str(t1.get('dependency_ids', '')).split(',') if d.strip()]
    dep2 = [d.strip() for d in str(t2.get('dependency_ids', '')).split(',') if d.strip()]
    tid1 = str(t1.get('task_id', ''))
    tid2 = str(t2.get('task_id', ''))
    if (tid1 and tid1 in dep2) or (tid2 and tid2 in dep1):
        checks['dependencies'] = False
        checks['precedence'] = False
        reasons.append("DEPENDENCY_CONFLICT: One task has a precedence dependency on the other and cannot be executed concurrently.")

    # 6. Duration Containment Ratio & Due Date Proximity (T_ij)
    d1 = int(t1.get('duration_minutes', 60))
    d2 = int(t2.get('duration_minutes', 60))
    ratio = max(d1, d2) / max(1.0, min(d1, d2))
    if ratio > 3.0:
        checks['duration_ratio'] = False
        checks['time'] = False
        reasons.append(f"DURATION_IMBALANCE: Duration ratio ({ratio:.1f}x) exceeds maximum 3.0x efficiency bound.")

    due1_raw = t1.get('due_date')
    due2_raw = t2.get('due_date')
    if due1_raw and due2_raw:
        try:
            dt1 = pd.to_datetime(due1_raw)
            dt2 = pd.to_datetime(due2_raw)
            due_diff_days = abs((dt1 - dt2).days)
            if due_diff_days > 3:
                checks['time'] = False
                checks['duration_ratio'] = False
                reasons.append(f"DUE_DATE_DISPERSION: Due dates differ by {due_diff_days} days (> 3-day coordination window).")
        except Exception:
            pass

    # 7. Domain Safety Prohibitions & Longitudinal Buffer (Safety_ij)
    pair_ab = (type1, type2)
    pair_ba = (type2, type1)
    if pair_ab in INCOMPATIBLE_WORK_PAIRS or pair_ba in INCOMPATIBLE_WORK_PAIRS:
        checks['safety'] = False
        reasons.append(f"SAFETY_PROHIBITION: Prohibited simultaneous activity between '{type1}' and '{type2}'.")

    # Longitudinal safety clearance buffer >= 500m between mobile crews (unless exact same asset)
    a1 = t1.get('asset_id')
    a2 = t2.get('asset_id')
    if a1 and a2 and a1 != a2 and km1 is not None and km2 is not None:
        try:
            dist_km = abs(float(km1) - float(km2))
            if dist_km < 0.5: # less than 500 meters
                checks['safety'] = False
                reasons.append(f"SAFETY_CLEARANCE_VIOLATION: Tasks on separate assets are within 500m longitudinal clearance ({dist_km * 1000:.0f}m < 500m).")
        except (ValueError, TypeError):
            pass

    # 8. Departmental Rules: Must be different departments for cross-department shadow consolidation
    if dept1 and dept2 and dept1 == dept2:
        checks['operations'] = False
        reasons.append("INTRA_DEPARTMENT: Same department tasks are scheduled sequentially, not merged into a single concurrent block.")

    # Determine Overall Status
    critical_checks = [checks['spatial'], checks['safety'], checks['resources'], checks['isolation']]
    secondary_checks = [checks['direction'], checks['duration_ratio'], checks['dependencies'], checks['operations']]
    
    is_compat = all(critical_checks) and all(secondary_checks)
    
    if is_compat:
        status = STATUS_ELIGIBLE
        reasons.append(f"COORDINATION_APPROVED: All 8 spatial, safety, resource, isolation, and precedence checks passed.")
        if dept1 != dept2 and dept1 and dept2:
            reasons.append(f"MULTI_DEPT_OPPORTUNITY: Safe multi-possession between {dept1} and {dept2}.")
    elif not all(critical_checks):
        status = STATUS_REJECTED
    elif not all(secondary_checks):
        status = STATUS_CONDITIONAL
    else:
        status = STATUS_UNKNOWN

    d_combined = max(d1, d2)
    saving = (d1 + d2 - d_combined) if is_compat else 0

    return {
        'pair_id': f"{t1.get('task_id', 'T1')}_{t2.get('task_id', 'T2')}",
        'status': status,
        'is_compatible': is_compat,
        'duration_combined': d_combined,
        'saving_minutes': saving,
        'reason_codes': reasons,
        'checks': checks
    }

def generate_shadow_block_candidates(tasks: list[dict]) -> list[dict]:
    """Generates candidate multi-task shadow blocks grouped by section and multi-department feasibility."""
    by_section = {}
    for t in tasks:
        sid = t.get('section_id')
        if sid:
            by_section.setdefault(sid, []).append(t)

    candidates = []
    bundle_id_counter = 100

    for sid, sec_tasks in by_section.items():
        if len(sec_tasks) < 2:
            continue

        # Sort tasks by priority to evaluate highest-value multi-department bundles first
        sec_tasks = sorted(sec_tasks, key=lambda x: float(x.get('priority_score') or 0.0), reverse=True)[:50]

        # Evaluate pairs to find dense multi-department cliques
        compatible_pairs = []
        for i in range(len(sec_tasks)):
            for j in range(i + 1, len(sec_tasks)):
                t1 = sec_tasks[i]
                t2 = sec_tasks[j]
                eval_res = evaluate_pair_compatibility(t1, t2)
                if eval_res['is_compatible']:
                    compatible_pairs.append((t1, t2, eval_res))

        # Bundle compatible tasks
        used_task_ids = set()
        for t1, t2, eval_res in compatible_pairs:
            tid1 = t1.get('task_id')
            tid2 = t2.get('task_id')
            if tid1 in used_task_ids or tid2 in used_task_ids:
                continue

            bundle_id_counter += 1
            bundle_id = f"SB_{bundle_id_counter}"
            bundled_tasks = [t1, t2]
            used_task_ids.add(tid1)
            used_task_ids.add(tid2)

            # Check if a 3rd compatible task can join the shadow block
            for t3 in sec_tasks:
                tid3 = t3.get('task_id')
                if tid3 not in used_task_ids:
                    res13 = evaluate_pair_compatibility(t1, t3)
                    res23 = evaluate_pair_compatibility(t2, t3)
                    if res13['is_compatible'] and res23['is_compatible']:
                        bundled_tasks.append(t3)
                        used_task_ids.add(tid3)
                        break

            # Calculate shadow block metrics
            durations = [int(t.get('duration_minutes', 60)) for t in bundled_tasks]
            block_dur = max(durations)
            sum_dur = sum(durations)
            saving = sum_dur - block_dur
            depts = sorted(list(set(t.get('department', '') for t in bundled_tasks)))

            # Coordination Value formula: Blueprint Section 14.12
            # CoordinationValue = 1.2 * Saving + 25 * DeptCount + 0.5 * sum(Priority)
            prio_sum = sum(float(t.get('priority_score', 50.0)) for t in bundled_tasks)
            coord_val = round(1.2 * saving + (25.0 * len(depts)) + (0.05 * prio_sum), 2)

            candidates.append({
                'bundle_id': bundle_id,
                'section_id': sid,
                'corridor_id': t1.get('corridor_id', ''),
                'task_ids': [t.get('task_id') for t in bundled_tasks],
                'task_count': len(bundled_tasks),
                'departments': depts,
                'block_duration_minutes': block_dur,
                'saved_possession_minutes': saving,
                'coordination_value': coord_val,
                'is_multi_department': len(depts) > 1,
                'tasks': bundled_tasks
            })

    return candidates

if __name__ == '__main__':
    t_eng = {'task_id': 'T1', 'section_id': 'SEC_01', 'department': 'Engineering', 'task_type': 'Track Gauge Spread', 'duration_minutes': 90, 'affects_line': 'UP'}
    t_trd = {'task_id': 'T2', 'section_id': 'SEC_01', 'department': 'Traction', 'task_type': 'Cantilever Insulator Flashover', 'duration_minutes': 60, 'affects_line': 'UP'}
    res = evaluate_pair_compatibility(t_eng, t_trd)
    print("Coordination Engine Pair Compatibility Test:")
    print(f"  Status: {res['status']}, Compatible: {res['is_compatible']}, Saving: {res['saving_minutes']} min")
    print(f"  Reasons: {res['reason_codes']}")
