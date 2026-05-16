// src/firebase.js
// ─────────────────────────────────────────────────────────────────
// SETUP INSTRUCTIONS:
// 1. Go to https://console.firebase.google.com
// 2. Click "Add project" → name it "noodle-tracker" → Continue
// 3. Disable Google Analytics → Create project
// 4. Click "Build" → "Realtime Database" → "Create database"
//    Choose "Start in test mode" → Enable
// 5. Click the gear icon → "Project settings" → "Your apps"
// 6. Click </> (Web) → Register app → copy the firebaseConfig below
// 7. Replace the placeholder values below with your real config
// ─────────────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, get } from "firebase/database";

const firebaseConfig = {
  apiKey:            "AIzaSyCSpTz1NNiWBjsbVvsEP_OFwGbi2xlOjns",
  authDomain:        "noodle-tracker-a1840.firebaseapp.com",
  databaseURL:       "https://noodle-tracker-a1840-default-rtdb.firebaseio.com",
  projectId:         "noodle-tracker-a1840",
  storageBucket:     "noodle-tracker-a1840.firebasestorage.app",
  messagingSenderId: "1006750763456",
  appId:             "1:1006750763456:web:5fb1f0195dd4371c152025",
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

const DATA_PATH = "noodle_tracker_v1";

export async function loadData() {
  const snapshot = await get(ref(db, DATA_PATH));
  return snapshot.exists() ? snapshot.val() : null;
}

export async function saveData(data) {
  await set(ref(db, DATA_PATH), data);
}

export function subscribeToData(callback) {
  const r = ref(db, DATA_PATH);
  const unsub = onValue(r, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null);
  });
  return unsub; // call this to unsubscribe
}
