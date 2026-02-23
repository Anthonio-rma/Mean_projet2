// Initialisation des icônes Lucide
lucide.createIcons();

const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const actionIcon = document.getElementById('actionIcon');
const chatDisplay = document.getElementById('chatDisplay');

// Basculer entre l'icône micro et envoyer
messageInput.addEventListener('input', () => {
    const hasValue = messageInput.value.trim().length > 0;
    const newIcon = hasValue ? 'send' : 'mic';
    
    if (actionIcon.getAttribute('data-lucide') !== newIcon) {
        actionIcon.setAttribute('data-lucide', newIcon);
        lucide.createIcons();
    }
});

// Fonction pour ajouter un message à l'écran
function appendMessage(text, type = 'outgoing') {
    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    const messageHTML = `
        <div class="message-row ${type}">
            <div class="message-bubble">
                ${text}
                <div class="message-meta">
                    ${time} 
                    ${type === 'outgoing' ? '<i data-lucide="check-check" class="status-icon"></i>' : ''}
                </div>
            </div>
        </div>
    `;

    chatDisplay.insertAdjacentHTML('beforeend', messageHTML);
    lucide.createIcons(); // Re-générer l'icône check-check
    
    // Scroll automatique vers le bas
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

// Gérer le clic sur envoyer
sendBtn.addEventListener('click', () => {
    const message = messageInput.value.trim();
    if (message !== "") {
        appendMessage(message, 'outgoing');
        messageInput.value = "";
        messageInput.dispatchEvent(new Event('input')); // Réinitialise l'icône en micro

        // Petite simulation de réponse automatique
        setTimeout(() => {
            appendMessage("C'est reçu ! Je regarde ça.", 'incoming');
        }, 1500);
    }
});

// Envoyer avec la touche "Entrée"
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendBtn.click();
    }
});




function nextStep() {
    const num = document.getElementById('tel').value;
    if (num.length < 9) {
        alert("Saisissez un numéro Malagasy valide (ex: 34...)");
        return;
    }
    document.getElementById('login-step').classList.remove('active');
    document.getElementById('profile-step').classList.add('active');
}

function prevStep() {
    document.getElementById('profile-step').classList.remove('active');
    document.getElementById('login-step').classList.add('active');
}