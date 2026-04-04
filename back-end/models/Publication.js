const mongoose = require("mongoose");

const publicationSchema = new mongoose.Schema({
  auteur: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  titre: { type: String, required: true, trim: true },
  contenu: { type: String, required: true },
  image: { type: String, default: null }, // nom du fichier uploadé
  hashtags: { type: [String], default: [] },
  datePublication: { type: Date, default: Date.now },
  likes: { type: Number, default: 0 }
});

module.exports = mongoose.model("Publication", publicationSchema);