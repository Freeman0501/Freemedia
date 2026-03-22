const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');

const uiStart = document.getElementById('start-screen');
const uiGameOver = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const finalScoreEl = document.getElementById('final-score');
const finalLevelEl = document.getElementById('final-level');

// Game State
let gameState = 'START'; 
let score = 0;
let level = 1;
let animationId;
let lastTime = 0;

// Inputs
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    a: false,
    d: false,
    Space: false
};

// Web Audio API Context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let isMuted = false;

function playShootSound() {
    if (isMuted) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sawtooth'; // 產生類似雷射的波形
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime); // 起始頻率高
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15); // 快速下降
    
    gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime); // 更輕脆的音量
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
}

function playGameOverSound() {
    if (isMuted) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 1.5); 
    
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime); 
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 1.5);
}

function playExplosionSound() {
    if (isMuted) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const bufferSize = audioCtx.sampleRate * 0.3; // 0.3秒
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1; // 白噪音
    }
    
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(1000, audioCtx.currentTime);
    noiseFilter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
    
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    noiseSource.start();
    noiseSource.stop(audioCtx.currentTime + 0.3);
}

document.addEventListener('keydown', e => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
    if (e.key === ' ' || e.code === 'Space') {
        keys.Space = true;
        e.preventDefault(); // Prevent scrolling
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
});

document.addEventListener('keyup', e => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
    if (e.key === ' ' || e.code === 'Space') keys.Space = false;
});

const muteBtn = document.getElementById('mute-btn');
if (muteBtn) {
    muteBtn.addEventListener('click', () => {
        isMuted = !isMuted;
        muteBtn.innerText = isMuted ? '🔇' : '🔊';
        if (audioCtx.state === 'suspended' && !isMuted) {
            audioCtx.resume();
        }
    });
}

class Player {
    constructor() {
        this.width = 46;
        this.height = 46;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - this.height - 20;
        this.speed = 400;
        this.color = '#00f3ff';
        this.cooldown = 0;
        this.fireRate = 0.2;
    }

    update(dt) {
        if ((keys.ArrowLeft || keys.a) && this.x > 0) {
            this.x -= this.speed * dt;
        }
        if ((keys.ArrowRight || keys.d) && this.x < canvas.width - this.width) {
            this.x += this.speed * dt;
        }

        if (this.cooldown > 0) this.cooldown -= dt;

        if (keys.Space && this.cooldown <= 0) {
            this.shoot();
            this.cooldown = this.fireRate;
        }
    }

    shoot() {
        bullets.push(new Bullet(this.x + this.width / 2, this.y, -600, '#00f3ff'));
        spawnParticles(this.x + this.width/2, this.y, 5, '#00f3ff', 80);
        playShootSound();
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2);

        // Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffffff';

        // Maltese Head (White circle)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();

        // Ears (Floppy side ellipses)
        ctx.beginPath();
        ctx.ellipse(-18, 5, 8, 15, -Math.PI/6, 0, Math.PI * 2);
        ctx.ellipse(18, 5, 8, 15, Math.PI/6, 0, Math.PI * 2);
        ctx.fill();

        // Eyes (Black dots)
        ctx.shadowBlur = 0; // turn off glow for face details
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(-7, -3, 3, 0, Math.PI * 2);
        ctx.arc(7, -3, 3, 0, Math.PI * 2);
        ctx.fill();

        // Nose (Black oval)
        ctx.beginPath();
        ctx.ellipse(0, 4, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tongue (Pink)
        ctx.fillStyle = '#ff66b2';
        ctx.beginPath();
        ctx.arc(0, 8, 3, 0, Math.PI, false);
        ctx.fill();

        ctx.restore();
    }
}

