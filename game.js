// Game Configuration and State
const MAX_ATTEMPTS = 10;
const MAX_WRONG_ANSWERS = 3;

let currentLevel = 0; // Default to Level 0 (starts before Level 1)
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

// Level 0 Variables
let level0Targets = { left: '', right: '' };
let placedChips = { left: null, right: null };
let selectedChip = null;

// Level 1 Variables (Quantities)
let leftCount = 0;
let rightCount = 0;
let countedLeft = 0;
let countedRight = 0;

// DOM Elements
const leftContainer = document.getElementById('left-container');
const rightContainer = document.getElementById('right-container');
const smallBoxLeft = document.getElementById('small-box-left');
const smallBoxRight = document.getElementById('small-box-right');
const scoreboard = document.getElementById('scoreboard');
const centerCol = document.getElementById('center-col');
const btnLess = document.getElementById('btn-less');
const btnGreater = document.getElementById('btn-greater');
const orText = document.getElementById('or-text');
const chipsContainer = document.getElementById('chips-container');
const questionSentence = document.getElementById('question-sentence');
const playArea = document.getElementById('play-area');
const lvlBtn0 = document.getElementById('lvl-btn-0');
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

function createRectangleSvg(colorHex, size) {
    // Upright rectangle standing on its base (aspect ratio ~1:1.55, width 54, height 84)
    return `<svg viewBox="0 0 100 100" style="width:${size}px; height:${size}px;" class="shape-svg">
        <rect x="23" y="8" width="54" height="84" rx="8" fill="${colorHex}" stroke="rgba(255,255,255,0.35)" stroke-width="4" />
    </svg>`;
}

