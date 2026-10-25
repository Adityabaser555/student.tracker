// Student Expense Tracker: vanilla JavaScript, data saved in localStorage
const STORAGE_KEY = "studentExpenseTracker";
const CATEGORIES = {
  Food: "#f59e0b", Travel: "#38bdf8", Books: "#34d399",
  Entertainment: "#f472b6", Rent: "#a78bfa", Other: "#94a3b8",
};

const $ = (id) => document.getElementById(id);
const form = $("expenseForm");
let editingId = null; // id of the expense being edited, or null when adding

// ---------- Storage ----------
function loadState() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && Array.isArray(data.expenses)) {
      return { expenses: data.expenses, budget: Number(data.budget) || 0 };
    }
  } catch (e) { /* ignore broken or unavailable storage */ }
  return { expenses: [], budget: 0 };
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.warn("Could not save to localStorage:", e); }
}
let state = loadState();

// ---------- Helpers ----------
const money = (n) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
const formatDate = (iso) => new Date(iso + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const sum = (items) => items.reduce((t, e) => t + e.amount, 0);

// Create an element and set its text safely (user input is never inserted as HTML)
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---------- Setup ----------
function fillSelect(select, includeAll) {
  if (includeAll) select.append(new Option("All categories", "all"));
  Object.keys(CATEGORIES).forEach((c) => select.append(new Option(c, c)));
}
fillSelect($("category"), false);
fillSelect($("filterCat"), true);
$("date").value = todayISO();
$("budget").value = state.budget || "";

// ---------- Validation ----------
function setError(id, message) {
  $(id + "Error").textContent = message;
  $(id).classList.toggle("invalid", Boolean(message));
  return !message;
}

// ---------- Add / edit ----------
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = $("title").value.trim();
  const amount = parseFloat($("amount").value);
  const date = $("date").value;

  const ok = [
    setError("title", title.length < 2 ? "Enter a description (at least 2 characters)." : ""),
    setError("amount", !(amount > 0) || amount > 10000000 ? "Enter an amount between 0.01 and 1,00,00,000." : ""),
    setError("date", !date ? "Choose a date." : date > todayISO() ? "Date cannot be in the future." : ""),
  ].every(Boolean);
  if (!ok) return;

  const data = { title, amount: Math.round(amount * 100) / 100, date, category: $("category").value };
  if (editingId) {
    state.expenses = state.expenses.map((e) => (e.id === editingId ? { ...e, ...data } : e));
  } else {
    state.expenses.push({ id: Date.now(), ...data });
  }
  saveState();
  resetForm();
  render();
  $("title").focus();
});

function resetForm() {
  editingId = null;
  form.reset();
  $("date").value = todayISO();
  $("formTitle").textContent = "Add expense";
  $("submitBtn").textContent = "Add expense";
  $("cancelEdit").hidden = true;
  ["title", "amount", "date"].forEach((id) => setError(id, ""));
}
$("cancelEdit").addEventListener("click", resetForm);

function startEdit(expense) {
  editingId = expense.id;
  $("title").value = expense.title;
  $("amount").value = expense.amount;
  $("date").value = expense.date;
  $("category").value = expense.category;
  $("formTitle").textContent = "Edit expense";
  $("submitBtn").textContent = "Save changes";
  $("cancelEdit").hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  $("title").focus();
}

// ---------- List actions (event delegation) ----------
$("list").addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-id]");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  if (btn.dataset.action === "delete") {
    state.expenses = state.expenses.filter((e) => e.id !== id);
    if (editingId === id) resetForm();
    saveState();
    render();
  } else {
    startEdit(state.expenses.find((e) => e.id === id));
  }
});

$("clearAll").addEventListener("click", () => {
  if (state.expenses.length && confirm("Delete all expenses? This cannot be undone.")) {
    state.expenses = [];
    resetForm();
    saveState();
    render();
  }
});

// ---------- Budget ----------
$("budget").addEventListener("input", () => {
  state.budget = Math.max(0, parseFloat($("budget").value) || 0);
  saveState();
  render();
});

