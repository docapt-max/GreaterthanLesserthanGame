// Game State
const MAX_ATTEMPTS = 10;
let currentAttempt = 0;
let score = 0;
let leftCount = 0;
let rightCount = 0;
let attemptHistory = [];
let roundPool = [];
let lastButtonPressed = null;
let consecutiveButtonCount = 0;
let consecutivePointsFromCurrentButton = 0;

// DOM Elements
const leftContainer = document.getElementById('left-container');
const rightContainer = document.getElementById('right-container');
const scoreboard = document.getElementById('scoreboard');
const centerCol = document.getElementById('center-col');
const btnLess = document.getElementById('btn-less');
const btnGreater = document.getElementById('btn-greater');
const orText = document.getElementById('or-text');

// Pre-generate exactly 5 '<' and 5 '>' rounds to guarantee that
// repeatedly pressing any single button can NEVER yield more than 5 points
function generateBalancedRounds() {
    const pool = ['<', '<', '<', '<', '<', '>', '>', '>', '>', '>'];
    let shuffled = [...pool];
    let isValid = false;
    let attempts = 0;

    while (!isValid && attempts < 100) {
        attempts++;
        shuffled = [...pool];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // Avoid long streaks of the same sign (max 2 in a row) for engaging variety
        let maxConsecutive = 1;
        let currentConsecutive = 1;
        for (let i = 1; i < shuffled.length; i++) {
            if (shuffled[i] === shuffled[i - 1]) {
                currentConsecutive++;
                if (currentConsecutive > maxConsecutive) maxConsecutive = currentConsecutive;
            } else {
                currentConsecutive = 1;
            }
        }

        if (maxConsecutive <= (attempts > 50 ? 3 : 2)) {
            isValid = true;
        }
    }

    return shuffled;
}

// Initialize / Start Game
function startGame() {
    currentAttempt = 0;
    score = 0;
    attemptHistory = [];
    lastButtonPressed = null;
    consecutiveButtonCount = 0;
    consecutivePointsFromCurrentButton = 0;

    // Reset Center Column UI
    btnLess.style.display = 'flex';
    btnGreater.style.display = 'flex';
    orText.style.display = 'block';

    const existingGameOver = document.getElementById('game-over-msg');
    if (existingGameOver) {
        existingGameOver.remove();
    }

    roundPool = generateBalancedRounds();

    updateScoreboardUI();
    nextRound();
}

// Setup a new round
function nextRound() {
    leftContainer.innerHTML = '';
    rightContainer.innerHTML = '';

    // Generate two distinct groups so the difference is visually clear for a child (minimum 2 items)
    const smallCount = Math.floor(Math.random() * 5) + 2; // 2 to 6 items
    const largeCount = Math.floor(Math.random() * 7) + 14; // 14 to 20 items

    // Use balanced pool: exactly 5 '<' and 5 '>' in every 10-attempt game
    const targetOperator = roundPool[currentAttempt] || (Math.random() < 0.5 ? '<' : '>');

    if (targetOperator === '<') {
        leftCount = smallCount;
        rightCount = largeCount;
    } else {
        leftCount = largeCount;
        rightCount = smallCount;
    }

    drawDots(leftContainer, leftCount, '🐟');
    drawDots(rightContainer, rightCount, '🦀');
}

// Draw emojis using a strict grid-based coordinate system to prevent overlap and border collision
function drawDots(container, count, emojiChar) {
    // Create a 5x5 grid (25 cells)
    const rows = 5;
    const cols = 5;
    const cells = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            cells.push({ r, c });
        }
    }

    // Shuffle cells to pick random unique positions
    for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    // Safe inner boundary (percentages) to guarantee items never touch borders
    const minX = 14;
    const maxX = 86;
    const minY = 14;
    const maxY = 86;
    const stepX = (maxX - minX) / (cols - 1); // 18%
    const stepY = (maxY - minY) / (rows - 1); // 18%

    for (let i = 0; i < count; i++) {
        const dot = document.createElement('div');
        dot.classList.add('dot');
        dot.classList.add(emojiChar === '🐟' ? 'fish' : 'crab');
        dot.textContent = emojiChar;

        const cell = cells[i];

        // Controlled subtle jitter (max ±2.5%) inside the grid cell
        const jitterX = (Math.random() - 0.5) * 5;
        const jitterY = (Math.random() - 0.5) * 5;

        const leftPos = minX + (cell.c * stepX) + jitterX;
        const topPos = minY + (cell.r * stepY) + jitterY;

        dot.style.top = `${topPos}%`;
        dot.style.left = `${leftPos}%`;

        container.appendChild(dot);
    }
}

