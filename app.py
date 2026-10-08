"""
Campus Issue Tracker — Flask web app + REST API.

This is the merged, working version of the project:
  database.py          -> Bibasan's design, as actually used by the team
  auth.py               -> Nishika — register/login/logout, decorators
  management_routes.py  -> Shounak's part, adapted — admin DELETE
  app.py (this file)    -> Sutrishna — issue endpoints + app wiring
  frontend/             -> Subhdra + Ananya's map.js — served as static files

The frontend is a self-contained client-side app (plain HTML/JS calling the
JSON API with fetch), so Flask serves it directly as static files instead of
rendering Jinja templates. "/" serves frontend/index.html; every other page
(login.html, issues.html, report-issue.html, issue-details.html) is reached
by its own URL, e.g. http://127.0.0.1:5000/login.html.
"""

import os
import uuid

from flask import (
    Flask,
    current_app,
    jsonify,
    request,
    send_from_directory,
    session,
)

from werkzeug.utils import secure_filename

import database as db
from auth import (
    login_required,
    register_auth_routes,
    register_create_admin_command,
    role_required,
)
from management_routes import management


ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
ALLOWED_STATUSES = {"reported", "in_progress", "resolved", "rejected"}
ALLOWED_CATEGORIES = {"equipment", "safety", "maintenance", "wifi", "other"}

# Default map centre: IEM Kolkata.
IEM_LAT = 22.5691
IEM_LNG = 88.4328


class PhotoUploadError(ValueError):
    """Raised when an uploaded photo has an invalid format."""


