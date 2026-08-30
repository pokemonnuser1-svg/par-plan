const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

const STORAGE_KEY = "shared_planner_v1";
const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"members":[],"events":[]}');

function currentUser() {
  const u = tg?.initDataUnsafe?.user;
  return u ? {
    id: String(u.id),
    name: [u.first_name, u.last_name].filter(Boolean).join(" ") || "Пользователь",
    short: u.first_name || "П"
  } : {id:"local-user", name:"Евгений", short:"Е"};
}

const me = currentUser();

if (!state.members.length) {
  state.members.push({id: me.id, name: me.name, color:"#3b82f6"});
}
if (!state.members.some(x => x.id === me.id)) {
  state.members.unshift({id: me.id, name: me.name, color:"#3b82f6"});
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function render() {
  document.getElementById("userName").textContent = me.name;
  document.getElementById("avatar").textContent = me.short[0].toUpperCase();
  document.getElementById("memberCount").textContent =
    `${state.members.length} ${state.members.length === 1 ? "участник" : "участника"}`;

  const members = document.getElementById("members");
  members.innerHTML = state.members.map(m =>
    `<div class="member"><span class="dot" style="background:${m.color}"></span>${escapeHtml(m.name)}</div>`
  ).join("");

  const events = document.getElementById("events");
  const today = new Date().toISOString().slice(0,10);
  const todayEvents = state.events.filter(e => e.date === today)
    .sort((a,b) => (a.time||"99:99").localeCompare(b.time||"99:99"));

  events.innerHTML = todayEvents.map(e => `
    <div class="event">
      <div class="event-time">${e.time || "—"}</div>
      <div>
        <div class="event-title">${escapeHtml(e.title)}</div>
        <div class="event-author">${escapeHtml(e.authorName)}</div>
      </div>
    </div>
  `).join("");

  document.getElementById("empty").style.display = todayEvents.length ? "none" : "block";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

document.getElementById("addBtn").onclick = () => {
  document.getElementById("eventDialog").showModal();
};

document.getElementById("eventForm").onsubmit = (e) => {
  e.preventDefault();
  const title = document.getElementById("eventTitle").value.trim();
  const time = document.getElementById("eventTime").value;
  if (!title) return;
  state.events.push({
    id: crypto.randomUUID(),
    title,
    time,
    date: new Date().toISOString().slice(0,10),
    authorId: me.id,
    authorName: me.name
  });
  document.getElementById("eventDialog").close();
  document.getElementById("eventTitle").value = "";
  document.getElementById("eventTime").value = "";
  save();
};

document.getElementById("inviteBtn").onclick = async () => {
  // For the first prototype we create a simple Telegram share link.
  // Real group joining/synchronization will be added after the basic Mini App works.
  const botUsername = tg?.initDataUnsafe?.receiver?.username || "YOUR_BOT_USERNAME";
  const link = `https://t.me/${botUsername}?startapp=invite`;
  const text = `Таня, присоединяйся к нашему планировщику: ${link}`;

  if (tg?.openTelegramLink) {
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
  } else {
    await navigator.clipboard?.writeText(link);
    alert("Ссылка скопирована: " + link);
  }
};

render();
