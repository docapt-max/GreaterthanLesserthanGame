// Game Configuration and State
const MAX_ATTEMPTS = 10;
const MAX_WRONG_ANSWERS = 3;

let currentLevel = 1; // Default to Level 1
let currentAttempt = 0;
let score = 0;
let wrongAnswers = 0;
let attemptHistory = [];
let roundPool = [];
let lastButtonPressed = null;
let consecutiveButtonCount = 0;
let consecutivePointsFromCurrentButton = 0;
let lastLessOnTop = null;
let samePositionStreak = 0;
let isAnsweringBlocked = false;
let isWaitingForNext = false;

// Level 2 Variables
let leftCount = 0;
let rightCount = 0;

// DOM Elements
const leftContainer = document.getElementById('left-container');
const rightContainer = document.getElementById('right-container');
const scoreboard = document.getElementById('scoreboard');
const centerCol = document.getElementById('center-col');
const btnLess = document.getElementById('btn-less');
const btnGreater = document.getElementById('btn-greater');
const orText = document.getElementById('or-text');
const chipsContainer = document.getElementById('chips-container');
const questionSentence = document.getElementById('question-sentence');
const playArea = document.getElementById('play-area');
const lvlBtn1 = document.getElementById('lvl-btn-1');
const lvlBtn2 = document.getElementById('lvl-btn-2');

// Shape Color Palette (Vibrant, high-contrast, child-friendly)
const SHAPE_COLORS = [
    { name: 'green', hex: '#22c55e', textHex: '#4ade80' },
    { name: 'red', hex: '#ef4444', textHex: '#f87171' },
    { name: 'blue', hex: '#3b82f6', textHex: '#60a5fa' },
    { name: 'yellow', hex: '#eab308', textHex: '#facc15' },
    { name: 'purple', hex: '#a855f7', textHex: '#c084fc' },
    { name: 'orange', hex: '#f97316', textHex: '#fb923c' },
    { name: 'pink', hex: '#ec4899', textHex: '#f472b6' }
];

// SVG Shape Generators
function createCircleSvg(colorHex, size) {
    return `<svg viewBox="0 0 100 100" style="width:${size}px; height:${size}px;" class="shape-svg">
        <circle cx="50" cy="50" r="44" fill="${colorHex}" stroke="rgba(255,255,255,0.35)" stroke-width="4" />
    </svg>`;
}

function createSquareSvg(colorHex, size) {
    return `<svg viewBox="0 0 100 100" style="width:${size}px; height:${size}px;" class="shape-svg">
        <rect x="8" y="8" width="84" height="84" rx="10" fill="${colorHex}" stroke="rgba(255,255,255,0.35)" stroke-width="4" />
    </svg>`;
}

function createTriangleSvg(colorHex, size) {
    // Equilateral triangle (side ~84, height ~72.7 centered in 100x100)
    return `<svg viewBox="0 0 100 100" style="width:${size}px; height:${size}px;" class="shape-svg">
        <polygon points="50,13.5 92,86.2 8,86.2" fill="${colorHex}" stroke="rgba(255,255,255,0.35)" stroke-width="4" stroke-linejoin="round" />
    </svg>`;
}

function createPentagonSvg(colorHex, size) {
    // Regular pentagon centered at (50, 52) with radius 42
    return `<svg viewBox="0 0 100 100" style="width:${size}px; height:${size}px;" class="shape-svg">
        <polygon points="50,10 89.9,39 74.7,86 25.3,86 10.1,39" fill="${colorHex}" stroke="rgba(255,255,255,0.35)" stroke-width="4" stroke-linejoin="round" />
    </svg>`;
}

const SHAPES = [
    { type: 'circle', name: 'circle', render: createCircleSvg },
    { type: 'square', name: 'square', render: createSquareSvg },
    { type: 'triangle', name: 'triangle', render: createTriangleSvg },
    { type: 'pentagon', name: 'pentagon', render: createPentagonSvg }
];

