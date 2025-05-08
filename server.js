
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { /* options si besoin */ });

const streamerUsername = 'tiktokgo.fr'; // 👈 TON NOM D'UTILISATEUR TIKTOK
const liveConnection = new TikTokLiveConnection(streamerUsername);

const scores = {};
let currentOperation = { n1: 0, n2: 0, operator: '+', correctAnswer: 0, answers: [] };
let hasAnsweredCurrentOperation = false;
let waitingForAnswer = false; // Nouvelle variable de contrôle
const goodMessages = [
    "Bravo champion ! 🏆🔥",
    "Trop fort ! 💪⭐",
    "Tu m’épates ! 😲👏",
    "Bien joué, futur Einstein ! 🧠💡",
    "T’as mangé quoi ce matin ? Trop fort ! 🍽️⚡",
    "Quel talent ! Chapeau l’artiste ! 🎩🎉",
    "La classe internationale ! ✈️🌍",
    "Même Google n’aurait pas trouvé mieux ! 🔍✨",
    "C’est validé par l’Académie ! 📜✅",
    "On dirait que t’as triché… mais non ! 😂👌",
    "Respect total ! 🫡🏅",
    "On arrête tout : on a un génie ici ! 🛑🧠",
    "T’es plus rapide que la lumière ! 💥⚡",
    "Comme dirait Mbappé : ‘Incroyable !’ ⚽🔥",
    "Même Napoléon serait fier de toi ! 🇫🇷🎖️",
    "Maman serait fière ! 👩‍👦❤️",
    "T’es chaud comme la braise ! 🔥🔥",
    "C’est carré, net et sans bavure ! ⬛✔️",
    "Là, t’as mis tout le monde d’accord ! 🤝💯",
    "On va t’embaucher chez la NASA ! 🚀👨‍🚀",
    "Gold medal direct ! 🥇🎖️",
    "Masterclass ! 📚👏",
    "Grosse dinguerie, t’es un crack ! 🤯⚽",
    "On va graver ton nom sur le mur des légendes ! 🏛️📝",
    "Là franchement… RESPECT ! 🙏🔥"
];
const badMessages = [
    "Oups, essaie encore ! ❌",
    "Pas mal... mais raté ! 😅",
    "Trop rapide, mais pas juste ! ⚡❌",
    "C’est pas ça, mais j’aime l’énergie ! 💥👏",
    "Allez, la prochaine c’est la bonne ! 🤞",
    "Presque ! Donne-toi encore un petit coup ! 💪😉",
    "Ça chauffe, mais c’est pas encore ça ! 🔥❌",
    "Tu y es presque, continue ! 🏃‍♂️💨",
    "Raté… mais t’es sur la bonne voie ! 🚀",
    "Encore un petit effort ! 🙌✨",
    "Comme disait Napoléon : 'On peut perdre une bataille, pas la guerre.' 🇫🇷⚔️",
    "Même Einstein se trompait parfois… 😉🧠",
    "Patience est mère de sûreté. 🕰️🤓",
    "Ce n’est qu’un échec temporaire, camarade ! ✊📈",
    "La roue tourne… et la chance aussi ! 🎡🍀",
    "‘L’erreur est humaine’, Socrate l’a validé ! 🏛️📚",
    "On ne change pas une équipe qui perd… sauf si tu veux gagner ! ⚽😂",
    "Comme disait Churchill : 'Le succès, c’est d’aller d’échec en échec sans perdre son enthousiasme.' 🇬🇧🍵",
    "Recommence ! Même les plus grands ont chuté avant de réussir ! 🏆🥇",
    "Ce n’est pas parce que tu es tombé que tu ne vas pas te relever ! 🥊💥",
    "Même ta grand-mère aurait mieux répondu 😆👵",
    "Raté… mais t’es toujours beau gosse ! 😎❌",
    "C’est pas ça… mais au moins t’as cliqué ! 😂🖱️",
    "Allez… ça mérite un café avant de continuer ☕😉",
    "Tu viens de faire pleurer un panda 🐼😭",
    "Je crois en toi, champion ! 🏅🔥"
];
const gifsGood = ["https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExOGJrMXZwanpwZ2J6OWw3NWF5M3Bwb293YjY3bXBnZThpOXczcW1oMyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/2T7lF77q5hKiA/giphy.gif"];
const gifsBad = []; // Ajoute tes GIFs pour les mauvaises réponses

