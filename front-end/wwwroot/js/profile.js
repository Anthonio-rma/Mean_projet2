const API_BASE = "http://localhost:3000";

const profileCard = document.getElementById("profileCard");
const userPostsList = document.getElementById("userPostsList");
const logoutBtn = document.getElementById("logoutBtn");
const refreshPostsBtn = document.getElementById("refreshPostsBtn");

let currentMe = null;
let viewedUser = null;

function getUserIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleString("fr-FR");
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(`${API_BASE}${url}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Erreur serveur");
  }

  return data;
}

async function loadMe() {
  currentMe = await fetchJSON("/api/users/me");
}

function renderProfile(user) {
  const image = user.image || `https://i.pravatar.cc/150?u=${encodeURIComponent(user.fullname || "user")}`;
  const onlineText = user.connect ? "En ligne" : "Hors ligne";
  const onlineClass = user.connect ? "online" : "offline";
  const isMe = currentMe && String(currentMe._id) === String(user._id);

  profileCard.innerHTML = `
    <div class="profile-top">
      <img src="${image}" alt="${escapeHtml(user.fullname || "Utilisateur")}">
      <div class="profile-meta">
        <h2>${escapeHtml(user.fullname || "Utilisateur")}</h2>
        <p class="username">${user.username ? "@" + escapeHtml(user.username) : ""}</p>
        <span class="status-badge ${onlineClass}">${onlineText}</span>
      </div>
    </div>

    <div class="profile-info-grid">
      <div class="info-box">
        <span>Bio</span>
        <strong>${escapeHtml(user.bio || "Aucune bio")}</strong>
      </div>

      <div class="info-box">
        <span>Email</span>
        <strong>${escapeHtml(user.email || "Non renseigné")}</strong>
      </div>

      <div class="info-box">
        <span>Pays</span>
        <strong>${escapeHtml(user.paysname || "Non renseigné")}</strong>
      </div>

      <div class="info-box">
        <span>Followers</span>
        <strong>${user.followersCount || 0}</strong>
      </div>

      <div class="info-box">
        <span>Following</span>
        <strong>${user.followingCount || 0}</strong>
      </div>
    </div>

    <div class="profile-actions">
      ${
        isMe
          ? `<a href="/pages/feed.html" class="primary-btn link-btn">Mon feed</a>`
          : `<button class="primary-btn" onclick="toggleFollow('${user._id}')">Suivre / Ne plus suivre</button>`
      }
    </div>
  `;
}

async function loadProfile() {
  const userId = getUserIdFromUrl();

  if (!userId) {
    profileCard.innerHTML = `<div class="error-box">Aucun identifiant utilisateur fourni.</div>`;
    return;
  }

  viewedUser = await fetchJSON(`/api/users/${userId}`);
  renderProfile(viewedUser);
}

function makePostHtml(post) {
  const authorName = post.author?.fullname || "Inconnu";
  const authorUsername = post.author?.username ? `@${post.author.username}` : "";
  const authorImage = post.author?.file
    ? `${API_BASE}/upload/${post.author.file}`
    : `https://i.pravatar.cc/150?u=${encodeURIComponent(authorName)}`;

  const repostBlock = post.repostOf
    ? `
      <div class="repost-block">
        <small>Repost de ${escapeHtml(post.repostOf.author?.fullname || "Inconnu")}</small>
        <p>${post.repostOf.content ? escapeHtml(post.repostOf.content) : "<em>Sans texte</em>"}</p>
      </div>
    `
    : "";

  return `
    <article class="post-card">
      <div class="post-head">
        <img src="${authorImage}" alt="${escapeHtml(authorName)}">
        <div class="post-head-meta">
          <strong>${escapeHtml(authorName)}</strong>
          <span>${escapeHtml(authorUsername)}</span>
          <small>${formatDate(post.createdAt)}</small>
        </div>
      </div>

      ${repostBlock}

      <div class="post-body">
        ${post.content ? escapeHtml(post.content) : "<em>Sans texte</em>"}
      </div>

      <div class="post-stats">
        <span>${post.likesCount || 0} likes</span>
        <span>${post.repliesCount || 0} commentaires</span>
      </div>
    </article>
  `;
}

function renderPosts(posts) {
  if (!Array.isArray(posts) || posts.length === 0) {
    userPostsList.innerHTML = `<div class="empty-box">Aucun post pour cet utilisateur.</div>`;
    return;
  }

  userPostsList.innerHTML = posts.map(makePostHtml).join("");
}

async function loadUserPosts() {
  const userId = getUserIdFromUrl();

  if (!userId) {
    userPostsList.innerHTML = `<div class="error-box">Impossible de charger les posts.</div>`;
    return;
  }

  const posts = await fetchJSON(`/api/posts/user/${userId}`);
  renderPosts(posts);
}

async function toggleFollow(userId) {
  try {
    await fetchJSON(`/api/users/${userId}/follow`, {
      method: "POST"
    });

    await Promise.all([loadMe(), loadProfile()]);
  } catch (error) {
    alert(error.message);
  }
}

async function logout() {
  try {
    await fetchJSON("/api/users/logout", {
      method: "POST"
    });
    window.location.href = "/pages/login.html";
  } catch (error) {
    alert(error.message);
  }
}

function bindEvents() {
  logoutBtn.addEventListener("click", logout);
  refreshPostsBtn.addEventListener("click", loadUserPosts);
}

async function init() {
  try {
    bindEvents();
    await loadMe();
    await Promise.all([loadProfile(), loadUserPosts()]);
  } catch (error) {
    console.error(error);
    alert(error.message || "Erreur de chargement");
    window.location.href = "/pages/login.html";
  }
}

window.toggleFollow = toggleFollow;

init();