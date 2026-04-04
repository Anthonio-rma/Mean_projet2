const express = require("express");
const router = express.Router();
const isAuth = require("../middleware/auth");

const User = require("../models/User");
const Post = require("../models/Post");
const Comment = require("../models/Comment");

/**
 * Extraire les mentions dans un texte : @username
 */
async function extractMentions(content) {
  const matches = [...content.matchAll(/@([a-zA-Z0-9_.]+)/g)];
  const usernames = [...new Set(matches.map(m => m[1].toLowerCase()))];

  if (usernames.length === 0) return [];

  const users = await User.find({
    username: { $in: usernames }
  }).select("_id username");

  return users.map(u => u._id);
}

/**
 * Vérifier si une chaîne ressemble à un ObjectId Mongo
 */
function isValidObjectId(id) {
  return /^[a-f\d]{24}$/i.test(id);
}

/**
 * Formater un post pour le front
 */
function formatPost(post, me) {
  return {
    ...post,
    likesCount: post.likes?.length || 0,
    likedByMe: post.likes?.some(id => String(id) === String(me)) || false,
    repliesCount: post.repliesCount || 0
  };
}

/**
 * Créer un post
 */
router.post("/", isAuth, async (req, res) => {
  try {
    const me = req.session.userId;
    const { content, image } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Contenu obligatoire" });
    }

    const cleanContent = content.trim();
    const mentions = await extractMentions(cleanContent);

    const post = await Post.create({
      author: me,
      content: cleanContent,
      image: image || null,
      mentions
    });

    const populated = await Post.findById(post._id)
      .populate("author", "fullname username file")
      .populate({
        path: "repostOf",
        populate: { path: "author", select: "fullname username file" }
      })
      .lean();

    res.status(201).json(formatPost(populated, me));
  } catch (err) {
    console.error("CREATE POST ERROR:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * Liste globale des posts récents
 */
router.get("/", isAuth, async (req, res) => {
  try {
    const me = req.session.userId;

    const posts = await Post.find()
      .populate("author", "fullname username file")
      .populate({
        path: "repostOf",
        populate: { path: "author", select: "fullname username file" }
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const result = posts.map(post => formatPost(post, me));
    res.json(result);
  } catch (err) {
    console.error("GET POSTS ERROR:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * Fil d’actualité : mes posts + posts des comptes suivis
 */
router.get("/feed", isAuth, async (req, res) => {
  try {
    const me = req.session.userId;

    const currentUser = await User.findById(me).select("following");
    if (!currentUser) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    const authorIds = [me, ...currentUser.following];

    const posts = await Post.find({
      author: { $in: authorIds }
    })
      .populate("author", "fullname username file")
      .populate({
        path: "repostOf",
        populate: { path: "author", select: "fullname username file" }
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const result = posts.map(post => formatPost(post, me));
    res.json(result);
  } catch (err) {
    console.error("GET FEED ERROR:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * Posts d'un utilisateur
 * IMPORTANT : cette route doit être placée avant /:id
 */
router.get("/user/:userId", isAuth, async (req, res) => {
  try {
    const me = req.session.userId;
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ error: "ID utilisateur invalide" });
    }

    const posts = await Post.find({ author: userId })
      .populate("author", "fullname username file")
      .populate({
        path: "repostOf",
        populate: { path: "author", select: "fullname username file" }
      })
      .sort({ createdAt: -1 })
      .lean();

    const result = posts.map(post => formatPost(post, me));
    res.json(result);
  } catch (err) {
    console.error("GET USER POSTS ERROR:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * Détail d’un post
 */
router.get("/:id", isAuth, async (req, res) => {
  try {
    const me = req.session.userId;
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de post invalide" });
    }

    const post = await Post.findById(id)
      .populate("author", "fullname username file")
      .populate({
        path: "repostOf",
        populate: { path: "author", select: "fullname username file" }
      })
      .lean();

    if (!post) {
      return res.status(404).json({ error: "Post introuvable" });
    }

    res.json(formatPost(post, me));
  } catch (err) {
    console.error("GET POST BY ID ERROR:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * Modifier son post
 */
router.put("/:id", isAuth, async (req, res) => {
  try {
    const me = req.session.userId;
    const { id } = req.params;
    const { content, image } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de post invalide" });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ error: "Post introuvable" });
    }

    if (String(post.author) !== String(me)) {
      return res.status(403).json({ error: "Accès interdit" });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Contenu obligatoire" });
    }

    const cleanContent = content.trim();

    post.content = cleanContent;
    post.mentions = await extractMentions(cleanContent);

    if (image !== undefined) {
      post.image = image || null;
    }

    await post.save();

    const updated = await Post.findById(post._id)
      .populate("author", "fullname username file")
      .populate({
        path: "repostOf",
        populate: { path: "author", select: "fullname username file" }
      })
      .lean();

    res.json(formatPost(updated, me));
  } catch (err) {
    console.error("UPDATE POST ERROR:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * Supprimer son post
 */
router.delete("/:id", isAuth, async (req, res) => {
  try {
    const me = req.session.userId;
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de post invalide" });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ error: "Post introuvable" });
    }

    if (String(post.author) !== String(me)) {
      return res.status(403).json({ error: "Accès interdit" });
    }

    await Comment.deleteMany({ post: post._id });
    await Post.findByIdAndDelete(post._id);

    res.json({ ok: true, message: "Post supprimé" });
  } catch (err) {
    console.error("DELETE POST ERROR:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * Like / unlike
 */
router.post("/:id/like", isAuth, async (req, res) => {
  try {
    const me = req.session.userId;
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de post invalide" });
    }

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({ error: "Post introuvable" });
    }

    const alreadyLiked = post.likes.some(likeId => String(likeId) === String(me));

    if (alreadyLiked) {
      post.likes = post.likes.filter(likeId => String(likeId) !== String(me));
    } else {
      post.likes.push(me);
    }

    await post.save();

    res.json({
      ok: true,
      liked: !alreadyLiked,
      likesCount: post.likes.length
    });
  } catch (err) {
    console.error("LIKE POST ERROR:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * Repost
 */
router.post("/:id/repost", isAuth, async (req, res) => {
  try {
    const me = req.session.userId;
    const { id } = req.params;
    const content = req.body.content ? req.body.content.trim() : "";

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de post invalide" });
    }

    const originalPost = await Post.findById(id);

    if (!originalPost) {
      return res.status(404).json({ error: "Post original introuvable" });
    }

    const mentions = content ? await extractMentions(content) : [];

    const repost = await Post.create({
      author: me,
      content,
      repostOf: originalPost._id,
      mentions
    });

    const populated = await Post.findById(repost._id)
      .populate("author", "fullname username file")
      .populate({
        path: "repostOf",
        populate: { path: "author", select: "fullname username file" }
      })
      .lean();

    res.status(201).json(formatPost(populated, me));
  } catch (err) {
    console.error("REPOST ERROR:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * Ajouter un commentaire
 */
router.post("/:id/comments", isAuth, async (req, res) => {
  try {
    const me = req.session.userId;
    const { id } = req.params;
    const { content } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de post invalide" });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Commentaire vide" });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ error: "Post introuvable" });
    }

    const comment = await Comment.create({
      post: post._id,
      author: me,
      content: content.trim()
    });

    post.repliesCount += 1;
    await post.save();

    const populated = await Comment.findById(comment._id)
      .populate("author", "fullname username file")
      .lean();

    res.status(201).json(populated);
  } catch (err) {
    console.error("ADD COMMENT ERROR:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * Lister les commentaires d’un post
 */
router.get("/:id/comments", isAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "ID de post invalide" });
    }

    const comments = await Comment.find({ post: id })
      .populate("author", "fullname username file")
      .sort({ createdAt: -1 })
      .lean();

    res.json(comments);
  } catch (err) {
    console.error("GET COMMENTS ERROR:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;