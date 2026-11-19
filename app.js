"use strict";
/* Taskboard — Trello-style app. Vanilla JS, no build step.
   Persistence: localStorage (synced across tabs).
   Bonus feature: role-based access (owner / member / viewer), enforced in every mutation. */

const KEY = "taskboard-v1";
const uid = () => Math.random().toString(36).slice(2, 10);
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- State & persistence ---------- */
function seed() {
  const me = { id: uid(), name: "Yogesh" }, a = { id: uid(), name: "Aisha" }, s = { id: uid(), name: "Sam" };
  const card = (title, label = "", assignee = "", due = "") => ({ id: uid(), title, desc: "", label, due, assignee });
  const board = {
    id: uid(), name: "Website Launch",
    members: { [me.id]: "owner", [a.id]: "member", [s.id]: "viewer" },
    lists: [
      { id: uid(), title: "To Do", cards: [card("Write landing copy", "blue", a.id), card("Pick colour palette", "purple")] },
      { id: uid(), title: "In Progress", cards: [card("Build navigation", "orange", me.id)] },
      { id: uid(), title: "Done", cards: [card("Register domain", "green", me.id)] },
    ],
  };
  return { users: [me, a, s], currentUserId: me.id, boards: [board], activeBoardId: board.id };
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.boards) && s.users) return s; } catch {}
  return seed();
}
let state = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { toast("Could not save (storage blocked)"); } }
window.addEventListener("storage", (e) => { if (e.key === KEY) { state = load(); render(); } }); // cross-tab sync

/* ---------- Roles / permissions ---------- */
const user = (id) => state.users.find((u) => u.id === id);
const me = () => user(state.currentUserId);
const visibleBoards = () => state.boards.filter((b) => b.members[state.currentUserId]);
const board = () => visibleBoards().find((b) => b.id === state.activeBoardId) || null;
const role = (b = board()) => (b ? b.members[state.currentUserId] || null : null);
const canEdit = () => ["owner", "member"].includes(role());
const canManage = () => role() === "owner";
function guard(ok, msg = "Your role doesn't allow that") { if (!ok) toast(msg); return ok; }

let toastTimer;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- Mutations (each checks permission) ---------- */
function addBoard() {
  const name = prompt("Board name?"); if (!name || !name.trim()) return;
  const b = { id: uid(), name: name.trim().slice(0, 60), members: { [state.currentUserId]: "owner" },
    lists: ["To Do", "In Progress", "Done"].map((t) => ({ id: uid(), title: t, cards: [] })) };
  state.boards.push(b); state.activeBoardId = b.id; save(); render();
}
function renameBoard() {
  if (!guard(canManage(), "Only the owner can rename the board")) return;
  const n = prompt("Rename board", board().name); if (n && n.trim()) { board().name = n.trim().slice(0, 60); save(); render(); }
}
function deleteBoard() {
  if (!guard(canManage(), "Only the owner can delete the board")) return;
  if (!confirm(`Delete board "${board().name}"?`)) return;
  state.boards = state.boards.filter((b) => b.id !== board().id); state.activeBoardId = null; save(); render();
}
function addList() {
  if (!guard(canEdit())) return;
  const t = prompt("List title?"); if (!t || !t.trim()) return;
  board().lists.push({ id: uid(), title: t.trim().slice(0, 60), cards: [] }); save(); render();
}
function renameList(id, title) {
  if (!canEdit()) return render();
  const l = board().lists.find((l) => l.id === id); if (l && title.trim()) { l.title = title.trim().slice(0, 60); save(); }
}
function deleteList(id) {
  if (!guard(canEdit())) return;
  const l = board().lists.find((l) => l.id === id);
  if (l.cards.length && !confirm(`Delete "${l.title}" and its ${l.cards.length} card(s)?`)) return;
  board().lists = board().lists.filter((x) => x.id !== id); save(); render();
}
function addCard(listId) {
  if (!guard(canEdit())) return;
  const t = prompt("Card title?"); if (!t || !t.trim()) return;
  board().lists.find((l) => l.id === listId).cards.push({ id: uid(), title: t.trim().slice(0, 120), desc: "", label: "", due: "", assignee: "" });
  save(); render();
}
function findCard(id) {
  for (const l of board().lists) { const i = l.cards.findIndex((c) => c.id === id); if (i > -1) return { list: l, index: i, card: l.cards[i] }; }
  return null;
}
function moveCard(cardId, toListId, toIndex) {
  if (!guard(canEdit())) return;
  const f = findCard(cardId); if (!f) return;
  const to = board().lists.find((l) => l.id === toListId);
  f.list.cards.splice(f.index, 1);
  if (f.list === to && f.index < toIndex) toIndex--;      // removal shifted the target
  to.cards.splice(Math.max(0, Math.min(toIndex, to.cards.length)), 0, f.card);
  save(); render();
}