// Update the top scoreboard display
function updateScoreboardUI() {
    scoreboard.innerHTML = '';
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const marker = document.createElement('span');
        if (i < attemptHistory.length) {
            marker.innerText = attemptHistory[i] ? '✅' : '❌';
        } else {
            marker.innerText = '⚪'; // Empty state
            marker.style.opacity = '0.3';
        }
        scoreboard.appendChild(marker);
    }
}

// Handle user input
function handleGuess(operator) {
    // Track consecutive button presses
    if (operator === lastButtonPressed) {
        consecutiveButtonCount++;
    } else {
        lastButtonPressed = operator;
        consecutiveButtonCount = 1;
        consecutivePointsFromCurrentButton = 0;
    }

    let isCorrect = false;

    if (operator === '<' && leftCount < rightCount) {
        isCorrect = true;
    } else if (operator === '>' && leftCount > rightCount) {
        isCorrect = true;
    }

    // Safety guard: if player continuously presses one button, cap score at 5
    if (isCorrect) {
        if (consecutivePointsFromCurrentButton >= 5) {
            isCorrect = false;
        } else {
            consecutivePointsFromCurrentButton++;
        }
    }

    // Emoji Feedback Logic
    const emoji = document.createElement('div');
    emoji.classList.add('emoji-feedback');

    if (isCorrect) {
        emoji.innerText = '✅😉👍';
        emoji.classList.add('fly-up');
    } else {
        emoji.innerText = '❌😟❌';
        emoji.classList.add('fly-down');
    }

    document.body.appendChild(emoji);

    // Remove emoji after animation completes (2 seconds)
    setTimeout(() => {
        emoji.remove();
    }, 2000);

    if (isCorrect) score++;
    attemptHistory.push(isCorrect);

    updateScoreboardUI();
    currentAttempt++;

    if (currentAttempt >= MAX_ATTEMPTS) {
        endGame();
    } else {
        nextRound();
    }
}

// Show Game Over inline within the center column
function endGame() {
    // Hide the middle buttons & the "OR" text
    btnLess.style.display = 'none';
    btnGreater.style.display = 'none';
    orText.style.display = 'none';

    // Show Game Over in the center column
    const gameOverMsg = document.createElement('div');
    gameOverMsg.id = 'game-over-msg';

    // Center the message exactly in the gap
    gameOverMsg.className = 'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center bg-slate-800/95 backdrop-blur-md p-6 md:p-8 rounded-3xl border-4 border-slate-600 shadow-[0_0_40px_rgba(0,0,0,0.85)] z-50 w-72 md:w-80';
    gameOverMsg.style.animation = 'popIn 1s ease-out forwards';

    gameOverMsg.innerHTML = `
        <div class="text-3xl md:text-4xl font-black text-white mb-2 whitespace-nowrap">🎉 Game Over!</div>
        <div class="text-2xl md:text-3xl text-emerald-400 font-extrabold whitespace-nowrap mb-6">Score: ${score} / ${MAX_ATTEMPTS}</div>
        <button onclick="startGame()" class="w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 active:scale-95 rounded-2xl text-white text-xl font-bold shadow-xl transition-all cursor-pointer whitespace-nowrap">Play Again 🔄</button>
    `;
    centerCol.appendChild(gameOverMsg);
}

// Start the game initially
window.onload = () => {
    startGame();
};

