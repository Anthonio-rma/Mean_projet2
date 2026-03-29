const express = require("express");
const http = require("http");
const path = require("path");
const session = require("express-session");
const cors = require("cors");
const { Server } = require("socket.io");
const connectDB = require("./config/db"); // ton fichier de connexion Mongo
const User = require("./models/User");

const app = express();
const server = http.createServer(app);

// 🔹 Connexion MongoDB
connectDB();

// 🔹 Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔹 CORS
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));

// 🔹 Sessions
const sessionMiddleware = session({
  secret: "mon_secret_ultra_secure",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 } // 1h
});
app.use(sessionMiddleware);

// 🔹 Upload static
app.use("/upload", express.static(path.join(__dirname, "upload")));
app.use(express.static(path.join(__dirname, "../front-end"))); // ton front

// 🔹 Routes
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/publications", require("./routes/publication")); // ⚡ attention à ce fichier

// 🔹 SPA fallback
app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "../front-end/index.html"));
  } else {
    next();
  }
});

// 🔹 Socket.io
const io = new Server(server, {
  cors: { origin: "http://localhost:3000", credentials: true }
});
io.use((socket, next) => sessionMiddleware(socket.request, {}, next));

io.on("connection", async (socket) => {
  const userId = socket.request.session?.userId;
  if (!userId) return socket.disconnect(true);

  await User.updateOne({ _id: userId }, { connect: true });
  io.emit("presence", { userId, online: true });

  socket.on("disconnect", async () => {
    await User.updateOne({ _id: userId }, { connect: false });
    io.emit("presence", { userId, online: false });
  });
});

app.set("io", io);

// 🔹 Démarrage serveur
const PORT = 3000;
server.listen(PORT, () => console.log(`Serveur lancé sur http://localhost:${PORT}`));