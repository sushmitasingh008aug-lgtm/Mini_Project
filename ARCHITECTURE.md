# Architecture — In Simple Words

## 1. The Idea
- 3 departments ask for separate track closures: Engineering (tracks), Traction (overhead wires), Signalling (signals/switches).
- We put them into 1 shared corridor possession ("shadow block") whenever safe.
- Trains stop less. Tracks stay available for trains much longer.
- Like a hospital surgery room: patients = track sections, doctors = departments, operation slot = maintenance block.

## 2. Full Flow — Start, Middle, End

```
START (load data) → MIDDLE (rank + combine + schedule + check) → END (serve + show + approve)
```

### START — Where data comes from
- Trigger: `python engine/seed_diversified_12k.py` loads the 12K operational dataset (25 tables, 7 views, 252K rows).
  On an empty database, Docker does this automatically (`docker/entrypoint.sh` → seed → priority → optimizer).
- Base day is `2026-08-23`. Planning horizon is 7 days (weekly) or 30 days (monthly) (`--horizon-days`).
- What the data holds:
  - 12,000 physical assets mapped to 2,400 sections by GPS, plus past failure logs and inspections.
  - Open repair tasks from TMS (track), TDMS (traction), and SMMS (signals).
  - Train timetables from COA with entry/exit times and directions (UP, DN, BOTH).
  - Corridor block windows from COA (`block_windows`) marked `AVAILABLE`.
  - Freight traffic forecasts (`goods_forecast`), heavy machines (Tampers, Tower Wagons, BCM, Cranes), and work crews.
- Authoritative Indian Railways GIS Network:
  - 12,000 physical assets, 12,000 sections, and 1,812 scheduled tasks calibrated across 25 operational divisions (`NDLS`, `DLI`, `CNB`, `ALD`, `LKO`, `LJN`, `GKP`, `DDU`, `MGS`, `PNBE`, `KIR`, `HWH`, `RNC`, `BBS`, `VSKP`, `MAS`, `GNT`, `SC`, `BPL`, `JBP`, `RTM`, `BCT`, `ADI`, `JP`, `AII`).
  - Zero ocean / offshore pins: Guaranteed 100% of points fall on land inside sovereign Indian railway coordinates (`13.09°N – 29.38°N`, `72.57°E – 88.33°E`).
  - Curvilinear OpenStreetMap (OSM) track geometry for major high-density trunk corridors (e.g. 473 curve vertices for Varanasi–Sultanpur–Lucknow) and major yard complexes.
  - Line-aware lateral track separation (+1.5 km offset for UP line, -1.5 km for DOWN line, centerline for BOTH lines) so parallel maintenance possessions never visually collide.
- Department Feeds & BDMS:
  - Feed files: `engine/data_feeds/tms_engineering.csv, tdms_traction.csv, smms_sndt.csv`.
  - `ingest_feeds.py` reads feed files → fills missing section/corridor from the asset master → writes `maintenance_tasks` + `department_feeds` rows.
  - Each feed request tracks full BDMS lifecycle status (`REQUESTED`, `APPROVED`, `REJECTED`, `GRANTED`), requested time windows, and advance notice hours.

### MIDDLE — Rank, combine, schedule, check

- Step 1: Rank (which repair comes first):
  - `risk_service.py` = Chance of failure in 30 days ($R$). Uses an isotonic-calibrated Machine Learning model (Random Forest, Brier score 0.1695, calibration error 1.84%) or physical hazard fallback. Decoupled from criticality to eliminate target leakage.
  - `criticality_engine.py` = How bad if it breaks ($C$). Passenger speed + route class + asset importance. Normalized between 0.0 and 1.0.
  - `urgency_engine.py` = How close to deadline ($U$). S-curve logistic formula. If overdue, $U$ approaches 1.0. Overdue days are tracked and exposed.
  - `impact_engine.py` = How much train disruption ($I$). Standardized downtime denominator (360 min) + single-track possession factor (0.60) + corridor traffic density.
  - `priority_engine.py` = Expected-Loss Priority:
    $$\text{Priority} = 100 \times R \times I(C) \times U$$
    - Strictly partitioned bands: Critical ($\ge 80$), High ($\ge 60$), Medium ($\ge 35$), Low ($< 35$).
    - Safety override: Broken rails, snapped OHE wires, and blank signals are locked to Critical ($\ge 92.5$) automatically.