class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = 36;
        this.height = 36;
        this.type = type;
        this.colors = ['#ff00ea', '#fcee0a', '#ff3333'];
        this.color = this.colors[this.type % this.colors.length];
        
        this.vx = 80 + (level * 20);
        this.vy = 0;
        
        this.moveDownRange = 40;
        this.targetY = y;
        this.movingDown = false;
        
        this.baseY = y;
        this.time = Math.random() * Math.PI * 2;
        this.markedForDeletion = false;
    }

    update(dt) {
        this.x += this.vx * dt;
        
        this.time += dt * 3;
        if (!this.movingDown) {
            this.y = this.baseY + Math.sin(this.time) * 10;
        } else {
            this.y += 150 * dt;
            this.baseY += 150 * dt;
            if (this.y >= this.targetY) {
                this.y = this.targetY;
                this.baseY = this.targetY;
                this.movingDown = false;
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2);

        // Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;

        // Cat Head
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();

        // Ears (Triangles)
        ctx.beginPath();
        ctx.moveTo(-14, -6);
        ctx.lineTo(-18, -20);
        ctx.lineTo(-4, -14);
        ctx.moveTo(14, -6);
        ctx.lineTo(18, -20);
        ctx.lineTo(4, -14);
        ctx.fill();

        // Eyes (Angry slits)
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.moveTo(-10, -4); ctx.lineTo(-4, -1); ctx.lineTo(-10, 2);
        ctx.moveTo(10, -4); ctx.lineTo(4, -1); ctx.lineTo(10, 2);
        ctx.fill();

        // Nose
        ctx.beginPath();
        ctx.moveTo(-3, 4); ctx.lineTo(3, 4); ctx.lineTo(0, 7);
        ctx.fill();

        // Whiskers
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-8, 3); ctx.lineTo(-16, 1);
        ctx.moveTo(-8, 6); ctx.lineTo(-16, 7);
        ctx.moveTo(8, 3); ctx.lineTo(16, 1);
        ctx.moveTo(8, 6); ctx.lineTo(16, 7);
        ctx.stroke();

        ctx.restore();
    }
}

class Bullet {
    constructor(x, y, vy, color) {
        this.width = 4;
        this.height = 16;
        this.x = x - this.width / 2;
        this.y = y;
        this.vy = vy;
        this.color = color;
        this.markedForDeletion = false;
    }

    update(dt) {
        this.y += this.vy * dt;
        if (this.y < -this.height || this.y > canvas.height) {
            this.markedForDeletion = true;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color, maxSpeed = 200) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 1.5;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * maxSpeed + 50;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.decay = Math.random() * 1.5 + 0.8;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= this.decay * dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }
}

const stars = [];
for (let i = 0; i < 120; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2,
        speed: Math.random() * 50 + 10,
        color: Math.random() > 0.8 ? '#00f3ff' : '#ffffff'
    });
}

let player;
let enemies = [];
let bullets = [];
let enemyBullets = [];
let particles = [];
let swarmDir = 1; 

function spawnParticles(x, y, count, color, maxSpeed=200) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color, maxSpeed));
    }
}

function initLevel() {
    enemies = [];
    bullets = [];
    enemyBullets = [];
    swarmDir = 1;
    
    const cols = 8;
    const rows = Math.min(3 + Math.floor(level / 2), 6);
    const spacingX = 65;
    const spacingY = 55;
    const offsetX = (canvas.width - ((cols-1) * spacingX + 36)) / 2;
    const offsetY = 70;
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            enemies.push(new Enemy(offsetX + c * spacingX, offsetY + r * spacingY, r));
        }
    }
    
    levelEl.innerText = level;
    levelEl.style.transform = 'scale(1.5)';
    setTimeout(() => { levelEl.style.transform = 'scale(1)'; }, 200);
}

function resetGame() {
    score = 0;
    level = 1;
    scoreEl.innerText = score;
    player = new Player();
    initLevel();
    uiStart.classList.add('hidden');
    uiGameOver.classList.add('hidden');
    gameState = 'PLAYING';
    lastTime = performance.now();
    cancelAnimationFrame(animationId);
    gameLoop(lastTime);
}

startBtn.addEventListener('click', resetGame);
restartBtn.addEventListener('click', resetGame);

function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

