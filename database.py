"""
database.py — SQLite helpers for the Campus Issue Tracker.

If you know Java:
  sqlite3.connect(...)  ≈  DriverManager.getConnection("jdbc:sqlite:campus.db")
  cursor.execute(sql)   ≈  PreparedStatement
  cursor.fetchall()     ≈  ResultSet loop into a List
  dict(row)             ≈  turning a ResultSet row into a Map / POJO

This file does NOT talk to the browser. It only talks to the database.
app.py will call these functions from the API routes.
"""

# pathlib.Path lets us build file paths that work on Windows and Linux.
from pathlib import Path

# sqlite3 is Python's built-in SQLite driver. No extra install needed.
import sqlite3

# g is Flask's "per-request storage" (like a request-scoped HashMap).
# current_app lets helpers read settings from the running Flask app.
from flask import g, current_app

# werkzeug hashes passwords so we never store "admin123" as plain text.
from werkzeug.security import generate_password_hash


# Folder that contains this file (the project root).
BASE_DIR = Path(__file__).resolve().parent

# The actual database file on disk. One file = the whole database.
DEFAULT_DB_PATH = BASE_DIR / "campus.db"

# SQL that creates tables (see schema.sql).
SCHEMA_PATH = BASE_DIR / "schema.sql"


def ensure_issue_columns(db):
    """Add newer issue fields to an existing SQLite database without deleting data."""
    columns = {row[1] for row in db.execute("PRAGMA table_info(issues)").fetchall()}
    if "student_class" not in columns:
        db.execute("ALTER TABLE issues ADD COLUMN student_class TEXT")
    if "section" not in columns:
        db.execute("ALTER TABLE issues ADD COLUMN section TEXT")
    db.commit()


def correct_demo_issue_locations(db):
    """Correct coordinates for the original demo reports without touching student reports."""
    corrections = [
        (22.5691, 88.4328, "IEM Gurukul Campus — Central Library stairs", "WiFi dead zone near library stairs"),
        (22.5707, 88.4367, "IEM Ashram Building — Room 301", "Broken projector in Room 301"),
        (22.5684, 88.4316, "IEM Management House — hostel walkway", "Loose railing on hostel walkway"),
    ]
    for lat, lng, note, title in corrections:
        db.execute(
            """UPDATE issues
               SET latitude = ?, longitude = ?, location_note = ?
             WHERE title = ?
               AND (latitude IN (22.5626, 22.5629, 22.5632) OR longitude IN (88.4112, 88.4108, 88.4115))""",
            (lat, lng, note, title),
        )
    db.commit()


def get_db():
    """
    Return one SQLite connection for the current HTTP request.

    Why not connect on every query?
      Opening a file every time is slow. Flask's `g` object lives for
      one request, so we reuse the same connection until the response is sent.
    """
    # `g` may already have a connection from an earlier call in this request.
    if "db" not in g:
        # Connect to the .db file. check_same_thread=False is needed because
        # Flask can use the connection in a slightly different thread.
        g.db = sqlite3.connect(
            current_app.config["DATABASE"],
            detect_types=sqlite3.PARSE_DECLTYPES,
            check_same_thread=False,
        )
        # Row objects act like dicts: row["email"] instead of row[2].
        g.db.row_factory = sqlite3.Row
        # Enforce FOREIGN KEY (user_id must point at a real user).
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


def close_db(_error=None):
    """Close the connection when the request ends. Prevents file locks."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    """
    Create tables (if missing) and insert demo users/issues.

    Safe to run more than once: CREATE TABLE IF NOT EXISTS does nothing
    if the tables already exist. Seed data only inserts if the table is empty.
    """
    db = get_db()
    # Read the whole schema file as text, then run it.
    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
    db.executescript(schema_sql)
    db.commit()
    ensure_issue_columns(db)
    seed_if_empty(db)
    correct_demo_issue_locations(db)


def seed_if_empty(db):
    """Insert demo accounts so the team can log in without registering first."""
    # COUNT(*) returns how many users exist.
    user_count = db.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]
    if user_count > 0:
        return

    # generate_password_hash turns a password into a one-way hash.
    # You can check a login later with check_password_hash(hash, typed_password).
    admin_hash = generate_password_hash("admin123")
    student_hash = generate_password_hash("student123")

    db.execute(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
        ("Campus Admin", "admin@iem.edu.in", admin_hash, "admin"),
    )
    db.execute(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
        ("Demo Student", "student@iem.edu.in", student_hash, "student"),
    )
    db.commit()

    student_id = db.execute(
        "SELECT id FROM users WHERE email = ?",
        ("student@iem.edu.in",),
    ).fetchone()["id"]

    # Sample reports so the admin dashboard is not empty on first demo.
    samples = [
        (
            student_id,
            "WiFi dead zone near library stairs",
            "wifi",
            "No signal on the first-floor landing. Many students sit here between classes.",
            22.5626,
            88.4112,
            "Central Library stairs",
            "reported",
        ),
        (
            student_id,
            "Broken projector in Room 301",
            "equipment",
            "Projector power light is on but the display stays black.",
            22.5629,
            88.4108,
            "Block A, Room 301",
            "in_progress",
        ),
        (
            student_id,
            "Loose railing on hostel walkway",
            "safety",
            "The metal railing shakes if you lean on it. Needs urgent check.",
            22.5632,
            88.4115,
            "Boys hostel walkway",
            "reported",
        ),
    ]
    for row in samples:
        db.execute(
            """
            INSERT INTO issues
                (user_id, title, category, description, latitude, longitude, location_note, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            row,
        )
    db.commit()


