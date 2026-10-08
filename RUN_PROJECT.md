# Campus Issue Tracker — Run Instructions

## Recommended (Flask serves the whole project)

1. Open a terminal in this folder.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Start Flask:

```bash
python app.py
```

4. Open:

`http://127.0.0.1:5000/`

Do **not** double-click the HTML files.

## If you use VS Code Live Server

This version also supports Live Server on ports **5500/5501**. Keep Flask running on port 5000 at the same time.

Open `frontend/login.html` through Live Server, e.g.:

`http://127.0.0.1:5500/campus-tracker-merged/frontend/login.html`

The frontend automatically sends API requests to Flask on port 5000.

## Demo accounts

- Student: `student@iem.edu.in` / `student123`
- Admin: `admin@iem.edu.in` / `admin123`

## Registration

Use a new email address. Passwords must be at least 6 characters.


## New in this version
- Student reports now record Class and Section.
- Admin dashboard and issue details show the reporter's Class and Section.
- IEM/UEM campus preset coordinates use the coordinates supplied by the project team:
  - IEM Gurukul: 22.5691, 88.4328
  - IEM Ashram: 22.5707, 88.4367
  - IEM Management House: 22.5684, 88.4316
  - IEM AI Campus: 22.5688, 88.4321
  - UEM Kolkata Main Campus: 22.5446, 88.4902
- Existing databases are migrated automatically; existing report data is preserved.
