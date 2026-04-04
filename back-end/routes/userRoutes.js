const express = require("express");
const router = express.Router();
const multer = require('multer');
const bcrypt = require("bcrypt");
const util = require("util");
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
        const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{6,}$/;
        if(!passwordRegex.test(password)){
            return res.status(400).json({
                error: "Le mot de passe doit contenir au moins 6 caractères, 1 majuscule, 1 chiffre et 1 caractère spécial"
            });
        }

        const hashPassword = await bcrypt.hash(req.body.password, 10)

        const user = new User({
            fullname: req.body.fullname,
            email: req.body.email,
            password: hashPassword,
            paysname: req.body.paysname,
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

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { code, phone, password } = req.body;

    if (code !== "+261") return res.status(400).json({ error: "Pays non autorisé" });

    const user = await User.findOne({ phone });
    if (!user) return res.status(400).json({ error: "Numéro inconnu" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Mot de passe incorrect" });

    if (!req.session) return res.status(500).json({ error: "Session non initialisée" });

    // 🔹 Mettre connect à true **avant** de créer la session
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { connect: true },
      { new: true }
    );

    // 🔹 Régénérer session et enregistrer
    const regenerateSession = util.promisify(req.session.regenerate).bind(req.session);
    await regenerateSession();
    req.session.userId = updatedUser._id;

    const saveSession = util.promisify(req.session.save).bind(req.session);
    await saveSession();

    // 🔹 Retourner user immédiatement avec connect=true
    res.json({ redirect: "/pages/message.html", user: updatedUser });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// /me optimisé
router.get("/me", isAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select("-password");
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    const imageUrl = user.file ? `/upload/${user.file}` : null;

    res.json({
      _id: user._id,
      fullname: user.fullname,
      paysname: user.paysname,
      phone: user.phone,
      connect: user.connect,
      image: imageUrl
    });

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

//update profile
router.put("/update", isAuth, upload.single("file"), async (req, res) => {
  try {
    const userId = req.session.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    const updateData = {};

    // fullname
    if (req.body.fullname) {
      updateData.fullname = req.body.fullname;
    }

    // phone avec vérification
    if (req.body.phone) {
      if (req.body.phone.length > 10) {
        return res.status(400).json({ error: "numero invalide" });
      }

      const phoneExists = await User.findOne({
        phone: req.body.phone,
        _id: { $ne: userId }
      });

      if (phoneExists) {
        return res.status(400).json({ error: "Ce numéro est déjà utilisé" });
      }

      updateData.phone = req.body.phone;
    }

    // image
    if (req.file) {
      updateData.file = req.file.filename;
    }

    // update
    await User.updateOne(
      { _id: userId },
      { $set: updateData }
    );

    res.json({ message: "Profil mis à jour avec succès" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;