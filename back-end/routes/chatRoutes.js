const express = require("express");
const router = express.Router();
const isAuth = require("../middleware/auth");

const User = require("../models/User");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

// 1) Créer ou récupérer une conversation directe avec un user
router.post("/conversations/direct", isAuth, async (req, res) => {
  try {
    const me = req.session.userId;
    const { otherUserId } = req.body;

    if (!otherUserId) return res.status(400).json({ error: "otherUserId requis" });
    if (otherUserId === me) return res.status(400).json({ error: "Impossible de discuter avec soi-même" });

    const other = await User.findById(otherUserId);
    if (!other) return res.status(404).json({ error: "Utilisateur introuvable" });

    // Chercher conversation existante (direct = exactement 2 participants)
    let conv = await Conversation.findOne({
      participants: { $all: [me, otherUserId] },
      $expr: { $eq: [{ $size: "$participants" }, 2] }
    });

    if (!conv) {
      conv = await Conversation.create({
        participants: [me, otherUserId],
        lastMessageAt: null
      });
    } 

    res.json({ conversationId: conv._id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 2) Lister les conversations de l'utilisateur connecté
router.get("/conversations", isAuth, async (req, res) => {
  try {
    const me = req.session.userId;

    const conversations = await Conversation.find({ participants: me })
      .populate("participants", "fullname phone file")
      .populate({
        path: "lastMessage",
        select: "text sender createdAt"
      })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();

    // Calcul des non-lus
    const convIds = conversations.map(c => c._id);
    const unreadAgg = await Message.aggregate([
      { $match: { conversation: { $in: convIds } } },
      { $match: { sender: { $ne: new (require("mongoose")).Types.ObjectId(me) } } },
      { $match: { readBy: { $ne: new (require("mongoose")).Types.ObjectId(me) } } },
      { $group: { _id: "$conversation", unread: { $sum: 1 } } }
    ]);

    const unreadMap = new Map(unreadAgg.map(x => [String(x._id), x.unread]));

    const result = conversations.map(c => ({
      ...c,
      unread: unreadMap.get(String(c._id)) || 0
    }));

    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 3) Récupérer les messages d'une conversation
router.get("/conversations/:id/messages", isAuth, async (req, res) => {
  try {
    const me = req.session.userId;
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit || "30", 10), 100);
    const before = req.query.before; 

    const conv = await Conversation.findById(id);
    if (!conv) return res.status(404).json({ error: "Conversation introuvable" });
    if (!conv.participants.map(String).includes(String(me))) {
      return res.status(403).json({ error: "Accès interdit" });
    }

    const filter = { conversation: id };
    if (before) filter.createdAt = { $lt: new Date(before) };

    const messages = await Message.find(filter)
      .populate("sender", "fullname file")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(messages.reverse()); // retour chronologique
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 4) Envoyer un message
router.post("/conversations/:id/messages", isAuth, async (req, res) => {
  try {
    const me = req.session.userId;
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) return res.status(400).json({ error: "Message vide" });

    const conv = await Conversation.findById(id);
    if (!conv) return res.status(404).json({ error: "Conversation introuvable" });
    if (!conv.participants.map(String).includes(String(me))) {
      return res.status(403).json({ error: "Accès interdit" });
    }

    const msg = await Message.create({
      conversation: id,
      sender: me,
      text: text.trim(),
      readBy: [me] // l’expéditeur l’a déjà “lu”
    });

    await Conversation.findByIdAndUpdate(id, {
      lastMessage: msg._id,
      lastMessageAt: msg.createdAt
    });

    const populated = await Message.findById(msg._id)
  .populate("sender", "fullname file")
  .lean();

// ✅ Socket.io : envoyer à tous les clients dans la room de cette conversation
const io = req.app.get("io");
if (io) {
  io.to(`conv:${id}`).emit("newMessage", populated);
}

res.json(populated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 5) Marquer toute la conversation comme lue
router.post("/conversations/:id/read", isAuth, async (req, res) => {
  try {
    const me = req.session.userId;
    const { id } = req.params;

    await Message.updateMany(
      { conversation: id, readBy: { $ne: me } },
      { $addToSet: { readBy: me } }
    );

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;