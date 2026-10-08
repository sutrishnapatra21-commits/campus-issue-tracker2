// ===== issues.js : loads issues and draws cards on issues.html =====
const listEl = document.getElementById("issues-list");
const msgEl = document.getElementById("issues-message");
const searchEl = document.getElementById("search");
const statusEl = document.getElementById("filter-status");
const categoryEl = document.getElementById("filter-category");
let allIssues = [];

function cardHTML(i){
  const img = i.photo_url ? `<img src="${escapeHTML(i.photo_url)}" alt="Photo for ${escapeHTML(i.title)}">` : "";
  const desc = i.description || "";
  return `<article class="card">${img}<div class="card-body">
    <span class="badge ${statusClass(i.status)}">${escapeHTML(displayStatus(i.status))}</span>
    <h3>${escapeHTML(i.title)}</h3>
    <p>${escapeHTML(desc.length > 110 ? desc.slice(0,110)+"..." : desc)}</p>
    <div class="meta"><span>${escapeHTML(displayCategory(i.category))}</span><span>${formatDate(i.created_at)}</span><span>${locationText(i)}</span></div>
    <p class="hint"><strong>Class:</strong> ${escapeHTML(i.student_class || "Not provided")} &nbsp; <strong>Section:</strong> ${escapeHTML(i.section || "Not provided")}</p>
    <a class="btn btn-outline btn-small" href="issue-details.html?id=${encodeURIComponent(i.id)}">View details</a>
  </div></article>`;
}

function render(){
  const q = searchEl.value.trim().toLowerCase();
  // statusEl.value / categoryEl.value are backend-format (see issues.html
  // <option value="reported">, <option value="wifi">, etc.) so they compare
  // directly against i.status / i.category without any conversion.
  const shown = allIssues.filter(i =>
    (!statusEl.value || i.status === statusEl.value) &&
    (!categoryEl.value || i.category === categoryEl.value) &&
    (!q || ((i.title||"") + " " + (i.description||"")).toLowerCase().includes(q)));
  listEl.innerHTML = shown.map(cardHTML).join("");
  msgEl.className = shown.length ? "hidden" : "empty";
  msgEl.textContent = shown.length ? "" : "No issues match. Try different filters, or report a new issue.";
}

async function loadIssues(){
  try{
    allIssues = await getIssues();
    render();
  }catch(err){
    msgEl.className = "alert alert-error";
    msgEl.textContent = "Could not load issues: " + err.message;
  }
}
[searchEl, statusEl, categoryEl].forEach(el => el.addEventListener("input", render));
loadIssues();
