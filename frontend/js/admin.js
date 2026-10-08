// ===== admin.js : admin-only issue management dashboard =====
let adminIssues = [];
const adminList = document.getElementById("admin-list");
const adminEmpty = document.getElementById("admin-empty");
const adminMessage = document.getElementById("admin-message");
const adminSearch = document.getElementById("admin-search");
const adminStatus = document.getElementById("admin-status");
const adminCategory = document.getElementById("admin-category");

function adminAlert(message, type="error") {
  adminMessage.className = "alert alert-" + type;
  adminMessage.textContent = message;
}

function updateStats(items) {
  const count = status => items.filter(i => i.status === status).length;
  document.getElementById("stat-total").textContent = items.length;
  document.getElementById("stat-reported").textContent = count("reported");
  document.getElementById("stat-progress").textContent = count("in_progress");
  document.getElementById("stat-resolved").textContent = count("resolved");
  document.getElementById("stat-rejected").textContent = count("rejected");
}

function issueAdminCard(i) {
  const image = i.photo_url ? `<img class="admin-photo" src="${escapeHTML(i.photo_url)}" alt="Photo for ${escapeHTML(i.title)}">` : "";
  const reporter = i.reporter_name ? `${escapeHTML(i.reporter_name)}${i.reporter_email ? ` · ${escapeHTML(i.reporter_email)}` : ""}` : "Unknown reporter";
  return `<article class="admin-card${i.photo_url ? "" : " no-photo"}" data-id="${i.id}">
    ${image}
    <div class="admin-card-main">
      <div class="admin-card-top">
        <div>
          <span class="badge ${statusClass(i.status)}">${escapeHTML(displayStatus(i.status))}</span>
          <h2>${escapeHTML(i.title)}</h2>
          <p class="admin-meta">${escapeHTML(displayCategory(i.category))} · ${formatDate(i.created_at)} · ${escapeHTML(locationText(i))}</p>
          <p>${escapeHTML(i.description || "")}</p>
          <p class="admin-meta"><strong>Reported by:</strong> ${reporter}</p>
          <p class="admin-meta"><strong>Class:</strong> ${escapeHTML(i.student_class || "Not provided")} &nbsp; <strong>Section:</strong> ${escapeHTML(i.section || "Not provided")}</p>
          ${i.location_note ? `<p class="admin-meta"><strong>Place:</strong> ${escapeHTML(i.location_note)}</p>` : ""}
          ${i.admin_note ? `<div class="admin-note"><strong>Admin note:</strong> ${escapeHTML(i.admin_note)}</div>` : ""}
        </div>
        <a class="btn btn-outline btn-small" href="issue-details.html?id=${encodeURIComponent(i.id)}">View</a>
      </div>
      <div class="admin-controls">
        <label>Status<select class="admin-status-select">
          <option value="reported" ${i.status === "reported" ? "selected" : ""}>Reported</option>
          <option value="in_progress" ${i.status === "in_progress" ? "selected" : ""}>In Progress</option>
          <option value="resolved" ${i.status === "resolved" ? "selected" : ""}>Resolved</option>
          <option value="rejected" ${i.status === "rejected" ? "selected" : ""}>Rejected</option>
        </select></label>
        <label class="admin-note-field">Admin note<textarea class="admin-note-input" rows="2" maxlength="500" placeholder="Optional note for the reporter">${escapeHTML(i.admin_note || "")}</textarea></label>
        <div class="admin-actions"><button class="btn btn-small save-btn" type="button">Save changes</button><button class="btn btn-outline btn-small delete-btn" type="button">Delete</button></div>
      </div>
    </div>
  </article>`;
}

function renderAdminList() {
  const q = adminSearch.value.trim().toLowerCase();
  const shown = adminIssues.filter(i => {
    const haystack = `${i.title || ""} ${i.description || ""} ${i.reporter_name || ""} ${i.reporter_email || ""} ${i.location_note || ""}`.toLowerCase();
    return (!adminStatus.value || i.status === adminStatus.value) &&
           (!adminCategory.value || i.category === adminCategory.value) &&
           (!q || haystack.includes(q));
  });
  adminList.innerHTML = shown.map(issueAdminCard).join("");
  adminEmpty.classList.toggle("hidden", shown.length !== 0);
}

async function loadAdminIssues() {
  adminList.innerHTML = `<div class="empty">Loading issues...</div>`;
  adminEmpty.classList.add("hidden");
  adminMessage.className = "hidden";
  try {
    const user = await getCurrentUser();
    if(!user) { location.href = "login.html"; return; }
    if(user.role !== "admin") {
      adminAlert("Admin access is required for this page.", "error");
      setTimeout(() => location.href = "issues.html", 900);
      return;
    }
    adminIssues = await getIssues();
    updateStats(adminIssues);
    renderAdminList();
  } catch (error) {
    adminList.innerHTML = "";
    adminAlert(error.message || "Could not load issues.", "error");
  }
}

adminList.addEventListener("click", async event => {
  const card = event.target.closest(".admin-card");
  if(!card) return;
  const id = card.dataset.id;
  const issue = adminIssues.find(i => String(i.id) === String(id));
  if(!issue) return;

  if(event.target.closest(".save-btn")) {
    const status = card.querySelector(".admin-status-select").value;
    const admin_note = card.querySelector(".admin-note-input").value.trim();
    const button = card.querySelector(".save-btn");
    button.disabled = true; button.textContent = "Saving...";
    try {
      const data = await updateIssue(id, {status, admin_note});
      const updated = normalizeIssue(data.issue || data);
      adminIssues = adminIssues.map(i => String(i.id) === String(id) ? {...i, ...updated, status, admin_note} : i);
      updateStats(adminIssues);
      renderAdminList();
      adminAlert("Issue updated successfully.", "success");
    } catch(error) {
      adminAlert(error.message || "Could not update issue.", "error");
      button.disabled = false; button.textContent = "Save changes";
    }
  }

  if(event.target.closest(".delete-btn")) {
    if(!confirm(`Delete issue #${id} — ${issue.title}? This cannot be undone.`)) return;
    const button = card.querySelector(".delete-btn");
    button.disabled = true; button.textContent = "Deleting...";
    try {
      await deleteIssue(id);
      adminIssues = adminIssues.filter(i => String(i.id) !== String(id));
      updateStats(adminIssues);
      renderAdminList();
      adminAlert("Issue deleted.", "success");
    } catch(error) {
      adminAlert(error.message || "Could not delete issue.", "error");
      button.disabled = false; button.textContent = "Delete";
    }
  }
});

[adminSearch, adminStatus, adminCategory].forEach(el => el.addEventListener("input", renderAdminList));
document.getElementById("refresh-btn").addEventListener("click", loadAdminIssues);

loadAdminIssues();
