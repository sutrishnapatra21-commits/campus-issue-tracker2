"""
Management & Security routes — admin-only issue deletion.

Adapted from Shounak's original submission to match the team's real
database.py (not a separate db.py) and the real session keys set by
auth.py (user_id / name / email / role), and to use role_required
instead of a hardcoded admin password.
"""

import os

from flask import Blueprint, current_app, jsonify

import database as db
from auth import role_required

management = Blueprint("management", __name__)


@management.delete("/api/issues/<int:issue_id>")
@role_required("admin")
def remove_issue(issue_id):
    issue = db.get_issue(issue_id)
    if issue is None:
        return jsonify({"ok": False, "error": "Issue not found."}), 404

    db.delete_issue(issue_id)

    # Also remove the uploaded photo file, if there was one.
    photo = issue.get("photo_path")
    if photo:
        filename = os.path.basename(photo)
        full_path = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
        if os.path.exists(full_path):
            os.remove(full_path)

    return jsonify({"ok": True})