def row_to_dict(row):
    """Convert a sqlite3.Row into a normal Python dict (JSON-friendly)."""
    if row is None:
        return None
    return dict(row)


def create_user(name, email, password_hash, role="student"):
    """Insert a new user. Returns the new id, or None if email is taken."""
    db = get_db()
    try:
        cursor = db.execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
            (name, email, password_hash, role),
        )
        db.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        # UNIQUE(email) is the expected case. Other CHECK failures would also
        # land here; we still return None and let the API show "email taken".
        return None


def find_user_by_email(email):
    """Look up one user by email. Used at login."""
    db = get_db()
    row = db.execute(
        "SELECT id, name, email, password_hash, role FROM users WHERE email = ?",
        (email,),
    ).fetchone()
    return row_to_dict(row)


def find_user_by_id(user_id):
    """Look up one user by id. Used to fill session / /api/me."""
    db = get_db()
    row = db.execute(
        "SELECT id, name, email, role FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    return row_to_dict(row)


def insert_issue(
    user_id,
    title,
    category,
    description,
    student_class=None,
    section=None,
    photo_path=None,
    latitude=None,
    longitude=None,
    location_note=None,
):
    """Save a new campus issue. Returns the new issue id."""
    db = get_db()
    cursor = db.execute(
        """
        INSERT INTO issues
            (user_id, title, category, description, student_class, section, photo_path,
             latitude, longitude, location_note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            title,
            category,
            description,
            student_class,
            section,
            photo_path,
            latitude,
            longitude,
            location_note,
        ),
    )
    db.commit()
    return cursor.lastrowid


def list_issues(user_id=None, status=None, category=None):
    """
    Return issues as a list of dicts.

    If user_id is given, only that student's reports (My Reports page).
    Admin calls this with user_id=None to see everyone.
    """
    db = get_db()
    sql = """
        SELECT
            issues.id,
            issues.title,
            issues.category,
            issues.description,
            issues.student_class,
            issues.section,
            issues.photo_path,
            issues.latitude,
            issues.longitude,
            issues.location_note,
            issues.status,
            issues.admin_note,
            issues.created_at,
            issues.updated_at,
            users.name AS reporter_name,
            users.email AS reporter_email
        FROM issues
        JOIN users ON users.id = issues.user_id
        WHERE 1 = 1
    """
    # params is built as we add optional filters (like StringBuilder + List in Java).
    params = []

    if user_id is not None:
        sql += " AND issues.user_id = ?"
        params.append(user_id)
    if status:
        sql += " AND issues.status = ?"
        params.append(status)
    if category:
        sql += " AND issues.category = ?"
        params.append(category)

    sql += " ORDER BY issues.created_at DESC"

    rows = db.execute(sql, params).fetchall()
    return [row_to_dict(row) for row in rows]


def get_issue(issue_id):
    """Return one issue, or None if the id does not exist."""
    db = get_db()
    row = db.execute(
        """
        SELECT
            issues.id,
            issues.user_id,
            issues.title,
            issues.category,
            issues.description,
            issues.student_class,
            issues.section,
            issues.photo_path,
            issues.latitude,
            issues.longitude,
            issues.location_note,
            issues.status,
            issues.admin_note,
            issues.created_at,
            issues.updated_at,
            users.name AS reporter_name,
            users.email AS reporter_email
        FROM issues
        JOIN users ON users.id = issues.user_id
        WHERE issues.id = ?
        """,
        (issue_id,),
    ).fetchone()
    return row_to_dict(row)


def delete_issue(issue_id):
    db = get_db()
    cursor = db.execute("DELETE FROM issues WHERE id = ?", (issue_id,))
    db.commit()
    return cursor.rowcount > 0


def update_issue_status(issue_id, status, admin_note=None):
    """Admin changes status (reported → in_progress → resolved / rejected)."""
    db = get_db()
    db.execute(
        """
        UPDATE issues
        SET status = ?,
            admin_note = ?,
            updated_at = datetime('now')
        WHERE id = ?
        """,
        (status, admin_note, issue_id),
    )
    db.commit()
    return get_issue(issue_id)
