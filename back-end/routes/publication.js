const express = require("express");
const router = express.Router();
const multer = require("multer");
const isAuth = require("../middleware/auth");

const Publication = require("../models/Publication");

// upload image
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "upload/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// Créer une publication
router.post("/", isAuth, upload.single("image"), async (req, res) => {
  try {
    const { titre, contenu, hashtags } = req.body;
    if (!titre || !contenu) return res.status(400).json({ error: "Remplir tous les champs" });

    const pub = new Publication({
      auteur: req.session.userId,
      titre,
      contenu,
      image: req.file ? req.file.filename : null,
      hashtags: hashtags ? hashtags.split(",").map(h => h.trim()) : []
    });

    await pub.save();
    res.json({ message: "Publication créée", publication: pub });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Récupérer toutes les publications
router.get("/", async (req, res) => {
  try {
    const pubs = await Publication.find()
      .populate("auteur", "fullname file")
      .sort({ datePublication: -1 })
      .lean();

    // ajouter l’URL de l’image si elle existe
    const result = pubs.map(p => ({
      ...p,
      image: p.image ? `/upload/${p.image}` : null
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;