function createStraightLineSvg(colorHex, size) {
    // Straight line / bar with long axis running from right upper corner to left lower corner
    // Constant thickness (12px) regardless of length along the long axis
    const fixedViewDim = 240;
    const thickness = 12;
    // Guaranteed minimum length of 54px (aspect ratio 4.5:1) so the small bar is always clearly a bar and never a dot
    const barLength = Math.max(54, size * 0.92);
    const halfLength = barLength / 2;

    return `<svg viewBox="-120 -120 240 240" style="width:${fixedViewDim}px; height:${fixedViewDim}px;" class="shape-svg">
        <rect x="${-thickness / 2}" y="${-halfLength}" width="${thickness}" height="${barLength}" rx="${thickness / 2}" transform="rotate(45)" fill="${colorHex}" stroke="rgba(255,255,255,0.4)" stroke-width="3" />
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
    { type: 'rectangle', name: 'rectangle', render: createRectangleSvg },
    { type: 'straight-line', name: 'bar', render: createStraightLineSvg },
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

// Level 1 Diverse Emoji Items (Fruits, Animals, Vehicles, Nature & Toys)
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

// Update Level Switcher active state
function updateLevelButtonsUI() {
    const activeClasses = 'px-3.5 py-1 md:px-4 md:py-1.5 min-h-[38px] rounded-full text-xs md:text-sm font-extrabold transition-all cursor-pointer bg-indigo-600 text-white shadow-md flex items-center justify-center';
    const inactiveClasses = 'px-3.5 py-1 md:px-4 md:py-1.5 min-h-[38px] rounded-full text-xs md:text-sm font-extrabold transition-all cursor-pointer text-slate-300 hover:text-white flex items-center justify-center';

    if (lvlBtn0) lvlBtn0.className = (currentLevel === 0) ? activeClasses : inactiveClasses;
    if (lvlBtn1) lvlBtn1.className = (currentLevel === 1) ? activeClasses : inactiveClasses;
    if (lvlBtn2) lvlBtn2.className = (currentLevel === 2) ? activeClasses : inactiveClasses;
}

// Switch between Level 0, Level 1, and Level 2
function switchLevel(lvl) {
    if (currentLevel === lvl) return;
    currentLevel = lvl;
    updateLevelButtonsUI();
    startGame();
}

// Calculate shape sizes ensuring smaller shape meets the required size difference
// In Level 0: 2D surface area difference is guaranteed to be a minimum of 85%
// Math: Area_ratio = (small / big)^2 <= (1 - 0.85) = 0.15 => small / big <= sqrt(0.15) ≈ 0.3873
function getShapeSizes(lvl = currentLevel, shapeType = null) {
    const boxRect = leftContainer.getBoundingClientRect();
    const minDim = Math.min(boxRect.width || 380, boxRect.height || 380);

    // Large shape takes around 54% of container dimension
    let bigSize = Math.round(minDim * 0.54);
    if (bigSize < 180) bigSize = 180;
    if (bigSize > 220) bigSize = 220;

    // Linear ratio:
    // For 2D shapes (circle, square, etc.), area scales as ratio^2: 0.38^2 = 0.1444 => >= 85.5% difference
    // For the bar, length ratio 0.28 gives 56px vs 190px (distinct bar, 4.5:1 aspect ratio, never a dot)
    let linearRatio;
    if (lvl === 0) {
        linearRatio = (shapeType === 'straight-line') ? 0.28 : 0.38;
    } else {
        linearRatio = (shapeType === 'straight-line') ? 0.46 : 0.48;
    }
    const smallSize = Math.floor(bigSize * linearRatio);

    return { bigSize, smallSize };
}

// Swap the position of the greater than and lesser than picture buttons (Level 1)
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
    placedChips = { left: null, right: null };
    selectedChip = null;

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
    if (currentLevel === 0) {
        centerCol.style.display = 'none';
        btnLess.style.display = 'none';
        btnGreater.style.display = 'none';
        orText.style.display = 'none';
        questionSentence.style.display = 'none';
        chipsContainer.style.display = 'flex';
        if (smallBoxLeft) smallBoxLeft.style.display = 'none';
        if (smallBoxRight) smallBoxRight.style.display = 'none';
        roundPool = generateBalancedPool(['left-small', 'left-big']);
    } else if (currentLevel === 1) {
        // Level 1: Quantities / Emojis (< and >) with Small Boxes showing counts
        centerCol.style.display = 'flex';
        btnLess.style.display = 'flex';
        btnGreater.style.display = 'flex';
        orText.style.display = 'block';
        questionSentence.style.display = 'none'; // Uncluttered sketch layout
        chipsContainer.style.display = 'none';
        if (smallBoxLeft) smallBoxLeft.style.display = 'flex';
        if (smallBoxRight) smallBoxRight.style.display = 'flex';
        roundPool = generateBalancedPool(['<', '>']);
    } else {
        // Level 2: Geometric Shapes (bigger / smaller)
        centerCol.style.display = 'none';
        btnLess.style.display = 'none';
        btnGreater.style.display = 'none';
        orText.style.display = 'none';
        questionSentence.style.display = 'block';
        chipsContainer.style.display = 'flex';
        if (smallBoxLeft) smallBoxLeft.style.display = 'none';
        if (smallBoxRight) smallBoxRight.style.display = 'none';
        roundPool = generateBalancedPool(['bigger', 'smaller']);
    }

    updateLevelButtonsUI();
    updateScoreboardUI();
    updateLivesUI();
    nextRound();
}

// Setup a new round for the active level
function nextRound() {
    leftContainer.innerHTML = '';
    rightContainer.innerHTML = '';
    leftContainer.onclick = null;
    rightContainer.onclick = null;
    leftContainer.className = 'relative flex-1 w-full game-board bg-slate-800 rounded-3xl overflow-hidden border-4 border-slate-600 flex items-center justify-center';
    rightContainer.className = 'relative flex-1 w-full game-board bg-slate-800 rounded-3xl overflow-hidden border-4 border-slate-600 flex items-center justify-center';
    countedLeft = 0;
    countedRight = 0;

    if (smallBoxLeft) {
        smallBoxLeft.className = 'self-end mb-1 md:mb-1.5 px-4 py-1 md:px-5 md:py-1.5 min-w-[76px] md:min-w-[90px] h-12 md:h-14 bg-slate-800/95 rounded-2xl border-4 border-indigo-400/90 shadow-[0_4px_16px_rgba(0,0,0,0.4),0_0_15px_rgba(99,102,241,0.3)] flex items-center justify-center text-2xl md:text-3xl font-black text-indigo-100 select-none z-10 transition-all';
    }
    if (smallBoxRight) {
        smallBoxRight.className = 'self-start mb-1 md:mb-1.5 px-4 py-1 md:px-5 md:py-1.5 min-w-[76px] md:min-w-[90px] h-12 md:h-14 bg-slate-800/95 rounded-2xl border-4 border-indigo-400/90 shadow-[0_4px_16px_rgba(0,0,0,0.4),0_0_15px_rgba(99,102,241,0.3)] flex items-center justify-center text-2xl md:text-3xl font-black text-indigo-100 select-none z-10 transition-all';
    }

    if (currentLevel === 0) {
        setupLevel0Round();
    } else if (currentLevel === 1) {
        setupLevel1Round();
    } else {
        setupLevel2Round();
    }
}

// Setup Level 0: Geometric Shapes with Drag and Drop "small" and "big" chips
function setupLevel0Round() {
    // 1. Pick geometric shape (circle, square, equilateral triangle, pentagon)
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];

    // 2. Pick 2 different colors
    const shuffledColors = [...SHAPE_COLORS].sort(() => Math.random() - 0.5);
    const leftColor = shuffledColors[0];
    const rightColor = shuffledColors[1];

    // 3. Determine sizes (Level 0: minimum 85% 2D surface area difference)
    const { bigSize, smallSize } = getShapeSizes(0, shape.type);

    // 4. Target from balanced pool
    const poolTarget = roundPool[currentAttempt] || (Math.random() < 0.5 ? 'left-small' : 'left-big');

    let leftSize, rightSize;
    if (poolTarget === 'left-small') {
        leftSize = smallSize;
        rightSize = bigSize;
        level0Targets = { left: 'small', right: 'big' };
    } else {
        leftSize = bigSize;
        rightSize = smallSize;
        level0Targets = { left: 'big', right: 'small' };
    }

    placedChips = { left: null, right: null };
    selectedChip = null;

    // 5. Render Shapes in Boxes (with top padding to center nicely below top drop slot)
    const leftWrapper = document.createElement('div');
    leftWrapper.className = 'shape-container pt-8 md:pt-10';
    leftWrapper.innerHTML = shape.render(leftColor.hex, leftSize);
    leftContainer.appendChild(leftWrapper);

    const rightWrapper = document.createElement('div');
    rightWrapper.className = 'shape-container pt-8 md:pt-10';
    rightWrapper.innerHTML = shape.render(rightColor.hex, rightSize);
    rightContainer.appendChild(rightWrapper);

    // 6. Create Drop Slots inside Boxes at center top
    const leftSlot = document.createElement('div');
    leftSlot.id = 'drop-slot-left';
    leftSlot.className = 'level0-drop-slot';
    leftSlot.innerHTML = `<span class="text-xs md:text-sm font-extrabold text-indigo-300/80 pointer-events-none select-none">Drop here</span>`;
    leftSlot.onclick = (e) => {
        e.stopPropagation();
        handleSlotClick('left');
    };
    leftContainer.appendChild(leftSlot);

    const rightSlot = document.createElement('div');
    rightSlot.id = 'drop-slot-right';
    rightSlot.className = 'level0-drop-slot';
    rightSlot.innerHTML = `<span class="text-xs md:text-sm font-extrabold text-indigo-300/80 pointer-events-none select-none">Drop here</span>`;
    rightSlot.onclick = (e) => {
        e.stopPropagation();
        handleSlotClick('right');
    };
    rightContainer.appendChild(rightSlot);

    // 7. Render "small" and "big" chips in chipsContainer with random order
    chipsContainer.innerHTML = '';
    const chipChoices = Math.random() < 0.5 ? ['small', 'big'] : ['big', 'small'];

    chipChoices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'chip-btn draggable-chip min-h-[52px] px-8 py-2.5 md:px-11 md:py-3.5 rounded-full text-xl md:text-2xl font-black bg-slate-800/95 text-indigo-100 hover:text-white border-2 border-indigo-400/90 shadow-[0_6px_20px_rgba(0,0,0,0.4),0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_8px_25px_rgba(99,102,241,0.5)] active:scale-95 transition-all select-none backdrop-blur-sm flex items-center justify-center gap-2';
        btn.dataset.chip = choice;
        btn.innerHTML = `<span>${choice}</span>`;

        btn.addEventListener('pointerdown', (e) => initChipDrag(e, choice, btn));

        chipsContainer.appendChild(btn);
    });
}

// Level 0 Drag & Drop and Tap Helpers
function isPointInElement(x, y, elem, padding = 0) {
    if (!elem) return false;
    const rect = elem.getBoundingClientRect();
    return x >= (rect.left - padding) &&
           x <= (rect.right + padding) &&
           y >= (rect.top - padding) &&
           y <= (rect.bottom + padding);
}

function setContainerHover(side, isHovering) {
    const container = side === 'left' ? leftContainer : rightContainer;
    const slot = document.getElementById(`drop-slot-${side}`);
    if (!container) return;
    if (isHovering) {
        container.classList.add('box-hover-active');
        if (slot) slot.classList.add('slot-hover');
    } else {
        container.classList.remove('box-hover-active');
        if (slot) slot.classList.remove('slot-hover');
    }
}

function clearSelectedChipHighlight() {
    document.querySelectorAll('.draggable-chip').forEach(btn => {
        btn.classList.remove('chip-selected');
    });
}

function initChipDrag(e, chipType, chipBtn, sourceSide = null) {
    if (isAnsweringBlocked) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    let isDragging = false;
    let ghostEl = null;

    function onPointerMove(moveEvent) {
        const curX = moveEvent.clientX;
        const curY = moveEvent.clientY;

        if (!isDragging) {
            if (Math.hypot(curX - startX, curY - startY) > 6) {
                isDragging = true;
                selectedChip = null;
                clearSelectedChipHighlight();

                if (sourceSide) {
                    placedChips[sourceSide] = null;
                    updateBoxSlotUI(sourceSide);
                    updateDockChipsUI();
                }

                ghostEl = document.createElement('div');
                ghostEl.className = 'chip-btn drag-ghost min-h-[52px] px-8 py-2.5 md:px-11 md:py-3.5 rounded-full text-xl md:text-2xl font-black bg-indigo-600 text-white border-2 border-indigo-300 shadow-2xl flex items-center justify-center';
                ghostEl.textContent = chipType;
                ghostEl.style.left = `${curX}px`;
                ghostEl.style.top = `${curY}px`;
                document.body.appendChild(ghostEl);

                if (chipBtn) chipBtn.style.opacity = '0.25';
            }
        }

        if (isDragging && ghostEl) {
            ghostEl.style.left = `${curX}px`;
            ghostEl.style.top = `${curY}px`;

            const leftSlot = document.getElementById('drop-slot-left');
            const rightSlot = document.getElementById('drop-slot-right');
            const isOverLeft = isPointInElement(curX, curY, leftSlot, 12);
            const isOverRight = isPointInElement(curX, curY, rightSlot, 12);

            setContainerHover('left', isOverLeft);
            setContainerHover('right', isOverRight);
        }
    }

    function onPointerUp(upEvent) {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);

        setContainerHover('left', false);
        setContainerHover('right', false);

        if (isDragging) {
            if (ghostEl) {
                ghostEl.remove();
                ghostEl = null;
            }
            if (chipBtn) chipBtn.style.opacity = '1';

            const endX = upEvent.clientX;
            const endY = upEvent.clientY;
            const leftSlot = document.getElementById('drop-slot-left');
            const rightSlot = document.getElementById('drop-slot-right');

            if (isPointInElement(endX, endY, leftSlot, 12)) {
                placeChipInBox('left', chipType);
            } else if (isPointInElement(endX, endY, rightSlot, 12)) {
                placeChipInBox('right', chipType);
            } else {
                updateDockChipsUI();
            }
        } else {
            if (!sourceSide) {
                handleChipTap(chipType, chipBtn);
            }
        }
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
}

function placeChipInBox(side, chipType) {
    if (isAnsweringBlocked) return;

    const otherSide = side === 'left' ? 'right' : 'left';
    if (placedChips[otherSide] === chipType) {
        placedChips[otherSide] = null;
        updateBoxSlotUI(otherSide);
    }

    placedChips[side] = chipType;
    selectedChip = null;
    clearSelectedChipHighlight();

    updateBoxSlotUI('left');
    updateBoxSlotUI('right');
    updateDockChipsUI();

    if (placedChips.left !== null && placedChips.right !== null) {
        checkLevel0Answer();
    }
}

function removeChipFromBox(side) {
    if (isAnsweringBlocked) return;
    placedChips[side] = null;
    selectedChip = null;
    clearSelectedChipHighlight();
    updateBoxSlotUI(side);
    updateDockChipsUI();
}

function updateBoxSlotUI(side) {
    const slot = document.getElementById(`drop-slot-${side}`);
    if (!slot) return;

    const val = placedChips[side];
    if (val === null) {
        slot.innerHTML = `<span class="text-xs md:text-sm font-extrabold text-indigo-300/80 pointer-events-none select-none">Drop here</span>`;
        slot.onclick = (e) => {
            e.stopPropagation();
            handleSlotClick(side);
        };
    } else {
        slot.innerHTML = '';
        slot.onclick = null;
        const chipDiv = document.createElement('div');
        chipDiv.className = 'placed-chip chip-btn draggable-chip px-6 py-1.5 md:px-8 md:py-2 rounded-full text-base md:text-lg font-black bg-indigo-600 text-white border-2 border-indigo-300 shadow-md flex items-center gap-2 select-none';
        chipDiv.title = 'Tap to remove or drag to other box';
        chipDiv.innerHTML = `
            <span>${val}</span>
            <span class="text-xs opacity-75 hover:opacity-100 bg-indigo-800/80 rounded-full w-4 h-4 flex items-center justify-center">✕</span>
        `;
        chipDiv.onclick = (e) => {
            e.stopPropagation();
            removeChipFromBox(side);
        };
        chipDiv.addEventListener('pointerdown', (e) => {
            initChipDrag(e, val, chipDiv, side);
        });
        slot.appendChild(chipDiv);
    }
}

function updateDockChipsUI() {
    const chipBtns = chipsContainer.querySelectorAll('.draggable-chip');
    chipBtns.forEach(btn => {
        const type = btn.dataset.chip;
        if (placedChips.left === type || placedChips.right === type) {
            btn.style.visibility = 'hidden';
        } else {
            btn.style.visibility = 'visible';
            btn.style.opacity = '1';
        }
    });
}

function handleChipTap(chipType, chipBtn) {
    if (isAnsweringBlocked) return;

    if (selectedChip === chipType) {
        selectedChip = null;
        clearSelectedChipHighlight();
        return;
    }

    selectedChip = chipType;
    clearSelectedChipHighlight();
    chipBtn.classList.add('chip-selected');

    if (placedChips.left === null && placedChips.right !== null) {
        placeChipInBox('left', chipType);
    } else if (placedChips.right === null && placedChips.left !== null) {
        placeChipInBox('right', chipType);
    }
}

function handleSlotClick(side) {
    if (isAnsweringBlocked) return;
    if (selectedChip) {
        placeChipInBox(side, selectedChip);
    }
}

function checkLevel0Answer() {
    if (isAnsweringBlocked) return;
    isAnsweringBlocked = true;

    const isLeftCorrect = (placedChips.left === level0Targets.left);
    const isRightCorrect = (placedChips.right === level0Targets.right);
    const isCorrect = isLeftCorrect && isRightCorrect;

    const leftSlot = document.getElementById('drop-slot-left');
    const rightSlot = document.getElementById('drop-slot-right');
    const leftPlacedChip = leftSlot ? leftSlot.querySelector('.placed-chip') : null;
    const rightPlacedChip = rightSlot ? rightSlot.querySelector('.placed-chip') : null;

    if (isCorrect) {
        if (leftPlacedChip) leftPlacedChip.classList.add('chip-correct');
        if (rightPlacedChip) rightPlacedChip.classList.add('chip-correct');
        leftContainer.classList.add('box-correct');
        rightContainer.classList.add('box-correct');
        score++;
    } else {
        if (!isLeftCorrect && leftPlacedChip) leftPlacedChip.classList.add('chip-wrong');
        if (!isRightCorrect && rightPlacedChip) rightPlacedChip.classList.add('chip-wrong');
        if (isLeftCorrect && leftPlacedChip) leftPlacedChip.classList.add('chip-correct');
        if (isRightCorrect && rightPlacedChip) rightPlacedChip.classList.add('chip-correct');

        if (!isLeftCorrect) leftContainer.classList.add('box-wrong');
        if (!isRightCorrect) rightContainer.classList.add('box-wrong');
        wrongAnswers++;
    }

    attemptHistory.push(isCorrect);
    showEmojiFeedback(isCorrect);
    updateScoreboardUI();
    updateLivesUI(!isCorrect);
    currentAttempt++;

    setTimeout(() => {
        showNextPrompt();
    }, 450);
}

// Setup Level 1: Quantities (Various Emojis arranged diagonally from right-upper to left-lower corner, populated from center)
function setupLevel1Round() {
    updateButtonPositions();

    // Pick 2 different emojis from the pool of 29 items (fruits, animals, vehicles, toys, nature)
    const shuffledItems = [...LEVEL_2_ITEMS].sort(() => Math.random() - 0.5);
    const leftItem = shuffledItems[0];
    const rightItem = shuffledItems[1];

    questionSentence.innerHTML = `${leftItem.emoji} ${leftItem.name} are <span id="sentence-blank" class="px-2.5 py-0.5 rounded-lg bg-slate-700/70 border border-slate-500 font-extrabold text-indigo-200">________</span> ${rightItem.emoji} ${rightItem.name}.`;

    // 1, 2, or 3 for smaller number; 7, 8, or 9 for bigger number
    const smallOptions = [1, 2, 3];
    const largeOptions = [7, 8, 9];
    const smallCount = smallOptions[Math.floor(Math.random() * smallOptions.length)];
    const largeCount = largeOptions[Math.floor(Math.random() * largeOptions.length)];

    const targetOperator = roundPool[currentAttempt] || (Math.random() < 0.5 ? '<' : '>');

    if (targetOperator === '<') {
        leftCount = smallCount;
        rightCount = largeCount;
    } else {
        leftCount = largeCount;
        rightCount = smallCount;
    }

    countedLeft = 0;
    countedRight = 0;

    // Both sides strictly diagonal from right upper to left lower corner, populated from center
    drawDots(leftContainer, leftCount, leftItem.emoji, 'left');
    drawDots(rightContainer, rightCount, rightItem.emoji, 'right');

    // Update the Small Boxes starting from 0 so the child can count up by touching/clicking emojis
    if (smallBoxLeft) {
        smallBoxLeft.style.display = 'flex';
        smallBoxLeft.textContent = '0';
    }
    if (smallBoxRight) {
        smallBoxRight.style.display = 'flex';
        smallBoxRight.textContent = '0';
    }
}

// Setup Level 2: Geometric Shapes & Sizes (with "bigger" and "smaller" chips)
function setupLevel2Round() {
    // 1. Pick geometric shape (circle, square, rectangle, equilateral triangle, pentagon)
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];

    // 2. Pick 2 different colors
    const shuffledColors = [...SHAPE_COLORS].sort(() => Math.random() - 0.5);
    const leftColor = shuffledColors[0];
    const rightColor = shuffledColors[1];

    // 3. Determine sizes with at least 50% difference
    const { bigSize, smallSize } = getShapeSizes(2, shape.type);

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
        btn.onclick = () => handleLevel2Guess(choice, target, btn);
        chipsContainer.appendChild(btn);
    });
}

// Draw emojis arranged diagonally from right-upper to left-lower corner, populated outward from the center
function drawDots(container, count, emojiChar, side) {
    const step = 7.8; // Uniform step percentage along X and Y axes

    for (let i = 0; i < count; i++) {
        const dot = document.createElement('div');
        dot.classList.add('dot');
        dot.textContent = emojiChar;

        // Offset from center in units of steps (negative = top-right, positive = bottom-left)
        const offset = i - (count - 1) / 2;
        const leftPos = 50 - (offset * step);
        const topPos = 50 + (offset * step);

        dot.style.top = `${topPos}%`;
        dot.style.left = `${leftPos}%`;

        // Interactive touch/click counting
        dot.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            handleDotCount(dot, side);
        });

        container.appendChild(dot);
    }
}

// Trigger a bump animation on the small count box
function triggerBoxBump(box) {
    if (!box) return;
    box.classList.remove('count-bump');
    void box.offsetWidth; // Force DOM reflow to re-trigger CSS keyframe
    box.classList.add('count-bump');
}

// Play pleasant ascending pop sound when counting
function playCountSound(count) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!window._countAudioCtx) {
            window._countAudioCtx = new AudioCtx();
        }
        const ctx = window._countAudioCtx;
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';

        // Frequency scales up with count: musical staircase
        const baseFreq = Math.min(440 + (count * 20), 960);
        osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, ctx.currentTime + 0.07);

        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.07);
    } catch (e) {}
}

// Play pleasant descending drop sound when uncounting
function playUncountSound() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!window._countAudioCtx) {
            window._countAudioCtx = new AudioCtx();
        }
        const ctx = window._countAudioCtx;
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.07);

        gain.gain.setValueAtTime(0.14, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.07);
    } catch (e) {}
}

// Handle tapping/clicking an emoji to increment or decrement the count
function handleDotCount(dot, side) {
    if (isAnsweringBlocked) return;

    const isCounted = dot.classList.contains('dot-counted');

    if (!isCounted) {
        dot.classList.add('dot-counted');
        if (side === 'left') {
            countedLeft++;
            if (smallBoxLeft) {
                smallBoxLeft.textContent = countedLeft;
                triggerBoxBump(smallBoxLeft);
            }
            playCountSound(countedLeft);
        } else {
            countedRight++;
            if (smallBoxRight) {
                smallBoxRight.textContent = countedRight;
                triggerBoxBump(smallBoxRight);
            }
            playCountSound(countedRight);
        }
    } else {
        // Untap to uncount if tapped again
        dot.classList.remove('dot-counted');
        if (side === 'left') {
            countedLeft = Math.max(0, countedLeft - 1);
            if (smallBoxLeft) {
                smallBoxLeft.textContent = countedLeft;
                triggerBoxBump(smallBoxLeft);
            }
        } else {
            countedRight = Math.max(0, countedRight - 1);
            if (smallBoxRight) {
                smallBoxRight.textContent = countedRight;
                triggerBoxBump(smallBoxRight);
            }
        }
        playUncountSound();
    }
}

// Handle Level 1 Symbol Tap (< or >)
function handleLevel1Guess(operator, targetChoice, chipBtn) {
    if (operator === 'bigger' || operator === 'smaller') {
        return handleLevel2Guess(operator, targetChoice, chipBtn);
    }
    if (isAnsweringBlocked) return;
    isAnsweringBlocked = true;

    // Reveal true totals and highlight all emojis upon answering
    if (smallBoxLeft) smallBoxLeft.textContent = leftCount;
    if (smallBoxRight) smallBoxRight.textContent = rightCount;
    leftContainer.querySelectorAll('.dot').forEach(d => d.classList.add('dot-counted'));
    rightContainer.querySelectorAll('.dot').forEach(d => d.classList.add('dot-counted'));

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
        if (smallBoxLeft) {
            smallBoxLeft.classList.remove('border-indigo-400/90');
            smallBoxLeft.classList.add('border-emerald-400', 'bg-emerald-500/20', 'text-emerald-300', 'shadow-[0_0_20px_rgba(16,185,129,0.5)]');
        }
        if (smallBoxRight) {
            smallBoxRight.classList.remove('border-indigo-400/90');
            smallBoxRight.classList.add('border-emerald-400', 'bg-emerald-500/20', 'text-emerald-300', 'shadow-[0_0_20px_rgba(16,185,129,0.5)]');
        }
    } else {
        wrongAnswers++;
        if (smallBoxLeft) {
            smallBoxLeft.classList.remove('border-indigo-400/90');
            smallBoxLeft.classList.add('border-rose-400', 'bg-rose-500/20', 'text-rose-300', 'shadow-[0_0_20px_rgba(244,63,94,0.5)]');
        }
        if (smallBoxRight) {
            smallBoxRight.classList.remove('border-indigo-400/90');
            smallBoxRight.classList.add('border-rose-400', 'bg-rose-500/20', 'text-rose-300', 'shadow-[0_0_20px_rgba(244,63,94,0.5)]');
        }
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

// Handle Level 2 Chip Tap ("bigger" or "smaller")
function handleLevel2Guess(choice, targetChoice, chipBtn) {
    if (choice === '<' || choice === '>') {
        return handleLevel1Guess(choice);
    }
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
    if (smallBoxLeft) smallBoxLeft.style.display = 'none';
    if (smallBoxRight) smallBoxRight.style.display = 'none';

    const existingGameOver = document.getElementById('game-over-modal');
    if (existingGameOver) existingGameOver.remove();

    const gameOverModal = document.createElement('div');
    gameOverModal.id = 'game-over-modal';
    gameOverModal.className = 'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center bg-slate-800/95 backdrop-blur-md p-6 md:p-8 rounded-3xl border-4 border-slate-600 shadow-[0_0_40px_rgba(0,0,0,0.85)] z-50 w-80 md:w-96';
    gameOverModal.style.animation = 'popIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';

    const title = isThreeStrikes ? 'Game Over!' : (score >= 8 ? '🎉 Amazing Job!' : '🎉 Game Over!');
    const reason = isThreeStrikes ? '<div class="text-rose-400 font-extrabold text-sm md:text-base uppercase tracking-wider mb-2">❌ 3 Wrong Answers</div>' : '';

    let nextLvlBtnHtml = '';
    if (currentLevel === 0) {
        nextLvlBtnHtml = `<button onclick="switchLevel(1)" class="w-full min-h-[52px] py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 active:scale-95 rounded-2xl text-white text-lg md:text-xl font-bold shadow-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center">Play Level 1 ➡️</button>`;
    } else if (currentLevel === 1) {
        nextLvlBtnHtml = `
            <button onclick="switchLevel(2)" class="w-full min-h-[52px] py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 active:scale-95 rounded-2xl text-white text-lg md:text-xl font-bold shadow-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center">Play Level 2 ➡️</button>
            <button onclick="switchLevel(0)" class="w-full min-h-[52px] py-3.5 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 active:scale-95 rounded-2xl text-white text-lg md:text-xl font-bold shadow-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center">Play Level 0 ⬅️</button>
        `;
    } else {
        nextLvlBtnHtml = `
            <button onclick="switchLevel(1)" class="w-full min-h-[52px] py-3.5 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 active:scale-95 rounded-2xl text-white text-lg md:text-xl font-bold shadow-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center">Play Level 1 ⬅️</button>
            <button onclick="switchLevel(0)" class="w-full min-h-[52px] py-3.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-800 active:scale-95 rounded-2xl text-white text-lg md:text-xl font-bold shadow-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center">Play Level 0 ⬅️</button>
        `;
    }

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
