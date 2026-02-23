const { default: mongoose } = require("mongoose")
const moongose = require("mongoose")

const userSchema = new mongoose.Schema({
    fullname: String,
    paysname: String,
    phone: String,
    password: String,
    file: String,
    connect: Boolean
});

module.exports = mongoose.model("User", userSchema)