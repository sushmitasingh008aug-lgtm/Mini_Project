"""Maintenance Action Workflow Engine (Master Plan v2 Section 4.5 & 23.3).

Decomposes abstract maintenance tasks and defects into concrete railway operational action packages:
  Inspection -> Isolation -> Repair -> Test -> Verify -> Release

Supplies crew sizes, required machinery, setup buffers, work durations,
isolation requirements, and joint verification certificates.
"""
import os
import sys
import pandas as pd
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

def get_actions_for_task(task_id: str, db_url=None):
    """Pulls ordered maintenance action steps for a specific task."""
    engine = get_db_engine() if db_url is None else sqlalchemy.create_engine(db_url)
    query = text("""
    SELECT action_id, task_id, action_type, required_crew, required_resources,
           setup_minutes, work_duration_minutes, isolation_requirement,
           possession_requirement, verification_required, sequence_order
    FROM task_actions
    WHERE task_id = :tid
    ORDER BY sequence_order ASC
    """)
    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params={'tid': task_id})
    return df.to_dict('records')

def get_actions_summary_by_department(db_url=None):
    """Pulls aggregated summary of action workflow steps across all pending tasks."""
    engine = get_db_engine() if db_url is None else sqlalchemy.create_engine(db_url)
    query = """
    SELECT mt.department, ta.action_type, COUNT(*) as action_count,
           SUM(ta.work_duration_minutes) as total_work_minutes,
           SUM(ta.setup_minutes) as total_setup_minutes
    FROM task_actions ta
    JOIN maintenance_tasks mt ON ta.task_id = mt.task_id
    WHERE mt.status = 'Pending'
    GROUP BY mt.department, ta.action_type
    ORDER BY mt.department, action_count DESC
    """
    with engine.connect() as conn:
        df = pd.read_sql(query, conn)
    return df.to_dict('records')

if __name__ == '__main__':
    engine = get_db_engine()
    actions = get_actions_for_task("TSK_1000")
    print(f"Sample Action Package for TSK_1000 ({len(actions)} steps):")
    for a in actions:
        print(f"  Step {a['sequence_order']}: {a['action_type']} ({a['work_duration_minutes']} min, Crew: {a['required_crew']})")
