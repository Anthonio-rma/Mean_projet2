// chat.js (version corrigée + socket.io + profil modal + room join)
// ⚠️ Assure-toi que message.html charge d'abord : <script src="/socket.io/socket.io.js"></script>

const API_BASE = "http://localhost:3000";

let socket = null;
let me = null;
let currentConversationId = null;

// DOM elements
const conversationList = document.getElementById("conversationList");
const chatDisplay = document.getElementById("chatDisplay");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const currentAvatar = document.getElementById("currentAvatar");
const currentName = document.getElementById("currentName");
const currentStatus = document.getElementById("currentStatus");

const elName = document.getElementById("name");
const elImg = document.getElementById("img");

// Profile modal elements
const profileModal = document.getElementById("profileModal");
const profileBackdrop = document.getElementById("profileBackdrop");
const profileClose = document.getElementById("profileClose");
const profileAvatar = document.getElementById("profileAvatar");
const profileName = document.getElementById("profileName");
const profilePhone = document.getElementById("profilePhone");
const profilePhone2 = document.getElementById("profilePhone2");
const profileStatus = document.getElementById("profileStatus");

// --- Utils ---
function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

async function fetchJSON(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// --- Socket ---
function initSocket() {
  if (typeof window.io !== "function") {
    console.error("socket.io client introuvable. Ajoute <script src='/socket.io/socket.io.js'></script> dans message.html");
    return;
  }

  socket = window.io(API_BASE, { withCredentials: true });

  socket.on("connect", () => {
    console.log("✅ socket connected:", socket.id);
  });

  socket.on("disconnect", () => {
    console.log("⚠️ socket disconnected");
  });

  socket.on("newMessage", (msg) => {
    // ✅ éviter doublon : si c'est moi qui l'ai envoyé, on ignore l'event
    const senderId = msg.sender?._id || msg.sender;
    if (me && senderId && String(senderId) === String(me._id)) {
      loadConversations().catch(() => {});
      return;
    }

    const convId = String(msg.conversationId || msg.conversation || "");
    if (String(currentConversationId) === convId) {
      chatDisplay.insertAdjacentHTML("beforeend", renderMessage(msg));
      refreshIcons();
      chatDisplay.scrollTop = chatDisplay.scrollHeight;
    }
    loadConversations().catch(() => {});
  });

  socket.on("presence", ({ userId, online }) => {
    console.log("presence", userId, online);
  });
}

// --- User ---
async function fetchUser() {
  const data = await fetchJSON("/api/users/me", { method: "GET" });
  me = data; // { _id, fullname, phone, image, connect? }

  elName.textContent = data.fullname || "";
  elImg.src = data.image || "https://i.pravatar.cc/150?u=me";
}

// --- Profile modal ---
async function openProfile(user) {
  if (!user?._id) return;

  const full = await fetchJSON(`/api/users/${user._id}`, { method: "GET" });

  profileAvatar.src =
    full.image || `https://i.pravatar.cc/150?u=${encodeURIComponent(full.fullname || "user")}`;
  profileName.textContent = full.fullname || "";
  profilePhone.textContent = full.phone ? `+261 ${full.phone}` : "";
  profilePhone2.textContent = full.phone ? `+261 ${full.phone}` : "";
  profileStatus.textContent = full.connect ? "En ligne" : "Hors ligne";

  profileModal?.classList.remove("hidden");
}

function closeProfile() {
  profileModal?.classList.add("hidden");
}

profileBackdrop?.addEventListener("click", closeProfile);
profileClose?.addEventListener("click", closeProfile);

// --- Conversations ---
function getOtherParticipant(conv) {
  const participants = conv.participants || [];
  const others = participants.filter((u) => String(u._id) !== String(me?._id));
  return others[0] || null;
}

function renderConversationItem(conv) {
  const other = getOtherParticipant(conv);
  const otherName = other?.fullname || "Discussion";
  const otherAvatar =
    other?.image || `https://i.pravatar.cc/150?u=${encodeURIComponent(otherName)}`;

  const lastText = conv.lastMessage?.text ? conv.lastMessage.text : "";
  const time = conv.lastMessage?.createdAt ? formatTime(conv.lastMessage.createdAt) : "";
  const unread = conv.unread || 0;

  const activeClass = String(conv._id) === String(currentConversationId) ? "active" : "";

  return `
    <div class="contact-item ${activeClass}" data-conv-id="${conv._id}">
      <img src="${escapeHtml(otherAvatar)}" alt="${escapeHtml(otherName)}">
      <div class="contact-info">
        <div class="contact-header">
          <span class="name">${escapeHtml(otherName)}</span>
          <span class="time">${escapeHtml(time)}</span>
        </div>
        <div class="contact-msg">
          <p>${escapeHtml(lastText)}</p>
          ${unread > 0 ? `<span class="badge">${unread}</span>` : ""}
        </div>
      </div>
    </div>
  `;
}

async function loadConversations() {
  const conversations = await fetchJSON("/api/chat/conversations", { method: "GET" });

  if (!Array.isArray(conversations) || conversations.length === 0) {
    conversationList.innerHTML = `
      <div style="padding: 12px; color: #666; font-size: 14px;">
        Aucune discussion. Clique sur ➕ pour démarrer.
      </div>
    `;
    refreshIcons();
    return;
  }

  conversationList.innerHTML = conversations.map(renderConversationItem).join("");
  refreshIcons();

  conversationList.querySelectorAll(".contact-item").forEach((item) => {
    item.addEventListener("click", async () => {
      const convId = item.getAttribute("data-conv-id");
      await openConversation(convId);
    });
  });
}

// --- Messages ---
function renderMessage(msg) {
  const senderId = msg.sender?._id || msg.sender;
  const isMe = me && String(senderId) === String(me._id);
  const rowClass = isMe ? "outgoing" : "incoming";
  const time = msg.createdAt ? formatTime(msg.createdAt) : "";

  // coches uniquement sur outgoing
  const ticks = isMe ? ` <i data-lucide="check-check" class="status-icon"></i>` : "";

  return `
    <div class="message-row ${rowClass}">
      <div class="message-bubble">
        ${escapeHtml(msg.text || "")}
        <div class="message-meta">${escapeHtml(time)}${ticks}</div>
      </div>
    </div>
  `;
}

async function openConversation(convId) {
  currentConversationId = convId;

  // ✅ rejoindre la room socket de cette conversation
  if (socket) socket.emit("joinConversation", convId);

  // Charger messages
  const messages = await fetchJSON(`/api/chat/conversations/${convId}/messages?limit=50`, {
    method: "GET",
  });

  chatDisplay.innerHTML = Array.isArray(messages) ? messages.map(renderMessage).join("") : "";
  refreshIcons();
  chatDisplay.scrollTop = chatDisplay.scrollHeight;

  // Marquer comme lu
  await fetchJSON(`/api/chat/conversations/${convId}/read`, { method: "POST" });

  // Mettre header (nom/photo) + clic profil
  const convs = await fetchJSON("/api/chat/conversations", { method: "GET" });
  const conv = Array.isArray(convs) ? convs.find((c) => String(c._id) === String(convId)) : null;
  const other = conv ? getOtherParticipant(conv) : null;

  currentName.textContent = other?.fullname || "Discussion";
  currentAvatar.src =
    other?.image || `https://i.pravatar.cc/150?u=${encodeURIComponent(other?.fullname || "user")}`;
  currentStatus.textContent = "";

  if (other && other._id) {
    currentAvatar.style.cursor = "pointer";
    currentName.style.cursor = "pointer";
    currentAvatar.onclick = () => openProfile(other);
    currentName.onclick = () => openProfile(other);
  } else {
    currentAvatar.style.cursor = "default";
    currentName.style.cursor = "default";
    currentAvatar.onclick = null;
    currentName.onclick = null;
  }

  await loadConversations();
}

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;
  if (!currentConversationId) return alert("Sélectionne une discussion d'abord.");

  // POST -> backend -> renvoie msg (et backend émet socket aux autres)
  const msg = await fetchJSON(`/api/chat/conversations/${currentConversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });

  messageInput.value = "";
  chatDisplay.insertAdjacentHTML("beforeend", renderMessage(msg));
  refreshIcons();
  chatDisplay.scrollTop = chatDisplay.scrollHeight;

  await loadConversations();
}

sendBtn?.addEventListener("click", sendMessage);
messageInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

// --- New chat flow ---
async function newChatFlow() {
  const users = await fetchJSON("/api/users/all", { method: "GET" });

  if (!Array.isArray(users) || users.length === 0) {
    alert("Aucun autre utilisateur trouvé. Crée un 2e compte d'abord.");
    return;
  }

  const list = users.map((u, i) => `${i + 1}. ${u.fullname} (${u.phone})`).join("\n");
  const choice = prompt(`Choisis un contact (numéro) :\n\n${list}`);
  const idx = parseInt(choice, 10) - 1;

  if (Number.isNaN(idx) || idx < 0 || idx >= users.length) return;

  const otherUserId = users[idx]._id;

  const created = await fetchJSON("/api/chat/conversations/direct", {
    method: "POST",
    body: JSON.stringify({ otherUserId }),
  });

  await loadConversations();
  if (created?.conversationId) {
    await openConversation(created.conversationId);
  }
}

const newChatBtn = document.getElementById("newChatBtn");
newChatBtn?.addEventListener("click", () => {
  newChatFlow().catch((err) => {
    console.error(err);
    alert(err.message || "Erreur");
  });
});

// ✅ Un seul DOMContentLoaded (tout en bas)
window.addEventListener("DOMContentLoaded", async () => {
  try {
    await fetchUser();
    initSocket();
    await loadConversations();
    refreshIcons();
  } catch (err) {
    console.error(err);
    alert(err.message || "Erreur serveur");
  }
});