const API_BASE = "http://localhost:3000";

let socket = null;
let me = null;
let currentConversationId = null;
let allUsers = [];

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

// Profile modal
const profileModal = document.getElementById("profileModal");
const profileBackdrop = document.getElementById("profileBackdrop");
const profileClose = document.getElementById("profileClose");
const profileAvatar = document.getElementById("profileAvatar");
const profileName = document.getElementById("profileName");
const profilePhone = document.getElementById("profilePhone");
const profilePhone2 = document.getElementById("profilePhone2");
const profileStatus = document.getElementById("profileStatus");

// =========================
// UTILS
// =========================
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
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function fetchJSON(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
}

// =========================
// SOCKET
// =========================
function initSocket() {
  if (typeof window.io !== "function") {
    console.error("Socket.io client non chargé");
    return;
  }

  socket = io(API_BASE, { withCredentials: true });

  socket.on("connect", () => {
    console.log("✅ Socket connecté :", socket.id);

    if (me?._id) {
      socket.emit("join", me._id);
    }

    if (currentConversationId) {
      socket.emit("joinConversation", currentConversationId);
    }
  });

  socket.on("disconnect", () => {
    console.log("⚠️ Socket déconnecté");
  });

  socket.on("newMessage", (msg) => {
    const senderId = msg.sender?._id || msg.sender;
    const convId = String(msg.conversation || "");

    if (String(currentConversationId) === convId) {
      const alreadyExists = document.querySelector(`[data-msg-id="${msg._id}"]`);
      if (!alreadyExists) {
        chatDisplay.insertAdjacentHTML("beforeend", renderMessage(msg));
        refreshIcons();
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
      }

      fetchJSON(`/api/chat/conversations/${convId}/read`, { method: "POST" }).catch(() => {});
    }

    loadConversations().catch(() => {});
  });

  socket.on("users:online", (onlineIds) => {
    if (!Array.isArray(onlineIds)) return;

    allUsers = allUsers.map(u => ({
      ...u,
      connect: onlineIds.includes(String(u._id))
    }));

    if (currentConversationId) {
      updateCurrentHeaderFromConversation(currentConversationId).catch(() => {});
    }

    loadConversations().catch(() => {});
  });

  socket.on("presence", ({ userId, online }) => {
    allUsers = allUsers.map(u =>
      String(u._id) === String(userId) ? { ...u, connect: online } : u
    );

    if (currentConversationId) {
      updateCurrentHeaderFromConversation(currentConversationId).catch(() => {});
    }
  });
}

// =========================
// USER
// =========================
async function fetchUser() {
  me = await fetchJSON("/api/users/me", { method: "GET" });
  elName.textContent = me.fullname || "";
  elImg.src = me.image || me.file || "https://i.pravatar.cc/150?u=me";
}

async function fetchAllUsers() {
  allUsers = await fetchJSON("/api/users/all", { method: "GET" });
  if (!Array.isArray(allUsers)) {
    allUsers = [];
  }
}

