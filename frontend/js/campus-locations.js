/* =========================================================
   campus-locations.js — real campus buildings for the report form's
   "Which campus?" dropdown.

   Coordinates are approximate (placed within the right block/street in
   Sector V or New Town from the official address), NOT surveyed exact
   points. Selecting one centers the map there with a draggable pin —
   drag it to the exact spot before submitting. If you have the real
   surveyed coordinates for any of these, just edit the numbers below.
   ========================================================= */
const CAMPUS_LOCATIONS = [
  {
    name: "IEM Gurukul Campus (College of Engineering)",
    address: "Y-12, EP Block, Sector V, Salt Lake, Kolkata 700091",
    lat: 22.574397,
    lng: 88.4337638,
  },
  {
    name: "IEM Ashram Building (IT & Admissions)",
    address: "GN-34/2, Street No. 27, GN Block, Sector V, Salt Lake, Kolkata 700091",
    lat: 22.569614,
    lng: 88.429407,
  },
  {
    name: "IEM Management House (Block-GP)",
    address: "D-1, Street No. 13, EP Block, Sector V, Salt Lake, Kolkata 700091",
    lat: 22.572777,
    lng: 88.437413,
  },
  {
    name: "IEM AI Campus (Kripa Bhawan)",
    address: "Kripa Bhawan, EP Block, Sector V, Salt Lake, Kolkata 700091",
    lat: 22.573636,
    lng: 88.434358,
  },
  {
    name: "UEM Kolkata Main Campus",
    address: "Plot III-B/5, Main Arterial Road, Action Area III, New Town, Kolkata 700160",
    lat: 22.559944,
    lng: 88.490029,
  },
];
