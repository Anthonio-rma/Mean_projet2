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