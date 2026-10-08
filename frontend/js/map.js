/* =========================================================
   map.js  –  Maps/Location module (Leaflet + OpenStreetMap)
   Owner: Ananya
   Exposes two functions for the rest of the team:
     initLocationPicker(...)  -> map where student clicks a spot
     showSavedLocation(...)   -> map showing an existing issue
   ========================================================= */

// Campus coordinates (same values as IEM_LAT / IEM_LNG in the backend's app.py).
// To change the starting view, edit the two numbers below.
const CAMPUS_CENTER = [22.5691, 88.4328]; // [latitude, longitude]
const DEFAULT_ZOOM = 17;
const MAX_ZOOM = 19;

/* ---------- Helper: check numbers are real coordinates ---------- */
function isValidCoordinate(lat, lng) {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

/* ---------- Helper: create a map with OpenStreetMap tiles ---------- */
function createBaseMap(mapId, center, zoom) {
  const map = L.map(mapId).setView(center, zoom);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: MAX_ZOOM,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  return map;
}

/* =========================================================
   PICKER: used on the "create issue" page
   options = {
     mapId:       "map",           // id of the <div> for the map
     latInputId:  "latitude",      // id of hidden input for latitude
     lngInputId:  "longitude",     // id of hidden input for longitude
     statusId:    "location-status"// id of text showing selection (optional)
     initialLocation: [lat, lng]   // optional, preload a marker
   }
   ========================================================= */
function initLocationPicker(options) {
  const map = createBaseMap(options.mapId, CAMPUS_CENTER, DEFAULT_ZOOM);
  const latInput = document.getElementById(options.latInputId);
  const lngInput = document.getElementById(options.lngInputId);
  const statusEl = options.statusId
    ? document.getElementById(options.statusId)
    : null;

  let marker = null; // only one marker ever exists

  // Save values into hidden inputs + update the text under the map
  function saveValues(lat, lng) {
    const latRounded = lat.toFixed(6);
    const lngRounded = lng.toFixed(6);
    latInput.value = latRounded;
    lngInput.value = lngRounded;
    if (statusEl) {
      statusEl.textContent = `Selected: ${latRounded}, ${lngRounded}`;
      statusEl.classList.remove("error");
    }
  }

  // Put (or move) the marker, and save the values
  function setLocation(lat, lng) {
    lat = Number(lat);
    lng = Number(lng);
    if (!isValidCoordinate(lat, lng)) return false;

    if (marker) {
      marker.setLatLng([lat, lng]); // move existing marker
    } else {
      marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      // Student can also drag the marker to fine-tune
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        saveValues(p.lat, p.lng);
      });
    }
    saveValues(lat, lng);
    return true;
  }

  // Clicking anywhere on the map selects / changes the location
  map.on("click", (e) => setLocation(e.latlng.lat, e.latlng.lng));

  // Optional: preload a location (e.g. when editing an issue)
  if (options.initialLocation) {
    const [lat, lng] = options.initialLocation;
    if (setLocation(lat, lng)) map.setView([lat, lng], DEFAULT_ZOOM);
  }

  // Functions other scripts can use
  return {
    map: map,
    setLocation: setLocation,
    hasLocation: () => latInput.value !== "" && lngInput.value !== "",
    getLocation: () => ({
      latitude: parseFloat(latInput.value),
      longitude: parseFloat(lngInput.value),
    }),
    clearLocation: () => {
      if (marker) { map.removeLayer(marker); marker = null; }
      latInput.value = "";
      lngInput.value = "";
      if (statusEl) statusEl.textContent = "No location selected yet.";
    },
    // Call this if the map sits inside a hidden tab/modal
    refresh: () => map.invalidateSize(),
  };
}

/* =========================================================
   VIEWER: show an existing issue's saved location
   showSavedLocation("map", 22.57, 88.43, "Broken fan")
   Returns the map, or null if coordinates are missing/invalid.
   ========================================================= */
function showSavedLocation(mapId, latitude, longitude, popupText) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  // Older issues might have no coordinates: show the campus instead
  if (latitude == null || longitude == null || !isValidCoordinate(lat, lng)) {
    createBaseMap(mapId, CAMPUS_CENTER, DEFAULT_ZOOM);
    return null;
  }

  const map = createBaseMap(mapId, [lat, lng], DEFAULT_ZOOM);
  const marker = L.marker([lat, lng]).addTo(map);
  if (popupText) marker.bindPopup(popupText).openPopup();
  return map;
}
