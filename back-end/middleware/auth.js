function isAuth(req,res,next){
    console.log("Session actuelle:", req.session); // 🔥 debug
    if(!req.session.userId){
        return res.redirect("/front-end/pages/login.html");
    }
    next();
}

module.exports = isAuth;