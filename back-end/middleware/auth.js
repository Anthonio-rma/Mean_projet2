function isAuth(req,res,next){
    console.log("Session actuelle:", req.session); // 🔥 debug
    if(!req.session.userId){
        return res.status(401).json({ error: "Non connecté" });
    }
    next();
}

module.exports = isAuth;