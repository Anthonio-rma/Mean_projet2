async function fetchUser(options = {}) {
    try {
        const res = await fetch("/api/users/me", {
            method: "GET",
            credentials: "include"
        });

        if (!res.ok) {
            if (options.redirectIfNotAuth) {
                window.location.href = "/pages/login.html";
            }
            return null;
        }

        const data = await res.json();

        // Sidebar
        if (options.nameSelector) {
            const nameEl = document.querySelector(options.nameSelector);
            if (nameEl) nameEl.textContent = data.fullname || "Prénom";
        }

        if (options.imgSelector) {
            const imgEl = document.querySelector(options.imgSelector);
            if (imgEl && data.image) imgEl.src = data.image; // <-- propriété correcte
        }

        // Contenu
        const contentNameEl = document.querySelector("#profileNameContent");
        const contentStatusEl = document.querySelector("#profileStatusContent");
        const contentPhoneEl = document.querySelector("#profilePhone");
        const contentEmailEl = document.querySelector("#profileEmail");
        const sidebarStatusEl = document.querySelector("#profileStatus");

        if (contentNameEl) contentNameEl.textContent = data.fullname || "";
        if (contentStatusEl) contentStatusEl.textContent = data.connect ? "En ligne" : "Hors ligne";
        if (sidebarStatusEl) sidebarStatusEl.textContent = data.connect ? "Actu : En ligne" : "Actu : Hors ligne";
        if (contentPhoneEl) contentPhoneEl.textContent = data.phone || "+261 34 00 000 00";
        if (contentEmailEl) contentEmailEl.textContent = data.paysname || "contact@domaine.mg";

        return data;

    } catch (err) {
        console.error("Erreur réelle :", err);
    }
}

// Charger user au démarrage
window.addEventListener("DOMContentLoaded", () => {
    fetchUser({
        nameSelector: "#profileName",
        imgSelector: "#profileImg",
        redirectIfNotAuth: true
    });
});

// front profile
async function loadProfile() {
    const res = await fetch("/api/users/me", {
        credentials: "include" // nécessaire pour la session
    });
    const user = await res.json();

    document.getElementById("profileName").innerText = user.fullname;
    document.getElementById("profileNameContent").innerText = user.fullname;
    document.getElementById("profilePhone").innerText = user.phone;

    if (user.image) {
        document.getElementById("profileImg").src = user.image;
    }

    //Mettre le status en ligne/hors ligne
    const sidebarStatusEl = document.getElementById("profileStatus");

    const statusText = user.connect ? "En ligne" : "Hors ligne";
    if (sidebarStatusEl) sidebarStatusEl.textContent = `Actu : ${statusText}`;

    console.log(user.paysname);
}

// Affiche le profil au chargement
loadProfile();

// Fonction pour transformer un div en input et valider l'update
function makeEditable(divId, fieldName, isSidebar = false) {
    const div = document.getElementById(divId);
    const oldValue = div.innerText;

    const input = document.createElement("input");
    input.type = "text";
    input.value = oldValue;
    input.style.width = "100%";
    input.style.fontSize = "18px";
    input.style.padding = "5px";
    input.style.border = "1px solid #ccc";
    input.style.borderRadius = "5px";

    div.innerHTML = "";
    div.appendChild(input);
    input.focus();

    // Fonction pour sauvegarder
    const save = async () => {
        const newValue = input.value.trim();
        if (!newValue) {
            div.innerText = oldValue; // restore
            return;
        }

        const formData = new FormData();
        formData.append(fieldName, newValue);

        const res = await fetch("/api/users/update", {
            method: "PUT",
            body: formData
        });

        const data = await res.json();

        if (data.error) {
            alert(data.error);
            div.innerText = oldValue;
        } else {
            div.innerText = newValue;
            if (isSidebar && fieldName === "fullname") {
                document.getElementById("profileName").innerText = newValue;
            }
        }
    };

    // Enter = save
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") save();
    });

    // Blur = save
    input.addEventListener("blur", save);
}

// Clic sur le bouton edit
document.querySelectorAll(".edit-btn")[0].addEventListener("click", () => {
    makeEditable("profileNameContent", "fullname", true);
});

document.querySelectorAll(".edit-btn")[1].addEventListener("click", () => {
    makeEditable("profilePhone", "phone");
});