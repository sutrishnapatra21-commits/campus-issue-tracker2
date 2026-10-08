// ===== config.js : backend connection settings =====
// The project can be opened either through Flask (port 5000) or VS Code Live
// Server (usually port 5500). In Live Server mode, API calls go to Flask.
const API_BASE = (location.port === "5500" || location.port === "5501")
  ? "http://127.0.0.1:5000"
  : "";
const API_URL = API_BASE + "/api/issues";

// false = use the real Flask API
const USE_MOCK = false;
