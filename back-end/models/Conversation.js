const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    lastMessageAt: { type: Date, default: null },
    // optionnel : type: "direct" | "group"
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);