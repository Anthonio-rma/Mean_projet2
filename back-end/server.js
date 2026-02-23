const express = require("express");
const cors = require("cors");
const open = (...args) => import("open").then(mod => mod.default(...args));
const connectDB = require("./config/db");
const session = require("express-session");
const path = require("path");

const app = express();

// 🔥 rendre le dossier front accessible
app.use(express.static(path.join(__dirname, "../front-end")));
// dossier upload accessible depuis le front
app.use("/upload", express.static(path.join(__dirname, "upload")));

// Connexion à MongoDB
connectDB();

// Middleware JSON et CORS
app.use(express.json());
app.use(cors({
    origin: "http://localhost:3000", // ton front
    credentials: true
}));

// Sessions
app.use(session({
    secret: "mon_secret_ultra_secure",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 } // 1h
}));

// Middleware log session
// app.use((req, res, next) => {
//     console.log("\n🌐 Nouvelle requête :", req.method, req.url);
//     console.log("🧠 Session ID :", req.sessionID);
//     console.log("📦 Session actuelle :", req.session);
//     next();
// });

// Routes API
app.use("/api/users", require("./routes/userRoutes"));

// Toutes les autres routes -> index.html pour SPA
// ❌ on remplace app.get("/*") par un middleware app.use
app.use((req, res, next) => {
    if (!req.path.startsWith("/api")) {
        res.sendFile(path.join(__dirname, "../front-end/index.html"));
    } else {
        next();
    }
});

// Lancer serveur
app.listen(3000, () => {
    console.log('Serveur lancé sur http://localhost:3000');
    open("http://localhost:3000");
});