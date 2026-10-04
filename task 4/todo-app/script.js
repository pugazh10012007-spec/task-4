/* ============================================================
   Tickit: To-Do Web App (SkillCraft Technology, Task 04)
   Add tasks, organise them in lists, edit, set date and time,
   mark as completed, delete with undo, get reminders.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- small helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const area = (n) => { try { return window[n]; } catch (e) { return null; } };
  const readJSON = (st, k) => { try { return JSON.parse(st.getItem(k)); } catch (e) { return null; } };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.5 3.5L13 4"/></svg>';
  const COLORS = ["#6c4cff", "#ff7a3d", "#ff9ec7", "#8fd3ff", "#c6f432"];

  // tiny element builder (uses textContent, so user text can never inject HTML)
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach((c) => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); });
    return e;
  }

  /* ---------- session guard ---------- */
  const getSession = () => readJSON(area("sessionStorage"), "td_session") || readJSON(area("localStorage"), "td_session");
  const session = getSession();
  if (!session) { location.replace("index.html"); return; }
  window.addEventListener("pageshow", (e) => { if (e.persisted && !getSession()) location.replace("index.html"); });

  /* ---------- data ---------- */
  const KEY = "td_data_" + session.id;
  const store = () => (session.guest ? area("sessionStorage") : area("localStorage"));
  const pad = (n) => String(n).padStart(2, "0");
  const dateStr = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const todayStr = () => dateStr(new Date());

  function seed() {
    const tomorrow = new Date(Date.now() + 864e5);
    const t = (listId, title, date, time, priority) => ({ id: uid(), listId, title, date, time, priority, done: false, created: Date.now() - Math.random() * 1000, notified: false });
    return {
      lists: [
        { id: "inbox", name: "Inbox", color: COLORS[0] },
        { id: "study", name: "Study", color: COLORS[1] },
        { id: "home", name: "Personal", color: COLORS[2] },
      ],
      tasks: [
        t("inbox", "Tick me to see the confetti", todayStr(), "", 1),
        t("inbox", "Press Edit to change my name, date or time", "", "", 1),
        t("study", "Push the project to GitHub", dateStr(tomorrow), "10:00", 2),
        t("home", "Drink water", todayStr(), "", 0),
      ],
    };
  }
  function load() {
    const d = readJSON(store(), KEY);
    return d && Array.isArray(d.lists) && d.lists.length && Array.isArray(d.tasks) ? d : seed();
  }
  function save() { try { store().setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage blocked */ } }

  let state = load();
  save();

  /* ---------- UI state ---------- */
  let view = "all";          // "all" or a list id
  let filter = "all";        // all | active | done
  let query = "";
  let sort = "due";          // due | pri | new | az
  let editingId = null;
  let renaming = false;
  let refreshTimer = 0;

  const listById = (id) => state.lists.find((l) => l.id === id);
  const find = (id) => state.tasks.find((t) => t.id === id);
  const inView = () => state.tasks.filter((t) => view === "all" || t.listId === view);
  const viewName = () => (view === "all" ? "All tasks" : (listById(view) || {}).name || "Tasks");

  /* ---------- dates ---------- */
  function dueTs(t) {
    if (!t.date) return null;
    const [y, m, d] = t.date.split("-").map(Number);
    const [hh, mm] = (t.time || "23:59").split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm, t.time ? 0 : 59).getTime();
  }
  function dueInfo(t) {
    if (!t.date) return null;
    const [y, m, d] = t.date.split("-").map(Number);
    const n = new Date();
    const diff = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5);
    let label = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday"
      : new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    if (t.time) {
      const [hh, mm] = t.time.split(":").map(Number);
      label += ", " + new Date(y, m - 1, d, hh, mm).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    }
    const over = !t.done && dueTs(t) < Date.now();
    return { label: (over ? "Overdue: " : "") + label, over, today: !t.done && !over && diff === 0 };
  }

  /* ---------- toasts ---------- */
  function toast(msg, opt) {
    opt = opt || {};
    const box = $("toasts");
    const el = h("div", { class: "toast" }, h("span", { text: msg }));
    const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 260); };
    if (opt.action) {
      el.append(h("button", { type: "button", class: "toast-btn", text: opt.action.label }));
      el.lastChild.onclick = () => { opt.action.fn(); close(); };
    }
    box.append(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(close, opt.ms || (opt.action ? 7000 : 3500));
  }

  /* ---------- confetti ---------- */
  const cv = $("confetti"), cx = cv.getContext("2d");
  let parts = [], raf = 0, dpr = 1;
  function fit() {
    dpr = window.devicePixelRatio || 1;
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fit(); window.addEventListener("resize", fit);
  function burst(x, y, n, power) {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (3 + Math.random() * 7) * (power || 1);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 5, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
        w: 7 + Math.random() * 7, h: 5 + Math.random() * 5, c: COLORS[i % COLORS.length], life: 1 });
    }
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function frame() {
    cx.clearRect(0, 0, innerWidth, innerHeight);
    parts.forEach((p) => {
      p.vy += 0.28; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= 0.011;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r);
      cx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6));
      cx.fillStyle = p.c; cx.strokeStyle = "#17142b"; cx.lineWidth = 1.5;
      cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
      cx.restore();
    });
    parts = parts.filter((p) => p.life > 0 && p.y < innerHeight + 40);
    if (parts.length) raf = requestAnimationFrame(frame);
    else { raf = 0; cx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  /* ---------- rendering: lists, header, ring ---------- */
  const activeCount = (id) => state.tasks.filter((t) => !t.done && (id === "all" || t.listId === id)).length;

  function renderLists() {
    const nav = $("lists");
    nav.textContent = "";
    [{ id: "all", name: "All tasks", color: "#ffffff" }].concat(state.lists).forEach((l) => {
      const b = h("button", { type: "button", class: "lbtn", "aria-current": String(view === l.id) },
        h("span", { class: "dot", style: "--c:" + l.color }),
        h("span", { class: "lname", text: l.name }),
        h("span", { class: "cnt", text: String(activeCount(l.id)), "aria-label": activeCount(l.id) + " active" }));
      b.onclick = () => { if (view !== l.id) setView(l.id); };
      nav.append(b);
    });
  }

  function renderTitle() {
    const wrap = $("title-wrap");
    wrap.textContent = "";
    if (renaming && view !== "all") {
      const inp = h("input", { type: "text", id: "rename-in", maxlength: "24", "aria-label": "List name", value: viewName() });
      inp.onkeydown = (e) => {
        if (e.key === "Enter") { e.preventDefault(); commitRename(inp.value); }
        else if (e.key === "Escape") { e.preventDefault(); renaming = false; renderTitle(); }
      };
      inp.onblur = () => commitRename(inp.value);
      wrap.append(h("div", { class: "rename" }, inp));
      inp.focus(); inp.select();
    } else {
      wrap.append(h("h1", { id: "view-title", tabindex: "-1", text: viewName() }));
    }
    $("head-actions").hidden = view === "all";
  }

  const C = 2 * Math.PI * 50;
  let ringReady = false;
  function renderRing() {
    const list = inView();
    const done = list.filter((t) => t.done).length, total = list.length;
    $("ring-t").textContent = done + "/" + total;
    $("ring-wrap").setAttribute("aria-label", done + " of " + total + " tasks done");
    const ring = $("ring");
    ring.style.strokeDasharray = C;
    const set = () => { ring.style.strokeDashoffset = C * (1 - (total ? done / total : 0)); };
    if (!ringReady) { ring.style.strokeDashoffset = C; ringReady = true; requestAnimationFrame(() => requestAnimationFrame(set)); }
    else set();
    const left = list.length - done;
    $("left").textContent = left + (left === 1 ? " task left" : " tasks left");
    $("clear-done").hidden = !done;
    $("clear-done").textContent = "Clear completed (" + done + ")";
  }

  function renderListSelect() {
    const sel = $("t-list");
    const keep = view !== "all" ? view : sel.value;
    sel.textContent = "";
    state.lists.forEach((l) => sel.append(h("option", { value: l.id, text: l.name })));
    sel.value = state.lists.some((l) => l.id === keep) ? keep : state.lists[0].id;
  }

  /* ---------- rendering: tasks ---------- */
  const CMP = {
    due: (a, b) => {
      const x = dueTs(a), y = dueTs(b);
      if (x === null && y === null) return b.created - a.created;
      if (x === null) return 1;
      if (y === null) return -1;
      return x - y;
    },
    pri: (a, b) => b.priority - a.priority || CMP.due(a, b),
    new: (a, b) => b.created - a.created,
    az: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
  };

  function visible() {
    let t = inView();
    if (filter === "active") t = t.filter((x) => !x.done);
    if (filter === "done") t = t.filter((x) => x.done);
    if (query) { const q = query.toLowerCase(); t = t.filter((x) => x.title.toLowerCase().includes(q)); }
    return t.sort((a, b) => (a.done - b.done) || CMP[sort](a, b));
  }

  function card(t, o, i) {
    const list = listById(t.listId) || { name: "List", color: COLORS[0] };
    const li = h("li", { class: "task" + (t.done ? " done" : ""), "data-id": t.id, style: "--c:" + list.color });
    if (o.newId === t.id) li.classList.add("enter");
    else if (o.stagger) { li.classList.add("stag"); li.style.setProperty("--i", Math.min(i, 10)); }
    if (o.flashId === t.id) li.classList.add("flash");
    if (editingId === t.id) { li.classList.add("editing"); li.append(editForm(t)); return li; }

    const tick = h("button", { type: "button", class: "tick", role: "checkbox", "data-role": "tick",
      "aria-checked": String(t.done), "aria-label": 'Mark "' + t.title + '" as ' + (t.done ? "not done" : "done") });
    tick.innerHTML = CHECK;
    tick.onclick = () => toggle(t.id, tick);

    const meta = h("div", { class: "t-meta" });
    const info = dueInfo(t);
    if (info) meta.append(h("span", { class: "chip" + (info.over ? " over" : info.today ? " today" : ""), text: info.label }));
    if (t.priority === 2) meta.append(h("span", { class: "chip hi", text: "High priority" }));
    if (t.priority === 0) meta.append(h("span", { class: "chip lo", text: "Low priority" }));
    if (view === "all") meta.append(h("span", { class: "chip" }, h("span", { class: "dot", style: "--c:" + list.color }), list.name));

    const body = h("div", { class: "t-body" }, h("p", { class: "t-title" }, h("span", { class: "t-text", text: t.title })), meta);
    if (!meta.children.length) meta.remove();

    const edit = h("button", { type: "button", class: "link-btn", "data-role": "edit", text: "Edit", "aria-label": 'Edit "' + t.title + '"' });
    edit.onclick = () => { editingId = t.id; renderTasks({ focusEdit: true }); };
    const del = h("button", { type: "button", class: "link-btn danger", "data-role": "del", text: "Delete", "aria-label": 'Delete "' + t.title + '"' });
    del.onclick = () => removeTask(t.id);

    li.append(tick, body, h("div", { class: "t-actions" }, edit, del));
    return li;
  }

  function field(label, input) { return h("label", { class: "fld" }, label, input); }

  function editForm(t) {
    const f = h("form", { class: "edit", novalidate: true });
    const title = h("input", { type: "text", id: "e-title", maxlength: "120", "aria-label": "Task name", value: t.title });
    const date = h("input", { type: "date", value: t.date || "" });
    const time = h("input", { type: "time", value: t.time || "" });
    const pri = h("select", {}, ...[["0", "Low"], ["1", "Normal"], ["2", "High"]].map((p) => h("option", { value: p[0], text: p[1] })));
    pri.value = String(t.priority);
    const lst = h("select", {}, ...state.lists.map((l) => h("option", { value: l.id, text: l.name })));
    lst.value = t.listId;
    const err = h("p", { class: "err", role: "alert" });
    const cancel = h("button", { class: "btn btn-white btn-sm", type: "button", text: "Cancel" });
    const saveBtn = h("button", { class: "btn btn-sm", type: "submit", text: "Save changes" });
    f.append(title, h("div", { class: "edit-grid" }, field("Date", date), field("Time", time), field("Priority", pri), field("List", lst)),
      err, h("div", { class: "edit-act" }, cancel, saveBtn));

    f.onsubmit = (e) => {
      e.preventDefault();
      const v = title.value.trim();
      if (!v) { err.textContent = "A task needs a name."; title.focus(); return; }
      let d = date.value;
      const tm = time.value;
      if (tm && !d) d = todayStr();
      if (d !== (t.date || "") || tm !== (t.time || "")) t.notified = false;
      const moved = lst.value !== t.listId && view !== "all";
      Object.assign(t, { title: v, date: d, time: tm, priority: Number(pri.value), listId: lst.value });
      save();
      editingId = null;
      renderAll({ flashId: t.id });
      focusRole(t.id, "edit");
      if (moved) toast('Moved to "' + (listById(t.listId) || {}).name + '"');
    };
    cancel.onclick = () => { editingId = null; renderTasks({}); focusRole(t.id, "edit"); };
    f.onkeydown = (e) => { if (e.key === "Escape") { e.preventDefault(); cancel.click(); } };
    return f;
  }

  function focusRole(id, role) {
    const el = $("tasks").querySelector('li[data-id="' + id + '"] [data-role="' + role + '"]');
    if (el) el.focus({ preventScroll: true });
  }

  function renderTasks(o) {
    o = o || {};
    const ul = $("tasks");
    // remember where things are (for the slide animation) and what had focus
    const before = new Map();
    if (!o.stagger && !o.noflip) [...ul.children].forEach((li) => before.set(li.dataset.id, li.getBoundingClientRect().top));
    const act = document.activeElement;
    const actLi = act && act.closest ? act.closest("li.task") : null;
    const ref = actLi && act.dataset && act.dataset.role ? { id: actLi.dataset.id, role: act.dataset.role } : null;

    const items = visible();
    ul.replaceChildren(...items.map((t, i) => card(t, o, i)));

    // empty state
    const all = inView().length;
    $("empty").hidden = items.length > 0;
    if (!items.length) {
      const msg = !all ? ["No tasks yet", "Type a task above and press Add task."]
        : query ? ["Nothing matches your search", "Try different words or clear the search box."]
        : filter === "done" ? ["Nothing completed yet", "Tick a task and it shows up here."]
        : ["All clear", "Every task here is done. Add another one above."];
      $("empty-h").textContent = msg[0];
      $("empty-p").textContent = msg[1];
    }

    // slide items from their old position to the new one
    if (before.size && !reduced) {
      [...ul.children].forEach((li) => {
        const p = before.get(li.dataset.id);
        if (p == null || li.classList.contains("enter")) return;
        const dy = p - li.getBoundingClientRect().top;
        if (Math.abs(dy) > 1) li.animate([{ transform: "translateY(" + dy + "px)" }, { transform: "none" }], { duration: 400, easing: "cubic-bezier(.3,1.3,.5,1)" });
      });
    }
    if (o.focusEdit) { const e = $("e-title"); if (e) { e.focus(); e.setSelectionRange(e.value.length, e.value.length); } }
    else if (ref) focusRole(ref.id, ref.role);
  }

  function renderAll(o) {
    renderLists(); renderTitle(); renderRing(); renderListSelect(); renderTasks(o);
  }

  function setView(id) {
    view = id; editingId = null; renaming = false;
    renderAll({ stagger: true });
  }

  /* ---------- task actions ---------- */
  function toggle(id, btn) {
    const t = find(id);
    if (!t) return;
    t.done = !t.done;
    if (!t.done) t.notified = false;
    save();
    const li = btn.closest("li");
    li.classList.toggle("done", t.done);
    btn.setAttribute("aria-checked", String(t.done));
    btn.setAttribute("aria-label", 'Mark "' + t.title + '" as ' + (t.done ? "not done" : "done"));
    if (t.done) {
      li.classList.remove("pop"); void li.offsetWidth; li.classList.add("pop");
      const r = btn.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, 34, 1);
      const rest = inView();
      if (rest.length && rest.every((x) => x.done)) {
        burst(innerWidth * 0.25, innerHeight * 0.3, 60, 1.4);
        burst(innerWidth * 0.75, innerHeight * 0.3, 60, 1.4);
        toast("All done in " + viewName() + ". Nice work!");
      }
    }
    renderLists(); renderRing();
    // let the stamp animation play, then move the task to its new place
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => renderTasks({}), reduced ? 0 : 650);
  }

  function removeTask(id) {
    const idx = state.tasks.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const [t] = state.tasks.splice(idx, 1);
    if (editingId === id) editingId = null;
    save();
    const li = $("tasks").querySelector('li[data-id="' + id + '"]');
    const finish = () => { renderLists(); renderRing(); renderTasks({}); };
    if (li && !reduced) {
      li.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(80px) rotate(3deg)" }],
        { duration: 300, easing: "ease-in", fill: "forwards" }).onfinish = finish;
    } else finish();
    toast("Task deleted", { action: { label: "Undo", fn: () => {
      state.tasks.splice(Math.min(idx, state.tasks.length), 0, t);
      save(); renderAll({ newId: t.id });
    } } });
  }

  /* ---------- add task ---------- */
  $("add-form").onsubmit = (e) => {
    e.preventDefault();
    const title = $("t-title").value.trim();
    const err = $("add-err");
    if (!title) { err.textContent = "Enter a task name to add it."; $("t-title").setAttribute("aria-invalid", "true"); $("t-title").focus(); return; }
    err.textContent = ""; $("t-title").removeAttribute("aria-invalid");
    let date = $("t-date").value;
    const time = $("t-time").value;
    if (time && !date) date = todayStr();
    const t = { id: uid(), listId: $("t-list").value, title, date, time, priority: Number($("t-pri").value), done: false, created: Date.now(), notified: false };
    state.tasks.push(t);
    save();
    if (filter === "done") setFilter("all", true);
    query = ""; $("search").value = "";
    if (view !== "all") view = t.listId;
    $("t-title").value = ""; $("t-date").value = ""; $("t-time").value = ""; $("t-pri").value = "1";
    renderAll({ newId: t.id });
    $("t-title").focus();
  };
  $("t-title").addEventListener("input", () => { $("add-err").textContent = ""; $("t-title").removeAttribute("aria-invalid"); });

  /* ---------- lists: add, rename, delete ---------- */
  $("list-form").onsubmit = (e) => {
    e.preventDefault();
    const name = $("new-list").value.trim(), err = $("list-err");
    if (!name) { err.textContent = "Enter a name for the new list."; return; }
    if (state.lists.some((l) => l.name.toLowerCase() === name.toLowerCase())) { err.textContent = "A list with this name already exists."; return; }
    err.textContent = "";
    const l = { id: uid(), name, color: COLORS[state.lists.length % COLORS.length] };
    state.lists.push(l);
    save();
    $("new-list").value = "";
    setView(l.id);
  };

  $("rename").onclick = () => { renaming = true; renderTitle(); };
  function commitRename(val) {
    if (!renaming) return;
    renaming = false;
    const name = val.trim(), l = listById(view);
    if (l && name && name !== l.name) {
      if (state.lists.some((x) => x.id !== l.id && x.name.toLowerCase() === name.toLowerCase())) toast("A list with this name already exists.");
      else { l.name = name; save(); }
    }
    renderAll({ noflip: true });
  }

  $("del-list").onclick = () => {
    if (view === "all") return;
    if (state.lists.length <= 1) { toast("Keep at least one list."); return; }
    const l = listById(view), at = state.lists.indexOf(l);
    const gone = state.tasks.filter((t) => t.listId === l.id);
    state.lists.splice(at, 1);
    state.tasks = state.tasks.filter((t) => t.listId !== l.id);
    save();
    setView("all");
    toast('List "' + l.name + '" deleted' + (gone.length ? " with " + gone.length + (gone.length === 1 ? " task" : " tasks") : ""), { action: { label: "Undo", fn: () => {
      state.lists.splice(Math.min(at, state.lists.length), 0, l);
      state.tasks.push(...gone);
      save(); setView(l.id);
    } } });
  };

  $("clear-done").onclick = () => {
    const gone = inView().filter((t) => t.done);
    if (!gone.length) return;
    const ids = new Set(gone.map((t) => t.id));
    state.tasks = state.tasks.filter((t) => !ids.has(t.id));
    save();
    renderAll({});
    toast(gone.length + (gone.length === 1 ? " completed task cleared" : " completed tasks cleared"), { action: { label: "Undo", fn: () => {
      state.tasks.push(...gone); save(); renderAll({ stagger: true });
    } } });
  };

  /* ---------- filter, search, sort ---------- */
  function setFilter(f, silent) {
    filter = f;
    document.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.f === f)));
    if (!silent) renderTasks({ stagger: true });
  }
  document.querySelectorAll(".seg button").forEach((b) => { b.onclick = () => setFilter(b.dataset.f); });
  $("search").addEventListener("input", () => { query = $("search").value.trim(); renderTasks({ noflip: true }); });
  $("sort").onchange = () => { sort = $("sort").value; renderTasks({}); };

  /* ---------- reminders ---------- */
  function remind(t) {
    toast("Due now: " + t.title, { ms: 10000 });
    try { if ("Notification" in window && Notification.permission === "granted") new Notification("Task due", { body: t.title }); } catch (e) { /* ignore */ }
  }
  function checkDue() {
    const now = Date.now();
    let changed = false;
    state.tasks.forEach((t) => {
      if (t.done || t.notified || !t.date || !t.time) return;
      const ts = dueTs(t);
      if (ts > now) return;
      t.notified = true; changed = true;
      if (now - ts <= 10 * 60 * 1000) remind(t);   // older than 10 minutes: already shown as Overdue
    });
    if (changed) save();
  }
  let overSig = "";
  function refreshDue() {
    checkDue();
    const sig = state.tasks.filter((t) => dueInfo(t) && dueInfo(t).over).map((t) => t.id).join();
    if (sig !== overSig) { overSig = sig; if (editingId === null && !renaming) renderTasks({ noflip: true }); }
  }
  setInterval(refreshDue, 15000);

  const alertsBtn = $("alerts");
  function alertsLabel() {
    if (!("Notification" in window)) { alertsBtn.hidden = true; return; }
    alertsBtn.textContent = Notification.permission === "granted" ? "Alerts on" : "Get alerts";
  }
  // the keyboard hint only makes sense with a mouse and keyboard
  if (window.matchMedia && matchMedia("(hover: hover)").matches) $("t-title").placeholder = "What needs doing? Press N to jump here";
  alertsBtn.onclick = () => {
    if (Notification.permission === "granted") toast("Browser alerts are on for timed tasks.");
    else if (Notification.permission === "denied") toast("Alerts are blocked. Allow notifications for this site in your browser settings.", { ms: 6000 });
    else Notification.requestPermission().then(alertsLabel).catch(() => {});
  };
  alertsLabel();

  /* ---------- header: ticker, user, logout, shortcuts ---------- */
  (function ticker() {
    const words = ["Plan it", "Tick it", "Done", "Repeat"];
    const track = $("ticker");
    for (let g = 0; g < 2; g++) {
      const grp = h("div", { class: "tgrp" });
      for (let r = 0; r < 5; r++) words.forEach((w) => grp.append(h("span", { text: w }), h("i", { class: "star" })));
      track.append(grp);
    }
  })();

  const name = session.name || "Guest";
  $("avatar").textContent = name.charAt(0).toUpperCase();
  $("uname").textContent = name;
  $("today").textContent = "Hi, " + name.split(" ")[0] + ". It is " +
    new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) + ".";

  $("logout").onclick = () => {
    ["localStorage", "sessionStorage"].forEach((n) => { try { area(n).removeItem("td_session"); } catch (e) { /* ignore */ } });
    location.replace("index.html");
  };

  document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() !== "n" || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || e.target.isContentEditable) return;
    e.preventDefault();
    $("t-title").focus();
  });

  /* ---------- start ---------- */
  renderAll({ stagger: true });
  checkDue();
})();
