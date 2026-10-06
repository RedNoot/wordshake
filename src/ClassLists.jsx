import { useState } from "react";
import { T } from "./theme.js";
import { authFetch } from "./auth.js";

const MAX_STUDENTS = 60;

const btn = { background: "none", border: `1px solid ${T.faint}`, color: T.mist, borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 15 };
const primary = { background: T.amber, color: T.ink, border: "none", borderRadius: 12, padding: "10px 22px", cursor: "pointer", fontSize: 17, fontWeight: 700 };
const input = { background: "rgb(var(--ws-fg) / .06)", border: `1px solid rgb(var(--ws-fg) / .18)`, color: "var(--ws-text)", borderRadius: 10, padding: "9px 12px", fontSize: 16, fontFamily: "inherit" };

const ERRORS = {
  "class-name": "Give the class a name (up to 40 characters).",
  "too-many-students": `A class can have up to ${MAX_STUDENTS} students.`,
  "too-many-classes": "You've reached the limit of 30 classes. Delete an old one first.",
  "class-not-found": "That class no longer exists. It may have been deleted in another tab.",
};
const errorText = body => body.error === "duplicate-student" ? `"${body.name}" is in the list twice. Add an initial to tell them apart, e.g. "${body.name} R".`
  : body.error === "student-name" ? `"${body.name}" is too long (30 characters at most).`
  : ERRORS[body.error] || "That didn't save. Check your connection and try again.";

// Names from pasted text or a spreadsheet export. In a CSV with a header row, prefer the first-name column.
export function parseNames(text) {
  const rows = text.split(/\r?\n/).map(line => line.split(/[,\t;]/).map(c => c.trim().replace(/^"|"$/g, "").trim()));
  let col = 0, start = 0;
  if (rows.length && rows[0].length > 1) {
    const head = rows[0].map(c => c.toLowerCase());
    const pick = [/^(preferred|first|given) ?name$/, /^(name|student|student name|full name)$/].map(re => head.findIndex(h => re.test(h))).find(i => i >= 0);
    if (pick !== undefined) { col = pick; start = 1; }
  } else if (rows.length && /^(names?|students?|first ?names?)$/i.test(rows[0][0] || "")) start = 1;
  return rows.slice(start).map(r => r[col] || r.find(Boolean) || "").filter(Boolean);
}

