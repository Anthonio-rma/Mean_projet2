const API_BASE = "http://localhost:3000";

const meImage = document.getElementById("meImage");
const meFullname = document.getElementById("meFullname");
const meUsername = document.getElementById("meUsername");
const meBio = document.getElementById("meBio");
const meFollowers = document.getElementById("meFollowers");
const meFollowing = document.getElementById("meFollowing");

const postContent = document.getElementById("postContent");
const charCount = document.getElementById("charCount");
const publishBtn = document.getElementById("publishBtn");
const refreshBtn = document.getElementById("refreshBtn");
const reloadUsersBtn = document.getElementById("reloadUsersBtn");
const logoutBtn = document.getElementById("logoutBtn");

const feedList = document.getElementById("feedList");
const usersList = document.getElementById("usersList");

let currentUser = null;
let cachedPosts = [];

function escapeHtml(text = "") {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  return d.toLocaleString("fr-FR");
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

function updateCounter() {
  charCount.textContent = `${postContent.value.length} / 500`;
}

function renderMe(me) {
  currentUser = me;

  meImage.src = me.image || `https://i.pravatar.cc/150?u=${encodeURIComponent(me.fullname || "me")}`;
  meFullname.textContent = me.fullname || "Utilisateur";
  meUsername.textContent = me.username ? `@${me.username}` : "@username";
  meBio.textContent = me.bio || "Aucune bio";
  meFollowers.textContent = me.followersCount || 0;
  meFollowing.textContent = me.followingCount || 0;
}

function renderUsers(users) {
  if (!Array.isArray(users) || users.length === 0) {
    usersList.innerHTML = `<div class="empty-mini">Aucun utilisateur trouvé.</div>`;
    return;
  }

  usersList.innerHTML = users
    .slice(0, 8)
    .map(user => {
      const image = user.image || `https://i.pravatar.cc/150?u=${encodeURIComponent(user.fullname || "user")}`;
      return `
        <div class="user-item">
          <img src="${image}" alt="${escapeHtml(user.fullname || "User")}">
          <div class="user-meta">
            <strong>${escapeHtml(user.fullname || "Utilisateur")}</strong>
            <span>${user.username ? "@" + escapeHtml(user.username) : ""}</span>
            <small>${user.followersCount || 0} followers</small>
          </div>
          <button class="follow-btn" onclick="toggleFollow('${user._id}')">
            Suivre
          </button>
        </div>
      `;
    })
    .join("");
}

function renderComments(postId, comments) {
  const box = document.getElementById(`comments-list-${postId}`);
  if (!box) return;

  if (!comments.length) {
    box.innerHTML = `<div class="empty-mini">Aucun commentaire.</div>`;
    return;
  }

  box.innerHTML = comments
    .map(comment => {
      const author = comment.author?.fullname || "Inconnu";
      return `
        <div class="comment-item">
          <strong>${escapeHtml(author)}</strong>
          <small>${formatDate(comment.createdAt)}</small>
          <p>${escapeHtml(comment.content || "")}</p>
        </div>
      `;
    })
    .join("");
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
        <small>Repost de 
          <a href="/pages/profile.html?id=${post.repostOf.author?._id}" class="author-link">
            ${escapeHtml(post.repostOf.author?.fullname || "Inconnu")}
          </a>
        </small>
        <p>${escapeHtml(post.repostOf.content || "") || "<em>Sans texte</em>"}</p>
      </div>
    `
    : "";

  return `
    <article class="post-card">
      <div class="post-head">
        <img src="${authorImage}" alt="${escapeHtml(authorName)}">
        <div class="post-head-meta">
          <strong>
            <a href="/pages/profile.html?id=${post.author?._id}" class="author-link">
              ${escapeHtml(authorName)}
            </a>
          </strong>
          <span>${escapeHtml(authorUsername)}</span>
          <small>${formatDate(post.createdAt)}</small>
        </div>
      </div>

      ${repostBlock}

      <div class="post-body">
        ${post.content ? escapeHtml(post.content) : "<em>Sans texte</em>"}
      </div>

      <div class="post-actions">
      ${
        post.author?._id === currentUser?._id
        ? `<button class="action-btn danger" onclick="deletePost('${post._id}')">Supprimer</button>`
        : ""
      }
        <button class="action-btn" onclick="toggleLike('${post._id}')">
          ${post.likedByMe ? "Unlike" : "Like"} (${post.likesCount || 0})
        </button>

        <button class="action-btn" onclick="repostPost('${post._id}')">
          Repost
        </button>

        <button class="action-btn" onclick="toggleComments('${post._id}')">
          Commentaires (${post.repliesCount || 0})
        </button>
      </div>

      <div class="comments-wrap hidden" id="comments-wrap-${post._id}">
        <div class="comment-form">
          <input
            type="text"
            id="comment-input-${post._id}"
            placeholder="Écrire un commentaire..."
            maxlength="300"
          />
          <button onclick="addComment('${post._id}')">Envoyer</button>
        </div>

        <div id="comments-list-${post._id}"></div>
      </div>
    </article>
  `;
}

function renderFeed(posts) {
  cachedPosts = posts;

  if (!Array.isArray(posts) || posts.length === 0) {
    feedList.innerHTML = `<div class="empty-box">Aucun post à afficher pour le moment.</div>`;
    return;
  }

  feedList.innerHTML = posts.map(makePostHtml).join("");
}

async function loadMe() {
  const me = await fetchJSON("/api/users/me");
  renderMe(me);
}

async function loadUsers() {
  const users = await fetchJSON("/api/users/all");
  renderUsers(users);
}

async function loadFeed() {
  feedList.innerHTML = `<div class="empty-box">Chargement...</div>`;
  const posts = await fetchJSON("/api/posts/feed");
  renderFeed(posts);
}

async function createPost() {
  const content = postContent.value.trim();

  if (!content) {
    alert("Le contenu du post est obligatoire.");
    return;
  }

  publishBtn.disabled = true;

  try {
    await fetchJSON("/api/posts", {
      method: "POST",
      body: JSON.stringify({ content })
    });

    postContent.value = "";
    updateCounter();
    await loadFeed();
  } catch (error) {
    alert(error.message);
  } finally {
    publishBtn.disabled = false;
  }
}

async function deletePost(postId) {
  const confirmDelete = confirm("Supprimer ce post ?");
  if (!confirmDelete) return;

  try {
    await fetchJSON(`/api/posts/${postId}`, {
      method: "DELETE"
    });

    await loadFeed();
  } catch (error) {
    alert(error.message);
  }
}

async function toggleLike(postId) {
  try {
    await fetchJSON(`/api/posts/${postId}/like`, {
      method: "POST"
    });
    await loadFeed();
  } catch (error) {
    alert(error.message);
  }
}

async function repostPost(postId) {
  const content = prompt("Ajoute un texte au repost (optionnel) :") || "";

  try {
    await fetchJSON(`/api/posts/${postId}/repost`, {
      method: "POST",
      body: JSON.stringify({ content })
    });
    await loadFeed();
  } catch (error) {
    alert(error.message);
  }
}

async function toggleFollow(userId) {
  try {
    await fetchJSON(`/api/users/${userId}/follow`, {
      method: "POST"
    });

    await Promise.all([loadMe(), loadUsers(), loadFeed()]);
  } catch (error) {
    alert(error.message);
  }
}

async function toggleComments(postId) {
  const wrap = document.getElementById(`comments-wrap-${postId}`);
  if (!wrap) return;

  const isHidden = wrap.classList.contains("hidden");

  if (!isHidden) {
    wrap.classList.add("hidden");
    return;
  }

  wrap.classList.remove("hidden");

  try {
    const comments = await fetchJSON(`/api/posts/${postId}/comments`);
    renderComments(postId, comments);
  } catch (error) {
    alert(error.message);
  }
}

async function addComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  if (!input) return;

  const content = input.value.trim();
  if (!content) {
    alert("Le commentaire est vide.");
    return;
  }

  try {
    await fetchJSON(`/api/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content })
    });

    input.value = "";
    await loadFeed();

    const comments = await fetchJSON(`/api/posts/${postId}/comments`);
    const wrap = document.getElementById(`comments-wrap-${postId}`);
    if (wrap) wrap.classList.remove("hidden");
    renderComments(postId, comments);
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
  publishBtn.addEventListener("click", createPost);
  refreshBtn.addEventListener("click", loadFeed);
  reloadUsersBtn.addEventListener("click", loadUsers);
  logoutBtn.addEventListener("click", logout);
  postContent.addEventListener("input", updateCounter);
}

async function init() {
  try {
    bindEvents();
    updateCounter();

    await loadMe();
    await Promise.all([loadUsers(), loadFeed()]);
  } catch (error) {
    console.error(error);
    alert(error.message || "Erreur de chargement");
    window.location.href = "/pages/login.html";
  }
}

window.toggleLike = toggleLike;
window.repostPost = repostPost;
window.toggleFollow = toggleFollow;
window.toggleComments = toggleComments;
window.addComment = addComment;
window.deletePost = deletePost;

init();