/* ---------- Rendering ---------- */
function render() {
  // user dropdown
  $("#userSelect").innerHTML = state.users.map((u) => `<option value="${u.id}" ${u.id === state.currentUserId ? "selected" : ""}>${esc(u.name)}</option>`).join("");
  // board dropdown
  const vb = visibleBoards();
  if (!board() && vb.length) state.activeBoardId = vb[0].id;
  $("#boardSelect").innerHTML = vb.map((b) => `<option value="${b.id}" ${b.id === state.activeBoardId ? "selected" : ""}>${esc(b.name)}</option>`).join("");
  const b = board(), r = role();
  $("#roleBadge").textContent = r || "no access"; $("#roleBadge").className = "badge " + (r || "");
  $("#membersBtn").disabled = !b;
  $("#renameBoardBtn").disabled = !canManage(); $("#deleteBoardBtn").disabled = !canManage();
  const root = $("#board");
  root.className = "board" + (canEdit() ? "" : " readonly");
  if (!b) { root.innerHTML = `<div class="empty"><h2>No boards yet</h2><p>Create one with “+ Board”.</p></div>`; return; }

  const q = $("#search").value.trim().toLowerCase();
  const edit = canEdit();
  root.innerHTML = b.lists.map((l) => {
    const shown = l.cards.filter((c) => !q || (c.title + " " + c.desc).toLowerCase().includes(q));
    return `<section class="list" data-list="${l.id}">
      <div class="list-head">
        <input class="list-title" value="${esc(l.title)}" data-rename="${l.id}" ${edit ? "" : "readonly"} aria-label="List title">
        <span class="count">${l.cards.length}</span>
        ${edit ? `<button class="icon" data-del-list="${l.id}" title="Delete list">✕</button>` : ""}
      </div>
      <div class="cards" data-cards="${l.id}">
        ${shown.map(cardHtml).join("")}
      </div>
      ${edit ? `<button class="add-card" data-add-card="${l.id}">+ Add a card</button>` : ""}
    </section>`;
  }).join("") + (edit ? `<button class="add-list" id="addListBtn">+ Add another list</button>` : "");
}
function cardHtml(c) {
  const a = user(c.assignee);
  const overdue = c.due && c.due < new Date().toISOString().slice(0, 10);
  return `<article class="card" draggable="${canEdit()}" data-card="${c.id}">
    ${c.label ? `<span class="label l-${esc(c.label)}"></span>` : ""}
    <div>${esc(c.title)}</div>
    <div class="meta">
      ${c.due ? `<span class="${overdue ? "overdue" : ""}">📅 ${esc(c.due)}</span>` : ""}
      ${c.desc ? `<span title="Has description">≡</span>` : ""}
      ${a ? `<span class="avatar" title="${esc(a.name)}">${esc(a.name[0].toUpperCase())}</span>` : ""}
    </div>
  </article>`;
}

/* ---------- Card dialog ---------- */
let editingId = null;
function openCard(id) {
  const f = findCard(id); if (!f) return;
  editingId = id;
  const form = $("#cardForm"), c = f.card, edit = canEdit();
  form.title.value = c.title; form.desc.value = c.desc; form.label.value = c.label; form.due.value = c.due;
  form.assignee.innerHTML = `<option value="">Unassigned</option>` +
    Object.keys(board().members).map((id) => `<option value="${id}">${esc(user(id)?.name)}</option>`).join("");
  form.assignee.value = c.assignee;
  [...form.elements].forEach((el) => { if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) el.disabled = !edit; });
  $("#saveCardBtn").hidden = !edit; $("#deleteCardBtn").hidden = !edit;
  $("#cardDlg").showModal();
}
$("#cardForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!guard(canEdit())) return;
  const f = findCard(editingId), form = e.target; if (!f || !form.title.value.trim()) return;
  Object.assign(f.card, { title: form.title.value.trim(), desc: form.desc.value, label: form.label.value, due: form.due.value, assignee: form.assignee.value });
  save(); $("#cardDlg").close(); render();
});
$("#cancelCardBtn").onclick = () => $("#cardDlg").close();
$("#deleteCardBtn").onclick = () => {
  if (!guard(canEdit()) || !confirm("Delete this card?")) return;
  const f = findCard(editingId); f.list.cards.splice(f.index, 1); save(); $("#cardDlg").close(); render();
};

