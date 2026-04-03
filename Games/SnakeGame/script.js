const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const overlay = document.getElementById('game-overlay');
const overlayTitle = document.getElementById('overlay-title');
const finalScoreElement = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const scoreDisplayDiv = document.getElementById('score-display');
const muteBtn = document.getElementById('mute-btn');

// Audio Context and Mute Setup
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContextClass();
let isMuted = false;

if (muteBtn) {
    muteBtn.addEventListener('click', () => {
        isMuted = !isMuted;
        muteBtn.textContent = isMuted ? '🔇' : '🔊';
        if (!isMuted && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    });
}

function playEatSound() {
    if (isMuted) return;
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'square'; // 復古街機方波
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.15);
    
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime); 
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.15); 
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
}

function playGameOverSound() {
    if (isMuted) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sawtooth'; // 失敗感的鋸齒波
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 1.0);
    
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.0);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 1.0);
}

// Game constants
const GRID_SIZE = 25;
const TILE_COUNT = canvas.width / GRID_SIZE; // 20 tiles
const INITIAL_SPEED = 130; 

// Colors matching the CSS variables
const SNAKE_HEAD_COLOR = '#34d399';
const SNAKE_BODY_COLOR = '#10b981';
const FOOD_COLOR = '#f43f5e';
const FOOD_GLOW = 'rgba(244, 63, 94, 0.7)';

// Game state
let snake = [];
let dx = 0;
let dy = 0;
let nextDx = 0;
let nextDy = 0;
let foodX = 0;
let foodY = 0;
let score = 0;
let highScore = localStorage.getItem('snakeWebHighScore') || 0;
let gameLoopTimeout;
let isGameOver = false;
let isPaused = false;
let speed = INITIAL_SPEED;

// Initialize game
function initGame() {
    highScoreElement.textContent = highScore;
    resetGame();
    setupInputs();
    
    // UI Events
    restartBtn.addEventListener('click', () => {
        if (!isPaused && isGameOver) {
            resetGame();
        } else if (isPaused) {
            togglePause();
        }
    });

    // Handle touch interactions for mobile if needed
    canvas.addEventListener('touchstart', handleTouchStart, false);        
    canvas.addEventListener('touchmove', handleTouchMove, false);
}

function resetGame() {
    // Starting position (middle of the grid)
    const startX = Math.floor(TILE_COUNT / 2);
    const startY = Math.floor(TILE_COUNT / 2);
    
    snake = [
        { x: startX, y: startY },
        { x: startX - 1, y: startY },
        { x: startX - 2, y: startY }
    ];
    
    // Initial movement (right)
    dx = 1;
    dy = 0;
    nextDx = 1;
    nextDy = 0;
    
    score = 0;
    speed = INITIAL_SPEED;
    isGameOver = false;
    isPaused = false;
    scoreElement.textContent = score;
    
    overlay.classList.add('hidden');
    spawnFood();
    
    clearTimeout(gameLoopTimeout);
    gameLoop();
}

function spawnFood() {
    let validPosition = false;
    while (!validPosition) {
        foodX = Math.floor(Math.random() * TILE_COUNT);
        foodY = Math.floor(Math.random() * TILE_COUNT);
        
        // Ensure food doesn't spawn on snake
        validPosition = !snake.some(segment => segment.x === foodX && segment.y === foodY);
    }
}

function togglePause() {
    if (isGameOver) return;
    
    isPaused = !isPaused;
    if (isPaused) {
        showOverlay('Paused', false);
        clearTimeout(gameLoopTimeout);
    } else {
        overlay.classList.add('hidden');
        gameLoop();
    }
}

