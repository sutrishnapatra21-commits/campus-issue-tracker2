// ===== report-issue.js : validation + sending the report form =====

const PENDING_ISSUE_KEY = "pendingIssue";

const form = document.getElementById("issue-form");
const latInput = document.getElementById("latitude");
const lngInput = document.getElementById("longitude");
const photoInput = document.getElementById("photo");
const classInput = document.getElementById("student_class");
const sectionInput = document.getElementById("section");
const preview = document.getElementById("photo-preview");
const banner = document.getElementById("form-banner");
const LOCATION_REQUIRED = true;          // set false if location is optional
const MAX_PHOTO_MB = 5;                  // matches Flask's MAX_CONTENT_LENGTH

// ---- MAP CONNECTION (Ananya) ----
// Ananya's map.js exposes initLocationPicker(options); it does the map click
// handling itself and writes straight into #latitude/#longitude. We just have
// to actually call it once, after map.js has loaded (map.js must be loaded
// BEFORE this file in report-issue.html). Keep the returned picker so the
// campus dropdown below can move the map/marker programmatically too.
let locationPicker = null;
if (typeof initLocationPicker === "function") {
  locationPicker = initLocationPicker({
    mapId: "map",
    latInputId: "latitude",
    lngInputId: "longitude",
    statusId: "error-location",
  });
}

// ---- CAMPUS PICKER ----
// Fills the dropdown from campus-locations.js, and on selection, moves
// the map + marker there and fills the location_note field with the
// real address. The student can still drag the marker to the exact
// spot, or edit the location_note text, after picking a campus.
const campusSelect = document.getElementById("campus");
const locationNoteInput = document.getElementById("location_note");

if (campusSelect && typeof CAMPUS_LOCATIONS !== "undefined") {
  CAMPUS_LOCATIONS.forEach((campus, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = campus.name;
    campusSelect.appendChild(option);
  });

  campusSelect.addEventListener("change", () => {
    if (campusSelect.value === "") return;
    const campus = CAMPUS_LOCATIONS[Number(campusSelect.value)];
    if (!campus) return;

    if (locationPicker) {
      locationPicker.setLocation(campus.lat, campus.lng);
      locationPicker.map.setView([campus.lat, campus.lng], 17);
    }
    if (locationNoteInput && !locationNoteInput.value.trim()) {
      locationNoteInput.value = campus.address;
    }
    setError("location", "");
  });
}

// Kept as a fallback entry point in case a future version of map.js calls
// this directly instead of writing to the inputs itself.
function setIssueLocation(lat, lng){
  latInput.value = Number(lat).toFixed(6);
  lngInput.value = Number(lng).toFixed(6);
  setError("location", "");
}
document.addEventListener("locationSelected", e => setIssueLocation(e.detail.lat, e.detail.lng));
// Clear the location error as soon as the inputs get a value, in case
// map.js fills them directly without going through setIssueLocation().
[latInput, lngInput].forEach(el => el.addEventListener("input", () => {
  if (latInput.value && lngInput.value) setError("location", "");
}));

function setError(field, message){
  const el = document.getElementById("error-" + field);
  if(el) el.textContent = message;
  const input = document.getElementById(field);
  if(input) input.classList.toggle("invalid", !!message);
}

function validate(){
  let ok = true;
  const studentClass = classInput.value.trim(), section = sectionInput.value.trim();
  if(!studentClass){ setError("student_class","Enter your class."); ok = false; }
  else if(studentClass.length > 80){ setError("student_class","Keep the class under 80 characters."); ok = false; }
  else setError("student_class", "");
  if(!section){ setError("section","Enter your section."); ok = false; }
  else if(section.length > 40){ setError("section","Keep the section under 40 characters."); ok = false; }
  else setError("section", "");
  const title = form.title.value.trim(), desc = form.description.value.trim();
  if(title.length < 5){ setError("title","Title must be at least 5 characters."); ok = false; }
  else if(title.length > 120){ setError("title","Keep the title under 120 characters."); ok = false; }
  else setError("title", "");
  if(desc.length < 10){ setError("description","Description must be at least 10 characters."); ok = false; }
  else setError("description", "");
  setError("category", form.category.value ? "" : "Select a category."); if(!form.category.value) ok = false;
  if(LOCATION_REQUIRED && !latInput.value){ setError("location","Click the map to choose where the problem is."); ok = false; }
  const file = photoInput.files[0];
  if(file){
    if(!file.type.startsWith("image/")){ setError("photo","Choose an image file (JPG, PNG, etc.)."); ok = false; }
    else if(file.size > MAX_PHOTO_MB*1024*1024){ setError("photo","Photo must be smaller than "+MAX_PHOTO_MB+" MB."); ok = false; }
    else setError("photo","");
  }
  return ok;
}

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if(file && file.type.startsWith("image/")){ preview.src = URL.createObjectURL(file); preview.classList.remove("hidden"); }
  else preview.classList.add("hidden");
  validate();
});