/* ---------- Members dialog (owner manages roles) ---------- */
function openMembers() {
  const b = board(), owner = canManage();
  $("#membersList").innerHTML = Object.entries(b.members).map(([id, r]) =>
    `<div class="member-row"><span>${esc(user(id)?.name)}</span>
     <select data-role-of="${id}" ${owner ? "" : "disabled"}>${["owner", "member", "viewer"].map((x) => `<option ${x === r ? "selected" : ""}>${x}</option>`).join("")}</select>
     ${owner ? `<button data-remove="${id}">Remove</button>` : ""}</div>`).join("");
  $("#addMemberBox").hidden = !owner;
  $("#membersDlg").showModal();
}
const ownerCount = (b) => Object.values(b.members).filter((r) => r === "owner").length;
$("#membersList").addEventListener("change", (e) => {
  const id = e.target.dataset.roleOf; if (!id || !guard(canManage())) return;
  const b = board();
  if (b.members[id] === "owner" && e.target.value !== "owner" && ownerCount(b) === 1) { toast("Board needs at least one owner"); return openMembers(); }
  b.members[id] = e.target.value; save(); render(); openMembers();
});
$("#membersList").addEventListener("click", (e) => {
  const id = e.target.dataset.remove; if (!id || !guard(canManage())) return;
  const b = board();
  if (b.members[id] === "owner" && ownerCount(b) === 1) return toast("Board needs at least one owner");
  delete b.members[id]; save(); render(); b.members[state.currentUserId] ? openMembers() : $("#membersDlg").close();
});
$("#addMemberBtn").onclick = () => {
  if (!guard(canManage())) return;
  const name = $("#newMemberName").value.trim(); if (!name) return;
  let u = state.users.find((u) => u.name.toLowerCase() === name.toLowerCase());
  if (!u) { u = { id: uid(), name: name.slice(0, 40) }; state.users.push(u); }
  board().members[u.id] = $("#newMemberRole").value;
  $("#newMemberName").value = ""; save(); render(); openMembers();
};
$("#closeMembersBtn").onclick = () => $("#membersDlg").close();

/* ---------- Drag and drop ---------- */
let dragId = null, placeholder = null;
function dropIndex(container, y) {
  const els = [...container.querySelectorAll(".card:not(.dragging)")];
  const listId = container.dataset.cards, list = board().lists.find((l) => l.id === listId);
  for (const el of els) { const r = el.getBoundingClientRect(); if (y < r.top + r.height / 2) return list.cards.findIndex((c) => c.id === el.dataset.card); }
  return list.cards.length;
}
const rootEl = $("#board");
rootEl.addEventListener("dragstart", (e) => {
  const c = e.target.closest(".card"); if (!c || !canEdit()) return e.preventDefault();
  dragId = c.dataset.card; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragId);
  setTimeout(() => c.classList.add("dragging"), 0);
});
rootEl.addEventListener("dragover", (e) => {
  if (!dragId) return;
  const cont = e.target.closest(".cards") || e.target.closest(".list")?.querySelector(".cards"); if (!cont) return;
  e.preventDefault(); e.dataTransfer.dropEffect = "move";
  document.querySelectorAll(".list.drag-over").forEach((l) => l.classList.remove("drag-over"));
  cont.closest(".list").classList.add("drag-over");
  if (!placeholder) { placeholder = document.createElement("div"); placeholder.className = "placeholder"; }
  const after = [...cont.querySelectorAll(".card:not(.dragging)")].find((el) => e.clientY < el.getBoundingClientRect().top + el.offsetHeight / 2);
  cont.insertBefore(placeholder, after || null);
});
rootEl.addEventListener("drop", (e) => {
  if (!dragId) return;
  const cont = e.target.closest(".cards") || e.target.closest(".list")?.querySelector(".cards"); if (!cont) return;
  e.preventDefault();
  const idx = dropIndex(cont, e.clientY), id = dragId; cleanupDrag();
  moveCard(id, cont.dataset.cards, idx);
});
rootEl.addEventListener("dragend", () => { cleanupDrag(); render(); });
function cleanupDrag() {
  dragId = null; placeholder?.remove(); placeholder = null;
  document.querySelectorAll(".list.drag-over").forEach((l) => l.classList.remove("drag-over"));
}

/* ---------- Event delegation & wiring ---------- */
rootEl.addEventListener("click", (e) => {
  const t = e.target;
  if (t.dataset.addCard) return addCard(t.dataset.addCard);
  if (t.dataset.delList) return deleteList(t.dataset.delList);
  if (t.id === "addListBtn") return addList();
  const c = t.closest(".card"); if (c) openCard(c.dataset.card);
});
rootEl.addEventListener("change", (e) => { if (e.target.dataset.rename) renameList(e.target.dataset.rename, e.target.value); });
rootEl.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.dataset.rename) e.target.blur(); });
$("#boardSelect").onchange = (e) => { state.activeBoardId = e.target.value; save(); render(); };
$("#userSelect").onchange = (e) => { state.currentUserId = e.target.value; save(); render(); toast(`Now viewing as ${me().name}`); };
$("#newBoardBtn").onclick = addBoard;
$("#membersBtn").onclick = openMembers;
$("#search").oninput = render;
$("#renameBoardBtn").onclick = renameBoard;
$("#deleteBoardBtn").onclick = deleteBoard;

render();