// ---------- Filters ----------
["search", "filterCat", "sortBy"].forEach((id) => $(id).addEventListener("input", render));

// ---------- Export CSV ----------
$("exportBtn").addEventListener("click", () => {
  if (!state.expenses.length) return alert("No expenses to export yet.");
  const quote = (v) => '"' + String(v).replace(/"/g, '""') + '"';
  const rows = [["Date", "Description", "Category", "Amount"]]
    .concat(state.expenses.map((e) => [e.date, e.title, e.category, e.amount]));
  const blob = new Blob([rows.map((r) => r.map(quote).join(",")).join("\n")], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "expenses.csv";
  link.click();
  URL.revokeObjectURL(link.href);
});

// ---------- Rendering ----------
function renderStats() {
  const thisMonth = state.expenses.filter((e) => e.date.slice(0, 7) === todayISO().slice(0, 7));
  const spent = sum(thisMonth);
  $("total").textContent = money(sum(state.expenses));
  $("month").textContent = money(spent);
  $("count").textContent = state.expenses.length;

  const bar = $("budgetBar");
  if (state.budget > 0) {
    const pct = (spent / state.budget) * 100;
    bar.style.width = Math.min(pct, 100) + "%";
    bar.classList.toggle("over", pct > 100);
    $("budgetText").textContent = spent > state.budget
      ? `Over budget by ${money(spent - state.budget)} this month.`
      : `${money(state.budget - spent)} left this month (${Math.round(pct)}% used).`;
  } else {
    bar.style.width = "0";
    bar.classList.remove("over");
    $("budgetText").textContent = "Set a budget to track this month's spending.";
  }
}

function renderChart() {
  const total = sum(state.expenses);
  const legend = $("legend");
  legend.innerHTML = "";
  $("donutTotal").textContent = money(total).replace(".00", "");
  if (!total) {
    $("donut").style.background = "";
    legend.append(el("li", "empty", "No data yet."));
    return;
  }
  let start = 0;
  const stops = [];
  Object.keys(CATEGORIES).forEach((cat) => {
    const amount = sum(state.expenses.filter((e) => e.category === cat));
    if (!amount) return;
    const pct = (amount / total) * 100;
    stops.push(`${CATEGORIES[cat]} ${start}% ${start + pct}%`);
    start += pct;
    const li = el("li");
    const dot = el("i");
    dot.style.background = CATEGORIES[cat];
    li.append(dot, el("span", "l-name", cat), el("span", "", `${money(amount)} (${Math.round(pct)}%)`));
    legend.append(li);
  });
  $("donut").style.background = `conic-gradient(${stops.join(", ")})`;
}

function renderList() {
  const query = $("search").value.trim().toLowerCase();
  const cat = $("filterCat").value;
  const sorters = {
    new: (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
    old: (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
    high: (a, b) => b.amount - a.amount,
    low: (a, b) => a.amount - b.amount,
  };
  const shown = state.expenses
    .filter((e) => (cat === "all" || e.category === cat) && e.title.toLowerCase().includes(query))
    .sort(sorters[$("sortBy").value]);

  const list = $("list");
  list.innerHTML = "";
  if (!shown.length) {
    list.append(el("li", "empty", state.expenses.length ? "No expenses match your filters." : "Add your first expense to get started."));
    return;
  }
  shown.forEach((e) => {
    const li = el("li");
    const dot = el("span", "dot");
    dot.style.background = CATEGORIES[e.category] || CATEGORIES.Other;
    const info = el("div", "info");
    info.append(el("div", "name", e.title), el("div", "meta", `${e.category} · ${formatDate(e.date)}`));

    const edit = el("button", "icon-btn", "Edit");
    const del = el("button", "icon-btn del", "✕");
    edit.dataset.id = del.dataset.id = e.id;
    edit.dataset.action = "edit";
    del.dataset.action = "delete";
    edit.setAttribute("aria-label", "Edit " + e.title);
    del.setAttribute("aria-label", "Delete " + e.title);

    li.append(dot, info, el("span", "amt", money(e.amount)), edit, del);
    list.append(li);
  });
}

function render() {
  renderStats();
  renderChart();
  renderList();
}
render();