// Pre-generate balanced 5 vs 5 pool to prevent single-choice exploit
function generateBalancedPool(options) {
    const pool = [
        options[0], options[0], options[0], options[0], options[0],
        options[1], options[1], options[1], options[1], options[1]
    ];
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

        // Avoid long streaks of the same sign (max 2 in a row)
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

// Level 2 Diverse Emoji Items (Fruits, Animals, Vehicles, Nature & Toys)
const LEVEL_2_ITEMS = [
    { emoji: '🍎', name: 'Apples' },
    { emoji: '🍌', name: 'Bananas' },
    { emoji: '🍓', name: 'Strawberries' },
    { emoji: '🍊', name: 'Oranges' },
    { emoji: '🍉', name: 'Watermelons' },
    { emoji: '🍪', name: 'Cookies' },
    { emoji: '🧁', name: 'Cupcakes' },
    { emoji: '🐶', name: 'Dogs' },
    { emoji: '🐱', name: 'Cats' },
    { emoji: '🐰', name: 'Bunnies' },
    { emoji: '🐸', name: 'Frogs' },
    { emoji: '🦁', name: 'Lions' },
    { emoji: '🐘', name: 'Elephants' },
    { emoji: '🐝', name: 'Bees' },
    { emoji: '🦋', name: 'Butterflies' },
    { emoji: '🚗', name: 'Cars' },
    { emoji: '🚌', name: 'Buses' },
    { emoji: '🚂', name: 'Trains' },
    { emoji: '✈️', name: 'Airplanes' },
    { emoji: '🚀', name: 'Rockets' },
    { emoji: '⚽', name: 'Soccer balls' },
    { emoji: '🎈', name: 'Balloons' },
    { emoji: '⭐', name: 'Stars' },
    { emoji: '☀️', name: 'Suns' },
    { emoji: '🌿', name: 'Leaves' },
    { emoji: '🍁', name: 'Maple leaves' },
    { emoji: '🌻', name: 'Sunflowers' },
    { emoji: '🐟', name: 'Fishes' },
    { emoji: '🦀', name: 'Crabs' }
];

// Switch between Level 1 and Level 2
function switchLevel(lvl) {
    if (currentLevel === lvl) return;
    currentLevel = lvl;

    if (currentLevel === 1) {
        lvlBtn1.className = 'px-4 py-1.5 md:px-5 md:py-2 min-h-[44px] rounded-full text-xs md:text-sm font-extrabold transition-all cursor-pointer bg-indigo-600 text-white shadow-md flex items-center justify-center';
        lvlBtn2.className = 'px-4 py-1.5 md:px-5 md:py-2 min-h-[44px] rounded-full text-xs md:text-sm font-extrabold transition-all cursor-pointer text-slate-300 hover:text-white flex items-center justify-center';
    } else {
        lvlBtn2.className = 'px-4 py-1.5 md:px-5 md:py-2 min-h-[44px] rounded-full text-xs md:text-sm font-extrabold transition-all cursor-pointer bg-indigo-600 text-white shadow-md flex items-center justify-center';
        lvlBtn1.className = 'px-4 py-1.5 md:px-5 md:py-2 min-h-[44px] rounded-full text-xs md:text-sm font-extrabold transition-all cursor-pointer text-slate-300 hover:text-white flex items-center justify-center';
    }

    startGame();
}

// Calculate shape sizes ensuring smaller shape is 50% or less of the larger shape (difference >= 50%)
function getShapeSizes() {
    const boxRect = leftContainer.getBoundingClientRect();
    const minDim = Math.min(boxRect.width || 380, boxRect.height || 380);

    // Large shape takes around 54% of container dimension
    let bigSize = Math.round(minDim * 0.54);
    if (bigSize < 180) bigSize = 180;
    if (bigSize > 220) bigSize = 220;

    // Small shape is 48% of big shape (making difference at least 52% >= 50%)
    const smallSize = Math.round(bigSize * 0.48);

    return { bigSize, smallSize };
}

// Swap the position of the greater than and lesser than picture buttons (Level 2)
function updateButtonPositions() {
    let lessOnTop = Math.random() < 0.5;

    if (lastLessOnTop !== null && lessOnTop === lastLessOnTop) {
        samePositionStreak++;
        if (samePositionStreak >= 2) {
            lessOnTop = !lessOnTop;
            samePositionStreak = 1;
        }
    } else {
        samePositionStreak = 1;
    }
    lastLessOnTop = lessOnTop;

    if (lessOnTop) {
        centerCol.insertBefore(btnLess, orText);
        centerCol.appendChild(btnGreater);
    } else {
        centerCol.insertBefore(btnGreater, orText);
        centerCol.appendChild(btnLess);
    }
}

// Initialize / Start Game
function startGame() {
    currentAttempt = 0;
    score = 0;
    wrongAnswers = 0;
    attemptHistory = [];
    lastButtonPressed = null;
    consecutiveButtonCount = 0;
    consecutivePointsFromCurrentButton = 0;
    lastLessOnTop = null;
    samePositionStreak = 0;
    isAnsweringBlocked = false;
    isWaitingForNext = false;

    // Reset Next Button & Scoreboard Tap State
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
        nextBtn.style.display = 'none';
    }
    if (scoreboard) {
        scoreboard.classList.remove('scoreboard-active-tap');
    }

    // Remove any existing Game Over popup
    const existingGameOver = document.getElementById('game-over-modal');
    if (existingGameOver) {
        existingGameOver.remove();
    }

    // Configure UI based on Level
    if (currentLevel === 1) {
        centerCol.style.display = 'none';
        chipsContainer.style.display = 'flex';
        roundPool = generateBalancedPool(['bigger', 'smaller']);
    } else {
        centerCol.style.display = 'flex';
        btnLess.style.display = 'flex';
        btnGreater.style.display = 'flex';
        orText.style.display = 'block';
        chipsContainer.style.display = 'none';
        roundPool = generateBalancedPool(['<', '>']);
    }

    updateScoreboardUI();
    updateLivesUI();
    nextRound();
}

