const login = document.getElementById('loginForm')
        // Gestion étapes
        function nextStep() {
            document.getElementById("login-step").classList.remove("active");
            document.getElementById("profile-step").classList.add("active");
        }
        function prevStep() {
            document.getElementById("profile-step").classList.remove("active");
            document.getElementById("login-step").classList.add("active");
        }

    login.addEventListener("submit", async (e) => {
        e.preventDefault()

        const formData = new FormData(login);
        const data = Object.fromEntries(formData.entries()); // transforme en JSON

        try {
            const res = await fetch("http://localhost:3000/api/users/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
                credentials: "include" // 🔥 indispensable pour que connect.sid soit envoyé
            })

            const result = await res.json();
            if(result.error){
                alert(result.error);
            } else {
                window.location.href = result.redirect; // /pages/message.html
            }
        } catch(err){
            console.error(err);
            alert("Erreur serveur");
        }
    });