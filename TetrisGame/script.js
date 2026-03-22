const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextPiece');
const nextContext = nextCanvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const levelElement = document.getElementById('level');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');
const muteBtn = document.getElementById('mute-btn');

context.scale(20, 20);
nextContext.scale(20, 20);

// Colors for Tetrominos
const colors = [
    null,
    '#00f3ff', // I
    '#ff00ea', // J
    '#fcee0a', // L
    '#ff3333', // O
    '#39ff14', // S
    '#0077ff', // T
    '#ff8800', // Z
];

// Audio Context and Sounds
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let isMuted = false;

function playSound(type) {
    if (isMuted) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    switch (type) {
        case 'move':
            osc.type = 'square';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(110, now + 0.05);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.start();
            osc.stop(now + 0.05);
            break;
        case 'rotate':
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.start();
            osc.stop(now + 0.08);
            break;
        case 'clear':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.2); // C6
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.start();
            osc.stop(now + 0.2);
            break;
        case 'drop':
            osc.type = 'square';
            osc.frequency.setValueAtTime(110, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start();
            osc.stop(now + 0.1);
            break;
        case 'gameover':
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(55, now + 1.5);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
            osc.start();
            osc.stop(now + 1.5);
            break;
    }
}

function createPiece(type) {
    if (type === 'I') {
        return [
            [0, 1, 0, 0],
            [0, 1, 0, 0],
            [0, 1, 0, 0],
            [0, 1, 0, 0],
        ];
    } else if (type === 'L') {
        return [
            [0, 3, 0],
            [0, 3, 0],
            [0, 3, 3],
        ];
    } else if (type === 'J') {
        return [
            [0, 2, 0],
            [0, 2, 0],
            [2, 2, 0],
        ];
    } else if (type === 'O') {
        return [
            [4, 4],
            [4, 4],
        ];
    } else if (type === 'Z') {
        return [
            [7, 7, 0],
            [0, 7, 7],
            [0, 0, 0],
        ];
    } else if (type === 'S') {
        return [
            [0, 5, 5],
            [5, 5, 0],
            [0, 0, 0],
        ];
    } else if (type === 'T') {
        return [
            [0, 6, 0],
            [6, 6, 6],
            [0, 0, 0],
        ];
    }
}

function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
}

function drawMatrix(matrix, offset, ctx = context) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                // Main Block color
                ctx.fillStyle = colors[value];
                ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
                
                // Border/Highlight effect
                ctx.lineWidth = 0.05;
                ctx.strokeStyle = 'white';
                ctx.strokeRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);

    drawMatrix(arena, {x: 0, y: 0});
    drawGhostPiece();
    drawMatrix(player.matrix, player.pos);
}

function drawGhostPiece() {
    const ghostPos = {x: player.pos.x, y: player.pos.y};
    while (!collide(arena, {matrix: player.matrix, pos: ghostPos})) {
        ghostPos.y++;
    }
    ghostPos.y--;
    
    // Draw Ghost
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                context.lineWidth = 0.05;
                context.strokeRect(x + ghostPos.x, y + ghostPos.y, 1, 1);
            }
        });
    });
}

function drawNext() {
    nextContext.fillStyle = '#0f0f23';
    nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    const offset = {
        x: (nextCanvas.width / 20 - player.next.length) / 2,
        y: (nextCanvas.height / 20 - player.next.length) / 2,
    };
    drawMatrix(player.next, offset, nextContext);
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [
                matrix[x][y],
                matrix[y][x],
            ] = [
                matrix[y][x],
                matrix[x][y],
            ];
        }
    }
    if (dir > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
}

function arenaSweep() {
    let rowCount = 1;
    outer: for (let y = arena.length - 1; y > 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) {
                continue outer;
            }
        }

        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        ++y;

        player.score += rowCount * 10;
        rowCount *= 2;
        playSound('clear');
    }
    updateScore();
}

function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
               (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        playerReset();
        arenaSweep();
        updateScore();
        playSound('drop');
    }
    dropCounter = 0;
}

function playerFastDrop() {
    while (!collide(arena, player)) {
        player.pos.y++;
    }
    player.pos.y--;
    merge(arena, player);
    playerReset();
    arenaSweep();
    updateScore();
    playSound('drop');
    dropCounter = 0;
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) {
        player.pos.x -= dir;
    } else {
        playSound('move');
    }
}

function playerReset() {
    const pieces = 'ILJOTSZ';
    if (player.next === null) {
        player.matrix = createPiece(pieces[pieces.length * Math.random() | 0]);
        player.next = createPiece(pieces[pieces.length * Math.random() | 0]);
    } else {
        player.matrix = player.next;
        player.next = createPiece(pieces[pieces.length * Math.random() | 0]);
    }
    
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) -
                   (player.matrix[0].length / 2 | 0);
    
    if (collide(arena, player)) {
        gameOver();
    }
    drawNext();
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
    playSound('rotate');
}

function updateScore() {
    scoreElement.innerText = player.score;
    levelElement.innerText = (player.score / 100 | 0) + 1;
    if (player.score > player.highScore) {
        player.highScore = player.score;
        highScoreElement.innerText = player.highScore;
        localStorage.setItem('tetrisHighScore', player.highScore);
    }
}

function gameOver() {
    arena.forEach(row => row.fill(0));
    player.score = 0;
    updateScore();
    overlay.classList.remove('hidden');
    document.getElementById('overlay-title').innerText = 'GAME OVER';
    document.getElementById('overlay-msg').innerText = '再試一次？';
    playSound('gameover');
}

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;

function update(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }

    draw();
    requestAnimationFrame(update);
}

const arena = createMatrix(12, 24);

const player = {
    pos: {x: 0, y: 0},
    matrix: null,
    next: null,
    score: 0,
    highScore: localStorage.getItem('tetrisHighScore') || 0,
};

function startGame() {
    overlay.classList.add('hidden');
    player.score = 0;
    updateScore();
    playerReset();
    update();
}

startBtn.addEventListener('click', startGame);

muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    muteBtn.innerText = isMuted ? '🔇' : '🔊';
});

document.addEventListener('keydown', event => {
    if (overlay.classList.contains('hidden')) {
        if (event.keyCode === 37) { // Left
            playerMove(-1);
        } else if (event.keyCode === 39) { // Right
            playerMove(1);
        } else if (event.keyCode === 40) { // Down
            playerDrop();
        } else if (event.keyCode === 38) { // Up (Rotate)
            playerRotate(1);
        } else if (event.keyCode === 32) { // Space (Quick Drop)
            playerFastDrop();
            event.preventDefault();
        }
    }
});

highScoreElement.innerText = player.highScore;
draw(); // Initial draw for black canvas 