- Step 2: Combine (which jobs can share 1 track closure):
  - `coordination_engine.py` & `compatibility_engine.py` enforce all 8 safety & operational checks:
    1. Spatial section match (both jobs in the same 20km section).
    2. Track line direction match (UP, DOWN, or single-line BOTH).
    3. Electrical power isolation (traction power-cut cannot co-occur with live electrical testing).
    4. Heavy machinery exclusivity (two crews cannot demand the same Tamper, Crane, or Tower Wagon at once).
    5. Precedence / dependency check (dependent tasks cannot run at the exact same minute).
    6. Duration ratio bound ($\le 3.0\times$ between longest and shortest job to avoid wasted track time).
    7. Due date proximity ($|d_1 - d_2| \le 3\text{ days}$ so future jobs aren't rushed too early).
    8. Longitudinal crew clearance ($\ge 500\text{m}$ safety distance between crews unless working on the same asset).
  - Pairs passing all 8 checks are bundled into candidate shadow blocks (`CB_001, CB_002...`).
  - Shared block duration = longest job, not the sum. Possession time saved = sum of individual durations minus combined duration.

- Step 3: Schedule (when each block happens):
  - `optimizer_core.py` runs a true Google OR-Tools CP-SAT constraint optimization model:
    - Boolean activation variables $u_b$ and slot selection variables $w_{b, k}$.
    - Optional interval variables across train-free windows (satisfying 10-minute headway margin).
    - Hard constraint: each task is assigned to at most one block ($\sum u_b \le 1$).
    - Hard constraint: track possession non-overlap (`AddNoOverlap`) per section and line.
    - Hard constraint: cumulative heavy machine capacity (`AddCumulative`) across Tampers, Wagons, Cranes, and BCMs.
    - Multi-objective maximization: balances priority score, coordination bonus, duration minimization, and freight traffic penalties ($T_{goods}$ from COA).

- Step 4: Check & Evaluate (fail-closed safety gate):
  - `validator.py` runs BEFORE anything is written to the database or published.
  - Checks: 10-minute safety buffer before and after moving trains, max block duration $\le 240\text{ min}$, chronology (end after start), peak caution flag (`12:00-18:00`).
  - `PASS` = certified and published. Anything else = plan rejected; previous certified plan stays active. No broken or half-written schedule is ever shown.
  - Evaluation KPIs (`evaluation_engine.py` & `scenario_engine.py`): Grounded in physical reality — 15-min handover overhead, availability gain calculated directly from line possession hours saved, and 2-hour standard allocation baseline.

### END — How the plan reaches the controller & screens

- Atomic Publish (all-or-nothing):
  - Writes to DB `scheduled_tasks` (task assignments with coordinates, duration, start/end minutes).
  - Writes to DB `optimized_blocks` (coordinated shadow blocks with safety stamps).
  - Writes to DB `schedule_versions` (manifest: version ID, SHA-256 hash, CP-SAT objective value, validation JSON).
  - Writes `engine/optimized_schedule.csv` as an export-only copy.
- Serve (Go Fiber single-port gateway owns API + UI on :3000):
  - Go `backend/main.go` on `:3000` serves both the high-performance Go Fiber REST API (`/api/*`) AND the compiled React SPA frontend (`frontend/dist/`) on one single port. No CORS configuration or separate frontend server needed in production.
  - Preserves calibrated geographic coordinates and handles dual-backend database parity (PostgreSQL 16 primary on `:5544`, SQLite fallback).
  - Python Flask on `:8765` is a legacy fallback used only if the database is unreachable.
  - Python engine scripts execute as background worker subprocesses — never blocking user HTTP requests.
  - Every schedule API response carries its `version_id`.
- Dynamic 5-Layer GIS Telemetry Engine:
  - Synchronizes map layer state between top-level controls and the interactive map canvas.
  - Supports 5 dedicated live layers: `All Layers`, `Assets` (color-coded by department), `Failures` (pulsing red emergency alerts with speed restrictions), `Blocks` (coordinated shadow windows with UP/DOWN offsets), and `Trains` (moving passenger & freight locos with speed and status).
- Governance & Version-Locked Approvals:
  - Controllers review the plan in `ApprovalAuditView.tsx`.
  - POST `/api/approvals` locks against an explicit `version_id`.
  - Re-approving an already approved plan returns `409 Conflict` (immutable).
  - Once signed off, associated `department_feeds` requests transition from `REQUESTED` to `APPROVED` with controller notes and an audit log stamp.

## 3. File Map — File | In | Out

| Step | File | In | Out |
|---|---|---|---|
| Collect | `engine/data/*.csv` (23 files) | 12K dataset pack | All 25 database tables seeded |
| Collect | `engine/data_feeds/*.csv` | Raw TMS / TDMS / SMMS defect feeds | Demo department fault requests |
| Collect | `engine/ingest_feeds.py` | Feed drops + asset master | Clean `maintenance_tasks` + `department_feeds` with BDMS lifecycle |
| Rank | `engine/risk_service.py` | Asset health, age, failures, overdue | Calibrated failure probability in 30 days ($R$) |
| Rank | `engine/criticality_engine.py` | Speed, route type, asset importance | Criticality score ($C$, 0.0 to 1.0) |
| Rank | `engine/urgency_engine.py` | Due date vs plan date | Urgency score ($U$, 0.0 to 1.0) + `days_overdue` |
| Rank | `engine/impact_engine.py` | Duration, corridor, line, $C$ | Disruption score ($I$, 0.0 to 1.0) |
| Rank | `engine/priority_engine.py` | $R + C + U + I$ | Expected-Loss Priority (0 to 100); critical defects $\ge 92.5$ |
| Combine | `engine/compatibility_engine.py` | Task pairs in section | All 8 compatibility checks (delegates to coordination engine) |
| Combine | `engine/coordination_engine.py` | Eligible pairs | Bundled shadow blocks `CB_*`, time = longest job, saving computed |
| Schedule | `engine/optimizer_core.py` | Tasks + trains + windows + freight | CP-SAT solver: `scheduled_tasks`, `optimized_blocks`, manifest |
| Check | `engine/validator.py` | Blocks + train movements | PASS / FAIL certification gate before publishing |
| Evaluate | `engine/evaluation_engine.py` | Certified blocks vs baseline | Physical line possession hours saved, availability gain % |
| Telemetry | `frontend/src/data/railwayNetwork.ts` | 25 divisions + OSM curves + assets + feeds | Multi-layer authoritative railway datasets and line offsets |
| Serve | `backend/main.go` | Database tables + static SPA dist bundle | Single-port Go Fiber gateway (:3000) serving API + React UI |
| Serve | `backend/server.py` | Database tables | Backup Flask API on :8765 |
| Show | `frontend/src/api/client.ts` | Backend JSON endpoints | Typed TypeScript interfaces |
| Show | `frontend/src/components/MapView.tsx` | Active layer prop + railway network data | Interactive 5-layer Leaflet GIS map with line offsets & alerts |
| Show | `frontend/src/components/CommandCenterView.tsx` | Metrics, schedule, trains, layer state | Top-level KPI cockpit with synchronized 5-layer map switcher |
| Show | `frontend/src/App.tsx` | All frontend views | Navigation, horizon state (7d/30d), and screen routing |

## 4. Rules We Follow

1. **Same section only**: Coordinated work must happen in the exact same 20km section.
2. **Line direction compatibility**: Work must be on the same track or single-line corridor.
3. **Power isolation safety**: Traction power cut cannot co-occur with live signal testing.
4. **Machinery non-contention**: No two jobs can share the same heavy track machine.
5. **No task precedence conflicts**: Dependent work cannot run concurrently.
6. **Duration ratio $\le 3.0\times$**: Fast jobs are not held inside overly long track possessions.
7. **Due date window $\le 3\text{ days}$**: Work scheduled together must have close deadlines.
8. **Longitudinal crew clearance $\ge 500\text{m}$**: Separate crews keep safe distance unless working on the same asset.
9. **10-minute headway margin**: Maintenance blocks must end $\ge 10\text{ min}$ before a train arrives and start $\ge 10\text{ min}$ after it passes.
10. **Fail-closed certification**: Never show or publish an uncertified or failing schedule.
11. **Immutable approvals**: Approvals are locked to explicit version IDs and cannot be overwritten.
12. **Track-locked GIS geometry & line separation**: Zero coordinates offshore/in ocean; UP and DOWN tracks maintain visual lateral clearance to prevent operational confusion.
13. **Single-port gateway delivery**: Backend serves both API and production SPA bundle on port 3000 to eliminate cross-origin and network latency issues.

## 5. Screens — What Judge Sees (ABPS v4)

- Sidebar organized into 5 groups: OPERATIONS, COORDINATION, INTELLIGENCE, DATA, CONTROL.
- Top bar: Horizon picker (7-day Weekly / 30-day Monthly), simulation badge, feed sync indicators, verification bell.

| Screen | Source | What you see |
|---|---|---|
| Dashboard (= CommandCenter) | `/api/metrics` + `/dashboard/summary` | Big KPIs, active alerts, and integrated 5-layer GIS map (`All Layers \| Assets \| Failures \| Blocks \| Trains`) |
| GIS Network Map (= MapView) | `/api/schedule` + `/api/trains` | Dedicated interactive Indian Railways map with track-snapped blocks, lateral UP/DOWN separation, station junctions, and live locos |
| Asset Backlog (= Tasks) | `/api/tasks` (paged, filterable) | Full task list with **Overdue column**, warning badges, and overdue filter tab |
| Weekly Block Planner (= Gantt) | `/api/schedule` + `/api/trains` | Interactive Gantt timeline of blocks vs train paths with 7d/30d switch |
| Monthly Forecast (= WeeklyMonthly) | `/api/schedule` (horizon 30) | True weekly date-partitioned heatmaps (Weeks 1 to 4) using `assigned_start_time` |
| Anomaly Handling | `/api/anomalies/catalog` | 29 disruption scenarios with impact drills |
| Coordination Centre | `/api/compatibility` | Compatibility matrix with tick marks across all 8 safety rules |
| Integrated / Shadow Blocks | `/api/impact` + `/api/blocks/detailed` | Before/after comparison showing physical possession hours saved |
| Train & Block Conflicts | `/api/schedule` + `/api/trains` | Visual timeline confirming zero train conflicts and $\ge 10\text{ min}$ headway |
| AI Risk & Priority | `/api/ml/explain` | Tasks ranked by Expected Loss with live overdue days and SHAP explanations |
| Failure Intelligence | `/api/failures` | Historical breakdowns, delay detentions, and failure trends |
| Asset Health | `/api/assets` (paged) | Track asset conditions, health indices, and inspection details |
| What-If Simulator | `POST /api/what-if/scenario` | Interactive track block disruption and timetable adjustments |
| Data Ingestion | `/api/ingestion/*` | Preview, validate, and commit new BDMS / TMS / TDMS / SMMS feeds |
| Data Quality | `/api/data-quality/*` | Data health metrics and missing coordinate checks per table |
| Scenario Explorer | `/api/anomalies/*` | Detailed breakdown of operational disruption recovery plans |
| Model / Data Versions | `/api/models/versions` | ML model version history, calibration curves, and retrain trigger |
| Human Review & Audit | `/api/approvals` + `/api/audit` | Controller review, **locked version sign-off**, and immutable audit log |
| Verification Suite | `/api/tests/status` | Live green verification checks (12/12 passing) |

## 6. Run — Commands

```bash
# 1. Seed demo dataset (12K operational data)
python engine/seed_diversified_12k.py

# 2. Compute Expected-Loss priorities (with calibrated ML risk)
python engine/priority_engine.py

# 3. Solve optimal CP-SAT block schedule (7-day or 30-day horizon)
python engine/optimizer_core.py --horizon-days 7
python engine/optimizer_core.py --horizon-days 30

# 4. Run automated mathematical and safety validation suite (12/12 checks)
python engine/test_suite.py

# 5. Full Postgres verification gate (tests full pipeline against Postgres 16 in Docker)
sh scripts/verify-postgres.sh

# 6. Build and run production server (Single-Port: Go Fiber serves both API + React SPA)
cd frontend && npm run build
cd ../backend && DATABASE_URL="postgresql://postgres:postgrespassword@127.0.0.1:5544/block_planning?sslmode=disable" PORT=3000 go run main.go

# 7. (Optional) Run frontend in dev mode with hot reload
cd frontend && npm run dev                 # Serves on :5173
```

## 7. Real Vs Demo

- **Real & Production-Ready**:
  - Full Expected-Loss ranking mathematics ($P = 100 \times R \times I \times U$).
  - Isotonic-calibrated Machine Learning risk model with zero target leakage.
  - Authoritative 8-rule compatibility validation.
  - True OR-Tools CP-SAT solver with track non-overlap and machine resource constraints.
  - Fail-closed deterministic safety gate (10-minute headway validation).
  - High-performance Go API gateway on `:3000` with atomic buffer tables and version locks.
  - Single-port Go Fiber gateway serving high-speed API endpoints and compiled React SPA bundle with zero CORS friction.
  - Authoritative Indian Railways track geometry with 25 operational divisions, OpenStreetMap curvilinear tracks, and calibrated zero-ocean GIS database.
  - Dynamic 5-layer interactive GIS map engine (`All Layers`, `Assets`, `Failures`, `Blocks`, `Trains`) with line-aware lateral separation and pulsing emergency alerts.
  - Date-partitioned multi-horizon weekly & monthly scheduling.
- **Demo / Synthetic Elements**:
  - Timetable entries and defect feeds are generated to simulate heavy corridor operations for the SIH evaluation.
  - Laptop SQLite database is for local development; PostgreSQL 16 is the production standard.

## Appendix — Technical References
- **Seed & GIS**: `engine/data/*.csv` via `seed_diversified_12k.py`; schema in `schema.sql`; spatial calibration in `calibrate_postgres_gis.py`.
- **Score**: `risk_service.py` ML + fallback; `criticality_engine.py`; `urgency_engine.py`; `impact_engine.py`; `priority_engine.py` Expected-Loss formula + safety overrides.
- **Combine**: `compatibility_engine.py` and `coordination_engine.py` (8 safety rules, shadow block grouping).
- **Schedule**: `optimizer_core.py` CP-SAT solver (`AddNoOverlap`, `AddCumulative`, freight penalties, atomic publish).
- **Check**: `validator.py` headway buffer $\ge 10\text{ min}$, duration $\le 240\text{ min}$, chronology.
- **Buffer**: `scheduled_tasks`, `optimized_blocks`, `schedule_versions` (`schema.sql` and `db_helper.py`).
- **Telemetry & Map**: `frontend/src/data/railwayNetwork.ts` (authoritative Indian Railways network, station nodes, assets, emergency failures, live train telemetry).
- **Serve**: `backend/main.go` native Go Fiber routes for all endpoints + static SPA bundle on `:3000`; `backend/server.py` fallback.
- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite, Leaflet (`frontend/src/`).