// Setup a new round for the active level
function nextRound() {
    leftContainer.innerHTML = '';
    rightContainer.innerHTML = '';

    if (currentLevel === 1) {
        setupLevel1Round();
    } else {
        setupLevel2Round();
    }
}

// Setup Level 1: Geometric Shapes & Sizes
function setupLevel1Round() {
    // 1. Pick geometric shape (circle, square, equilateral triangle, pentagon)
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];

    // 2. Pick 2 different colors
    const shuffledColors = [...SHAPE_COLORS].sort(() => Math.random() - 0.5);
    const leftColor = shuffledColors[0];
    const rightColor = shuffledColors[1];

    // 3. Determine sizes with at least 50% difference (smaller shape is 48% or less of big shape)
    const { bigSize, smallSize } = getShapeSizes();

    // 4. Target from balanced pool: 'bigger' or 'smaller'
    const target = roundPool[currentAttempt] || (Math.random() < 0.5 ? 'bigger' : 'smaller');

    let leftSize, rightSize;
    if (target === 'bigger') {
        leftSize = bigSize;
        rightSize = smallSize;
    } else {
        leftSize = smallSize;
        rightSize = bigSize;
    }

    // 5. Render Shapes in Boxes
    const leftWrapper = document.createElement('div');
    leftWrapper.className = 'shape-container';
    leftWrapper.innerHTML = shape.render(leftColor.hex, leftSize);
    leftContainer.appendChild(leftWrapper);

    const rightWrapper = document.createElement('div');
    rightWrapper.className = 'shape-container';
    rightWrapper.innerHTML = shape.render(rightColor.hex, rightSize);
    rightContainer.appendChild(rightWrapper);

    // 6. Sentence: "The [color1] [shape] is ______ than the [color2] [shape]."
    questionSentence.innerHTML = `The <span style="color: ${leftColor.textHex}; font-weight: 800;">${leftColor.name}</span> ${shape.name} is <span id="sentence-blank" class="px-2.5 py-0.5 rounded-lg bg-slate-700/70 border border-slate-500 font-extrabold text-indigo-200">______</span> than the <span style="color: ${rightColor.textHex}; font-weight: 800;">${rightColor.name}</span> ${shape.name}.`;

    // 7. Render "bigger" and "smaller" chips just above the boxes
    chipsContainer.innerHTML = '';
    const chipChoices = Math.random() < 0.5 ? ['bigger', 'smaller'] : ['smaller', 'bigger'];

    chipChoices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'chip-btn min-h-[52px] px-8 py-2.5 md:px-11 md:py-3.5 rounded-full text-xl md:text-2xl font-black bg-slate-800/95 text-indigo-100 hover:text-white border-2 border-indigo-400/90 shadow-[0_6px_20px_rgba(0,0,0,0.4),0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_8px_25px_rgba(99,102,241,0.5)] active:scale-95 transition-all cursor-pointer select-none backdrop-blur-sm flex items-center justify-center';
        btn.textContent = choice;
        btn.onclick = () => handleLevel1Guess(choice, target, btn);
        chipsContainer.appendChild(btn);
    });
}

