const STORAGE_KEY = "restaurant-counter";
const TABLE = "restaurant_counter";
const config = window.RESTAURANT_COUNTER_SUPABASE;
const restUrl = `${config.url}/rest/v1/${TABLE}`;
const headers = {
  apikey: config.anonKey,
  Authorization: `Bearer ${config.anonKey}`,
  "Content-Type": "application/json",
};

const listEl = document.getElementById("list");
const formEl = document.getElementById("add-form");
const inputEl = document.getElementById("name-input");
const menuEl = document.getElementById("menu");
const sheetEl = document.getElementById("sheet");
const sheetNameEl = document.getElementById("sheet-name");
const menuDecBtn = menuEl.querySelector('[data-action="dec"]');
const sheetDecBtn = sheetEl.querySelector('[data-action="dec"]');

let restaurants = [];
let menuId = null;

function isDesktop() {
  return window.matchMedia("(min-width: 720px)").matches;
}

function hideMenu() {
  menuEl.hidden = true;
  sheetEl.hidden = true;
  document.body.classList.remove("sheet-open");
  menuId = null;
}

function placeMenu(anchor) {
  const margin = 8;
  const gap = 4;
  const rect = anchor.getBoundingClientRect();
  menuEl.hidden = false;
  menuEl.style.maxHeight = "";
  menuEl.style.top = "0px";
  menuEl.style.left = "0px";
  const menuRect = menuEl.getBoundingClientRect();
  const spaceDown = window.innerHeight - margin - rect.bottom - gap;
  const spaceUp = rect.top - margin - gap;
  let top;
  if (menuRect.height <= spaceDown) {
    top = rect.bottom + gap;
  } else if (menuRect.height <= spaceUp) {
    top = rect.top - menuRect.height - gap;
  } else if (spaceDown >= spaceUp) {
    top = rect.bottom + gap;
    menuEl.style.maxHeight = `${Math.max(36, spaceDown)}px`;
  } else {
    menuEl.style.maxHeight = `${Math.max(36, spaceUp)}px`;
    const height = Math.min(menuRect.height, Math.max(36, spaceUp));
    top = rect.top - height - gap;
  }
  let left = rect.right - menuRect.width;
  if (left + menuRect.width > window.innerWidth - margin) {
    left = window.innerWidth - margin - menuRect.width;
  }
  if (left < margin) left = margin;
  if (top < margin) top = margin;
  menuEl.style.top = `${top}px`;
  menuEl.style.left = `${left}px`;
}

function showChooser(anchor, restaurant) {
  menuId = restaurant.id;
  const canDecrease = restaurant.count > 0;
  menuDecBtn.disabled = !canDecrease;
  sheetDecBtn.disabled = !canDecrease;
  sheetNameEl.textContent = restaurant.name;
  if (isDesktop()) {
    sheetEl.hidden = true;
    document.body.classList.remove("sheet-open");
    placeMenu(anchor);
    return;
  }
  menuEl.hidden = true;
  sheetEl.hidden = false;
  document.body.classList.add("sheet-open");
}

function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

function nameKey(name) {
  return name.trim().toLowerCase();
}

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateStamp(date) {
  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())}.${String(date.getFullYear()).slice(-2)}`;
}

function timeStamp(date) {
  return `${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function stampDates(restaurant) {
  const added = toDate(restaurant.added_at);
  const dates = added ? [added] : [];
  for (const visit of restaurant.visits) {
    const date = toDate(visit);
    if (date) dates.push(date);
  }
  return dates;
}

function stampLines(restaurant) {
  const dates = stampDates(restaurant);
  const groups = [];
  for (const date of dates) {
    const last = groups[groups.length - 1];
    if (last && sameDay(last[0], date)) last.push(date);
    else groups.push([date]);
  }
  return groups.map((group, index) => {
    const times = group.map(timeStamp).join(", ");
    const line = `${dateStamp(group[0])} ${times}`;
    return index === 0 ? `First added ${line}` : line;
  });
}

function cacheSave() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(restaurants));
}

function cacheLoad() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalize).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function normalize(row) {
  if (!row || typeof row !== "object") return null;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!name) return null;
  const added = toDate(row.added_at || row.created_at);
  if (!added) return null;
  const visits = Array.isArray(row.visits)
    ? row.visits.map(toDate).filter(Boolean).map((date) => date.toISOString())
    : [];
  const count = Math.max(0, Number.isFinite(row.count) ? Math.trunc(row.count) : visits.length);
  return {
    id: typeof row.id === "string" && row.id ? row.id : crypto.randomUUID(),
    name,
    name_key: typeof row.name_key === "string" ? row.name_key : nameKey(name),
    count,
    added_at: added.toISOString(),
    visits,
    created_at: (toDate(row.created_at) || added).toISOString(),
  };
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }
  if (response.status === 204) return null;
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

