const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, trim: true, maxlength: 4000 },
    // optionnel : fichiers
    // fileUrl: String,
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);