// Reads a File as a data URL so it can be kept in sessionStorage across
// the trip to login.html and back.
function fileToDataURL(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Saves everything currently in the form so it can be resubmitted
// automatically once the student has logged in.
async function savePendingIssue(){
  const pending = {
    student_class: classInput.value.trim(),
    section: sectionInput.value.trim(),
    title: form.title.value.trim(),
    description: form.description.value.trim(),
    category: form.category.value,
    latitude: latInput.value,
    longitude: lngInput.value,
    location_note: locationNoteInput ? locationNoteInput.value.trim() : "",
  };
  const file = photoInput.files[0];
  if(file){
    try{
      pending.photoDataUrl = await fileToDataURL(file);
      pending.photoName = file.name;
    }catch(_e){ /* photo just won't be restored; everything else still will be */ }
  }
  try{
    sessionStorage.setItem(PENDING_ISSUE_KEY, JSON.stringify(pending));
  }catch(_e){
    // Likely ran out of storage because of a large photo — retry without it.
    delete pending.photoDataUrl; delete pending.photoName;
    try{ sessionStorage.setItem(PENDING_ISSUE_KEY, JSON.stringify(pending)); }catch(_e2){ /* give up quietly */ }
  }
}

// After coming back from login, refills the form from what was saved
// and returns true if there was anything to restore.
async function restorePendingIssueIfAny(){
  const raw = sessionStorage.getItem(PENDING_ISSUE_KEY);
  if(!raw) return false;
  sessionStorage.removeItem(PENDING_ISSUE_KEY);

  let pending;
  try{ pending = JSON.parse(raw); } catch(_e){ return false; }

  classInput.value = pending.student_class || "";
  sectionInput.value = pending.section || "";
  form.title.value = pending.title || "";
  form.description.value = pending.description || "";
  form.category.value = pending.category || "";
  latInput.value = pending.latitude || "";
  lngInput.value = pending.longitude || "";
  if(locationNoteInput) locationNoteInput.value = pending.location_note || "";

  if(locationPicker && pending.latitude && pending.longitude){
    locationPicker.setLocation(Number(pending.latitude), Number(pending.longitude));
    locationPicker.map.setView([Number(pending.latitude), Number(pending.longitude)], 17);
  }

  if(pending.photoDataUrl){
    try{
      const blob = await (await fetch(pending.photoDataUrl)).blob();
      const file = new File([blob], pending.photoName || "photo.jpg", {type: blob.type});
      const dt = new DataTransfer();
      dt.items.add(file);
      photoInput.files = dt.files;
      preview.src = pending.photoDataUrl;
      preview.classList.remove("hidden");
    }catch(_e){ /* photo wasn't restored — student can reattach it */ }
  }
  return true;
}

// Builds the FormData from whatever is currently in the form and sends it.
async function submitIssue(){
  const data = new FormData();
  data.append("student_class", classInput.value.trim());
  data.append("section", sectionInput.value.trim());
  data.append("title", form.title.value.trim());
  data.append("description", form.description.value.trim());
  data.append("category", form.category.value);
  data.append("latitude", latInput.value);
  data.append("longitude", lngInput.value);
  if(locationNoteInput && locationNoteInput.value.trim()) data.append("location_note", locationNoteInput.value.trim());
  if(photoInput.files[0]) data.append("photo", photoInput.files[0]);

  const btn = document.getElementById("submit-btn");
  btn.disabled = true; btn.textContent = "Submitting...";
  try{
    await createIssue(data);
    banner.className = "alert alert-success";
    banner.textContent = "Issue submitted. You can track it on the View Issues page.";
    form.reset();
  }catch(err){
    banner.className = "alert alert-error";
    banner.textContent = "Could not submit the issue: " + err.message;
  }finally{
    btn.disabled = false; btn.textContent = "Submit issue";
  }
}

// ---- Who is logged in? ----
// Admins get sent to the dashboard instead of seeing this form at all.
// A logged-in student who has a report saved from before they logged in
// (see the submit handler below) gets it restored and sent automatically.
getCurrentUser().then(async (user) => {
  if (user && user.role === "admin") {
    sessionStorage.removeItem(PENDING_ISSUE_KEY);
    location.href = "admin.html";
    return;
  }
  if (user) {
    const resumed = await restorePendingIssueIfAny();
    if (resumed) {
      banner.className = "alert alert-success";
      banner.textContent = "Logged in — submitting your report now...";
      await submitIssue();
    }
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();                       // stop the browser's normal page-reload submit
  banner.className = "hidden";
  if(!validate()) return;

  // Not logged in? Save what they've typed, say so, and send them to log
  // in — once they do, this same page submits it for them automatically.
  const user = await getCurrentUser();
  if(!user){
    await savePendingIssue();
    banner.className = "alert alert-error";
    banner.textContent = "Please log in to submit a report. Taking you to the login page...";
    setTimeout(() => { location.href = "login.html"; }, 700);
    return;
  }

  await submitIssue();
});

// Runs after the Clear button / form.reset(). Ananya can also listen to "reset" to remove her map marker.
form.addEventListener("reset", () => setTimeout(() => {
  preview.classList.add("hidden");
  ["student_class","section","title","description","category","photo","location"].forEach(f => setError(f,""));
  if(locationPicker && typeof locationPicker.clearLocation === "function") locationPicker.clearLocation();
}, 0));
