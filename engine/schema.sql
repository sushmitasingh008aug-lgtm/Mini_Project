-- ==============================================================================
-- SIH 2026 - Automatic Block Planning System
-- Master Plan v2 Database Schema (Government-Aligned Data Architecture)
-- Compatible with PostgreSQL 16 & SQLite 3
-- ==============================================================================

-- 1. Operational Corridors
CREATE TABLE IF NOT EXISTS corridors (
    corridor_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(120),
    zone VARCHAR(50),
    division VARCHAR(50),
    electrification_type VARCHAR(50),
    signaling_type VARCHAR(50)
);

-- 2. Operational Sections (Network Geography)
CREATE TABLE IF NOT EXISTS sections (
    section_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100),
    corridor_id VARCHAR(50),
    length_km DECIMAL(8,2),
    start_station VARCHAR(80),
    end_station VARCHAR(80),
    start_lat DECIMAL(9,6),
    start_lon DECIMAL(9,6),
    end_lat DECIMAL(9,6),
    end_lon DECIMAL(9,6),
    geometry TEXT
);

-- 3. ASSET_MASTER (Canonical Asset Master Entity)
CREATE TABLE IF NOT EXISTS assets (
    asset_id VARCHAR(50) PRIMARY KEY,
    asset_number VARCHAR(80),
    asset_type VARCHAR(100),
    asset_subtype VARCHAR(100),
    department VARCHAR(50),
    zone VARCHAR(50),
    division VARCHAR(50),
    corridor_id VARCHAR(50),
    section_id VARCHAR(50),
    block_section VARCHAR(100),
    station_from VARCHAR(80),
    station_to VARCHAR(80),
    chainage_km DECIMAL(8,2),
    direction VARCHAR(10),
    location_lat DECIMAL(9,6),
    location_lon DECIMAL(9,6),
    commissioning_date DATE,
    asset_age_years INT,
    asset_importance DECIMAL(4,2),
    criticality_class VARCHAR(20),
    operational_status VARCHAR(30) DEFAULT 'Operational',
    last_maintenance_date DATE,
    last_inspection_date DATE,
    condition_score INT,
    health_index INT
);

-- 4. FAILURE_EVENT_HISTORY (Ministry / UIMS / COA Operational Failure Reports)
CREATE TABLE IF NOT EXISTS failure_event_history (
    af_id VARCHAR(50) PRIMARY KEY,
    uims_id VARCHAR(50),
    zone VARCHAR(50),
    division VARCHAR(50),
    head VARCHAR(100),
    sub_head VARCHAR(100),
    failure_type VARCHAR(100),
    failure_date DATE,
    failure_time VARCHAR(20),
    failure_start TIMESTAMP,
    failure_end TIMESTAMP,
    failure_duration_min INT,
    corridor_id VARCHAR(50),
    coa_section VARCHAR(100),
    block_section VARCHAR(100),
    station_from VARCHAR(80),
    station_to VARCHAR(80),
    section_id VARCHAR(50),
    chainage_km DECIMAL(8,2),
    direction VARCHAR(10),
    train_name VARCHAR(120),
    train_id VARCHAR(50),
    loco_id VARCHAR(50),
    coach_id VARCHAR(50),
    wagon_id VARCHAR(50),
    trains_delayed INT DEFAULT 0,
    avg_detention_min DECIMAL(8,2) DEFAULT 0.0,
    total_detention_min DECIMAL(8,2) DEFAULT 0.0,
    service_added VARCHAR(50),
    update_time TIMESTAMP,
    responsibility VARCHAR(100),
    cause VARCHAR(200),
    subcause VARCHAR(200),
    sm_remarks TEXT,
    department_comment TEXT,
    raw_description TEXT,
    source_system VARCHAR(20)
);

