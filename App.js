import { useState, useEffect, useCallback, useRef } from "react";
import { loadData, saveData, subscribeToData } from "./firebase";

// -- DATA ----------------------------------------------------------------------
const PHASES = [
  {
    id: "phase1", label: "0-3 Months", color: "#e8845c", emoji: "\u{1F331}", weeks: "8-12 weeks",
    tasks: [
      { id: "p1_1", category: "Feeding",       text: "Feed 3x/day (puppy kibble, small breed)",     frequency: "daily" },
      { id: "p1_2", category: "Potty",         text: "Potty break every 1-2 hours",                 frequency: "daily" },
      { id: "p1_3", category: "Training",      text: "Crate training session",                       frequency: "daily" },
      { id: "p1_4", category: "Training",      text: "Name recognition & 'sit' practice",            frequency: "daily" },
      { id: "p1_5", category: "Socialization", text: "Expose to new sounds/surfaces/people",         frequency: "daily" },
      { id: "p1_6", category: "Grooming",      text: "Brush coat (2-3x/week)",                       frequency: "weekly" },
      { id: "p1_7", category: "Play",          text: "Gentle play session (5-10 min)",               frequency: "daily" },
      { id: "p1_8", category: "Health",        text: "Handle paws, ears, mouth for desensitization", frequency: "daily" },
    ],
  },
  {
    id: "phase2", label: "3-6 Months", color: "#7cb87c", emoji: "\u{1F33F}", weeks: "3-6 months",
    tasks: [
      { id: "p2_1", category: "Feeding",  text: "Transition to 2-3 meals/day",              frequency: "daily" },
      { id: "p2_2", category: "Exercise", text: "Low-impact walk (15-20 min) -- no jumping", frequency: "daily" },
      { id: "p2_3", category: "Training", text: "Practice 'stay', 'leave it', 'down'",      frequency: "daily" },
      { id: "p2_4", category: "Training", text: "Leash manners practice",                   frequency: "daily" },
      { id: "p2_5", category: "Health",   text: "Complete vaccination series",               frequency: "milestone" },
      { id: "p2_6", category: "Health",   text: "Spay/neuter vet consultation",              frequency: "milestone" },
      { id: "p2_7", category: "Grooming", text: "Daily brushing (coat growing in)",          frequency: "daily" },
      { id: "p2_8", category: "Grooming", text: "Nail trim & ear cleaning",                  frequency: "weekly" },
    ],
  },
  {
    id: "phase3", label: "6-12 Months", color: "#6b9fc4", emoji: "\u{1F333}", weeks: "6-12 months",
    tasks: [
      { id: "p3_1", category: "Feeding",    text: "2 meals/day",                               frequency: "daily" },
      { id: "p3_2", category: "Exercise",   text: "2x daily walks (20-30 min each)",           frequency: "daily" },
      { id: "p3_3", category: "Enrichment", text: "Puzzle feeder or sniff walk",               frequency: "daily" },
      { id: "p3_4", category: "Training",   text: "Reinforce all commands (5-10 min session)", frequency: "daily" },
      { id: "p3_5", category: "Training",   text: "Recall practice in fenced area",            frequency: "weekly" },
      { id: "p3_6", category: "Health",     text: "Transition to adult food (~10-12 months)",  frequency: "milestone" },
      { id: "p3_7", category: "Health",     text: "Annual vet visit + boosters",               frequency: "milestone" },
      { id: "p3_8", category: "Grooming",   text: "Professional grooming every 6-8 weeks",    frequency: "weekly" },
    ],
  },
];

const ALL_TASKS = PHASES.flatMap((p) => p.tasks);

const FEEDING_MEALS = {
  phase1: ["\u{1F37D} Morning meal", "\u{1F37D} Afternoon meal", "\u{1F37D} Evening meal"],
  phase2: ["\u{1F37D} Morning meal", "\u{1F37D} Midday meal", "\u{1F37D} Evening meal"],
  phase3: ["\u{1F37D} Morning meal", "\u{1F37D} Evening meal"],
};

const CAT_COLORS = {
  Feeding: "#e8845c", Potty: "#c4a96b", Training: "#7cb87c",
  Socialization: "#c47cb8", Grooming: "#6b9fc4", Play: "#e8c45c",
  Health: "#e87c7c", Exercise: "#7cb8b8", Enrichment: "#9c7cb8",
};

const TIPS = [
  "\u{1F9B4} Use ramps instead of stairs -- protect that long spine!",
  "\u{2696} Even a little extra weight stresses the back.",
  "\u{1F9AE} Always use a harness, never a collar, on walks.",
  "\u{2702} Brush behind ears & legs daily to prevent matting.",
  "\u{1F6CB} Pet steps prevent dangerous jumps off furniture.",
  "\u{1F9E0} Keep sessions short (5-10 min) -- dachshunds bore easily!",
];

const USER_COLORS  = ["#e8845c", "#6b9fc4", "#9c7cb8", "#7cb87c", "#c4a96b", "#e87c7c"];
const USER_AVATARS = ["\u{1F43E}", "\u{1F9B4}", "\u{1F436}", "\u{1F415}", "\u{1F338}", "\u{2B50}"];
const DAYS   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const LS_ID     = "noodle_uid";
const LS_NAME   = "noodle_name";
const LS_COLOR  = "noodle_color";
const LS_AVATAR = "noodle_avatar";

