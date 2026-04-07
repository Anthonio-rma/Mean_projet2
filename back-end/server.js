const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const path = require("path");
const cors = require("cors");
const http = require("http");
const connectDB = require("./config/db");
const { Server } = require("socket.io");
require("dotenv").config();

const User = require("./models/User");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

// rendre io accessible dans les routes
app.set("io", io);

// =========================
// MIDDLEWARE
// =========================
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =========================
// STATIC FILES
// =========================
app.use(express.static(path.join(__dirname, "../front-end")));
app.use("/upload", express.static(path.join(__dirname, "upload")));

// =========================
// SESSION
// =========================
app.use(
  session({
    secret: process.env.SESSION_SECRET || "reseauDb_secret_key",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/reseauDb"
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      sameSite: "lax",
      secure: false
    }
  })
);
// =========================
// DATABASE
// =========================
connectDB();

// =========================
// ROUTES
// =========================
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/posts", require("./routes/postRoutes"));
app.use("/api/publications", require("./routes/publication"));

// =========================
// DEFAULT ROUTE
// =========================
app.get("/", (req, res) => {
  res.redirect("/pages/login.html");
});

// =========================
// SOCKET LOGIC
// =========================
const onlineUsers = new Map(); // userId => Set(socketId)

io.on("connection", (socket) => {
  console.log("Socket connecté :", socket.id);

  // utilisateur en ligne
  socket.on("join", async (userId) => {
    try {
      if (!userId) return;

      const key = String(userId);

      if (!onlineUsers.has(key)) {
        onlineUsers.set(key, new Set());
      }

      onlineUsers.get(key).add(socket.id);

      socket.userId = key;

      await User.findByIdAndUpdate(userId, { connect: true });

      io.emit("users:online", Array.from(onlineUsers.keys()));
      io.emit("presence", { userId: key, online: true });
    } catch (err) {
      console.error("SOCKET JOIN ERROR:", err);
    }
  });

  // rejoindre une room de conversation
  socket.on("joinConversation", (convId) => {
    try {
      if (!convId) return;
      socket.join(`conv:${convId}`);
      console.log(`Socket ${socket.id} a rejoint conv:${convId}`);
    } catch (err) {
      console.error("JOIN CONVERSATION ERROR:", err);
    }
  });

  // quitter une room de conversation
  socket.on("leaveConversation", (convId) => {
    try {
      if (!convId) return;
      socket.leave(`conv:${convId}`);
      console.log(`Socket ${socket.id} a quitté conv:${convId}`);
    } catch (err) {
      console.error("LEAVE CONVERSATION ERROR:", err);
    }
  });

  // ancien message privé direct user->user
  socket.on("private message", (data) => {
    try {
      const { toUserId, message, fromUserId } = data || {};
      if (!toUserId) return;

      const targetSockets = onlineUsers.get(String(toUserId));
      if (!targetSockets || targetSockets.size === 0) return;

      for (const socketId of targetSockets) {
        io.to(socketId).emit("private message", {
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
      const disconnectedUserId = socket.userId;

      if (disconnectedUserId && onlineUsers.has(disconnectedUserId)) {
        const userSockets = onlineUsers.get(disconnectedUserId);
        userSockets.delete(socket.id);

        if (userSockets.size === 0) {
          onlineUsers.delete(disconnectedUserId);
          await User.findByIdAndUpdate(disconnectedUserId, { connect: false });

          io.emit("presence", { userId: disconnectedUserId, online: false });
        }
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