const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullname: {
      type: String,
      required: true,
      trim: true
    },
    username: {
      type: String,
      trim: true,
      unique: true,
      sparse: true
    },
    paysname: String,
    phone: {
      type: String,
      required: true,
      unique: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true
    },
    bio: {
      type: String,
      default: "",
      maxlength: 300
    },
    file: String,
    connect: {
      type: Boolean,
      default: false
    },
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);