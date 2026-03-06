const register = document.getElementById("registerForm")

register.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(register);

    try{
        const res = await fetch("http://localhost:3000/api/users/register", {
            method: "POST",
            body: formData
        })

        const data = await res.json()
        if(data.error){
            alert(data.error)
        }else{
            window.location.href = data.redirect;
        }
    } catch(err) {
        console.log(err);
        alert("erreur serveur")
    }
})
