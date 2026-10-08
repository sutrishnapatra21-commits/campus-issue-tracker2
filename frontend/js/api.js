// ===== api.js : all communication with Flask lives here =====
// Backend response shapes are now confirmed against the real app.py / database.py.
// Status/category stay in BACKEND format everywhere (lowercase / snake_case):
//   status:   reported | in_progress | resolved | rejected
//   category: equipment | safety | maintenance | wifi | other
// Use displayStatus()/displayCategory() from main.js only when SHOWING text to the user.


function absoluteApiUrl(path){
  if(!path) return "";
  if(/^https?:\/\//i.test(path)) return path;
  return API_BASE + (String(path).startsWith("/") ? path : "/" + path);
}

function normalizeIssue(raw){
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    student_class: raw.student_class || "",
    section: raw.section || "",
    category: raw.category,
    status: raw.status || "reported",
    created_at: raw.created_at || raw.date || "",
    latitude: raw.latitude ?? raw.lat ?? null,
    longitude: raw.longitude ?? raw.lng ?? null,
    // Real backend column is photo_path. Keep the old names as a fallback
    // only so mock/demo data (which used photo_url) still renders.
    photo_url: absoluteApiUrl(raw.photo_path || raw.photo_url || raw.image || ""),
    admin_note: raw.admin_note || "",
    location_note: raw.location_note || "",
    reporter_name: raw.reporter_name || "",
    reporter_email: raw.reporter_email || "",
    updated_at: raw.updated_at || ""
  };
}

async function handle(response){
  if(!response.ok){
    // Try to surface the backend's own message, e.g. "Title must be at
    // least 5 characters." instead of a bare status code.
    let message = "Server error (" + response.status + ")";
    try{
      const body = await response.json();
      if(body && body.error) message = body.error;
    }catch(_e){ /* response wasn't JSON — keep the generic message */ }
    throw new Error(message);
  }
  return response.json();
}

// DEMO ONLY (used when USE_MOCK = true): new issues are remembered in this browser
function mockAll(){
  const saved = JSON.parse(localStorage.getItem("mockNewIssues") || "[]");
  return [...saved, ...MOCK_ISSUES];
}

// GET /api/issues  ->  backend returns {"ok": true, "issues": [...]}
async function getIssues(){
  if(USE_MOCK) return mockAll().map(normalizeIssue);
  const data = await handle(await fetch(API_URL, {credentials:"include"}));
  const list = Array.isArray(data) ? data : data.issues;
  return (list || []).map(normalizeIssue);
}

// GET /api/issues/<id>  ->  backend returns {"ok": true, "issue": {...}}
async function getIssue(id){
  if(USE_MOCK){
    const found = mockAll().find(i => String(i.id) === String(id));
    if(!found) throw new Error("Issue not found");
    return normalizeIssue(found);
  }
  const data = await handle(await fetch(API_URL + "/" + id, {credentials:"include"}));
  return normalizeIssue(data.issue || data);
}

// POST /api/issues - formData has title, description, category, latitude, longitude, photo
// Do NOT set Content-Type manually: the browser sets it for FormData.
async function createIssue(formData){
  if(USE_MOCK){
    const saved = JSON.parse(localStorage.getItem("mockNewIssues") || "[]");
    saved.unshift({
      id: Date.now(), title: formData.get("title"), description: formData.get("description"),
      category: formData.get("category"), status: "reported",
      created_at: new Date().toISOString().slice(0,10),
      latitude: formData.get("latitude") || null, longitude: formData.get("longitude") || null,
      photo_url: "", admin_note: ""
    });
    localStorage.setItem("mockNewIssues", JSON.stringify(saved));
    return {message: "mock ok"};
  }
  return handle(await fetch(API_URL, {method:"POST", body:formData, credentials:"include"}));
}

// PATCH /api/issues/<id> - used mainly by the admin dashboard (Sohan)
// NOTE: the real backend only implements PATCH, not PUT.
async function updateIssue(id, changes){
  if(USE_MOCK) return {message:"mock ok"};
  return handle(await fetch(API_URL + "/" + id, {method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(changes), credentials:"include"}));
}


// DELETE /api/issues/<id> - admin only
async function deleteIssue(id){
  return handle(await fetch(API_URL + "/" + id, {
    method:"DELETE",
    credentials:"include"
  }));
}
