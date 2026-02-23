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

router.post("/login", async (req,res) => {
    const { code, phone, password, fullname} = req.body;

    //verif pays
    if(code != "+261"){
        return res.status(400).json({
            error: "Pays non autorisé"
        })
    }

    //verifi user
    const user = await User.findOne({ phone })
    if(!user){
        return res.status(400).json({
            error: 'numero inconnue'
        })
    }

    //verif name
    if(fullname !== user.fullname){
        return res.status(400).json({
            error: "nom incorrect"
        });
    }

    //verif password
    const match = await bcrypt.compare(password, user.password);
    if(!match){
        return res.status(400).json({
            error: "Mot de passe incorrect"
        });
    }

    // 🔥 forcer création d’une nouvelle session
    req.session.regenerate(err => {
        if(err) return res.status(500).json({ error: "Impossible de créer la session" });

        req.session.userId = user._id;
        res.json({ redirect: "/pages/message.html" });
    });
})

// route pour récupérer l'utilisateur connecté
router.get("/me", isAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).select("-password -paysname");
        // on retire le mot de passe et info sensible
        if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

        // construire le chemin complet pour l'image
        const imageUrl = user.file ? `/upload/${user.file}` : null;
        res.json({ fullname: user.fullname, phone: user.phone, image: imageUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

module.exports = router;