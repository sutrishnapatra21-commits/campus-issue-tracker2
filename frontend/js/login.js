// ===== login.js : login + register, tabbed, wired to the real backend =====
// The backend's users table has no username column — only email.

const loginMsg = document.getElementById("login-message");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

const tabLoginBtn = document.getElementById("tab-login-btn");
const tabRegisterBtn = document.getElementById("tab-register-btn");

function showMessage(text, type){
  loginMsg.className = "alert alert-" + type;
  loginMsg.textContent = text;
}
function clearMessage(){
  loginMsg.className = "hidden";
  loginMsg.textContent = "";
}

function switchTab(which){
  const loginActive = which === "login";
  tabLoginBtn.classList.toggle("active", loginActive);
  tabLoginBtn.setAttribute("aria-selected", String(loginActive));
  tabRegisterBtn.classList.toggle("active", !loginActive);
  tabRegisterBtn.setAttribute("aria-selected", String(!loginActive));
  loginForm.classList.toggle("hidden", !loginActive);
  registerForm.classList.toggle("hidden", loginActive);
  clearMessage();
}
tabLoginBtn.addEventListener("click", () => switchTab("login"));
tabRegisterBtn.addEventListener("click", () => switchTab("register"));

function redirectAfterLogin(user){
  if (user && user.role === "admin") {
    sessionStorage.removeItem("pendingIssue");
    location.href = "admin.html";
    return;
  }
  // A report typed before logging in waits here — send the student back
  // to report-issue.html, which notices it and submits it automatically.
  if (sessionStorage.getItem("pendingIssue")) {
    location.href = "report-issue.html";
    return;
  }
  location.href = "issues.html";
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  if(!email || !password){ showMessage("Enter both email and password.", "error"); return; }

  try{
    const response = await fetch(API_BASE + "/api/login", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({email, password}),
      credentials: "include",
    });
    const data = await response.json().catch(() => ({}));
    if(!response.ok || !data.ok){ showMessage(data.error || "Login failed.", "error"); return; }
    redirectAfterLogin(data.user);
  }catch(err){
    showMessage("Could not reach the server: " + err.message, "error");
  }
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();
  // NOTE: deliberately using getElementById, not registerForm.name /
  // registerForm.email etc. A form field named "name" collides with the
  // <form> element's own built-in .name property in the DOM, so
  // registerForm.name would silently return the FORM's name (empty),
  // not this input — crashing the handler before anything is sent.
  const name = document.getElementById("register-name").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;
  const confirm_password = document.getElementById("register-confirm").value;

  if(!name || !email || !password || !confirm_password){
    showMessage("All fields are required.", "error"); return;
  }
  if(password !== confirm_password){
    showMessage("Passwords do not match.", "error"); return;
  }

  try{
    const response = await fetch(API_BASE + "/api/register", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({name, email, password, confirm_password}),
      credentials: "include",
    });
    const data = await response.json().catch(() => ({}));
    if(!response.ok || !data.ok){ showMessage(data.error || "Registration failed.", "error"); return; }

    // /api/register creates the account but does NOT start a session
    // (only /api/login does) — so log the new student in right away
    // rather than leaving them on the form after a successful signup.
    const loginResponse = await fetch(API_BASE + "/api/login", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({email, password}),
      credentials: "include",
    });
    const loginData = await loginResponse.json().catch(() => ({}));
    if(!loginResponse.ok || !loginData.ok){
      // Extremely unlikely (would mean register succeeded but login
      // with the same credentials failed) — send them to log in manually.
      showMessage("Account created. Please log in.", "success");
      switchTab("login");
      return;
    }
    redirectAfterLogin(loginData.user);
  }catch(err){
    showMessage("Could not reach the server: " + err.message, "error");
  }
});