-- 5. DEFECT_HISTORY (Historical Defect Tracking)
CREATE TABLE IF NOT EXISTS defect_history (
    defect_id VARCHAR(50) PRIMARY KEY,
    asset_id VARCHAR(50),
    section_id VARCHAR(50),
    defect_type VARCHAR(100),
    severity VARCHAR(20),
    detected_at TIMESTAMP,
    resolved_at TIMESTAMP,
    recurrence_flag INT DEFAULT 0,
    source_system VARCHAR(20),
    description TEXT
);

-- 6. MAINTENANCE_TASKS (Unified Demand Backlog)
CREATE TABLE IF NOT EXISTS maintenance_tasks (
    task_id VARCHAR(50) PRIMARY KEY,
    source_system VARCHAR(20),
    department VARCHAR(50),
    asset_id VARCHAR(50),
    asset_type VARCHAR(100),
    section_id VARCHAR(50),
    corridor_id VARCHAR(50),
    task_type VARCHAR(100),
    defect_code VARCHAR(50),
    inspection_code VARCHAR(50),
    safety_impact VARCHAR(20),
    urgency VARCHAR(20),
    due_date DATE,
    duration_minutes INT,
    earliest_start TIMESTAMP,
    latest_finish TIMESTAMP,
    required_resources VARCHAR(100),
    isolation_requirement VARCHAR(50),
    dependency_ids TEXT,
    status VARCHAR(30) DEFAULT 'Pending',
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    risk_probability FLOAT,
    priority_score FLOAT,
    criticality VARCHAR(20),
    affects_line VARCHAR(10) DEFAULT 'BOTH'
);

-- 7. TASK_ACTIONS (Maintenance Action Workflow Engine)
CREATE TABLE IF NOT EXISTS task_actions (
    action_id VARCHAR(50) PRIMARY KEY,
    task_id VARCHAR(50),
    action_type VARCHAR(100),
    required_crew VARCHAR(100),
    required_resources VARCHAR(100),
    setup_minutes INT DEFAULT 15,
    work_duration_minutes INT DEFAULT 60,
    isolation_requirement VARCHAR(50),
    possession_requirement VARCHAR(50),
    verification_required INT DEFAULT 1,
    sequence_order INT DEFAULT 1
);

-- 8. TRAIN_MOVEMENTS (Operational Traffic / COA Timetables)
CREATE TABLE IF NOT EXISTS train_movements (
    movement_id VARCHAR(50) PRIMARY KEY,
    train_id VARCHAR(50),
    train_name VARCHAR(120),
    train_type VARCHAR(50),
    corridor_id VARCHAR(50),
    section_id VARCHAR(50),
    block_section VARCHAR(100),
    direction VARCHAR(10),
    entry_time TIMESTAMP,
    exit_time TIMESTAMP,
    actual_entry TIMESTAMP,
    actual_exit TIMESTAMP,
    delay_minutes INT DEFAULT 0,
    priority_class VARCHAR(20),
    is_passenger INT DEFAULT 1,
    is_goods INT DEFAULT 0,
    date DATE
);