function ls(key)        { try { return localStorage.getItem(key); } catch { return null; } }
function lsSet(k, v)    { try { localStorage.setItem(k, v); } catch {} }
function dateKey(d)     { return d.toDateString(); }
function isFriday(ds)   { return new Date(ds).getDay() === 5; }
function shouldShow(t, ds) { return t.frequency === "weekly" ? isFriday(ds) : true; }

// -- PURE HELPERS -------------------------------------------------------------
function mealKey(tid, i, ds, uid) { return `${tid}_meal${i}_${ds}_${uid}`; }
function whoCheckedMeal(comp, users, tid, i, ds) {
  return Object.entries(users || {})
    .filter(([uid]) => comp?.[mealKey(tid, i, ds, uid)])
    .map(([uid, u]) => ({ uid, ...u }));
}
function isFeedingDone(comp, users, tid, phaseId, ds) {
  const meals = FEEDING_MEALS[phaseId] || [];
  return meals.length > 0 && meals.every((_, i) => whoCheckedMeal(comp, users, tid, i, ds).length > 0);
}
function whoChecked(comp, users, tid, ds) {
  return Object.entries(users || {})
    .filter(([uid]) => comp?.[`${tid}_${ds}_${uid}`])
    .map(([uid, u]) => ({ uid, ...u }));
}
function isChecked(comp, tid, ds, uid) { return !!comp?.[`${tid}_${ds}_${uid}`]; }