// Setup Level 2: Quantities (Diverse Engaging Emojis)
function setupLevel2Round() {
    updateButtonPositions();

    // Pick 2 different emojis from the pool of 29 items
    const shuffledItems = [...LEVEL_2_ITEMS].sort(() => Math.random() - 0.5);
    const leftItem = shuffledItems[0];
    const rightItem = shuffledItems[1];

    questionSentence.innerHTML = `${leftItem.emoji} ${leftItem.name} are <span id="sentence-blank" class="px-2.5 py-0.5 rounded-lg bg-slate-700/70 border border-slate-500 font-extrabold text-indigo-200">________</span> ${rightItem.emoji} ${rightItem.name}.`;

    // Stark quantity contrast: larger box has 23, 24, or 25; smaller box has 2, 3, or 4
    const largeOptions = [23, 24, 25];
    const smallOptions = [2, 3, 4];
    const largeCount = largeOptions[Math.floor(Math.random() * largeOptions.length)];
    const smallCount = smallOptions[Math.floor(Math.random() * smallOptions.length)];

    const targetOperator = roundPool[currentAttempt] || (Math.random() < 0.5 ? '<' : '>');

    if (targetOperator === '<') {
        leftCount = smallCount;
        rightCount = largeCount;
    } else {
        leftCount = largeCount;
        rightCount = smallCount;
    }

    drawDots(leftContainer, leftCount, leftItem.emoji);
    drawDots(rightContainer, rightCount, rightItem.emoji);
}

// Draw emojis using a strict grid-based coordinate system (Level 2: 5 rows x 6 cols = 30 cells)
function drawDots(container, count, emojiChar) {
    const rows = 5;
    const cols = 6;
    const cells = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            cells.push({ r, c });
        }
    }

    // Shuffle cells to place emojis in random unique positions
    for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    // Safe inner boundary (percentages) to guarantee items never touch borders
    const minX = 11;
    const maxX = 89;
    const minY = 11;
    const maxY = 89;
    const stepX = (maxX - minX) / (cols - 1); // 15.6%
    const stepY = (maxY - minY) / (rows - 1); // 19.5%

    for (let i = 0; i < count; i++) {
        const dot = document.createElement('div');
        dot.classList.add('dot');
        dot.textContent = emojiChar;

        const cell = cells[i];

        // Controlled subtle jitter (max ±1.5%) inside the grid cell
        const jitterX = (Math.random() - 0.5) * 3;
        const jitterY = (Math.random() - 0.5) * 3;

        const leftPos = minX + (cell.c * stepX) + jitterX;
        const topPos = minY + (cell.r * stepY) + jitterY;

        dot.style.top = `${topPos}%`;
        dot.style.left = `${leftPos}%`;

        container.appendChild(dot);
    }
}

