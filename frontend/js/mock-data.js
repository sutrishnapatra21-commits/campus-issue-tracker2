// ===== mock-data.js : FAKE data for testing only. Delete/ignore once Flask API works. =====
// Values use the BACKEND's own format (lowercase status, lowercase category) so
// testing with USE_MOCK=true behaves exactly like the real API — use
// displayStatus()/displayCategory() from main.js when showing these to a user.
const MOCK_ISSUES = [
  {id:1,title:"Broken projector in Room 204",description:"The projector does not turn on. Classes are being disturbed.",category:"equipment",status:"reported",created_at:"2026-09-20",latitude:22.5726,longitude:88.4321,photo_url:"",admin_note:""},
  {id:2,title:"Loose wiring near canteen",description:"Exposed wires near the canteen entrance. Looks dangerous when it rains.",category:"safety",status:"in_progress",created_at:"2026-09-22",latitude:22.5729,longitude:88.4325,photo_url:"",admin_note:"Electrician assigned. Area cordoned off."},
  {id:3,title:"No Wi-Fi in library second floor",description:"Wi-Fi signal drops completely near the back shelves.",category:"wifi",status:"resolved",created_at:"2026-09-15",latitude:22.5722,longitude:88.4318,photo_url:"",admin_note:"Access point replaced on 25 Sept."},
  {id:4,title:"Water cooler leaking",description:"Water is pooling on the corridor floor, slippery.",category:"maintenance",status:"rejected",created_at:"2026-09-10",latitude:22.5731,longitude:88.4330,photo_url:"",admin_note:"Duplicate of an earlier report."}
];
