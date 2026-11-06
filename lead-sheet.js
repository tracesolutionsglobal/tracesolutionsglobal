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

  /* ---------- Import a CSV (Harvey's exports, or any sheet with a business column) ---------- */
  const importBtn = $("lsImport");
  const fileEl = $("lsFile");

  function parseCsv(text) {
    text = String(text).replace(/^﻿/, "");
    const rows = [];
    let row = [], val = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { val += '"'; i++; } else q = false; }
        else val += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { row.push(val); val = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(val); val = "";
        if (row.some((v) => v.trim())) rows.push(row);
        row = [];
      } else val += ch;
    }
    row.push(val);
    if (row.some((v) => v.trim())) rows.push(row);
    return rows;
  }
  // Harvey (like our own export) puts ' before cells starting = + - @ so
  // spreadsheets don't run them as formulas; take it off again.
  const unguard = (v) => String(v ?? "").trim().replace(/^'(?=[=+\-@])/, "");
  const keyOf = (h) => String(h).toLowerCase().replace(/[^a-z0-9]/g, "");
  const FIELDS = {
    name: ["company", "companyname", "business", "businessname", "name", "organisation", "organization"],
    first: ["firstname"], last: ["lastname"],
    contact: ["contactperson", "contact", "contactname", "owner", "fullname"],
    title: ["title", "jobtitle", "role"],
    email: ["email", "emailaddress"],
    emailStatus: ["emailstatus"],
    phone: ["phone", "phonenumber", "telephone", "mobile", "tel"],
    website: ["website", "url", "domain", "site"],
    sector: ["industry", "sector", "category"],
    area: ["area", "location", "city"],
    address: ["address", "streetaddress"],
    status: ["status"],
    why: ["whyselected", "fit"],
    whyNot: ["whynotcontacted"],
    personal: ["personalization", "personalisation"],
    hiring: ["hiring"],
    score: ["score"],
    notes: ["notes", "note"]
  };
  const domainOf = (w) => String(w || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  const digits = (p) => String(p || "").replace(/\D/g, "");
  const slug = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Harvey's prospect and company statuses → where the lead sits in our pipeline.
  function sheetStatus(s) {
    const v = String(s || "").toLowerCase().replace(/[\s-]+/g, "_");
    if (v === "meeting" || v === "meeting_booked") return "Meeting booked";
    if (v === "replied" || v === "interested") return "Interested";
    if (v === "closed" || v === "won") return "Won";
    if (v === "opted_out" || v === "lost") return "Lost";
    return "New";
  }

  function readLeads(text) {
    const grid = parseCsv(text);
    if (grid.length < 2) throw new Error("The file has no rows under its header.");
    const head = grid[0].map(keyOf);
    const col = {};
    Object.entries(FIELDS).forEach(([f, names]) => {
      const i = head.findIndex((h) => names.includes(h));
      if (i >= 0) col[f] = i;
    });
    if (col.name === undefined) throw new Error("No business column found. The first row needs a heading like “company” or “business”.");
    const harvey = ["emailStatus", "whyNot", "personal", "score", "why"].some((f) => col[f] !== undefined);
    const get = (r, f) => (col[f] === undefined ? "" : unguard(r[col[f]]));
    const byKey = new Map();
    let excluded = 0;
    grid.slice(1, 3001).forEach((r) => {
      const name = get(r, "name").slice(0, 160);
      if (!name) return;
      const st = get(r, "status");
      if (/^excluded$/i.test(st)) { excluded++; return; } // on Harvey's do-not-contact list
      const website = get(r, "website");
      const domain = domainOf(website);
      const key = ((harvey ? "harvey-" : "import-") + (domain || slug(name))).slice(0, 80);
      let lead = byKey.get(key);
      if (!lead) {
        lead = { key, name, website: website ? website.slice(0, 500) : "", domain, phone: "", email: "", contact: "",
          sector: get(r, "sector").slice(0, 80), area: get(r, "area").slice(0, 120), address: get(r, "address").slice(0, 240),
          status: sheetStatus(st), notes: [], people: [] };
        byKey.set(key, lead);
        const why = [get(r, "why"), get(r, "personal"), get(r, "hiring") && "Hiring: " + get(r, "hiring"), get(r, "notes")].filter(Boolean);
        if (why.length) lead.notes.push(why.join(" · "));
        if (get(r, "whyNot")) lead.notes.push("Harvey: " + get(r, "whyNot"));
        if (st && harvey && !/^(new|ready|not processed yet|not contacted)$/i.test(st)) lead.notes.push("Harvey status: " + st);
      } else if (lead.status === "New") lead.status = sheetStatus(st);
      const person = (get(r, "contact") || [get(r, "first"), get(r, "last")].filter(Boolean).join(" ")).trim();
      const title = get(r, "title");
      const email = get(r, "email");
      const es = get(r, "emailStatus").toLowerCase();
      const okEmail = email && /@/.test(email) && es !== "invalid";
      if (!lead.phone && get(r, "phone")) lead.phone = get(r, "phone").slice(0, 40);
      if (!lead.email && okEmail && (!es || es === "verified" || es === "risky")) lead.email = email.slice(0, 160);
      if (!lead.contact && person) lead.contact = (person + (title ? " (" + title + ")" : "")).slice(0, 120);
      if (person || okEmail) lead.people.push([person, title, okEmail ? email + (es && es !== "verified" ? " [" + es + "]" : "") : ""].filter(Boolean).join(", "));
    });
    return { leads: [...byKey.values()], harvey, excluded };
  }

  function alreadyIn(lead) {
    const n = lead.name.toLowerCase(), d = lead.domain, p = digits(lead.phone);
    return state.rows.some((r) =>
      r.dedupe_key === lead.key ||
      String(r.name || "").toLowerCase() === n ||
      (d && domainOf(r.website) === d) ||
      (p.length >= 7 && digits(r.phone).slice(-9) === p.slice(-9)));
  }

  async function importFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setSave("That file is over 5 MB. Export fewer rows.", true); return; }
    let parsed;
    try { parsed = readLeads(await file.text()); }
    catch (e) { setSave("Couldn't read the file. " + e.message, true); return; }
    await load(true);
    const fresh = parsed.leads.filter((l) => !alreadyIn(l));
    const dupes = parsed.leads.length - fresh.length;
    if (!fresh.length) { setSave(`Nothing new: all ${parsed.leads.length} businesses are already in the sheet.`); return; }
    const withPhone = fresh.filter((l) => l.phone).length;
    const msg = `${file.name}\n\nAdd ${fresh.length} new lead${fresh.length === 1 ? "" : "s"} to the sheet as New?` +
      `\n• ${withPhone} with a phone number, ${fresh.filter((l) => l.email).length} with an email` +
      (dupes ? `\n• ${dupes} skipped: already in the sheet` : "") +
      (parsed.excluded ? `\n• ${parsed.excluded} skipped: on Harvey's do-not-contact list` : "");
    if (!confirm(msg)) return;
    const source = parsed.harvey ? "harvey" : "import";
    const label = parsed.harvey ? "Imported from Harvey" : "Imported from " + file.name;
    const body = fresh.map((l) => {
      const notes = [label + " on " + today() + "."].concat(l.notes, l.people.length > 1 ? ["Contacts: " + l.people.join("; ")] : []).join("\n");
      return {
        dedupe_key: l.key, name: l.name, source, status: l.status, found_by: me(),
        phone: l.phone || null, email: l.email || null, contact_person: l.contact || null,
        website: l.website || null, sector: l.sector, area: l.area, address: l.address,
        notes: notes.slice(0, 4000)
      };
    });
    importBtn.disabled = true;
    let added = 0;
    try {
      for (let i = 0; i < body.length; i += 200) {
        setSave(`Importing ${Math.min(i + 200, body.length)} of ${body.length}…`);
        const out = await TSDB.rest("saved_leads?on_conflict=dedupe_key,found_by&select=" + SELECT, {
          method: "POST", prefer: "return=representation,resolution=ignore-duplicates", body: body.slice(i, i + 200)
        });
        added += (out || []).length;
      }
      setSave(`Imported ${added} lead${added === 1 ? "" : "s"}` + (withPhone ? `, ${withPhone} ready to call.` : "."));
      qEl.value = ""; statusEl.value = ""; openEl.checked = false; mineEl.checked = false;
    } catch (e) {
      setSave((added ? `Imported ${added}, then stopped. ` : "Couldn't import. ") + e.message, true);
    } finally {
      importBtn.disabled = false;
      await load(true);
    }
  }

  if (importBtn && fileEl) {
    importBtn.addEventListener("click", () => { fileEl.value = ""; fileEl.click(); });
    fileEl.addEventListener("change", () => importFile(fileEl.files && fileEl.files[0]));
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
