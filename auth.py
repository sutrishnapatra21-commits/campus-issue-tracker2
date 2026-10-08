"""
Authentication module for Campus Issue Tracker.

This module is designed to plug into the team's existing Flask app.py and
database.py. It does NOT create a Flask app or a database of its own.

Expected database.py API:
    create_user(name, email, password_hash, role="student")
    find_user_by_email(email)

find_user_by_email() may return a sqlite3.Row, dict, or None.
"""

from functools import wraps
import re

import click
from flask import jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from database import create_user, find_user_by_email


MIN_PASSWORD_LENGTH = 6
MAX_NAME_LENGTH = 80
MAX_EMAIL_LENGTH = 254

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s.]+$")


def _field(user, key, default=None):
    """Read a field from either a sqlite3.Row/dict-like object."""
    if user is None:
        return default
    try:
        return user[key]
    except (KeyError, IndexError, TypeError):
        return default


def validate_registration(name, email, password, confirm_password):
    """Return an error message, or None when registration data is valid."""
    if not name or not email or not password or not confirm_password:
        return "All fields are required."

    if len(name) > MAX_NAME_LENGTH:
        return f"Name must be at most {MAX_NAME_LENGTH} characters."

    if len(email) > MAX_EMAIL_LENGTH:
        return "Email address is too long."

    # Team requirement: @ plus a domain containing a dot.
    if "@" not in email or "." not in email.split("@")[-1]:
        return "Enter a valid email address."

    # Keep this check aligned with the team's API requirement.
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"Password must contain at least {MIN_PASSWORD_LENGTH} characters."

    if password != confirm_password:
        return "Passwords do not match."

    return None


def register_user_api():
    """POST /api/register handler. Returns JSON only."""
    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    confirm_password = data.get("confirm_password") or ""

    error = validate_registration(name, email, password, confirm_password)
    if error:
        return jsonify({"ok": False, "error": error}), 400

    if find_user_by_email(email) is not None:
        return jsonify({
            "ok": False,
            "error": "An account with this email already exists."
        }), 409

    password_hash = generate_password_hash(password)

    # Always create public registrations as students.
    create_user(name, email, password_hash, role="student")

    user = find_user_by_email(email)

    return jsonify({
        "ok": True,
        "user": {
            "id": _field(user, "id"),
            "name": _field(user, "name", name),
            "email": _field(user, "email", email),
            "role": _field(user, "role", "student"),
        },
    }), 201


def login_user_api():
    """POST /api/login handler. Returns JSON only."""
    data = request.get_json(silent=True) or {}

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({
            "ok": False,
            "error": "Email and password are required."
        }), 400

    user = find_user_by_email(email)

    # Do not reveal whether an email exists.
    if user is None or not check_password_hash(
        _field(user, "password_hash", ""), password
    ):
        return jsonify({
            "ok": False,
            "error": "Invalid email or password."
        }), 401

    session.clear()
    session.permanent = True
    session["user_id"] = _field(user, "id")
    session["name"] = _field(user, "name")
    session["email"] = _field(user, "email")
    session["role"] = _field(user, "role", "student")

    return jsonify({
        "ok": True,
        "user": {
            "id": _field(user, "id"),
            "name": _field(user, "name"),
            "email": _field(user, "email"),
            "role": _field(user, "role", "student"),
        },
    }), 200


def logout_user_api():
    """Optional JSON logout endpoint."""
    session.clear()
    return jsonify({"ok": True}), 200


def login_required(view):
    """Require a logged-in session for an API route."""
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({
                "ok": False,
                "error": "Login required."
            }), 401
        return view(*args, **kwargs)

    return wrapped


def role_required(role):
    """Require login and a specific session role for an API route."""
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if not session.get("user_id"):
                return jsonify({
                    "ok": False,
                    "error": "Login required."
                }), 401

            if session.get("role") != role:
                return jsonify({
                    "ok": False,
                    "error": "Not allowed."
                }), 403

            return view(*args, **kwargs)

        return wrapped

    return decorator


def register_auth_routes(app):
    """
    Attach authentication API routes to the team's existing Flask app.

    Do not call Flask(__name__) here and do not create another database.
    """
    app.add_url_rule(
        "/api/register",
        endpoint="api_register",
        view_func=register_user_api,
        methods=["POST"],
    )
    app.add_url_rule(
        "/api/login",
        endpoint="api_login",
        view_func=login_user_api,
        methods=["POST"],
    )
    app.add_url_rule(
        "/api/logout",
        endpoint="api_logout",
        view_func=logout_user_api,
        methods=["POST"],
    )


def register_create_admin_command(app):
    """Attach the team's create-admin CLI command to the existing Flask app."""

    @app.cli.command("create-admin")
    def create_admin():
        """Create an admin user in the shared database."""
        name = click.prompt("Admin name").strip()
        email = click.prompt("Admin email").strip().lower()
        password = click.prompt(
            "Admin password",
            hide_input=True,
            confirmation_prompt=True,
        )

        if not name or len(name) > MAX_NAME_LENGTH:
            click.echo(
                f"Name is required and must be at most {MAX_NAME_LENGTH} characters."
            )
            return

        if len(email) > MAX_EMAIL_LENGTH or (
            "@" not in email or "." not in email.split("@")[-1]
        ):
            click.echo("Enter a valid email address.")
            return

        if len(password) < MIN_PASSWORD_LENGTH:
            click.echo(
                f"Password must contain at least {MIN_PASSWORD_LENGTH} characters."
            )
            return

        if find_user_by_email(email) is not None:
            click.echo("A user with this email already exists.")
            return

        create_user(
            name,
            email,
            generate_password_hash(password),
            role="admin",
        )
        click.echo("Admin account created successfully.")
