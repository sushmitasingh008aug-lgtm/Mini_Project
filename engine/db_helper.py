import os
import sys
import sqlalchemy
from sqlalchemy import text, event

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SQLITE_PATH = os.path.join(BASE_DIR, 'block_planning.db')
SCHEMA_PATH = os.path.join(BASE_DIR, 'schema.sql')

_CACHED_ENGINE = None
_SCHEMA_ENSURED = False

def _resolve_db_url() -> str:
    for key in ("DATABASE_URL", "POSTGRES_URI"):
        v = os.getenv(key)
        if v and v.strip():
            return v.strip()
    return f"sqlite:///{SQLITE_PATH}"

def ensure_schema(engine):
    """Executes schema.sql once to ensure all required tables exist."""
    global _SCHEMA_ENSURED
    if _SCHEMA_ENSURED or not os.path.exists(SCHEMA_PATH):
        return
    try:
        # Quick check if tables already exist to avoid locking (dialect-aware:
        # sqlite_master does not exist on PostgreSQL).
        with engine.connect() as conn:
            if engine.dialect.name == 'postgresql':
                check = conn.execute(text(
                    "SELECT 1 FROM information_schema.tables "
                    "WHERE table_name = 'assets'")).first()
            else:
                check = conn.execute(text(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='assets'")).first()
            if check:
                _SCHEMA_ENSURED = True
                _ensure_buffer_tables(engine)
                return

        with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        statements = [s.strip() for s in sql_content.split(';') if s.strip()]
        is_pg = getattr(engine, 'dialect', None) and engine.dialect.name == 'postgresql'
        with engine.connect() as conn:
            for statement in statements:
                if not statement:
                    continue
                if is_pg:
                    # Portable rewrites: schema.sql is written for SQLite.
                    if 'VIEW IF NOT EXISTS' in statement.upper():
                        statement = statement.replace('CREATE VIEW IF NOT EXISTS', 'CREATE OR REPLACE VIEW').replace('create view if not exists', 'CREATE OR REPLACE VIEW')
                    # AUTOINCREMENT is SQLite-only; the single occurrence
                    # (coverage_report.id) becomes a PG identity column.
                    statement = statement.replace('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY')
                try:
                    with conn.begin():
                        conn.execute(text(statement))
                except Exception:
                    pass
        _SCHEMA_ENSURED = True
    except Exception as e:
        print(f"Warning: error ensuring schema: {str(e)[:100]}")


def _ensure_buffer_tables(engine):
    """Idempotent migration for tables added after the initial seed.

    Databases seeded before a table existed would otherwise miss it forever
    (ensure_schema early-returns when assets exists). Each statement is
    CREATE TABLE IF NOT EXISTS, safe to run on every boot, both dialects.
    """
    ddl = """
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
"""
    try:
        statements = [s.strip() for s in ddl.split(';') if s.strip()]
        with engine.begin() as conn:
            for statement in statements:
                conn.execute(text(statement))
    except Exception as e:
        print(f"Warning: buffer-table migration failed: {str(e)[:120]}")

def get_db_engine():
    global _CACHED_ENGINE
    if _CACHED_ENGINE is not None:
        return _CACHED_ENGINE

    db_url = _resolve_db_url()

    # Honor an explicit sqlite:// URL too (scratch/test copies, local files).
    # Previously only postgresql:// was honored and every sqlite URL silently
    # fell through to the repo file — so "isolated" test runs overwrote the
    # real database. Never again: explicit URL always wins.
    is_pg_url = db_url.startswith("postgresql://") or db_url.startswith("postgres://")
    is_sqlite_url = db_url.startswith("sqlite://")
    
    # If explicitly pointing to PostgreSQL
    if is_pg_url:
        try:
            engine = sqlalchemy.create_engine(
                db_url,
                connect_args={"connect_timeout": 3},
                pool_pre_ping=True
            )
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("Connected to PostgreSQL database.")
            ensure_schema(engine)
            _CACHED_ENGINE = engine
            return engine
        except Exception as e:
            # Fail-closed: an explicit production URL that can't be reached
            # must NEVER silently fall back to the local SQLite file — that
            # serves stale data while looking healthy. Raise instead.
            raise RuntimeError(
                f"FATAL: DATABASE_URL is set but PostgreSQL is unreachable ({e}). "
                "Refusing to fall back to SQLite."
            )
    
    # SQLite with WAL mode, 60s busy timeout, and memory cache.
    # Uses the explicit URL when one was given (scratch/test/prod files);
    # only defaults to the repo file when no URL is set at all.
    sqlite_url = db_url if is_sqlite_url else f"sqlite:///{SQLITE_PATH}"
    if is_sqlite_url and db_url != f"sqlite:///{SQLITE_PATH}":
        print(f"Using explicit SQLite database: {db_url}")
    engine = sqlalchemy.create_engine(
        sqlite_url,
        connect_args={
            "check_same_thread": False,
            "timeout": 60
        },
        pool_size=20,
        max_overflow=30
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=60000")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA cache_size=-64000")
        cursor.close()

    print("Connected to SQLite database (WAL mode enabled, 60s busy timeout).")
    ensure_schema(engine)
    _CACHED_ENGINE = engine
    return engine