def create_app():
    """Build and return the Flask application."""

    app = Flask(
        __name__,
        static_folder="frontend",   # the frontend team's folder, served as-is
        static_url_path="",         # served at the site root: /index.html, /css/style.css, ...
    )

    app.config["SECRET_KEY"] = os.environ.get(
        "SECRET_KEY",
        "iem-campus-tracker-dev-key",
    )

    app.config["DATABASE"] = os.environ.get(
        "DATABASE_PATH",
        str(db.DEFAULT_DB_PATH),
    )

    upload_folder = os.path.join(app.root_path, "static", "uploads")
    os.makedirs(upload_folder, exist_ok=True)
    app.config["UPLOAD_FOLDER"] = upload_folder

    app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024  # 5 MB

    # Allow the frontend to be opened with VS Code Live Server (typically
    # http://127.0.0.1:5500) while Flask runs on port 5000. The normal
    # Flask-served frontend remains same-origin and needs no CORS.
    @app.after_request
    def add_local_dev_cors(response):
        origin = request.headers.get("Origin", "")
        allowed = {
            "http://127.0.0.1:5500",
            "http://localhost:5500",
            "http://127.0.0.1:5501",
            "http://localhost:5501",
        }
        if origin in allowed:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
            response.headers["Vary"] = "Origin"
        return response

    app.teardown_appcontext(db.close_db)

    with app.app_context():
        db.init_db()

    # ------------------------------------------------------------
    # Frontend
    # ------------------------------------------------------------

    @app.get("/")
    def home():
        return app.send_static_file("index.html")

    # ------------------------------------------------------------
    # Authentication API (Nishika) — register/login/logout + CLI
    # ------------------------------------------------------------

    register_auth_routes(app)
    register_create_admin_command(app)

    # ------------------------------------------------------------
    # Admin/security API (Shounak) — DELETE /api/issues/<id>
    # ------------------------------------------------------------

    app.register_blueprint(management)

    # ------------------------------------------------------------
    # Session info
    # ------------------------------------------------------------

    @app.get("/api/me")
    @login_required
    def api_me():
        return jsonify({"ok": True, "user": public_user()})

    # ------------------------------------------------------------
    # Issues API (Sutrishna)
    # ------------------------------------------------------------

    @app.get("/api/issues")
    @login_required
    def api_list_issues():
        """
        Optional query params: ?status=reported  ?category=wifi

        Students see only their own issues. Admins see all issues.
        """
        status = (request.args.get("status") or "").strip() or None
        category = (request.args.get("category") or "").strip() or None

        if status and status not in ALLOWED_STATUSES:
            return jsonify({"ok": False, "error": "Invalid status."}), 400

        if category and category not in ALLOWED_CATEGORIES:
            return jsonify({"ok": False, "error": "Invalid category."}), 400

        user_id = None if session.get("role") == "admin" else session["user_id"]

        issues = db.list_issues(user_id=user_id, status=status, category=category)
        return jsonify({"ok": True, "issues": issues})

    @app.get("/api/issues/<int:issue_id>")
    @login_required
    def api_get_issue(issue_id):
        issue = db.get_issue(issue_id)
        if issue is None:
            return jsonify({"ok": False, "error": "Issue not found."}), 404

        if session.get("role") != "admin" and issue["user_id"] != session["user_id"]:
            return jsonify({"ok": False, "error": "Not allowed."}), 403

        return jsonify({"ok": True, "issue": issue})

    @app.post("/api/issues")
    @role_required("student")
    def api_create_issue():
        """
        multipart/form-data fields:
        title, category, description, student_class, section, location_note, latitude, longitude, photo
        """
        title = (request.form.get("title") or "").strip()
        category = (request.form.get("category") or "").strip()
        description = (request.form.get("description") or "").strip()
        student_class = (request.form.get("student_class") or "").strip()
        section = (request.form.get("section") or "").strip()
        location_note = (request.form.get("location_note") or "").strip() or None

        if len(title) < 5:
            return jsonify({"ok": False, "error": "Title must be at least 5 characters."}), 400

        if category not in ALLOWED_CATEGORIES:
            return jsonify({"ok": False, "error": "Pick a valid category."}), 400

        if len(description) < 10:
            return jsonify({
                "ok": False,
                "error": "Describe the problem in at least 10 characters.",
            }), 400

        if not student_class or len(student_class) > 80:
            return jsonify({"ok": False, "error": "Enter your class (up to 80 characters)."}), 400

        if not section or len(section) > 40:
            return jsonify({"ok": False, "error": "Enter your section (up to 40 characters)."}), 400

        latitude, lat_error = parse_coordinate(request.form.get("latitude"), "latitude", -90, 90)
        if lat_error:
            return jsonify({"ok": False, "error": lat_error}), 400

        longitude, lng_error = parse_coordinate(request.form.get("longitude"), "longitude", -180, 180)
        if lng_error:
            return jsonify({"ok": False, "error": lng_error}), 400

        try:
            photo_path = save_photo(request.files.get("photo"))
        except PhotoUploadError as error:
            return jsonify({"ok": False, "error": str(error)}), 400

        issue_id = db.insert_issue(
            user_id=session["user_id"],
            title=title,
            category=category,
            description=description,
            student_class=student_class,
            section=section,
            photo_path=photo_path,
            latitude=latitude,
            longitude=longitude,
            location_note=location_note,
        )

        return jsonify({"ok": True, "issue": db.get_issue(issue_id)}), 201

    @app.patch("/api/issues/<int:issue_id>")
    @role_required("admin")
    def api_update_issue(issue_id):
        """
        Expected JSON: {"status": "in_progress", "admin_note": "..."}
        """
        issue = db.get_issue(issue_id)
        if issue is None:
            return jsonify({"ok": False, "error": "Issue not found."}), 404

        data = request.get_json(silent=True) or {}
        status = data.get("status")
        admin_note = data.get("admin_note")

        if not isinstance(status, str) or status not in ALLOWED_STATUSES:
            return jsonify({"ok": False, "error": "Invalid status."}), 400

        if admin_note is not None and not isinstance(admin_note, str):
            return jsonify({"ok": False, "error": "admin_note must be text."}), 400

        updated = db.update_issue_status(issue_id, status, admin_note)
        return jsonify({"ok": True, "issue": updated})

    # ------------------------------------------------------------
    # Uploaded photos
    # ------------------------------------------------------------

    @app.get("/uploads/<path:filename>")
    def uploaded_file(filename):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    @app.errorhandler(413)
    def too_large(_error):
        return jsonify({"ok": False, "error": "File too large. Max 5 MB."}), 413

    return app


def public_user():
    """Safe user info. Password hash is never sent to the frontend."""
    return {
        "id": session.get("user_id"),
        "name": session.get("name"),
        "email": session.get("email"),
        "role": session.get("role"),
    }


def parse_coordinate(value, name, minimum, maximum):
    """Blank -> (None, None). Invalid/out of range -> (None, error). Valid -> (number, None)."""
    if value is None or str(value).strip() == "":
        return None, None
    try:
        number = float(value)
    except (ValueError, TypeError):
        return None, f"{name} must be a number."
    if number < minimum or number > maximum:
        return None, f"{name} must be between {minimum} and {maximum}."
    return number, None


def save_photo(file_storage):
    """None if no photo. Raises PhotoUploadError on a bad extension. Else returns /uploads/<name>."""
    if file_storage is None or file_storage.filename == "":
        return None

    original = secure_filename(file_storage.filename)
    ext = original.rsplit(".", 1)[-1].lower() if "." in original else ""

    if ext not in ALLOWED_EXTENSIONS:
        raise PhotoUploadError(
            "Invalid photo format. Allowed formats: PNG, JPG, JPEG, GIF, WEBP."
        )

    new_name = f"{uuid.uuid4().hex}.{ext}"
    full_path = os.path.join(current_app.config["UPLOAD_FOLDER"], new_name)
    file_storage.save(full_path)
    return f"/uploads/{new_name}"


app = create_app()


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
