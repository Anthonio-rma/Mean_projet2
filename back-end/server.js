const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const path = require("path");
const cors = require("cors");
const http = require("http");
const connectDB = require("./config/db")
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
      httpOnly: true
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
app.use("/api/publications", require("./routes/publication"))

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

io.on("connection", (socket) => {
  console.log("Socket connecté :", socket.id);

  socket.on("join", async (userId) => {
    try {
      onlineUsers.set(String(userId), socket.id);
      await User.findByIdAndUpdate(userId, { connect: true });
      io.emit("users:online", Array.from(onlineUsers.keys()));
    } catch (err) {
      console.error("SOCKET JOIN ERROR:", err);
    }
  });

  socket.on("private message", (data) => {
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