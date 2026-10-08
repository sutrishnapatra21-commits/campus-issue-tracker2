// ===== main.js : shared code (navbar, footer, helpers). Loaded on every page. =====

// ---- AUTH HOOK (Nishika) ----
// Replace the body of this function with Nishika's logic, e.g.
//   const r = await fetch(API_BASE + "/api/me", {credentials:"include"});
//   if(!r.ok) return null;
//   const data = await r.json();
//   return data.user; // {id, name, email, role}
// It must return:  null (not logged in)  |  {name:"...", role:"student"}  |  {name:"...", role:"admin"}
async function getCurrentUser(){
  try{
    const response = await fetch(API_BASE + "/api/me", {credentials:"include"});
    if(!response.ok) return null;
    const data = await response.json();
    return data.user || null;
  }catch(_error){
    return null;
  }
}

async function logoutUser(){
  try{
    await fetch(API_BASE + "/api/logout", {method:"POST", credentials:"include"});
  }finally{
    location.href = "index.html";
  }
}

async function renderNavbar(){
  const holder = document.getElementById("site-nav");
  if(!holder) return;
  const page = location.pathname.split("/").pop() || "index.html";
  const user = await getCurrentUser();

  const isAdmin = user && user.role === "admin";
  const links = [["index.html","Home"]];
  if(!isAdmin) links.push(["report-issue.html","Report Issue"]);
  links.push(["issues.html","View Issues"]);
  if(isAdmin) links.push(["admin.html","Dashboard"]);
  let html = links.map(([href,label]) => `<li><a href="${href}" class="${page===href?"active":""}">${label}</a></li>`).join("");
  html += user
    ? `<li><a href="#" id="logout-link">Logout (${escapeHTML(user.name)})</a></li>`
    : `<li><a href="login.html" class="${page==="login.html"?"active":""}">Login</a></li>`;

  holder.innerHTML = `<nav class="navbar"><div class="container">
    <a class="brand" href="index.html">Campus Issue Tracker</a>
    <button class="nav-toggle" id="nav-toggle" aria-label="Toggle menu">Menu</button>
    <ul class="nav-links" id="nav-links">${html}</ul></div></nav>`;

  document.getElementById("nav-toggle").addEventListener("click", () =>
    document.getElementById("nav-links").classList.toggle("open"));
  const lo = document.getElementById("logout-link");
  if(lo) lo.addEventListener("click", e => { e.preventDefault(); logoutUser(); });
}

function renderFooter(){
  const f = document.getElementById("site-footer");
  if(f) f.innerHTML = `<footer><div class="container">Smart Campus Maintenance &amp; Safety Reporting Platform &middot; College Project</div></footer>`;
}

// ---- helpers used by other files ----
function escapeHTML(text){
  const d = document.createElement("div");
  d.textContent = text ?? "";
  return d.innerHTML;
}

// status/category travel through the app in BACKEND format
// (status: reported/in_progress/resolved/rejected, category: equipment/safety/maintenance/wifi/other).
// statusClass() must turn underscores into hyphens too, or "in_progress"
// produces a CSS class ("status-in_progress") that doesn't exist in style.css.
function statusClass(status){ return "status-" + String(status).toLowerCase().replace(/[\s_]+/g,"-"); }

// Use these ONLY when showing text to the user — never for comparisons,
// <option value="...">, or sending data back to the backend.
const STATUS_LABELS = {reported:"Reported", in_progress:"In Progress", resolved:"Resolved", rejected:"Rejected"};
const CATEGORY_LABELS = {equipment:"Equipment", safety:"Safety", maintenance:"Maintenance", wifi:"Wi-Fi", other:"Other"};
function displayStatus(status){ return STATUS_LABELS[status] || status; }
function displayCategory(category){ return CATEGORY_LABELS[category] || category; }

function formatDate(d){
  const x = new Date(d);
  return isNaN(x) ? (d || "Unknown date") : x.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
}
function locationText(i){
  return (i.latitude != null && i.longitude != null)
    ? Number(i.latitude).toFixed(4) + ", " + Number(i.longitude).toFixed(4) : "Location not set";
}

document.addEventListener("DOMContentLoaded", () => { renderNavbar(); renderFooter(); });


// ---- Motion / interaction layer ----
function initMotion(){
  const nav = document.querySelector(".navbar");
  const onScroll = () => nav && nav.classList.toggle("scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, {passive:true});

  // Reveal content as it enters the viewport.
  const revealTargets = document.querySelectorAll(".steps, .steps > div, .grid, .card, .form-card, .detail .panel, .stats-grid, .admin-list");
  revealTargets.forEach((el, i) => {
    if (!el.classList.contains("reveal")) {
      el.classList.add("reveal");
      el.style.transitionDelay = `${Math.min((i % 6) * 70, 350)}ms`;
    }
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          obs.unobserve(entry.target);
        }
      });
    }, {threshold:.12});
    document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
  } else {
    document.querySelectorAll(".reveal").forEach(el => el.classList.add("visible"));
  }

  // Small material-style ripple on buttons.
  document.querySelectorAll(".btn").forEach(btn => {
    btn.addEventListener("click", function(e){
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const ripple = document.createElement("span");
      ripple.className = "ripple";
      ripple.style.width = ripple.style.height = size + "px";
      ripple.style.left = (e.clientX - rect.left - size/2) + "px";
      ripple.style.top = (e.clientY - rect.top - size/2) + "px";
      this.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove());
    });
  });

  // Keyboard users get the same card hover polish without trapping focus.
  document.querySelectorAll(".slip").forEach(card => {
    card.setAttribute("tabindex","0");
  });
}

document.addEventListener("DOMContentLoaded", initMotion);


// ---- Homepage live counters ----
async function initHomePulse(){
  if(!document.body.classList.contains("home-page")) return;
  const totalEl=document.getElementById("home-stat-total");
  const progressEl=document.getElementById("home-stat-progress");
  const resolvedEl=document.getElementById("home-stat-resolved");
  if(!totalEl || !progressEl || !resolvedEl) return;
  try{
    const issues=await getIssues();
    const values={total:issues.length,progress:issues.filter(i=>i.status==="in_progress").length,resolved:issues.filter(i=>i.status==="resolved").length};
    const animate=(el,target)=>{
      const duration=700,start=performance.now();
      const tick=(now)=>{
        const p=Math.min((now-start)/duration,1);
        const eased=1-Math.pow(1-p,3);
        el.textContent=String(Math.round(target*eased));
        if(p<1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    animate(totalEl,values.total); animate(progressEl,values.progress); animate(resolvedEl,values.resolved);
  }catch(_err){
    totalEl.textContent="—"; progressEl.textContent="—"; resolvedEl.textContent="—";
  }
}
document.addEventListener("DOMContentLoaded", initHomePulse);