// Handle Level 1 Chip Tap
function handleLevel1Guess(choice, targetChoice, chipBtn) {
    if (isAnsweringBlocked) return;
    isAnsweringBlocked = true;

    // Anti-spam guard: track consecutive same button presses
    if (choice === lastButtonPressed) {
        consecutiveButtonCount++;
    } else {
        lastButtonPressed = choice;
        consecutiveButtonCount = 1;
        consecutivePointsFromCurrentButton = 0;
    }

    let isCorrect = (choice === targetChoice);

    if (isCorrect) {
        if (consecutivePointsFromCurrentButton >= 5) {
            isCorrect = false;
        } else {
            consecutivePointsFromCurrentButton++;
        }
    }

    const sentenceBlank = document.getElementById('sentence-blank');

    if (isCorrect) {
        chipBtn.classList.add('chip-correct');
        if (sentenceBlank) {
            sentenceBlank.innerHTML = `<span class="text-emerald-400 font-extrabold">${choice}</span>`;
            sentenceBlank.className = 'px-2.5 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400 font-extrabold text-emerald-300';
        }
        score++;
    } else {
        chipBtn.classList.add('chip-wrong');
        if (sentenceBlank) {
            sentenceBlank.innerHTML = `<span class="text-rose-400 font-extrabold">${choice}</span>`;
            sentenceBlank.className = 'px-2.5 py-0.5 rounded-lg bg-rose-500/20 border border-rose-400 font-extrabold text-rose-300';
        }
        wrongAnswers++;
    }

    attemptHistory.push(isCorrect);
    showEmojiFeedback(isCorrect);
    updateScoreboardUI();
    updateLivesUI(!isCorrect);
    currentAttempt++;

    // Pause and wait for child to reflect instead of auto-advancing
    setTimeout(() => {
        showNextPrompt();
    }, 450);
}

// Handle Level 2 Symbol Tap
function handleLevel2Guess(operator) {
    if (isAnsweringBlocked) return;
    isAnsweringBlocked = true;

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

    if (isCorrect) {
        if (consecutivePointsFromCurrentButton >= 5) {
            isCorrect = false;
        } else {
            consecutivePointsFromCurrentButton++;
        }
    }

    const sentenceBlank = document.getElementById('sentence-blank');
    if (sentenceBlank) {
        sentenceBlank.innerText = operator === '<' ? 'lesser than' : 'greater than';
        sentenceBlank.className = isCorrect ? 'px-2.5 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400 font-extrabold text-emerald-300' : 'px-2.5 py-0.5 rounded-lg bg-rose-500/20 border border-rose-400 font-extrabold text-rose-300';
    }

    showEmojiFeedback(isCorrect);

    if (isCorrect) {
        score++;
    } else {
        wrongAnswers++;
    }
    attemptHistory.push(isCorrect);

    updateScoreboardUI();
    updateLivesUI(!isCorrect);
    currentAttempt++;

    // Pause and wait for child to reflect instead of auto-advancing
    setTimeout(() => {
        showNextPrompt();
    }, 450);
}

// Show Next prompt button and activate scoreboard tap for reflection
function showNextPrompt() {
    isWaitingForNext = true;
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
        nextBtn.style.display = 'inline-flex';
        nextBtn.style.animation = 'overlayPopIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
        if (wrongAnswers >= MAX_WRONG_ANSWERS || currentAttempt >= MAX_ATTEMPTS) {
            nextBtn.innerHTML = 'See Results 🎉';
        } else {
            nextBtn.innerHTML = 'Next ➡️';
        }
    }
    if (scoreboard) {
        scoreboard.classList.add('scoreboard-active-tap');
    }
}

// Advance to next round when Next button or score bar is tapped
function goToNextRound() {
    if (!isWaitingForNext) return;
    isWaitingForNext = false;

    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
        nextBtn.style.display = 'none';
    }
    if (scoreboard) {
        scoreboard.classList.remove('scoreboard-active-tap');
    }

    if (wrongAnswers >= MAX_WRONG_ANSWERS) {
        endGame(true);
    } else if (currentAttempt >= MAX_ATTEMPTS) {
        endGame(false);
    } else {
        isAnsweringBlocked = false;
        nextRound();
    }
}