-- 9. BLOCK_WINDOWS (corridor maintenance window availability)
CREATE TABLE IF NOT EXISTS block_windows (
    block_id VARCHAR(50) PRIMARY KEY,
    corridor_id VARCHAR(50),
    section_id VARCHAR(50),
    block_section VARCHAR(100),
    date DATE,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_min INT,
    block_type VARCHAR(50),
    availability_status VARCHAR(30) DEFAULT 'AVAILABLE',
    direction VARCHAR(10),
    line VARCHAR(10),
    allowed_departments VARCHAR(100),
    isolation_type VARCHAR(50),
    source VARCHAR(50),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 10. GOODS_FORECAST (Future Freight Train Density Forecast)
CREATE TABLE IF NOT EXISTS goods_forecast (
    forecast_id VARCHAR(50) PRIMARY KEY,
    corridor_id VARCHAR(50),
    section_id VARCHAR(50),
    forecast_date DATE,
    time_window_start TIMESTAMP,
    time_window_end TIMESTAMP,
    expected_goods_trains INT DEFAULT 0,
    forecast_confidence FLOAT DEFAULT 0.85,
    source VARCHAR(50),
    generated_at TIMESTAMP
);

-- 11. RESOURCES (Physical Equipment, Gangs, Crews)
CREATE TABLE IF NOT EXISTS resources (
    resource_id VARCHAR(50) PRIMARY KEY,
    resource_type VARCHAR(100),
    department VARCHAR(50),
    capability VARCHAR(100),
    section_id VARCHAR(50),
    capacity INT DEFAULT 1,
    available_from TIMESTAMP,
    available_to TIMESTAMP,
    team_size INT DEFAULT 5,
    skill VARCHAR(100),
    equipment VARCHAR(100),
    status VARCHAR(30) DEFAULT 'AVAILABLE'
);

-- 12. TASK_COMPATIBILITY (Auditable Compatibility Audit Log)
CREATE TABLE IF NOT EXISTS task_compatibility (
    pair_id VARCHAR(100) PRIMARY KEY,
    task_id_1 VARCHAR(50),
    task_id_2 VARCHAR(50),
    section_id VARCHAR(50),
    is_compatible INT,
    spatial_compatible INT,
    possession_compatible INT,
    isolation_compatible INT,
    resource_compatible INT,
    reason_codes TEXT,
    checked_at TIMESTAMP
);

-- 13. TASK_DEPENDENCIES
CREATE TABLE IF NOT EXISTS task_dependencies (
    dependency_id VARCHAR(50) PRIMARY KEY,
    predecessor_task_id VARCHAR(50),
    successor_task_id VARCHAR(50),
    dependency_type VARCHAR(50),
    min_lag_minutes INT DEFAULT 0
);

-- 14. ML_PREDICTIONS (Predictive Risk & SHAP Explanations)
CREATE TABLE IF NOT EXISTS ml_predictions (
    prediction_id VARCHAR(50) PRIMARY KEY,
    task_id VARCHAR(50),
    model_version VARCHAR(50),
    prediction_timestamp TIMESTAMP,
    risk_probability FLOAT,
    priority_score FLOAT,
    safety_override INT DEFAULT 0,
    top_positive_features TEXT,
    top_negative_features TEXT,
    shap_values_json TEXT
);

-- 15. OPTIMIZED_BLOCKS & SCHEDULE_VERSIONS
CREATE TABLE IF NOT EXISTS schedule_versions (
    version_id VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMP,
    horizon_days INT,
    status VARCHAR(30) DEFAULT 'DRAFT',
    approved_by VARCHAR(80),
    approved_at TIMESTAMP,
    objective_value FLOAT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS optimized_blocks (
    block_id VARCHAR(50) PRIMARY KEY,
    version_id VARCHAR(50),
    section_id VARCHAR(50),
    corridor_id VARCHAR(50),
    block_type VARCHAR(50),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_minutes INT,
    task_count INT,
    departments TEXT,
    utilization_pct FLOAT,
    train_conflicts_avoided INT,
    status VARCHAR(30) DEFAULT 'PROPOSED',
    explanation_json TEXT
);

-- 15b. SCHEDULED_TASKS (Phase B buffer: task-level rows of the live plan).
-- Single-live-version semantics like optimized_blocks: the optimizer rewrites
-- this table atomically with blocks + manifest. CSV is export artifact only,
-- all APIs read this table (see ?version_id= pinning in both backends).
CREATE TABLE IF NOT EXISTS scheduled_tasks (
    version_id VARCHAR(50),
    task_id VARCHAR(50),
    asset_id VARCHAR(50),
    department VARCHAR(50),
    task_type VARCHAR(100),
    criticality VARCHAR(20),
    priority_score FLOAT,
    section_id VARCHAR(50),
    section_name VARCHAR(100),
    corridor_id VARCHAR(50),
    duration_minutes INT,
    start_minute INT,
    end_minute INT,
    assigned_start_time TIMESTAMP,
    assigned_end_time TIMESTAMP,
    combined_group_id VARCHAR(50),
    affects_line VARCHAR(10),
    lat FLOAT,
    lon FLOAT,
    PRIMARY KEY (version_id, task_id)
);
CREATE INDEX IF NOT EXISTS idx_sched_tasks_version ON scheduled_tasks(version_id);

-- 16. AUDIT_LOG (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS audit_log (
    log_id VARCHAR(80) PRIMARY KEY,
    event_type VARCHAR(80),
    entity_id VARCHAR(80),
    timestamp TIMESTAMP,
    user_id VARCHAR(80),
    details_json TEXT,
    status VARCHAR(30)
);

-- 17. Departmental Feed Staging (TMS / TDMS / SMMS / BDMS Ingestion & Lifecycle)
CREATE TABLE IF NOT EXISTS department_feeds (
    feed_id VARCHAR(50) PRIMARY KEY,
    source_system VARCHAR(20),
    asset_id VARCHAR(50),
    raw_type VARCHAR(100),
    severity VARCHAR(20),
    reported_date DATE,
    ingested_at TIMESTAMP,
    status VARCHAR(30) DEFAULT 'REQUESTED',
    requested_start TIMESTAMP,
    requested_end TIMESTAMP,
    notice_hours INT DEFAULT 24,
    decision_notes TEXT
);

-- 18. INSPECTIONS (Track / OHE / Signalling Condition Observations)
CREATE TABLE IF NOT EXISTS inspections (
    inspection_id VARCHAR(50) PRIMARY KEY,
    asset_id VARCHAR(50),
    section_id VARCHAR(50),
    inspection_date DATE,
    inspection_type VARCHAR(50),
    condition_score INT,
    inspector_id VARCHAR(50),
    findings TEXT,
    created_at TIMESTAMP
);

-- 19. MAINTENANCE_HISTORY (Past Completed Interventions & Outcomes)
CREATE TABLE IF NOT EXISTS maintenance_history (
    record_id VARCHAR(50) PRIMARY KEY,
    task_id VARCHAR(50),
    asset_id VARCHAR(50),
    completed_at TIMESTAMP,
    duration_minutes INT,
    actual_cost FLOAT,
    rectification_details TEXT,
    outcome_status VARCHAR(30)
);

-- 20. BLOCK_TASKS (Many-to-Many Block Membership)
CREATE TABLE IF NOT EXISTS block_tasks (
    block_id VARCHAR(50),
    task_id VARCHAR(50),
    role VARCHAR(30) DEFAULT 'PRIMARY',
    PRIMARY KEY (block_id, task_id)
);

-- 21. ANOMALY_TASK_CATALOG (29 Scenario Classes: Scenario -> Department -> Task -> Actions -> Planning Handling)
CREATE TABLE IF NOT EXISTS anomaly_task_catalog (
    anomaly_scenario VARCHAR(120) PRIMARY KEY,
    department VARCHAR(100),
    recommended_task_types TEXT,
    recommended_actions TEXT,
    planning_handling TEXT
);

-- 22. COVERAGE_REPORT (Coverage Verification Matrix)
CREATE TABLE IF NOT EXISTS coverage_report (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset VARCHAR(50),
    metric VARCHAR(100),
    value VARCHAR(100),
    goal VARCHAR(100),
    status VARCHAR(20)
);

-- 23. DATA_INGESTION_RUNS (Immutable Ingestion Run Audit Records)
CREATE TABLE IF NOT EXISTS data_ingestion_runs (
    ingestion_id VARCHAR(60) PRIMARY KEY,
    source_system VARCHAR(50),
    dataset_name VARCHAR(60),
    source_file VARCHAR(200),
    file_hash VARCHAR(64),
    schema_version VARCHAR(20) DEFAULT 'v4.0',
    uploaded_by VARCHAR(80),
    uploaded_at TIMESTAMP,
    rows_received INT DEFAULT 0,
    rows_accepted INT DEFAULT 0,
    rows_rejected INT DEFAULT 0,
    duplicates INT DEFAULT 0,
    validation_status VARCHAR(30),
    notes TEXT
);

-- 24. ROUTE_STATION_POINTS (Detailed Geospatial Track Waypoints & Anchors)
CREATE TABLE IF NOT EXISTS route_station_points (
    route_point_id VARCHAR(60) PRIMARY KEY,
    route_variant VARCHAR(50),
    section_id VARCHAR(50),
    corridor_id VARCHAR(50),
    from_station_code VARCHAR(20),
    to_station_code VARCHAR(20),
    from_station_name VARCHAR(100),
    to_station_name VARCHAR(100),
    chainage_from_segment_km DECIMAL(8,3),
    direction VARCHAR(10),
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    coordinate_quality VARCHAR(50),
    source_basis VARCHAR(100)
);

-- 25. ANOMALY_SCENARIO_INSTANCES (Point-in-Time Field Anomaly Occurrences)
CREATE TABLE IF NOT EXISTS anomaly_scenario_instances (
    scenario_instance_id VARCHAR(60) PRIMARY KEY,
    anomaly_scenario VARCHAR(120),
    department VARCHAR(50),
    recommended_task_type VARCHAR(100),
    recommended_action VARCHAR(200),
    planning_handling VARCHAR(100),
    section_id VARCHAR(50),
    corridor_id VARCHAR(50),
    line_direction VARCHAR(20),
    scenario_date DATE,
    severity VARCHAR(30)
);

-- Performance Indexes for 15K Queries
CREATE INDEX IF NOT EXISTS idx_assets_dept_sec ON assets(department, section_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sec_prio ON maintenance_tasks(section_id, priority_score);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON maintenance_tasks(status);
CREATE INDEX IF NOT EXISTS idx_failures_sec_date ON failure_event_history(section_id, failure_start);
CREATE INDEX IF NOT EXISTS idx_trains_sec_entry ON train_movements(section_id, entry_time);
CREATE INDEX IF NOT EXISTS idx_blocks_sec_time ON block_windows(section_id, start_time);
CREATE INDEX IF NOT EXISTS idx_compat_tasks ON task_compatibility(task_id_1, task_id_2);
CREATE INDEX IF NOT EXISTS idx_actions_task ON task_actions(task_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_route_pts_sec ON route_station_points(section_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_inst_sec ON anomaly_scenario_instances(section_id);

-- CANONICAL UPPERCASE GOVERNMENT VIEWS (Blueprint v2 Section 09)
-- Portable DROP+CREATE pattern (works on SQLite and PostgreSQL, neither
-- supports CREATE VIEW IF NOT EXISTS).
DROP VIEW IF EXISTS ASSET_MASTER;
CREATE VIEW ASSET_MASTER AS SELECT * FROM assets;
-- (no view: name collides with failure_event_history table on both dialects)
-- (no view: name collides with maintenance_tasks table on both dialects)
DROP VIEW IF EXISTS TRAIN_OPERATION_HISTORY;
CREATE VIEW TRAIN_OPERATION_HISTORY AS SELECT * FROM train_movements;
DROP VIEW IF EXISTS BLOCK_AVAILABILITY;
CREATE VIEW BLOCK_AVAILABILITY AS SELECT * FROM block_windows;
DROP VIEW IF EXISTS RESOURCE_AVAILABILITY;
CREATE VIEW RESOURCE_AVAILABILITY AS SELECT * FROM resources;
DROP VIEW IF EXISTS GOODS_TRAIN_FORECAST;
CREATE VIEW GOODS_TRAIN_FORECAST AS SELECT * FROM goods_forecast;
DROP VIEW IF EXISTS AUDIT_EVENTS;
CREATE VIEW AUDIT_EVENTS AS SELECT * FROM audit_log;
DROP VIEW IF EXISTS OPTIMIZED_BLOCK_PLAN;
CREATE VIEW OPTIMIZED_BLOCK_PLAN AS SELECT * FROM optimized_blocks;