function render() {
  hideMenu();
  listEl.replaceChildren();
  for (const restaurant of restaurants) {
    const item = document.createElement("li");
    item.className = "item";
    item.dataset.id = restaurant.id;

    const nameBtn = document.createElement("button");
    nameBtn.type = "button";
    nameBtn.className = "name";
    nameBtn.dataset.action = "inc";
    nameBtn.textContent = restaurant.name;

    const countEl = document.createElement("span");
    countEl.className = "count";
    countEl.textContent = String(restaurant.count);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove";
    removeBtn.dataset.action = "del";
    removeBtn.setAttribute("aria-label", `Remove ${restaurant.name}`);
    removeBtn.textContent = "−";

    const stamps = document.createElement("ul");
    stamps.className = "stamps";

    for (const text of stampLines(restaurant)) {
      const line = document.createElement("li");
      line.textContent = text;
      stamps.appendChild(line);
    }

    item.append(nameBtn, countEl, removeBtn, stamps);
    listEl.appendChild(item);
  }
}

function findById(id) {
  return restaurants.find((item) => item.id === id);
}

function hasName(name) {
  const key = nameKey(name);
  return restaurants.some((item) => item.name_key === key);
}

async function loadRemote() {
  const rows = await api(`${restUrl}?select=*&order=created_at.asc`);
  return Array.isArray(rows) ? rows.map(normalize).filter(Boolean) : [];
}

async function persistInsert(row) {
  const [saved] = await api(restUrl, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      name: row.name,
      name_key: row.name_key,
      count: row.count,
      added_at: row.added_at,
      visits: row.visits,
      created_at: row.created_at,
    }),
  });
  return normalize(saved);
}

async function persistUpdate(row) {
  await api(`${restUrl}?id=eq.${encodeURIComponent(row.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      count: row.count,
      visits: row.visits,
    }),
  });
}

async function persistDelete(id) {
  await api(`${restUrl}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

function commit() {
  cacheSave();
  render();
}

async function deleteRestaurant(restaurant) {
  const snapshot = restaurants.slice();
  restaurants = restaurants.filter((entry) => entry.id !== restaurant.id);
  commit();
  try {
    await persistDelete(restaurant.id);
  } catch {
    restaurants = snapshot;
    commit();
  }
}

async function decreaseRestaurant(restaurant) {
  if (restaurant.count <= 0) return;
  const previousCount = restaurant.count;
  const previousVisits = restaurant.visits.slice();
  restaurant.count -= 1;
  restaurant.visits.pop();
  commit();
  try {
    await persistUpdate(restaurant);
  } catch {
    restaurant.count = previousCount;
    restaurant.visits = previousVisits;
    commit();
  }
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = inputEl.value.trim();
  if (!name || hasName(name)) {
    inputEl.value = "";
    return;
  }

  const now = new Date().toISOString();
  const local = {
    id: crypto.randomUUID(),
    name,
    name_key: nameKey(name),
    count: 0,
    added_at: now,
    visits: [],
    created_at: now,
  };

  restaurants.push(local);
  inputEl.value = "";
  commit();

  try {
    const saved = await persistInsert(local);
    if (saved) {
      const index = restaurants.findIndex((item) => item.id === local.id);
      if (index >= 0) restaurants[index] = saved;
      commit();
    }
  } catch {
    restaurants = restaurants.filter((item) => item.id !== local.id);
    commit();
  }
});

listEl.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const item = button.closest(".item");
  if (!item) return;
  const restaurant = findById(item.dataset.id);
  if (!restaurant) return;

  if (button.dataset.action === "inc") {
    restaurant.count += 1;
    restaurant.visits.push(new Date().toISOString());
    commit();
    try {
      await persistUpdate(restaurant);
    } catch {
      restaurant.count = Math.max(0, restaurant.count - 1);
      restaurant.visits.pop();
      commit();
    }
    return;
  }

  if (button.dataset.action === "del") {
    event.stopPropagation();
    showChooser(button, restaurant);
  }
});

async function chooseAction(action) {
  const restaurant = findById(menuId);
  hideMenu();
  if (!restaurant) return;
  if (action === "dec") await decreaseRestaurant(restaurant);
  if (action === "delete") await deleteRestaurant(restaurant);
}

menuEl.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  await chooseAction(button.dataset.action);
});

sheetEl.addEventListener("click", async (event) => {
  if (event.target.closest(".sheet-dismiss")) {
    hideMenu();
    return;
  }
  const button = event.target.closest(".sheet-screen button");
  if (!button) return;
  await chooseAction(button.dataset.action);
});

document.addEventListener("pointerdown", (event) => {
  if (menuEl.hidden) return;
  if (menuEl.contains(event.target)) return;
  if (event.target.closest(".remove")) return;
  hideMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideMenu();
});

window.addEventListener("resize", () => {
  if (!menuId) return;
  if (isDesktop()) hideMenu();
});
window.addEventListener("scroll", () => {
  if (!menuEl.hidden) hideMenu();
}, true);

async function start() {
  restaurants = cacheLoad();
  render();
  try {
    restaurants = await loadRemote();
    commit();
  } catch {
    cacheSave();
  }
}

start();