function setupInputs() {
    document.addEventListener('keydown', (e) => {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        // Prevent default scrolling for arrow keys
        if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            e.preventDefault();
        }
        
        if (isGameOver) {
            if (e.key === 'Enter' || e.key === ' ') {
                resetGame();
            }
            return;
        }
        
        if (e.key === ' ' || e.key === 'Escape') {
            togglePause();
            return;
        }
        
        if (isPaused) return;

        // Prevent 180 degree turns by checking both current and next direction
        const goingUp = dy === -1 || nextDy === -1;
        const goingDown = dy === 1 || nextDy === 1;
        const goingRight = dx === 1 || nextDx === 1;
        const goingLeft = dx === -1 || nextDx === -1;

        if ((e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') && !goingRight) {
            nextDx = -1; nextDy = 0;
        }
        else if ((e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') && !goingDown) {
            nextDx = 0; nextDy = -1;
        }
        else if ((e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') && !goingLeft) {
            nextDx = 1; nextDy = 0;
        }
        else if ((e.key === 'ArrowDown' || e.key.toLowerCase() === 's') && !goingUp) {
            nextDx = 0; nextDy = 1;
        }
    });
}

function gameLoop() {
    if (isGameOver || isPaused) return;

    // Apply queued direction
    dx = nextDx;
    dy = nextDy;

    // Calculate new head position
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
    
    // Check collisions BEFORE adding head
    if (checkCollision(head)) {
        gameOver();
        return;
    }
    
    snake.unshift(head); 
    
    // Check food collection
    if (head.x === foodX && head.y === foodY) {
        score += 10;
        playEatSound();
        scoreElement.textContent = score;
        
        // Dynamic speed increase (caps at around 60ms)
        if (speed > 60) {
            speed -= 3;
        }
        
        // Add a class for score pop animation
        scoreElement.style.transform = "scale(1.3)";
        scoreElement.style.color = "var(--accent-color)";
        setTimeout(() => {
            scoreElement.style.transform = "scale(1)";
            scoreElement.style.color = "var(--text-primary)";
        }, 150);
        
        spawnFood();
    } else {
        snake.pop(); // Remove tail
    }
    
    draw();
    
    gameLoopTimeout = setTimeout(gameLoop, speed);
}

function checkCollision(head) {
    // Wall collision
    if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) {
        return true;
    }
    
    // Self collision
    for (let i = 0; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            return true;
        }
    }
    
    return false;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Subtle background grid
    ctx.fillStyle = 'rgba(2, 6, 23, 1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for(let i=0; i<=TILE_COUNT; i++) {
        ctx.beginPath();
        ctx.moveTo(i * GRID_SIZE, 0);
        ctx.lineTo(i * GRID_SIZE, canvas.height);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, i * GRID_SIZE);
        ctx.lineTo(canvas.width, i * GRID_SIZE);
        ctx.stroke();
    }
    
    // Draw glowing food
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = FOOD_GLOW;
    ctx.fillStyle = FOOD_COLOR;
    ctx.beginPath();
    ctx.arc(
        foodX * GRID_SIZE + GRID_SIZE / 2, 
        foodY * GRID_SIZE + GRID_SIZE / 2, 
        GRID_SIZE / 2 - 3, 
        0, 
        Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
    
    // Draw snake backwards so head is on top
    for (let i = snake.length - 1; i >= 0; i--) {
        const segment = snake[i];
        
        ctx.fillStyle = i === 0 ? SNAKE_HEAD_COLOR : SNAKE_BODY_COLOR;
        
        // Make tail segments slightly smaller
        const shrink = i === 0 ? 0 : (i === snake.length - 1 ? 4 : 2);
        const size = GRID_SIZE - 2 - shrink;
        const offset = Math.floor(shrink / 2) + 1;
        
        // Draw segment
        const segmentRadius = i === 0 ? 6 : 3;
        roundRect(
            ctx, 
            segment.x * GRID_SIZE + offset, 
            segment.y * GRID_SIZE + offset, 
            size, 
            size, 
            segmentRadius
        );
        ctx.fill();
        
        // Eyes for head
        if (i === 0) {
            drawEyes(segment.x * GRID_SIZE, segment.y * GRID_SIZE);
        }
    }
}

