const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const path = require("path");
const multer = require("multer");

const User = require("../models/User");
const isAuth = require("../middleware/auth");

// =========================
// MULTER CONFIG
// =========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../upload"));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "_" + file.originalname.replace(/\s+/g, "_");
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// =========================
// REGISTER
// =========================
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

// =========================
// LOGIN
// =========================
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: "Téléphone et mot de passe obligatoires" });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Mot de passe incorrect" });
    }

    req.session.userId = user._id;

    user.connect = true;
    await user.save();

    res.json({
      message: "Connexion réussie",
      redirect: "/pages/feed.html",
      user: {
        _id: user._id,
        fullname: user.fullname,
        username: user.username,
        phone: user.phone
      }
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// =========================
// LOGOUT
// =========================
router.post("/logout", isAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (user) {
      user.connect = false;
      await user.save();
    }

    req.session.destroy(err => {
      if (err) {
        console.error("LOGOUT ERROR:", err);
        return res.status(500).json({ error: "Erreur lors de la déconnexion" });
      }

      res.clearCookie("connect.sid");
      res.json({
        message: "Déconnexion réussie",
        redirect: "/pages/login.html"
      });
    });
  } catch (err) {
    console.error("LOGOUT ERROR:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// =========================
// GET CURRENT USER
// =========================
router.get("/me", isAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    res.json({
      _id: user._id,
      fullname: user.fullname,
      username: user.username,
      phone: user.phone,
      email: user.email,
      bio: user.bio,
      paysname: user.paysname,
      connect: user.connect,
      image: user.file ? `/upload/${user.file}` : null,
      followersCount: user.followers?.length || 0,
      followingCount: user.following?.length || 0
    });
  } catch (err) {
    console.error("ME ERROR:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// =========================
// UPDATE CURRENT USER
// =========================
router.put("/me/update", isAuth, upload.single("file"), async (req, res) => {
  try {
    const me = req.session.userId;
    const { fullname, username, bio, email, paysname } = req.body;

    const updateData = {};

    if (fullname !== undefined) updateData.fullname = fullname.trim();
    if (bio !== undefined) updateData.bio = bio.trim();
    if (email !== undefined) updateData.email = email.trim().toLowerCase();
    if (paysname !== undefined) updateData.paysname = paysname.trim();

    if (username !== undefined) {
      const normalizedUsername = username.trim().toLowerCase();

      const existing = await User.findOne({
        username: normalizedUsername,
        _id: { $ne: me }
      });

      if (existing) {
        return res.status(400).json({ error: "Username déjà utilisé" });
      }

      updateData.username = normalizedUsername;
    }

    if (req.file) {
      updateData.file = req.file.filename;
    }

    const updated = await User.findByIdAndUpdate(me, updateData, { new: true }).select("-password");

    res.json({
      message: "Profil mis à jour",
      user: {
        _id: updated._id,
        fullname: updated.fullname,
        username: updated.username,
        phone: updated.phone,
        email: updated.email,
        bio: updated.bio,
        paysname: updated.paysname,
        image: updated.file ? `/upload/${updated.file}` : null,
        connect: updated.connect,
        followersCount: updated.followers?.length || 0,
        followingCount: updated.following?.length || 0
      }
    });
  } catch (err) {
    console.error("UPDATE PROFILE ERROR:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// =========================
// GET ALL USERS
// =========================
router.get("/all", isAuth, async (req, res) => {
  try {
    const me = req.session.userId;

    const users = await User.find({ _id: { $ne: me } }).select(
      "fullname username phone email file bio connect followers following"
    );

    const result = users.map(u => ({
      _id: u._id,
      fullname: u.fullname,
      username: u.username,
      phone: u.phone,
      email: u.email,
      bio: u.bio,
      connect: u.connect,
      image: u.file ? `/upload/${u.file}` : null,
      followersCount: u.followers?.length || 0,
      followingCount: u.following?.length || 0
    }));

    res.json(result);
  } catch (err) {
    console.error("ALL USERS ERROR:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// =========================
// GET USER BY ID
// =========================
router.get("/:id", isAuth, async (req, res) => {
  try {
    const u = await User.findById(req.params.id).select(
      "fullname username phone email bio file connect followers following paysname"
    );

    if (!u) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    res.json({
      _id: u._id,
      fullname: u.fullname,
      username: u.username,
      phone: u.phone,
      email: u.email,
      bio: u.bio,
      paysname: u.paysname,
      image: u.file ? `/upload/${u.file}` : null,
      connect: !!u.connect,
      followersCount: u.followers?.length || 0,
      followingCount: u.following?.length || 0
    });
  } catch (err) {
    console.error("GET USER BY ID ERROR:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// =========================
// FOLLOW / UNFOLLOW
// =========================
router.post("/:id/follow", isAuth, async (req, res) => {
  try {
    const me = req.session.userId;
    const targetId = req.params.id;

    if (String(me) === String(targetId)) {
      return res.status(400).json({ error: "Impossible de se suivre soi-même" });
    }

    const meUser = await User.findById(me);
    const targetUser = await User.findById(targetId);

    if (!meUser || !targetUser) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    const alreadyFollowing = meUser.following.some(
      id => String(id) === String(targetId)
    );

    if (alreadyFollowing) {
      meUser.following = meUser.following.filter(
        id => String(id) !== String(targetId)
      );
      targetUser.followers = targetUser.followers.filter(
        id => String(id) !== String(me)
      );
    } else {
      meUser.following.push(targetId);
      targetUser.followers.push(me);
    }

    await meUser.save();
    await targetUser.save();

    res.json({
      _id: u._id,
      fullname: u.fullname,
      username: u.username,
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