// Emoji Feedback Animation
function showEmojiFeedback(isCorrect) {
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

    setTimeout(() => {
        emoji.remove();
    }, 2000);
}

// Update the bottom scoreboard display (shared across all levels)
function updateScoreboardUI() {
    scoreboard.innerHTML = '';
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const marker = document.createElement('span');
        if (i < attemptHistory.length) {
            marker.innerText = attemptHistory[i] ? '✅' : '❌';
        } else {
            marker.innerText = '⚪';
            marker.style.opacity = '0.3';
        }
        scoreboard.appendChild(marker);
    }
}

// Update the 3 hearts / chances display on top left
function updateLivesUI(justLostLife = false) {
    const livesContainer = document.getElementById('lives-container');
    if (!livesContainer) return;

    livesContainer.innerHTML = '';
    const remainingLives = Math.max(0, MAX_WRONG_ANSWERS - wrongAnswers);

    for (let i = 0; i < MAX_WRONG_ANSWERS; i++) {
        const heart = document.createElement('span');
        if (i < remainingLives) {
            heart.innerText = '❤️';
        } else {
            heart.innerText = '💔';
            if (justLostLife && i === remainingLives) {
                heart.classList.add('heart-broken');
            } else {
                heart.classList.add('opacity-75');
            }
        }
        livesContainer.appendChild(heart);
    }
}

// Show Game Over modal centered over play area
function endGame(isThreeStrikes = false) {
    isWaitingForNext = false;
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) nextBtn.style.display = 'none';
    if (scoreboard) scoreboard.classList.remove('scoreboard-active-tap');

    if (chipsContainer) chipsContainer.style.display = 'none';
    if (btnLess) btnLess.style.display = 'none';
    if (btnGreater) btnGreater.style.display = 'none';
    if (orText) orText.style.display = 'none';

    const existingGameOver = document.getElementById('game-over-modal');
    if (existingGameOver) existingGameOver.remove();

    const gameOverModal = document.createElement('div');
    gameOverModal.id = 'game-over-modal';
    gameOverModal.className = 'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center bg-slate-800/95 backdrop-blur-md p-6 md:p-8 rounded-3xl border-4 border-slate-600 shadow-[0_0_40px_rgba(0,0,0,0.85)] z-50 w-80 md:w-96';
    gameOverModal.style.animation = 'popIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';

    const title = isThreeStrikes ? 'Game Over!' : (score >= 8 ? '🎉 Amazing Job!' : '🎉 Game Over!');
    const reason = isThreeStrikes ? '<div class="text-rose-400 font-extrabold text-sm md:text-base uppercase tracking-wider mb-2">❌ 3 Wrong Answers</div>' : '';

    const nextLvlBtnHtml = currentLevel === 1
        ? `<button onclick="switchLevel(2)" class="w-full min-h-[52px] py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 active:scale-95 rounded-2xl text-white text-lg md:text-xl font-bold shadow-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center">Play Level 2 ➡️</button>`
        : `<button onclick="switchLevel(1)" class="w-full min-h-[52px] py-3.5 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 active:scale-95 rounded-2xl text-white text-lg md:text-xl font-bold shadow-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center">Play Level 1 ⬅️</button>`;

    gameOverModal.innerHTML = `
        <div class="text-3xl md:text-4xl font-black text-white mb-2 whitespace-nowrap">${title}</div>
        ${reason}
        <div class="text-2xl md:text-3xl text-emerald-400 font-extrabold whitespace-nowrap mb-6">Score: ${score} / ${MAX_ATTEMPTS}</div>
        <div class="flex flex-col gap-3">
            <button onclick="startGame()" class="w-full min-h-[52px] py-3.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 active:scale-95 rounded-2xl text-white text-lg md:text-xl font-bold shadow-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center">Play Again 🔄</button>
            ${nextLvlBtnHtml}
        </div>
    `;

    playArea.appendChild(gameOverModal);
}

// Start Game on window load
window.onload = () => {
    startGame();
};
