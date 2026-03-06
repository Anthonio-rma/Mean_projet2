const express = require("express");
const router = express.Router();
const multer = require('multer');
const bcrypt = require("bcrypt");
//model
const User = require("../models/User");
const path = require("path");
const { error } = require("console");
//middleware
const isAuth = require("../middleware/auth");

//configuration de l upload de l image a ajouter dans db
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'upload/'),
    filename: (req, file, cb) => cb(null, Date.now() +'-'+file.originalname)
})

const upload = multer({storage})

//route inscription user
router.post("/register", upload.single("file"), async (req, res) => {
    try{
        if(!req.body.fullname || !req.body.phone){
            return res.status(400).json({error: 'remplir les champs!'})
        }
        const tel = req.body.phone
        if(tel.length > 10){
            return res.status(400).json({error: "numero invalide"})
        }

        const phoneExists = await User.findOne({ phone: req.body.phone });
        if (phoneExists) return res.status(400).json({ error: "Ce numéro est déjà utilisé" });

        const password = req.body.password
        const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{6,}$/
        if(!passwordRegex.test(password)){
            return res.status(400).json({
                error: "Le mot de passe doit contenir au moins 6 caractères, 1 majuscule, 1 chiffre et 1 caractère spécial"
            });
        }

        const hashPassword = await bcrypt.hash(req.body.password, 10)
        const hashPays = await bcrypt.hash(req.body.paysname, 15)

        const user = new User({
            fullname: req.body.fullname,
            email: req.body.email,
            password: hashPassword,
            paysname: hashPays,
            phone: req.body.phone,
            file: req.file ? req.file.filename : null,
            connect: false
        })

        //save to mongoDB
        await user.save()

        res.clearCookie('connect.sid');
        //petiti alert de succés
        res.json({redirect: "/pages/login.html"})
    } catch (err){
        console.error(err);
        res.status(500).json({error: err.message})
    }
})

//LOGIN

router.post("/login", async (req, res) => {
  try {
    const { code, phone, password } = req.body;

    if (code != "+261") return res.status(400).json({ error: "Pays non autorisé" });

    const user = await User.findOne({ phone });
    if (!user) return res.status(400).json({ error: "numero inconnue" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Mot de passe incorrect" });

    if (!req.session) return res.status(500).json({ error: "Session non initialisée" });

    req.session.regenerate(async (err) => {
      if (err) return res.status(500).json({ error: "Impossible de créer la session" });

      req.session.userId = user._id;

      await User.updateOne({ _id: user._id }, { $set: { connect: true } });

      res.json({ redirect: "/pages/message.html" });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// route pour récupérer l'utilisateur connecté
router.get("/me", isAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select("-password -paysname");
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    const imageUrl = user.file ? `/upload/${user.file}` : null;

    //IMPORTANT: renvoyer l'id
    res.json({ _id: user._id, fullname: user.fullname, phone: user.phone,connect: user.connect, image: imageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Lister tous les utilisateurs sauf moi (pour démarrer un chat)
router.get("/all", isAuth, async (req, res) => {
  try {
    const me = req.session.userId;
    const users = await User.find({ _id: { $ne: me } })
      .select("fullname phone file");
    const result = users.map(u => ({
      _id: u._id,
      fullname: u.fullname,
      phone: u.phone,
      image: u.file ? `/upload/${u.file}` : null
    }));
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

//LOGOUT
router.post("/logout", async (req, res) => {
  try {
    const userId = req.session?.userId;

    if (userId) {
      // CONNECT FALSE
      await User.updateOne(
        { _id: userId },
        { $set: { connect: false } }
      );
    }

    req.session.destroy(err => {
      if (err) return res.status(500).json({ error: "Logout impossible" });

      res.clearCookie("connect.sid");
      res.json({ redirect: "/pages/login.html" });
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Récupérer un utilisateur par id (profil)
router.get("/:id", isAuth, async (req, res) => {
  try {
    const u = await User.findById(req.params.id).select("fullname phone file connect");
    if (!u) return res.status(404).json({ error: "Utilisateur introuvable" });

    const imageUrl = u.file ? `/upload/${u.file}` : null;

    res.json({
      _id: u._id,
      fullname: u.fullname,
      phone: u.phone,
      image: imageUrl,
      connect: !!u.connect
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;