// -- FEEDING ROW ---------------------------------------------------------------
function FeedingTaskRow({ task, phase, dateStr, shared, userId, userColor, onToggleMeal, onSaveNote }) {
  const [open, setOpen] = useState(false);
  const [editNote, setEditNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const comp  = shared?.completions || {};
  const users = shared?.users || {};
  const meals = FEEDING_MEALS[phase.id] || [];
  const done  = isFeedingDone(comp, users, task.id, phase.id, dateStr);
  const doneCount = meals.filter((_, i) => whoCheckedMeal(comp, users, task.id, i, dateStr).length > 0).length;
  const note = shared?.notes?.[task.id];

  return (
    <div style={{ background: done ? `${phase.color}15` : "#fff", border: `1.5px solid ${done ? phase.color : "#e8ddd0"}`, borderRadius: 10, marginBottom: 5, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "10px 11px" }}>
        <button onClick={() => setOpen((o) => !o)} style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0, marginTop: 1, border: `2px solid ${done ? phase.color : "#c4b09a"}`, background: done ? phase.color : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: done ? "#fff" : "#7a5c3a" }}>
          {done ? "\u{2713}" : open ? "\u{25B2}" : "\u{25BC}"}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: done ? "#7a5c3a" : "#3d2b1f", fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
            <span>{task.text}</span>
            <span style={{ fontSize: 10, background: done ? phase.color : "#e8ddd0", color: done ? "#fff" : "#7a5c3a", borderRadius: 8, padding: "1px 7px", fontWeight: "bold" }}>{doneCount}/{meals.length}</span>
          </div>
          <div style={{ fontSize: 10, color: "#b09070", marginTop: 1 }}>\u{1F4C5} Daily -- <span style={{ color: "#e8845c" }}>tap to log each meal</span></div>
          {note && !editNote && <div style={{ marginTop: 5, fontSize: 11, color: "#7a5c3a", background: "#fdf0e0", borderRadius: 5, padding: "3px 7px", fontStyle: "italic" }}>\u{1F4DD} {note.text} <span style={{ color: "#b09070" }}>-- {note.byName}</span></div>}
          {editNote && (
            <div style={{ marginTop: 6, display: "flex", gap: 5 }}>
              <input value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (onSaveNote(task.id, noteText), setEditNote(false))} placeholder="Add a shared note\u{2026}" style={{ flex: 1, padding: "4px 7px", borderRadius: 5, border: "1px solid #c4b09a", fontFamily: "Georgia, serif", fontSize: 11, background: "#fff8f0" }} />
              <button onClick={() => { onSaveNote(task.id, noteText); setEditNote(false); }} style={{ background: phase.color, color: "#fff", border: "none", borderRadius: 5, padding: "4px 9px", cursor: "pointer", fontSize: 11 }}>Save</button>
              <button onClick={() => setEditNote(false)} style={{ background: "#e8ddd0", color: "#7a5c3a", border: "none", borderRadius: 5, padding: "4px 7px", cursor: "pointer", fontSize: 11 }}>\u{2715}</button>
            </div>
          )}
        </div>
        <button onClick={() => { setEditNote(true); setNoteText(note?.text || ""); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, opacity: 0.35, padding: 2, flexShrink: 0 }}>\u{1F4DD}</button>
      </div>
      {open && (
        <div style={{ borderTop: `1px solid ${phase.color}30`, background: `${phase.color}08`, padding: "8px 11px 10px" }}>
          {meals.map((label, i) => {
            const myMeal = !!comp[mealKey(task.id, i, dateStr, userId)];
            const checkers = whoCheckedMeal(comp, users, task.id, i, dateStr);
            const anyDone = checkers.length > 0;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 9px", marginBottom: i < meals.length - 1 ? 5 : 0, background: anyDone ? `${phase.color}20` : "rgba(255,255,255,0.7)", borderRadius: 8, border: `1px solid ${anyDone ? phase.color : "#e8ddd0"}` }}>
                <button onClick={() => onToggleMeal(task.id, i, dateStr)} style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0, border: `2px solid ${myMeal ? userColor : "#c4b09a"}`, background: myMeal ? userColor : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff" }}>{myMeal ? "\u{2713}" : ""}</button>
                <span style={{ flex: 1, fontSize: 12, color: anyDone ? "#7a5c3a" : "#3d2b1f" }}>{label}</span>
                {checkers.map((u) => <span key={u.uid} style={{ background: u.color, color: "#fff", borderRadius: 8, padding: "1px 6px", fontSize: 9, fontWeight: "bold" }}>{u.avatar} {u.uid === userId ? "You" : u.name}</span>)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// -- REGULAR ROW ---------------------------------------------------------------
function RegularTaskRow({ task, phase, dateStr, shared, userId, userColor, allUsers, onToggleTask, onSaveNote }) {
  const [editNote, setEditNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const comp     = shared?.completions || {};
  const users    = shared?.users || {};
  const myCheck  = isChecked(comp, task.id, dateStr, userId);
  const checkers = whoChecked(comp, users, task.id, dateStr);
  const anyDone  = checkers.length > 0;
  const note     = shared?.notes?.[task.id];

  return (
    <div style={{ background: anyDone ? `${phase.color}15` : "#fff", border: `1.5px solid ${anyDone ? phase.color : "#e8ddd0"}`, borderRadius: 10, padding: "10px 11px", marginBottom: 5 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
        <button onClick={() => onToggleTask(task.id, dateStr)} style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0, marginTop: 1, border: `2px solid ${myCheck ? userColor : "#c4b09a"}`, background: myCheck ? userColor : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff" }}>{myCheck ? "\u{2713}" : ""}</button>
        <div style={{ flex: 1 }}>
          <div style={{ color: anyDone ? "#7a5c3a" : "#3d2b1f", fontSize: 13, textDecoration: anyDone && checkers.length === allUsers.length ? "line-through" : "none" }}>{task.text}</div>
          <div style={{ fontSize: 10, color: "#b09070", marginTop: 1 }}>{task.frequency === "milestone" ? "\u{2B50} Milestone" : task.frequency === "weekly" ? "\u{1F501} Weekly" : "\u{1F4C5} Daily"}</div>
          {checkers.length > 0 && <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>{checkers.map((u) => <span key={u.uid} style={{ background: u.color, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: "bold" }}>{u.avatar} {u.uid === userId ? "You" : u.name}</span>)}</div>}
          {note && !editNote && <div style={{ marginTop: 5, fontSize: 11, color: "#7a5c3a", background: "#fdf0e0", borderRadius: 5, padding: "3px 7px", fontStyle: "italic" }}>\u{1F4DD} {note.text} <span style={{ color: "#b09070" }}>-- {note.byName}</span></div>}
          {editNote && (
            <div style={{ marginTop: 6, display: "flex", gap: 5 }}>
              <input value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (onSaveNote(task.id, noteText), setEditNote(false))} placeholder="Add a shared note\u{2026}" style={{ flex: 1, padding: "4px 7px", borderRadius: 5, border: "1px solid #c4b09a", fontFamily: "Georgia, serif", fontSize: 11, background: "#fff8f0" }} />
              <button onClick={() => { onSaveNote(task.id, noteText); setEditNote(false); }} style={{ background: phase.color, color: "#fff", border: "none", borderRadius: 5, padding: "4px 9px", cursor: "pointer", fontSize: 11 }}>Save</button>
              <button onClick={() => setEditNote(false)} style={{ background: "#e8ddd0", color: "#7a5c3a", border: "none", borderRadius: 5, padding: "4px 7px", cursor: "pointer", fontSize: 11 }}>\u{2715}</button>
            </div>
          )}
        </div>
        <button onClick={() => { setEditNote(true); setNoteText(note?.text || ""); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, opacity: 0.35, padding: 2, flexShrink: 0 }}>\u{1F4DD}</button>
      </div>
    </div>
  );
}

// -- TASK LIST -----------------------------------------------------------------
function TaskList({ dateStr, phase, shared, userId, userColor, allUsers, syncing, onToggleTask, onToggleMeal, onSaveNote }) {
  const comp  = shared?.completions || {};
  const users = shared?.users || {};
  const visible = phase.tasks.filter((t) => shouldShow(t, dateStr));
  const hidden  = phase.tasks.filter((t) => t.frequency === "weekly" && !isFriday(dateStr));
  const done    = visible.filter((t) => t.category === "Feeding" ? isFeedingDone(comp, users, t.id, phase.id, dateStr) : allUsers.some(([uid]) => isChecked(comp, t.id, dateStr, uid))).length;
  const rp = { shared, userId, userColor, allUsers, onToggleTask, onToggleMeal, onSaveNote };

  return (
    <div style={{ padding: "14px 13px 0", maxWidth: 600, margin: "0 auto" }}>
      <div style={{ background: phase.color, borderRadius: 14, padding: "11px 15px", marginBottom: 13, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 26 }}>{phase.emoji}</span>
        <div><div style={{ color: "#fff", fontWeight: "bold", fontSize: 15 }}>{phase.label}</div><div style={{ color: "rgba(255,255,255,0.85)", fontSize: 11 }}>{phase.weeks}</div></div>
        <div style={{ marginLeft: "auto", textAlign: "center", background: "rgba(255,255,255,0.22)", borderRadius: 10, padding: "4px 11px" }}>
          <div style={{ color: "#fff", fontWeight: "bold", fontSize: 18 }}>{done}/{visible.length}</div>
          <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 9 }}>done</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {allUsers.map(([uid, u]) => (
          <div key={uid} style={{ display: "flex", alignItems: "center", gap: 5, background: uid === userId ? u.color : "rgba(0,0,0,0.06)", borderRadius: 20, padding: "3px 10px 3px 6px", border: `1.5px solid ${u.color}` }}>
            <span style={{ fontSize: 14 }}>{u.avatar}</span>
            <span style={{ fontSize: 11, color: uid === userId ? "#fff" : "#5c3d2a", fontWeight: uid === userId ? "bold" : "normal" }}>{uid === userId ? "You" : u.name}</span>
          </div>
        ))}
        {syncing && <span style={{ fontSize: 10, color: "#b09070", alignSelf: "center" }}>\u{27F3} syncing\u{2026}</span>}
      </div>

      {hidden.length > 0 && (
        <div style={{ background: "#f8f4ec", border: "1.5px dashed #c4a96b", borderRadius: 10, padding: "8px 12px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>\u{1F4C5}</span>
          <div style={{ fontSize: 11, color: "#7a5c3a" }}><strong>{hidden.length} weekly task{hidden.length > 1 ? "s" : ""}</strong> appear on <strong>Fridays</strong> only.</div>
        </div>
      )}

      {Array.from(new Set(visible.map((t) => t.category))).map((cat) => (
        <div key={cat} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: CAT_COLORS[cat] || "#999" }} />
            <span style={{ fontSize: 10, fontWeight: "bold", letterSpacing: "1.5px", color: "#7a5c3a", textTransform: "uppercase" }}>{cat}</span>
          </div>
          {visible.filter((t) => t.category === cat).map((task) =>
            task.category === "Feeding"
              ? <FeedingTaskRow key={task.id} task={task} phase={phase} dateStr={dateStr} {...rp} />
              : <RegularTaskRow key={task.id} task={task} phase={phase} dateStr={dateStr} {...rp} />
          )}
        </div>
      ))}

      <div style={{ background: "#fff8f0", border: "1.5px solid #e8845c", borderRadius: 11, padding: "10px 12px", marginTop: 4, display: "flex", gap: 9, alignItems: "flex-start" }}>
        <span style={{ fontSize: 17 }}>\u{26A0}</span>
        <div style={{ color: "#7a5c3a", fontSize: 11, lineHeight: 1.5 }}><strong style={{ color: "#3d2b1f" }}>Spine Protection:</strong> Always use ramps. No jumping. Harness on walks.</div>
      </div>
      <div style={{ height: 28 }} />
    </div>
  );
}

// -- APP -----------------------------------------------------------------------
export default function App() {
  const savedId     = ls(LS_ID);
  const savedName   = ls(LS_NAME);
  const savedColor  = ls(LS_COLOR)  || USER_COLORS[0];
  const savedAvatar = ls(LS_AVATAR) || USER_AVATARS[0];

  const [userId,    setUserId]    = useState(savedId   || null);
  const [userName,  setUserName]  = useState(savedName || "");
  const [userColor, setUserColor] = useState(savedColor);
  const [setupDone, setSetupDone] = useState(!!(savedId && savedName));
  const [nameInput, setNameInput] = useState("");

  const [shared,  setShared]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [view,        setView]        = useState("today");
  const [activePhase, setActivePhase] = useState("phase1");
  const [calMonth,    setCalMonth]    = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayPhase,    setDayPhase]    = useState("phase1");
  const [tipIdx,      setTipIdx]      = useState(0);
  const [dogNameInput,setDogNameInput]= useState("Noodle");
  const [editDogName, setEditDogName] = useState(false);
  const [editNameInput,setEditNameInput] = useState("");

  // Tips rotation
  useEffect(() => {
    const t = setInterval(() => setTipIdx((i) => (i + 1) % TIPS.length), 5000);
    return () => clearInterval(t);
  }, []);

  // Subscribe to Firebase in real-time
  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToData((data) => {
      if (data) {
        setShared(data);
        if (data.dogName) setDogNameInput(data.dogName);
      } else {
        setShared({ users: {}, completions: {}, notes: {}, dogName: "Noodle" });
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Re-register returning user in shared state
  useEffect(() => {
    if (!setupDone || !userId || !shared) return;
    if (!shared.users?.[userId]) {
      const next = { ...shared, users: { ...(shared.users || {}), [userId]: { name: userName, color: userColor, avatar: savedAvatar, lastSeen: new Date().toISOString() } } };
      setShared(next);
      saveData(next).catch(console.error);
    }
  }, [shared, setupDone]);

  const getBase = () => shared || { users: {}, completions: {}, notes: {}, dogName: dogNameInput };

  const persist = useCallback((next) => {
    setSyncing(true);
    saveData(next).catch(console.error).finally(() => setSyncing(false));
  }, []);

  // -- SETUP ----------------------------------------------------------------
  const handleSetup = async () => {
    const name = nameInput.trim();
    if (!name) return;
    const id       = `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const colorIdx = Object.keys(shared?.users || {}).length % USER_COLORS.length;
    const color    = USER_COLORS[colorIdx];
    const avatar   = USER_AVATARS[colorIdx];
    setUserId(id); setUserName(name); setUserColor(color); setSetupDone(true);
    lsSet(LS_ID, id); lsSet(LS_NAME, name); lsSet(LS_COLOR, color); lsSet(LS_AVATAR, avatar);
    const base = getBase();
    const next = { ...base, users: { ...(base.users || {}), [id]: { name, color, avatar, lastSeen: new Date().toISOString() } } };
    setShared(next);
    await saveData(next);
  };

  // -- ACTIONS ---------------------------------------------------------------
  const handleToggleTask = useCallback((taskId, ds) => {
    const base = getBase();
    const key  = `${taskId}_${ds}_${userId}`;
    const next = { ...base, completions: { ...(base.completions || {}), [key]: !(base.completions || {})[key] }, users: { ...(base.users || {}), [userId]: { ...(base.users || {})[userId], lastSeen: new Date().toISOString() } } };
    setShared(next); persist(next);
  }, [shared, userId]);

  const handleToggleMeal = useCallback((taskId, mealIdx, ds) => {
    const base = getBase();
    const key  = mealKey(taskId, mealIdx, ds, userId);
    const next = { ...base, completions: { ...(base.completions || {}), [key]: !(base.completions || {})[key] }, users: { ...(base.users || {}), [userId]: { ...(base.users || {})[userId], lastSeen: new Date().toISOString() } } };
    setShared(next); persist(next);
  }, [shared, userId]);

  const handleSaveNote = useCallback((taskId, text) => {
    const base = getBase();
    const next = { ...base, notes: { ...(base.notes || {}), [taskId]: { text, by: userId, byName: userName } } };
    setShared(next); persist(next);
  }, [shared, userId, userName]);

  const handleChangeName = () => {
    const name = editNameInput.trim();
    if (!name) return;
    setUserName(name); lsSet(LS_NAME, name);
    const base = getBase();
    const next = { ...base, users: { ...(base.users || {}), [userId]: { ...(base.users || {})[userId], name, lastSeen: new Date().toISOString() } } };
    setShared(next); persist(next); setEditNameInput("");
  };

  const saveDogName = () => {
    const name = dogNameInput.trim() || "Noodle";
    setDogNameInput(name); setEditDogName(false);
    const next = { ...getBase(), dogName: name };
    setShared(next); persist(next);
  };

  // -- DERIVED ---------------------------------------------------------------
  const allUsers    = Object.entries(shared?.users || {});
  const dogName     = dogNameInput || "Noodle";
  const comp        = shared?.completions || {};
  const users       = shared?.users || {};

  const phaseProgress = (phase, ds) => {
    if (!allUsers.length) return 0;
    const vis = phase.tasks.filter((t) => shouldShow(t, ds));
    if (!vis.length) return 0;
    const done = vis.filter((t) => t.category === "Feeding" ? isFeedingDone(comp, users, t.id, phase.id, ds) : allUsers.some(([uid]) => isChecked(comp, t.id, ds, uid))).length;
    return Math.round((done / vis.length) * 100);
  };

  const dayRatio = (ds) => {
    if (!allUsers.length) return 0;
    const vis = PHASES.flatMap((ph) => ph.tasks.filter((t) => shouldShow(t, ds)));
    if (!vis.length) return 0;
    const done = vis.filter((t) => { const ph = PHASES.find((p) => p.tasks.includes(t)); return t.category === "Feeding" ? isFeedingDone(comp, users, t.id, ph?.id, ds) : allUsers.some(([uid]) => isChecked(comp, t.id, ds, uid)); }).length;
    return done / vis.length;
  };

  const tlProps = { shared, userId, userColor, allUsers, syncing, onToggleTask: handleToggleTask, onToggleMeal: handleToggleMeal, onSaveNote: handleSaveNote };

  // -- SETUP SCREEN ----------------------------------------------------------
  if (!setupDone) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#3d2b1f 0%,#5c3d2a 60%,#7a5c3a 100%)", fontFamily: "Georgia, serif", padding: 24 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>\u{1F43E}</div>
        <h1 style={{ color: "#fdf6ec", fontSize: 24, margin: "0 0 6px", textAlign: "center" }}>Noodle Puppy Tracker</h1>
        <p style={{ color: "#c4a477", margin: "0 0 32px", fontSize: 14, textAlign: "center" }}>Shared with your co-parent -- real-time sync!</p>
        {loading ? <div style={{ color: "#c4a477" }}>Loading\u{2026}</div> : (
          <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 340, border: "1px solid rgba(255,255,255,0.15)" }}>
            {Object.values(shared?.users || {}).length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ color: "#c4a477", fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>Already joined</div>
                {Object.values(shared.users).map((u) => (
                  <div key={u.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 20 }}>{u.avatar}</span>
                    <span style={{ color: "#fdf6ec", fontSize: 14 }}>{u.name}</span>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: u.color, marginLeft: "auto" }} />
                  </div>
                ))}
              </div>
            )}
            <div style={{ color: "#c4a477", fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>Your name</div>
            <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSetup()} placeholder="e.g. Mom, Dad, Alex\u{2026}" autoFocus style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "none", fontFamily: "Georgia, serif", fontSize: 15, background: "rgba(255,255,255,0.12)", color: "#fdf6ec", outline: "none", boxSizing: "border-box", marginBottom: 16 }} />
            <button onClick={handleSetup} disabled={!nameInput.trim()} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "none", background: nameInput.trim() ? "#e8845c" : "rgba(255,255,255,0.1)", color: "#fff", cursor: nameInput.trim() ? "pointer" : "default", fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold" }}>Join Tracker \u{2192}</button>
          </div>
        )}
      </div>
    );
  }

  // -- MAIN UI ---------------------------------------------------------------
  const today = new Date();
  const tStr  = dateKey(today);
  const curPhase   = PHASES.find((p) => p.id === activePhase);
  const firstDay   = new Date(calMonth.year, calMonth.month, 1).getDay();
  const daysInMonth = new Date(calMonth.year, calMonth.month + 1, 0).getDate();

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#fdf6ec 0%,#f0e8d8 100%)", fontFamily: "Georgia, serif" }}>

      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg,#3d2b1f 0%,#5c3d2a 100%)", padding: "18px 18px 13px", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 2 }}>\u{1F43E}</div>
        {editDogName ? (
          <div style={{ display: "flex", justifyContent: "center", gap: 7, marginBottom: 3, flexWrap: "wrap" }}>
            <input value={dogNameInput} onChange={(e) => setDogNameInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveDogName(); if (e.key === "Escape") setEditDogName(false); }} placeholder="Puppy's name" style={{ padding: "8px 14px", borderRadius: 18, border: "2px solid #e8845c", fontFamily: "Georgia, serif", fontSize: 15, background: "#fff8f0", minWidth: 160, outline: "none" }} />
            <button onClick={saveDogName} style={{ background: "#e8845c", color: "#fff", border: "none", borderRadius: 18, padding: "8px 18px", cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold" }}>Save</button>
            <button onClick={() => setEditDogName(false)} style={{ background: "rgba(255,255,255,0.15)", color: "#fdf6ec", border: "none", borderRadius: 18, padding: "8px 14px", cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 14 }}>\u{2715}</button>
          </div>
        ) : (
          <h1 onClick={() => setEditDogName(true)} style={{ color: "#fdf6ec", fontSize: 19, fontWeight: "bold", margin: "0 0 2px", cursor: "pointer" }}>{dogName}'s Journey <span style={{ fontSize: 11, color: "#c4a477" }}>\u{270F}</span></h1>
        )}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {allUsers.map(([uid, u]) => (
            <div key={uid} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.12)", borderRadius: 12, padding: "2px 9px" }}>
              <span style={{ fontSize: 13 }}>{u.avatar}</span>
              <span style={{ color: uid === userId ? userColor : "#c4a477", fontSize: 11, fontWeight: uid === userId ? "bold" : "normal" }}>{uid === userId ? `${u.name} (you)` : u.name}</span>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: u.color }} />
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "#fdf6ec", background: "rgba(255,255,255,0.1)", borderRadius: 9, padding: "5px 11px", display: "inline-block" }}>{TIPS[tipIdx]}</div>
      </div>

      {/* NAV */}
      <div style={{ display: "flex", background: "#3d2b1f" }}>
        {[["today","\u{1F4CB}","Today"],["calendar","\u{1F4C5}","Calendar"],["account","\u{1F464}","Account"]].map(([v, icon, label]) => (
          <button key={v} onClick={() => setView(v)} style={{ flex: 1, padding: "8px", background: v === view || (v === "calendar" && view === "day") ? "#e8845c" : "transparent", color: "#fff", border: "none", cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 11, fontWeight: v === view || (v === "calendar" && view === "day") ? "bold" : "normal", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <span style={{ fontSize: 15 }}>{icon}</span><span>{label}</span>
          </button>
        ))}
      </div>

      {/* TODAY */}
      {view === "today" && (<>
        <div style={{ display: "flex", background: "#f0e8d8", overflowX: "auto" }}>
          {PHASES.map((p) => { const prog = phaseProgress(p, tStr); const active = activePhase === p.id; return (
            <button key={p.id} onClick={() => setActivePhase(p.id)} style={{ flex: 1, minWidth: 86, padding: "8px 4px", background: active ? p.color : "transparent", color: active ? "#fff" : "#7a5c3a", border: "none", cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 11, fontWeight: active ? "bold" : "normal", borderBottom: active ? "3px solid #3d2b1f" : "3px solid transparent" }}>
              <div style={{ fontSize: 16 }}>{p.emoji}</div><div>{p.label}</div>
              <div style={{ height: 3, background: "rgba(0,0,0,0.1)", borderRadius: 2, margin: "2px 4px 0", overflow: "hidden" }}><div style={{ height: "100%", width: `${prog}%`, background: active ? "rgba(255,255,255,0.8)" : p.color }} /></div>
              <div style={{ fontSize: 9, marginTop: 1, opacity: 0.8 }}>{prog}% today</div>
            </button>
          ); })}
        </div>
        <TaskList dateStr={tStr} phase={curPhase} {...tlProps} />
      </>)}

      {/* CALENDAR */}
      {view === "calendar" && (
        <div style={{ padding: "13px", maxWidth: 600, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button onClick={() => setCalMonth((m) => { const d = new Date(m.year, m.month - 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })} style={{ background: "#e8ddd0", border: "none", borderRadius: 8, padding: "5px 13px", cursor: "pointer", fontSize: 17 }}>\u{2039}</button>
            <div style={{ fontWeight: "bold", color: "#3d2b1f", fontSize: 15 }}>{MONTHS[calMonth.month]} {calMonth.year}</div>
            <button onClick={() => setCalMonth((m) => { const d = new Date(m.year, m.month + 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })} style={{ background: "#e8ddd0", border: "none", borderRadius: 8, padding: "5px 13px", cursor: "pointer", fontSize: 17 }}>\u{203A}</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 2 }}>{DAYS.map((d) => <div key={d} style={{ textAlign: "center", fontSize: 10, color: "#9a7a5a", fontWeight: "bold" }}>{d}</div>)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {[...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)].map((d, i) => {
              if (!d) return <div key={`e${i}`} />;
              const cd = new Date(calMonth.year, calMonth.month, d);
              const ds = dateKey(cd);
              const ratio = dayRatio(ds);
              const isToday = ds === tStr;
              const fut = cd > today;
              let bg = "#fff";
              if (!fut && ratio > 0) bg = ratio >= 0.8 ? "#7cb87c" : ratio >= 0.4 ? "#e8c45c" : "#f0d0c0";
              if (fut) bg = "#f8f4f0";
              return (
                <button key={d} onClick={() => !fut && (setSelectedDay(new Date(calMonth.year, calMonth.month, d)), setDayPhase(activePhase), setView("day"))} style={{ background: bg, border: isToday ? "2px solid #e8845c" : "1.5px solid #e8ddd0", borderRadius: 7, padding: "4px 2px", cursor: fut ? "default" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, minHeight: 38 }}>
                  <span style={{ fontSize: 11, fontWeight: isToday ? "bold" : "normal", color: isToday ? "#e8845c" : fut ? "#c4b09a" : "#3d2b1f" }}>{d}</span>
                  {!fut && ratio > 0 && <span style={{ fontSize: 8, color: ratio >= 0.8 ? "#fff" : "#7a5c3a", fontWeight: "bold" }}>{Math.round(ratio * 100)}%</span>}
                  {isToday && <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#e8845c", display: "block" }} />}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 9, marginTop: 12, justifyContent: "center", flexWrap: "wrap" }}>
            {[["#7cb87c","80%+ done"],["#e8c45c","40-79%"],["#f0d0c0","< 40%"],["#fff","No activity"]].map(([c, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 9, height: 9, borderRadius: 3, background: c, border: "1px solid #e8ddd0" }} /><span style={{ fontSize: 10, color: "#7a5c3a" }}>{l}</span></div>
            ))}
          </div>
          <div style={{ height: 24 }} />
        </div>
      )}

      {/* DAY DRILL-DOWN */}
      {view === "day" && selectedDay && (() => {
        const ds = dateKey(selectedDay);
        const isToday = ds === tStr;
        const dayLabel = selectedDay.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
        const dpo = PHASES.find((p) => p.id === dayPhase);
        const totalVis = PHASES.flatMap((ph) => ph.tasks.filter((t) => shouldShow(t, ds)));
        const totalDone = totalVis.filter((t) => { const ph = PHASES.find((p) => p.tasks.includes(t)); return t.category === "Feeding" ? isFeedingDone(comp, users, t.id, ph?.id, ds) : allUsers.some(([uid]) => isChecked(comp, t.id, ds, uid)); }).length;
        return (<>
          <div style={{ background: "#f0e8d8", padding: "8px 12px", display: "flex", alignItems: "center", gap: 9, borderBottom: "1px solid #e8ddd0" }}>
            <button onClick={() => setView("calendar")} style={{ background: "#e8ddd0", border: "none", borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 12, color: "#3d2b1f" }}>\u{2190} Back</button>
            <div style={{ flex: 1 }}><div style={{ fontWeight: "bold", color: "#3d2b1f", fontSize: 13 }}>{dayLabel}</div><div style={{ fontSize: 10, color: "#9a7a5a" }}>{totalDone}/{totalVis.length} tasks done</div></div>
            {isToday && <span style={{ background: "#e8845c", color: "#fff", borderRadius: 7, padding: "2px 7px", fontSize: 10, fontWeight: "bold" }}>Today</span>}
          </div>
          <div style={{ display: "flex", background: "#f8f4f0", overflowX: "auto" }}>
            {PHASES.map((p) => { const prog = phaseProgress(p, ds); const active = dayPhase === p.id; return (
              <button key={p.id} onClick={() => setDayPhase(p.id)} style={{ flex: 1, minWidth: 86, padding: "7px 4px", background: active ? p.color : "transparent", color: active ? "#fff" : "#7a5c3a", border: "none", cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 11, fontWeight: active ? "bold" : "normal", borderBottom: active ? "3px solid #3d2b1f" : "3px solid transparent" }}>
                <div style={{ fontSize: 15 }}>{p.emoji}</div><div>{p.label}</div><div style={{ fontSize: 9, marginTop: 1, opacity: 0.85 }}>{prog}% done</div>
              </button>
            ); })}
          </div>
          <TaskList dateStr={ds} phase={dpo} {...tlProps} />
        </>);
      })()}

      {/* ACCOUNT */}
      {view === "account" && (
        <div style={{ padding: "20px 16px", maxWidth: 500, margin: "0 auto" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "18px", marginBottom: 16, border: "1.5px solid #e8ddd0" }}>
            <div style={{ fontSize: 11, fontWeight: "bold", letterSpacing: "1.5px", color: "#7a5c3a", textTransform: "uppercase", marginBottom: 14 }}>Your Profile</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: userColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{savedAvatar}</div>
              <div><div style={{ fontWeight: "bold", color: "#3d2b1f", fontSize: 16 }}>{userName}</div><div style={{ fontSize: 11, color: "#b09070" }}>Logged in on this device</div></div>
            </div>
            <div style={{ fontSize: 12, color: "#7a5c3a", marginBottom: 8, fontWeight: "bold" }}>Change your name</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={editNameInput} onChange={(e) => setEditNameInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleChangeName()} placeholder={userName} style={{ flex: 1, padding: "9px 13px", borderRadius: 10, border: "1.5px solid #e8ddd0", fontFamily: "Georgia, serif", fontSize: 14, background: "#fdf6ec", outline: "none" }} />
              <button onClick={handleChangeName} disabled={!editNameInput.trim()} style={{ background: editNameInput.trim() ? "#e8845c" : "#e8ddd0", color: editNameInput.trim() ? "#fff" : "#b09070", border: "none", borderRadius: 10, padding: "9px 16px", cursor: editNameInput.trim() ? "pointer" : "default", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold" }}>Save</button>
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 16, padding: "18px", marginBottom: 16, border: "1.5px solid #e8ddd0" }}>
            <div style={{ fontSize: 11, fontWeight: "bold", letterSpacing: "1.5px", color: "#7a5c3a", textTransform: "uppercase", marginBottom: 14 }}>Everyone on this tracker</div>
            {allUsers.map(([uid, u]) => (
              <div key={uid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f0e8d8" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: u.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{u.avatar}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: uid === userId ? "bold" : "normal", color: "#3d2b1f", fontSize: 14 }}>{u.name} {uid === userId && <span style={{ fontSize: 11, color: userColor }}>(you)</span>}</div>
                  <div style={{ fontSize: 10, color: "#b09070" }}>Last active {u.lastSeen ? new Date(u.lastSeen).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "unknown"}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: "#fff", borderRadius: 16, padding: "18px", border: "1.5px solid #e8ddd0" }}>
            <div style={{ fontSize: 11, fontWeight: "bold", letterSpacing: "1.5px", color: "#7a5c3a", textTransform: "uppercase", marginBottom: 14 }}>Puppy Name</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}><span style={{ fontSize: 28 }}>\u{1F43E}</span><div style={{ fontWeight: "bold", color: "#3d2b1f", fontSize: 18 }}>{dogName}</div></div>
            {editDogName ? (
              <div style={{ display: "flex", gap: 8 }}>
                <input value={dogNameInput} onChange={(e) => setDogNameInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveDogName(); if (e.key === "Escape") setEditDogName(false); }} placeholder="Puppy's name" style={{ flex: 1, padding: "9px 13px", borderRadius: 10, border: "1.5px solid #e8845c", fontFamily: "Georgia, serif", fontSize: 14, background: "#fdf6ec", outline: "none" }} />
                <button onClick={saveDogName} style={{ background: "#e8845c", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold" }}>Save</button>
                <button onClick={() => setEditDogName(false)} style={{ background: "#e8ddd0", color: "#7a5c3a", border: "none", borderRadius: 10, padding: "9px 12px", cursor: "pointer", fontSize: 14 }}>\u{2715}</button>
              </div>
            ) : (
              <button onClick={() => setEditDogName(true)} style={{ background: "#f0e8d8", border: "1.5px solid #e8ddd0", borderRadius: 10, padding: "9px 16px", cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 13, color: "#7a5c3a" }}>\u{270F} Change puppy name</button>
            )}
          </div>
          <div style={{ height: 32 }} />
        </div>
      )}
    </div>
  );
}