function generateOperation() {
    const n1 = Math.floor(Math.random() * 10) + 1;
    const n2 = Math.floor(Math.random() * 10) + 1;
    const operator = Math.random() < 0.5 ? '+' : '×';
    const correctAnswer = operator === '+' ? n1 + n2 : n1 * n2;
    const answersSet = new Set([correctAnswer]);
    while (answersSet.size < 4) {
        const fake = correctAnswer + Math.floor(Math.random() * 5) - 2;
        if (fake !== correctAnswer && fake >= 0) answersSet.add(fake);
    }
    const shuffledAnswers = Array.from(answersSet).sort(() => Math.random() - 0.5);
    currentOperation = { n1, n2, operator, correctAnswer, answers: shuffledAnswers };
    io.emit('newOperation', { operation: `${n1} ${operator} ${n2} = ?`, answers: shuffledAnswers });
    hasAnsweredCurrentOperation = false;
    waitingForAnswer = true; // On attend une réponse
}

function updateLeaderboard() {
    const sortedScores = Object.entries(scores).sort(([, a], [, b]) => b - a).slice(0, 3);
    io.emit('leaderboardUpdate', sortedScores);
}

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

liveConnection.on(WebcastEvent.CHAT, msg => {
    console.log(`[TikTok] ${msg.user.nickname}: ${msg.comment}`);
    const commenterName = msg.user.nickname;
    const userAnswer = parseInt(msg.comment);

    if (waitingForAnswer && !hasAnsweredCurrentOperation && !isNaN(userAnswer)) {
        if (currentOperation.answers.includes(userAnswer)) {
            hasAnsweredCurrentOperation = true;
            waitingForAnswer = false; // Une réponse valide a été reçue
            let messageToShow = getRandomItem(userAnswer === currentOperation.correctAnswer ? goodMessages : badMessages);
            if (userAnswer === currentOperation.correctAnswer) {
                messageToShow += ` La réponse était bien ${currentOperation.correctAnswer} !`;
                scores[commenterName] = (scores[commenterName] || 0) + 1;
                const gifUrl = getRandomItem(gifsGood);
                io.emit('showResult', { name: commenterName, message: messageToShow, gifUrl, points: 1 });
            } else {
                messageToShow += ` Non, la réponse était ${currentOperation.correctAnswer} !`;
                scores[commenterName] = (scores[commenterName] || 0) - 1;
                if (scores[commenterName] < 0) scores[commenterName] = 0;
                const gifUrl = gifsBad ? getRandomItem(gifsBad) : '';
                io.emit('showResult', { name: commenterName, message: messageToShow, gifUrl, points: -1 });
            }
            updateLeaderboard();
            setTimeout(generateOperation, 5000); // Générer une nouvelle question après le résultat
        } else {
            console.log(`[TikTok] Commentaire ignoré (réponse invalide ou hors délai): ${msg.comment}`);
            // Ne rien faire, on attend une réponse valide
        }
    } else if (!waitingForAnswer) {
        console.log('[TikTok] Commentaire ignoré (pas de question en attente):', msg.comment);
        // Si on n'attend pas de réponse, on ignore le commentaire lié à la réponse
    }
});

liveConnection.on(WebcastEvent.CONNECTED, state => {
    console.log('[TikTok] Connecté au live de', state.roomInfo?.host_user_name);
    generateOperation(); // Générer la première question une fois connecté
});

liveConnection.on(WebcastEvent.DISCONNECT, reason => {
    console.log('[TikTok] Déconnecté du live en raison de', reason);
});

liveConnection.on(WebcastEvent.ERROR, error => {
    console.error('[TikTok] Erreur lors de la connexion au live', error);
});

liveConnection.connect();

io.on('connection', (socket) => {
    console.log('[Socket.IO] Un utilisateur connecté');
    console.log('[Socket.IO] Envoi de l\'opération initiale :', currentOperation);
    socket.emit('newOperation', { operation: `${currentOperation.n1} ${currentOperation.operator} ${currentOperation.n2} = ?`, answers: currentOperation.answers });
    updateLeaderboard();
});

app.use(express.static('public'));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/switch-mode', (req, res) => {
    const operator = currentOperation.operator === '+' ? '×' : '+';
    const n1 = currentOperation.n1;
    const n2 = currentOperation.n2;
    const correctAnswer = operator === '+' ? n1 + n2 : n1 * n2;
    const answersSet = new Set([correctAnswer]);
    while (answersSet.size < 4) {
        const fake = correctAnswer + Math.floor(Math.random() * 5) - 2;
        if (fake !== correctAnswer && fake >= 0) answersSet.add(fake);
    }
    const shuffledAnswers = Array.from(answersSet).sort(() => Math.random() - 0.5);
    currentOperation = { n1, n2, operator, correctAnswer, answers: shuffledAnswers };
    io.emit('newOperation', { operation: `${n1} ${operator} ${n2} = ?`, answers: shuffledAnswers });
    res.json({ operation: `${n1} ${operator} ${n2} = ?`, answers: shuffledAnswers });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});

generateOperation();
