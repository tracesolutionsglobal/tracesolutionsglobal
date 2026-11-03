/* Lead sheet for admin.html: one shared, editable table of every lead.
   Rows come from public.saved_leads, the same table the lead finder saves into,
   so a search adds its businesses here as "New". Admins and agents can edit any
   cell; each change is saved straight away. Only admins can delete a row. */
(function () {
  const root = document.getElementById("trackerView");
  if (!root || !window.TSDB) return;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const STATUSES = [
    { id: "New", c: "var(--ink-3)" },
    { id: "Called", c: "var(--blue)" },
    { id: "No answer", c: "var(--ink-2)" },
    { id: "Call back", c: "var(--amber)" },
    { id: "Interested", c: "var(--violet)" },
    { id: "Demo ready", c: "var(--violet)" },
    { id: "Demo sent", c: "var(--blue)" },
    { id: "Meeting booked", c: "var(--green)" },
    { id: "Proposal sent", c: "var(--green)" },
    { id: "Won", c: "var(--green-deep)" },
    { id: "Lost", c: "var(--danger)" }
  ];
  const OPEN = (s) => s !== "Won" && s !== "Lost";
  const TEAM = [
    "ocean.tracesolutions@outlook.com", "azzy.tracesolutions@outlook.com", "mandy.tracesolutions@outlook.com",
    "shifar@tracesolutions.com", "ummer@tracesolutions.com"
  ];
  const COLS = [
    { k: "name", label: "Business", type: "text", max: 160, w: 220, sticky: true },
    { k: "status", label: "Status", type: "status", w: 150 },
    { k: "contact_person", label: "Contact person", type: "text", max: 120, w: 150 },
    { k: "phone", label: "Phone", type: "tel", max: 40, w: 140 },
    { k: "email", label: "Email", type: "email", max: 160, w: 190 },
    { k: "sector", label: "Sector", type: "text", max: 80, w: 150 },
    { k: "area", label: "Area", type: "text", max: 120, w: 160 },
    { k: "last_contacted", label: "Last called", type: "date", w: 140 },
    { k: "next_follow_up", label: "Next follow-up", type: "date", w: 140 },
    { k: "assigned_to", label: "Assigned to", type: "person", max: 160, w: 190 },
    { k: "notes", label: "Notes", type: "text", max: 4000, w: 320 },
    { k: "demo_url", label: "Demo link", type: "url", max: 500, w: 210 },
    { k: "website", label: "Their website", type: "url", max: 500, w: 190 },
    { k: "address", label: "Address", type: "text", max: 240, w: 200 }
  ];
  const SELECT = "id," + COLS.map((c) => c.k).join(",") + ",source,found_by,created_at,updated_at,updated_by";

  const rowsEl = $("lsRows");
  const headEl = $("lsHead");
  const wrap = $("lsWrap");
  const note = $("lsNote");
  const countEl = $("lsCount");
  const qEl = $("lsQ");
  const statusEl = $("lsStatus");
  const mineEl = $("lsMine");
  const openEl = $("lsOpen");
  const pipeEl = $("lsPipe");
  const saveEl = $("lsSave");
  const addBtn = $("lsAdd");
  const exportBtn = $("lsExport");

  const state = { role: "admin", rows: [], loaded: false, timer: null, pending: 0 };
  const me = () => ((TSDB.session() && TSDB.session().email) || "").toLowerCase();
  const who = (email) => {
    const e = String(email || "").toLowerCase();
    if (!e || e === "team") return "Team";
    return e.split("@")[0].split(".")[0].replace(/^./, (c) => c.toUpperCase());
  };
  const today = () => new Date().toISOString().slice(0, 10);

  statusEl.innerHTML = `<option value="">All statuses</option>` + STATUSES.map((s) => `<option>${esc(s.id)}</option>`).join("");
  $("lsPeople").innerHTML = TEAM.map((e) => `<option value="${esc(e)}">${esc(who(e))}</option>`).join("");
  headEl.innerHTML = `<tr>${COLS.map((c) => `<th style="min-width:${c.w}px"${c.sticky ? ' class="ls-stick"' : ""}>${esc(c.label)}</th>`).join("")}<th class="ls-meta">Updated</th><th class="ls-meta" data-admin-col><span class="ls-sr">Delete</span></th></tr>`;

  function setSave(text, bad) {
    saveEl.textContent = text;
    saveEl.className = "ls-save" + (bad ? " bad" : "");
  }
  function when(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  function statusColor(s) { return (STATUSES.find((x) => x.id === s) || STATUSES[0]).c; }

  function visible() {
    const q = qEl.value.trim().toLowerCase();
    const st = statusEl.value;
    const mine = mineEl.checked;
    const open = openEl.checked;
    return state.rows.filter((r) => {
      if (st && r.status !== st) return false;
      if (open && !OPEN(r.status)) return false;
      if (mine && String(r.assigned_to || "").toLowerCase() !== me() && String(r.found_by || "").toLowerCase() !== me()) return false;
      if (q && !COLS.some((c) => String(r[c.k] || "").toLowerCase().includes(q))) return false;
      return true;
    });
  }

  function paintPipe() {
    const counts = {};
    state.rows.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    pipeEl.innerHTML = STATUSES.map((s) => `<button type="button" class="ls-chip" data-status="${esc(s.id)}" aria-pressed="${statusEl.value === s.id}" style="--c:${s.c}"><i></i>${esc(s.id)}<b>${counts[s.id] || 0}</b></button>`).join("");
  }

  function cell(r, c) {
    const v = r[c.k] ?? "";
    const base = `data-id="${esc(r.id)}" data-k="${c.k}" aria-label="${esc(c.label)} for ${esc(r.name)}"`;
    if (c.type === "status") {
      return `<td class="ls-status" style="--c:${statusColor(v)}"><select ${base}>${STATUSES.map((s) => `<option${s.id === v ? " selected" : ""}>${esc(s.id)}</option>`).join("")}</select></td>`;
    }
    let extra = "";
    if (c.type === "url" && v) extra = `<a class="ls-open" href="${esc(/^https?:\/\//i.test(v) ? v : "https://" + v)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(c.label)}">↗</a>`;
    if (c.type === "tel" && v) extra = `<a class="ls-open" href="tel:${esc(String(v).replace(/[^\d+]/g, ""))}" aria-label="Call ${esc(r.name)}">☎</a>`;
    const type = c.type === "person" ? "text" : c.type === "url" ? "text" : c.type;
    const list = c.type === "person" ? ' list="lsPeople"' : "";
    const late = c.k === "next_follow_up" && v && v <= today() && OPEN(r.status) ? (v < today() ? " late" : " due") : "";
    return `<td class="${c.sticky ? "ls-stick" : ""}${late}"><div class="ls-cell"><input type="${type}"${list} ${base} value="${esc(v)}"${c.max ? ` maxlength="${c.max}"` : ""}${c.k === "name" ? " required" : ""}>${extra}</div></td>`;
  }

  function paint() {
    const shown = visible();
    countEl.textContent = state.rows.length;
    paintPipe();
    wrap.hidden = !shown.length;
    if (!state.rows.length) note.textContent = "No leads yet. Press “Add lead”, or run a search in the Lead finder: every business it finds lands here as New.";
    else if (!shown.length) note.textContent = "No leads match these filters.";
    else note.textContent = "";
    const admin = state.role === "admin";
    rowsEl.innerHTML = shown.map((r) => `<tr data-row="${esc(r.id)}">${COLS.map((c) => cell(r, c)).join("")}
      <td class="ls-meta"><small>${esc(who(r.updated_by || r.found_by))}<br>${esc(when(r.updated_at || r.created_at))}</small></td>
      <td class="ls-meta" data-admin-col>${admin ? `<button type="button" class="ls-del" data-del="${esc(r.id)}" aria-label="Delete ${esc(r.name)}">✕</button>` : ""}</td></tr>`).join("");
    root.querySelectorAll("[data-admin-col]").forEach((el) => { el.hidden = !admin; });
  }

  async function load(quiet) {
    if (!TSDB.session()) return;
    if (!quiet) setSave("Loading…");
    try {
      state.rows = (await TSDB.rest("saved_leads?select=" + SELECT + "&order=updated_at.desc&limit=2000")) || [];
      setSave(quiet ? saveEl.textContent : "All changes saved");
    } catch (e) {
      setSave("Couldn't load the lead sheet. " + e.message, true);
    }
    paint();
  }

  function normalise(c, value) {
    let v = String(value ?? "").trim();
    if (c.max) v = v.slice(0, c.max);
    if (c.type === "date" || c.type === "person" || c.type === "url" || c.type === "email" || c.type === "tel") return v || null;
    return v;
  }

  async function save(input) {
    const id = input.dataset.id, k = input.dataset.k;
    const c = COLS.find((x) => x.k === k);
    const row = state.rows.find((r) => r.id === id);
    if (!c || !row) return;
    const value = normalise(c, input.value);
    if ((row[k] ?? null) === value || (row[k] ?? "") === value) return;
    if (k === "name" && !value) { input.value = row.name; setSave("A lead needs a business name.", true); return; }
    const body = { [k]: value };
    if (k === "status" && !row.last_contacted && value !== "New") body.last_contacted = today();
    const before = { ...row };
    Object.assign(row, body);
    state.pending++;
    setSave("Saving…");
    try {
      const out = await TSDB.rest("saved_leads?id=eq." + encodeURIComponent(id) + "&select=" + SELECT, { method: "PATCH", prefer: "return=representation", body });
      if (!out || !out.length) throw new Error("You don't have permission to edit this row.");
      Object.assign(row, out[0]);
      state.pending--;
      setSave("Saved " + c.label.toLowerCase());
      if (k === "status" || body.last_contacted || k === "next_follow_up" || k === "notes" || k === "name") {
        const tr = input.closest("tr");
        if (tr && k === "status") tr.querySelector(".ls-status").style.setProperty("--c", statusColor(value));
        paintPipe();
        if (body.last_contacted && tr) { const d = tr.querySelector('[data-k="last_contacted"]'); if (d) d.value = body.last_contacted; }
      }
      const meta = input.closest("tr") && input.closest("tr").querySelector(".ls-meta small");
      if (meta) meta.innerHTML = `${esc(who(row.updated_by))}<br>${esc(when(row.updated_at))}`;
    } catch (e) {
      state.pending--;
      Object.assign(row, before);
      input.value = before[k] ?? "";
      setSave("Not saved: " + e.message, true);
    }
  }

  async function addLead() {
    addBtn.disabled = true;
    setSave("Adding…");
    try {
      const key = "manual-" + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
      const out = await TSDB.rest("saved_leads?select=" + SELECT, {
        method: "POST", prefer: "return=representation",
        body: { dedupe_key: key.slice(0, 80), name: "New lead", source: "manual", status: "New", found_by: me(), assigned_to: me() || null }
      });
      const row = Array.isArray(out) ? out[0] : out;
      state.rows.unshift(row);
      qEl.value = ""; statusEl.value = ""; openEl.checked = false; mineEl.checked = false;
      paint();
      setSave("Lead added. Type the business name.");
      const first = rowsEl.querySelector(`[data-id="${CSS.escape(row.id)}"][data-k="name"]`);
      if (first) { first.focus(); first.select(); }
    } catch (e) {
      setSave("Couldn't add a lead. " + e.message, true);
    } finally { addBtn.disabled = false; }
  }

  async function removeLead(id) {
    const row = state.rows.find((r) => r.id === id);
    if (!row || !confirm(`Delete ${row.name} from the lead sheet for good?`)) return;
    try {
      await TSDB.rest("saved_leads?id=eq." + encodeURIComponent(id), { method: "DELETE", prefer: "return=minimal" });
      state.rows = state.rows.filter((r) => r.id !== id);
      paint();
      setSave("Lead deleted");
    } catch (e) { setSave("Couldn't delete. " + e.message, true); }
  }

  function csvCell(v) {
    const s = String(v ?? "");
    return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? '"' + (/^[=+\-@]/.test(s) ? "'" : "") + s.replace(/"/g, '""') + '"' : s;
  }
  function exportCsv() {
    const rows = visible();
    if (!rows.length) { setSave("Nothing to export.", true); return; }
    const lines = [COLS.map((c) => c.label).concat(["Added by", "Updated by", "Updated"]).join(",")]
      .concat(rows.map((r) => COLS.map((c) => r[c.k]).concat([r.found_by, r.updated_by, r.updated_at]).map(csvCell).join(",")));
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    link.download = "lead-sheet-" + today() + ".csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  rowsEl.addEventListener("change", (e) => { if (e.target.matches("[data-k]")) save(e.target); });
  rowsEl.addEventListener("keydown", (e) => {
    const t = e.target;
    if (!t.matches("input[data-k]")) return;
    if (e.key === "Escape") {
      const row = state.rows.find((r) => r.id === t.dataset.id);
      if (row) t.value = row[t.dataset.k] ?? "";
      t.blur();
      return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();
    const tr = t.closest("tr");
    const next = (e.shiftKey ? tr.previousElementSibling : tr.nextElementSibling);
    t.blur();
    const target = next && next.querySelector(`[data-k="${t.dataset.k}"]`);
    if (target) target.focus();
  });
  rowsEl.addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]");
    if (del) removeLead(del.dataset.del);
  });
  pipeEl.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-status]");
    if (!chip) return;
    statusEl.value = statusEl.value === chip.dataset.status ? "" : chip.dataset.status;
    paint();
  });
  [qEl].forEach((el) => el.addEventListener("input", paint));
  [statusEl, mineEl, openEl].forEach((el) => el.addEventListener("change", paint));
  addBtn.addEventListener("click", addLead);
  exportBtn.addEventListener("click", exportCsv);
  document.addEventListener("ts:leads-saved", () => { if (state.loaded) load(true); });

  window.TSLeadSheet = {
    setRole(r) { state.role = r === "agent" ? "agent" : "admin"; },
    show() {
      state.loaded = true;
      load();
      clearInterval(state.timer);
      state.timer = setInterval(() => {
        if (document.hidden || root.hidden || state.pending) return;
        if (root.contains(document.activeElement) && document.activeElement.matches("[data-k]")) return;
        load(true);
      }, 30000);
    },
    hide() { clearInterval(state.timer); state.timer = null; },
    reset() { clearInterval(state.timer); state.timer = null; state.rows = []; state.loaded = false; rowsEl.innerHTML = ""; setSave(""); }
  };
})();
