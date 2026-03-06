const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const open = (...args) => import("open").then(mod => mod.default(...args));
const connectDB = require("./config/db");
const session = require("express-session");
const path = require("path");
const User = require("./models/User"); // <-- ajuste si chemin différent

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
  origin: "http://localhost:3000",
  credentials: true
}));

// ✅ Session middleware (on le garde dans une variable pour le partager à socket.io)
const sessionMiddleware = session({
  secret: "mon_secret_ultra_secure",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 } // 1h
});
app.use(sessionMiddleware);

// Routes API
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));

// SPA fallback
app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "../front-end/index.html"));
  } else {
    next();
  }
});

// ✅ créer serveur HTTP
const server = http.createServer(app);

// ✅ socket.io
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true
  }
});

// ✅ partager session Express avec Socket.io
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// ✅ logique socket
io.on("connection", async (socket) => {
  const userId = socket.request.session?.userId;

  // si pas authentifié -> on coupe
  if (!userId) {
    socket.disconnect(true);
    return;
  }

  // connect=true
  await User.updateOne({ _id: userId }, { $set: { connect: true } });

  // broadcast présence
  io.emit("presence", { userId: String(userId), online: true });

  // rejoindre une conversation (room)
  socket.on("joinConversation", (conversationId) => {
    if (!conversationId) return;
    socket.join(`conv:${conversationId}`);
  });

  socket.on("leaveConversation", (conversationId) => {
    if (!conversationId) return;
    socket.leave(`conv:${conversationId}`);
  });

  socket.on("disconnect", async () => {
    // connect=false
    await User.updateOne({ _id: userId }, { $set: { connect: false } });
    io.emit("presence", { userId: String(userId), online: false });
  });
});

// rendre io accessible dans les routes (chatRoutes)
app.set("io", io);


server.listen(3000, () => {
  console.log("Serveur + Socket.io lancé sur http://localhost:3000");
  open("http://localhost:3000");
});