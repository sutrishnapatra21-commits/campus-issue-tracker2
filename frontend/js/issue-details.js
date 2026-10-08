// ===== issue-details.js : shows ONE issue. URL looks like issue-details.html?id=2 =====
const box = document.getElementById("issue-detail");
const id = new URLSearchParams(location.search).get("id");

async function loadIssue(){
  if(!id){ box.innerHTML = `<div class="alert alert-error">No issue selected. <a href="issues.html">Go back to the list</a>.</div>`; return; }
  try{
    const i = await getIssue(id);
    document.title = i.title + " - Campus Issue Tracker";
    box.innerHTML = `
      <div class="panel">
        <span class="badge ${statusClass(i.status)}">${escapeHTML(displayStatus(i.status))}</span>
        <h1 style="font-size:2rem;margin-top:.6rem">${escapeHTML(i.title)}</h1>
        <div class="meta" style="margin:.6rem 0"><span>${escapeHTML(displayCategory(i.category))}</span><span>Reported ${formatDate(i.created_at)}</span></div>
        <p class="hint"><strong>Class:</strong> ${escapeHTML(i.student_class || "Not provided")} &nbsp; <strong>Section:</strong> ${escapeHTML(i.section || "Not provided")}</p>
        <p>${escapeHTML(i.description)}</p>
        ${i.photo_url ? `<img class="photo" src="${escapeHTML(i.photo_url)}" alt="Photo of the issue">` : ""}
        ${i.admin_note ? `<div class="admin-note"><strong>Admin note</strong><br>${escapeHTML(i.admin_note)}</div>` : ""}
      </div>
      <div class="panel">
        <h3>Location</h3>
        <p class="hint" style="margin-bottom:.6rem">${locationText(i)}</p>
        <!-- MAP SLOT (Ananya): her code draws the saved location inside this div -->
        <div id="issue-map">Map will appear here once the map module is connected.</div>
      </div>`;
    // MAP CONNECTION (Ananya): her real signature is
    //   showSavedLocation(mapId, latitude, longitude, popupText)
    // mapId comes FIRST — a previous version of this file had the arguments
    // in the wrong order, which would crash Leaflet instead of rendering.
    if(typeof showSavedLocation === "function" && i.latitude != null){
      document.getElementById("issue-map").textContent = "";
      showSavedLocation("issue-map", i.latitude, i.longitude, i.title);
    }
  }catch(err){
    box.innerHTML = `<div class="alert alert-error">Could not load this issue: ${escapeHTML(err.message)}. <a href="issues.html">Back to list</a></div>`;
  }
}
loadIssue();