function update(dt) {
    stars.forEach(s => {
        s.y += (s.speed) * dt;
        if (s.y > canvas.height) {
            s.y = 0;
            s.x = Math.random() * canvas.width;
        }
    });

    if (gameState !== 'PLAYING') return;

    player.update(dt);
    
    let hitEdge = false;
    let lowestEnemyY = 0;
    
    enemies.forEach(e => {
        e.update(dt);
        if (e.x <= 15 && swarmDir === -1) hitEdge = true;
        if (e.x + e.width >= canvas.width - 15 && swarmDir === 1) hitEdge = true;
        if (e.y + e.height > lowestEnemyY) lowestEnemyY = e.y + e.height;
    });
    
    if (hitEdge) {
        swarmDir *= -1;
        enemies.forEach(e => {
            e.vx *= -1;
            e.targetY = e.baseY + e.moveDownRange;
            e.movingDown = true;
        });
    }
    
    // Enemy shooting
    if (Math.random() < 0.4 * dt * level && enemies.length > 0) {
        const shooter = enemies[Math.floor(Math.random() * enemies.length)];
        enemyBullets.push(new Bullet(shooter.x + shooter.width/2, shooter.y + shooter.height, 250 + level*30, shooter.color));
    }

    bullets.forEach(b => b.update(dt));
    enemyBullets.forEach(b => b.update(dt));
    particles.forEach(p => p.update(dt));
    
    // Collisions Player Bullets -> Enemies
    bullets.forEach(b => {
        enemies.forEach(e => {
            if (!b.markedForDeletion && !e.markedForDeletion && checkCollision(b, e)) {
                b.markedForDeletion = true;
                e.markedForDeletion = true;
                spawnParticles(e.x + e.width/2, e.y + e.height/2, 20, e.color, 300);
                playExplosionSound();
                score += 100 * level;
                scoreEl.innerText = score;
                scoreEl.style.transform = 'scale(1.3)';
                setTimeout(() => scoreEl.style.transform = 'scale(1)', 100);
            }
        });
    });

    // Enemy Bullets -> Player
    enemyBullets.forEach(b => {
        if (!b.markedForDeletion && checkCollision(b, player)) {
            b.markedForDeletion = true;
            triggerGameOver();
        }
    });
    
    // Enemies -> Player
    enemies.forEach(e => {
        if (checkCollision(e, player) || e.y + e.height >= player.y + 10) {
            triggerGameOver();
        }
    });

    bullets = bullets.filter(b => !b.markedForDeletion);
    enemyBullets = enemyBullets.filter(b => !b.markedForDeletion);
    enemies = enemies.filter(e => !e.markedForDeletion);
    particles = particles.filter(p => p.life > 0);
    
    if (enemies.length === 0) {
        level++;
        initLevel();
    }
}

function triggerGameOver() {
    playGameOverSound();
    spawnParticles(player.x + player.width/2, player.y + player.height/2, 60, '#00f3ff', 600);
    spawnParticles(player.x + player.width/2, player.y + player.height/2, 40, '#ff00ea', 400);
    gameState = 'GAMEOVER';
    finalScoreEl.innerText = score;
    finalLevelEl.innerText = level;
    setTimeout(() => {
        uiGameOver.classList.remove('hidden');
    }, 1200);
}

function draw() {
    ctx.fillStyle = 'rgba(5, 5, 16, 0.35)'; // Trail effect
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    stars.forEach(s => {
        ctx.fillStyle = s.color;
        ctx.globalAlpha = Math.random() * 0.4 + 0.6;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });

    if (gameState === 'PLAYING') {
        player.draw(ctx);
        enemies.forEach(e => e.draw(ctx));
        bullets.forEach(b => b.draw(ctx));
        enemyBullets.forEach(b => b.draw(ctx));
    }
    
    particles.forEach(p => p.draw(ctx));
}

function gameLoop(timestamp) {
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    
    if (dt < 0.1) {
        update(dt);
        draw();
    }
    
    animationId = requestAnimationFrame(gameLoop);
}

// First screen draw
ctx.fillStyle = '#050510';
ctx.fillRect(0, 0, canvas.width, canvas.height);