function Editor({ cls, onSaved, onCancel }) {
  const [name, setName] = useState(cls ? cls.name : "");
  const [rows, setRows] = useState(cls ? cls.students : []);
  const [paste, setPaste] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const added = parseNames(paste);
  const total = rows.length + added.length;

  const readFile = async e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 200_000) return setError("That file is too big for a class list. Save it as a .csv with just the names.");
    const names = parseNames(await file.text());
    if (!names.length) return setError("No names found in that file. Try saving it as a .csv, or paste the names instead.");
    setError("");
    setPaste(p => (p.trim() ? p.trim() + "\n" : "") + names.join("\n"));
  };

  const save = async () => {
    setError("");
    if (total > MAX_STUDENTS) return setError(ERRORS["too-many-students"]);
    setSaving(true);
    const body = { name, students: [...rows, ...added.map(n => ({ name: n }))] };
    const res = await authFetch(cls ? `/api/classes/${cls.id}` : "/api/classes", {
      method: cls ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).catch(() => null);
    const out = res && await res.json().catch(() => ({}));
    setSaving(false);
    if (!res || !res.ok) return setError(errorText(out || {}));
    onSaved(out);
  };

  return (
    <div className="ws-fade" style={{ display: "grid", gap: 16, width: "min(720px, 94vw)" }}>
      <h2 className="ws-display" style={{ margin: 0, fontSize: 30 }}>{cls ? `Edit ${cls.name}` : "New class"}</h2>
      <label style={{ display: "grid", gap: 6, color: T.mist, fontSize: 14 }}>
        Class name
        <input value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder="e.g. 3/4B" style={input} autoFocus={!cls} />
      </label>

      {rows.length > 0 && (
        <div>
          <div style={{ color: T.mist, fontSize: 14, marginBottom: 8 }}>Students ({rows.length})</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
            {rows.map((s, i) => (
              <div key={s.id || i} style={{ display: "flex", gap: 6 }}>
                <input aria-label={`Student ${i + 1}`} value={s.name} maxLength={30} onChange={e => setRows(r => r.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} style={{ ...input, flex: 1, minWidth: 0, padding: "7px 10px", fontSize: 15 }} />
                <button className="ws-btn" aria-label={`Remove ${s.name}`} title="Remove" onClick={() => setRows(r => r.filter((_, j) => j !== i))} style={{ ...btn, padding: "4px 10px" }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <label style={{ display: "grid", gap: 6, color: T.mist, fontSize: 14 }}>
        {rows.length ? "Add more students" : "Students"} — one name per line, or paste a column from a spreadsheet
        <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={8} placeholder={"Ava\nBen\nChloe R\nChloe T"} style={{ ...input, resize: "vertical", lineHeight: 1.5 }} />
      </label>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 14, color: T.mist }}>
        <label className="ws-btn" style={{ ...btn, display: "inline-block" }}>
          Upload a .csv or .txt file
          <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={readFile} style={{ display: "none" }} />
        </label>
        {added.length > 0 && <span>{added.length} name{added.length > 1 ? "s" : ""} to add: {added.slice(0, 6).join(", ")}{added.length > 6 ? "…" : ""}</span>}
      </div>
      <p style={{ margin: 0, fontSize: 13.5, color: "rgb(var(--ws-fg) / .5)", lineHeight: 1.5 }}>
        Use first names only. If two students share a name, add an initial (Chloe R, Chloe T). Students see this list when they join your game,
        so check it before class. Names are saved in your WordShake account and you can delete them at any time.
      </p>
      {error && <div role="alert" style={{ color: T.red, fontSize: 15 }}>{error}</div>}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button className="ws-btn ws-display" onClick={save} disabled={saving} style={{ ...primary, opacity: saving ? 0.7 : 1 }}>{saving ? "Saving…" : `Save class (${total} student${total === 1 ? "" : "s"})`}</button>
        <button className="ws-btn" onClick={onCancel} style={btn}>Cancel</button>
      </div>
    </div>
  );
}

export function ClassLists({ classes, setClasses, onDone }) {
  const [editing, setEditing] = useState(null); // null | "new" | class
  const [error, setError] = useState("");

  const remove = async cls => {
    if (!window.confirm(`Delete ${cls.name}, its ${cls.students.length} student names and all its saved progress? This can't be undone.`)) return;
    const res = await authFetch(`/api/classes/${cls.id}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) return setError("That didn't delete. Check your connection and try again.");
    setClasses(cs => cs.filter(c => c.id !== cls.id));
  };

  const saved = cls => {
    setClasses(cs => [...cs.filter(c => c.id !== cls.id), cls].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
    setEditing(null);
  };

  if (editing) return <Editor cls={editing === "new" ? null : editing} onSaved={saved} onCancel={() => setEditing(null)} />;

  return (
    <div className="ws-fade" style={{ display: "grid", gap: 18, width: "min(720px, 94vw)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 className="ws-display" style={{ margin: 0, fontSize: 38 }}>My classes</h1>
        <button className="ws-btn" onClick={onDone} style={btn}>← Back to game settings</button>
      </div>
      <p style={{ margin: 0, color: T.mist, fontSize: 16.5 }}>
        Add a class list and your students can join a game by tapping their name. No typing, no logins for students.
      </p>
      {classes === null && <div style={{ color: T.mist }}>Loading your classes…</div>}
      {classes && classes.length === 0 && (
        <div style={{ border: `1px dashed rgb(var(--ws-fg) / .2)`, borderRadius: 14, padding: 20, color: T.mist, textAlign: "center" }}>No classes yet.</div>
      )}
      {classes && classes.map(c => (
        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, border: `1px solid ${T.faint}`, background: "rgb(var(--ws-fg) / .04)", borderRadius: 14, padding: "12px 16px", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div className="ws-display" style={{ fontSize: 22, fontWeight: 700 }}>{c.name}</div>
            <div style={{ color: T.mist, fontSize: 14 }}>{c.students.length} student{c.students.length === 1 ? "" : "s"}{c.students.length ? `: ${c.students.slice(0, 5).map(s => s.name).join(", ")}${c.students.length > 5 ? "…" : ""}` : ""}</div>
          </div>
          <button className="ws-btn" onClick={() => setEditing(c)} style={btn}>Edit</button>
          <button className="ws-btn" onClick={() => remove(c)} style={{ ...btn, color: T.red }}>Delete</button>
        </div>
      ))}
      {error && <div role="alert" style={{ color: T.red }}>{error}</div>}
      {classes && <div><button className="ws-btn ws-display" onClick={() => setEditing("new")} style={primary}>+ New class</button></div>}
    </div>
  );
}
