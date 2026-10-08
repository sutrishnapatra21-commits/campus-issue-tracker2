-- Campus Issue Tracker database schema
-- SQLite is one file (campus.db). This script creates the tables.

-- Students and admins live in the same table.
-- role is either 'student' or 'admin'.
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student', 'admin')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row = one campus problem reported by a student.
CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK (
        category IN ('equipment', 'safety', 'maintenance', 'wifi', 'other')
    ),
    description TEXT NOT NULL,
    student_class TEXT,
    section TEXT,
    photo_path TEXT,
    latitude REAL,
    longitude REAL,
    location_note TEXT,
    status TEXT NOT NULL DEFAULT 'reported' CHECK (
        status IN ('reported', 'in_progress', 'resolved', 'rejected')
    ),
    admin_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Faster admin filtering by status and category.
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_user ON issues(user_id);
