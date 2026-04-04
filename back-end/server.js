const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const path = require("path");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const User = require("./models/User");

const app = express();

// 🔥 rendre le dossier front accessible
app.use(express.static(path.join(__dirname, "../front-end")));
// dossier upload accessible depuis le front
app.use("/upload", express.static(path.join(__dirname, "upload")));

// Connexion à MongoDB
connectDB();

// Middleware JSON et CORS
app.use(express.json());

// ⚠️ CORS : si ton front est servi par CE serveur (http://localhost:3000), c’est OK.
// Si ton front est sur un autre port (ex: 5500), remplace origin.
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =========================
// STATIC FILES
// =========================
app.use("/upload", express.static(path.join(__dirname, "upload")));
app.use(express.static(path.join(__dirname, "../front-end")));

// =========================
// SESSION
// =========================
app.use(
  session({
    secret: process.env.SESSION_SECRET || "mini_threads_secret_key",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mini_threads"
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true
    }
  })
);

// =========================
// DATABASE
// =========================
mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mini_threads")
  .then(() => {
    console.log("MongoDB connecté");
  })
  .catch(err => {
    console.error("Erreur MongoDB :", err);
  });

// =========================
// ROUTES
// =========================
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/posts", require("./routes/postRoutes"));

// =========================
// DEFAULT ROUTE
// =========================
app.get("/", (req, res) => {
  res.redirect("/pages/login.html");
});

// =========================
// SOCKET LOGIC
// =========================
const onlineUsers = new Map();

io.on("connection", socket => {
  console.log("Socket connecté :", socket.id);

  socket.on("join", async userId => {
    try {
      onlineUsers.set(String(userId), socket.id);
      await User.findByIdAndUpdate(userId, { connect: true });
      io.emit("users:online", Array.from(onlineUsers.keys()));
    } catch (err) {
      console.error("SOCKET JOIN ERROR:", err);
    }
  });

  socket.on("private message", data => {
    try {
      const { toUserId, message, fromUserId } = data;
      const targetSocketId = onlineUsers.get(String(toUserId));

      if (targetSocketId) {
        io.to(targetSocketId).emit("private message", {
          fromUserId,
          message
        });
      }
    } catch (err) {
      console.error("PRIVATE MESSAGE ERROR:", err);
    }
  });

  socket.on("disconnect", async () => {
    try {
      let disconnectedUserId = null;

      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          disconnectedUserId = userId;
          break;
        }
      }

      if (disconnectedUserId) {
        onlineUsers.delete(disconnectedUserId);
        await User.findByIdAndUpdate(disconnectedUserId, { connect: false });
      }

      io.emit("users:online", Array.from(onlineUsers.keys()));
      console.log("Socket déconnecté :", socket.id);
    } catch (err) {
      console.error("SOCKET DISCONNECT ERROR:", err);
    }
  });
});

// =========================
// START SERVER
// =========================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