// =========================
// PROFILE MODAL
// =========================
async function openProfile(user) {
  if (!user?._id) return;

  const full =
    allUsers.find(u => String(u._id) === String(user._id)) ||
    await fetchJSON(`/api/users/${user._id}`, { method: "GET" });

  profileAvatar.src =
    full.image ||
    full.file ||
    `https://i.pravatar.cc/150?u=${encodeURIComponent(full.fullname || "user")}`;

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

// =========================
// CONVERSATION HELPERS
// =========================
function getOtherParticipant(conv) {
  if (!conv?.participants) return null;
  return conv.participants.find(u => String(u._id) !== String(me?._id)) || null;
}

function renderConversationItem(conv) {
  let other = getOtherParticipant(conv);

  if (other) {
    const found = allUsers.find(u => String(u._id) === String(other._id));
    if (found) {
      other = { ...other, ...found };
    }
  }

  const otherName = other?.fullname || "Discussion";
  const otherAvatar =
    other?.image ||
    other?.file ||
    "https://cdn-icons-png.flaticon.com/512/149/149071.png";

  const lastText = conv.lastMessage?.text || "";
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
      <div style="padding:12px;color:#666;font-size:14px;">
        Aucune discussion. Clique sur ➕ pour démarrer.
      </div>
    `;
    refreshIcons();
    return;
  }

  conversationList.innerHTML = conversations.map(renderConversationItem).join("");
  refreshIcons();

  conversationList.querySelectorAll(".contact-item").forEach(item => {
    item.addEventListener("click", async () => {
      const convId = item.getAttribute("data-conv-id");
      await openConversation(convId);
    });
  });
}

async function updateCurrentHeaderFromConversation(convId) {
  const convs = await fetchJSON("/api/chat/conversations", { method: "GET" });
  const conv = Array.isArray(convs) ? convs.find(c => String(c._id) === String(convId)) : null;

  let other = conv ? getOtherParticipant(conv) : null;

  if (other) {
    const userInfo = allUsers.find(u => String(u._id) === String(other._id));
    if (userInfo) {
      other = { ...other, ...userInfo };
    }
  }

  currentName.textContent = other?.fullname || "Discussion";
  currentAvatar.src =
    other?.image ||
    other?.file ||
    `https://i.pravatar.cc/150?u=${encodeURIComponent(other?.fullname || "user")}`;

  currentStatus.textContent = other?.connect ? "En ligne" : "Hors ligne";

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
}

// =========================
// MESSAGES
// =========================
function renderMessage(msg) {
  const senderId = msg.sender?._id || msg.sender;
  const isMe = me && String(senderId) === String(me._id);
  const rowClass = isMe ? "outgoing" : "incoming";
  const time = msg.createdAt ? formatTime(msg.createdAt) : "";
  const ticks = isMe ? ` <i data-lucide="check-check" class="status-icon"></i>` : "";

  return `
    <div class="message-row ${rowClass}" data-msg-id="${msg._id || ""}">
      <div class="message-bubble">
        ${escapeHtml(msg.text || "")}
        <div class="message-meta">${escapeHtml(time)}${ticks}</div>
      </div>
    </div>
  `;
}

// =========================
// OPEN CONVERSATION
// =========================
async function openConversation(convId) {
  if (currentConversationId && socket && currentConversationId !== convId) {
    socket.emit("leaveConversation", currentConversationId);
  }

  currentConversationId = convId;

  if (socket) {
    socket.emit("joinConversation", convId);
  }

  const messages = await fetchJSON(`/api/chat/conversations/${convId}/messages?limit=50`, {
    method: "GET"
  });

  chatDisplay.innerHTML = Array.isArray(messages)
    ? messages.map(renderMessage).join("")
    : "";

  refreshIcons();
  chatDisplay.scrollTop = chatDisplay.scrollHeight;

  await fetchJSON(`/api/chat/conversations/${convId}/read`, { method: "POST" });

  await updateCurrentHeaderFromConversation(convId);
  await loadConversations();
}

// =========================
// SEND MESSAGE
// =========================
async function sendMessage() {
  const text = messageInput.value.trim();

  if (!text) return;

  if (!currentConversationId) {
    alert("Sélectionne une discussion d'abord.");
    return;
  }

  await fetchJSON(`/api/chat/conversations/${currentConversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text })
  });

  messageInput.value = "";
  await loadConversations();
}

sendBtn?.addEventListener("click", sendMessage);

messageInput?.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    sendMessage();
  }
});

// =========================
// NEW CHAT FLOW
// =========================
async function newChatFlow() {
  if (!allUsers.length) {
    await fetchAllUsers();
  }

  const users = allUsers.filter(u => String(u._id) !== String(me._id));

  if (!users.length) {
    return alert("Aucun autre utilisateur trouvé.");
  }

  const list = users.map((u, i) => `${i + 1}. ${u.fullname} (${u.phone || "-"})`).join("\n");
  const choice = prompt(`Choisis un contact (numéro) :\n\n${list}`);
  const idx = parseInt(choice, 10) - 1;

  if (Number.isNaN(idx) || idx < 0 || idx >= users.length) {
    return;
  }

  const otherUserId = users[idx]._id;

  const created = await fetchJSON("/api/chat/conversations/direct", {
    method: "POST",
    body: JSON.stringify({ otherUserId })
  });

  await loadConversations();

  if (created?.conversationId) {
    await openConversation(created.conversationId);
  }
}

const newChatBtn = document.getElementById("newChatBtn");
newChatBtn?.addEventListener("click", () => {
  newChatFlow().catch(err => {
    console.error(err);
    alert(err.message || "Erreur");
  });
});

// =========================
// INIT
// =========================
window.addEventListener("DOMContentLoaded", async () => {
  try {
    await fetchUser();
    await fetchAllUsers();
    initSocket();
    await loadConversations();
    refreshIcons();
  } catch (err) {
    console.error(err);
    alert(err.message || "Erreur serveur");
  }
});