function drawEyes(x, y) {
    ctx.fillStyle = '#020617'; 
    const eyeSize = 3;
    
    // Position eyes appropriately based on current direction
    const eyeOffset1 = 7;
    const eyeOffset2 = 18;
    
    ctx.beginPath();
    if (dx === 1) { // Right
        ctx.arc(x + 18, y + eyeOffset1, eyeSize, 0, Math.PI * 2);
        ctx.arc(x + 18, y + eyeOffset2, eyeSize, 0, Math.PI * 2);
    } else if (dx === -1) { // Left
        ctx.arc(x + 7, y + eyeOffset1, eyeSize, 0, Math.PI * 2);
        ctx.arc(x + 7, y + eyeOffset2, eyeSize, 0, Math.PI * 2);
    } else if (dy === 1) { // Down
        ctx.arc(x + eyeOffset1, y + 18, eyeSize, 0, Math.PI * 2);
        ctx.arc(x + eyeOffset2, y + 18, eyeSize, 0, Math.PI * 2);
    } else if (dy === -1) { // Up
        ctx.arc(x + eyeOffset1, y + 7, eyeSize, 0, Math.PI * 2);
        ctx.arc(x + eyeOffset2, y + 7, eyeSize, 0, Math.PI * 2);
    } else {
        // Default right
        ctx.arc(x + 18, y + eyeOffset1, eyeSize, 0, Math.PI * 2);
        ctx.arc(x + 18, y + eyeOffset2, eyeSize, 0, Math.PI * 2);
    }
    ctx.fill();
}

function roundRect(ctx, x, y, width, height, radius) {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
}

function showOverlay(titleText, isDeath = true) {
    overlayTitle.textContent = titleText;
    
    if (isDeath) {
        overlayTitle.style.color = 'var(--danger-color)';
        scoreDisplayDiv.style.display = 'block';
        finalScoreElement.textContent = score;
        restartBtn.textContent = 'Play Again';
    } else {
        overlayTitle.style.color = 'var(--text-primary)';
        scoreDisplayDiv.style.display = 'none';
        restartBtn.textContent = 'Resume';
    }
    
    overlay.classList.remove('hidden');
}

function gameOver() {
    isGameOver = true;
    playGameOverSound();
    clearTimeout(gameLoopTimeout);
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeWebHighScore', highScore);
        highScoreElement.textContent = highScore;
        
        // Add a celebration effect or color change for high score
        highScoreElement.style.color = "var(--accent-color)";
        setTimeout(() => {
            highScoreElement.style.color = "var(--text-primary)";
        }, 1000);
    }
    
    // Draw a dark red tint over screen
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    setTimeout(() => {
        showOverlay('Game Over', true);
    }, 500);
}

// Mobile Swipe Controls
let touchStartX = 0;
let touchStartY = 0;

function handleTouchStart(evt) {
    const firstTouch = evt.touches[0];                                      
    touchStartX = firstTouch.clientX;                                      
    touchStartY = firstTouch.clientY;                                      
};                                                

function handleTouchMove(evt) {
    if (!touchStartX || !touchStartY || isGameOver || isPaused) {
        return;
    }

    let touchEndX = evt.touches[0].clientX;                                    
    let touchEndY = evt.touches[0].clientY;

    let xDiff = touchStartX - touchEndX;
    let yDiff = touchStartY - touchEndY;

    const goingUp = dy === -1 || nextDy === -1;
    const goingDown = dy === 1 || nextDy === 1;
    const goingRight = dx === 1 || nextDx === 1;
    const goingLeft = dx === -1 || nextDx === -1;

    // Detect most significant swipe direction
    if (Math.abs(xDiff) > Math.abs(yDiff)) {
        if (xDiff > 0 && !goingRight) {
            // left swipe
            nextDx = -1; nextDy = 0;
        } else if (xDiff < 0 && !goingLeft) {
            // right swipe
            nextDx = 1; nextDy = 0;
        }                       
    } else {
        if (yDiff > 0 && !goingDown) {
            // up swipe
            nextDx = 0; nextDy = -1;
        } else if (yDiff < 0 && !goingUp) { 
            // down swipe
            nextDx = 0; nextDy = 1;
        }                                                                 
    }
    
    // Reset values
    touchStartX = 0;
    touchStartY = 0;
    evt.preventDefault();
};

window.addEventListener('load', initGame);
