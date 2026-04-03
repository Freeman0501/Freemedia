/**
 * 經典打磚塊 - Enhanced Game Engine
 * Features: 20 Levels, Power-ups, Difficulty Scaling, Multi-audio
 */

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById('overlay');
        this.statusText = document.getElementById('status-text');
        this.startBtn = document.getElementById('start-btn');
        this.scoreEl = document.getElementById('score');
        this.highScoreEl = document.getElementById('high-score');
        this.livesEl = document.getElementById('lives');
        this.levelEl = document.getElementById('level');
        this.muteBtn = document.getElementById('mute-btn');

        // Audio System
        this.audioCtx = null;
        this.isMuted = false;
        this.masterVolume = 0.3; // Increased volume as requested

        // Game State
        this.level = 1;
        this.maxLevels = 20;
        this.score = 0;
        this.highScore = localStorage.getItem('breakout-high-score') || 0;
        this.lives = 3;
        this.running = false;

        // Entities
        this.balls = []; 
        this.paddle = { x: 0, y: 0, width: 120, height: 12, speed: 9, laserMode: false };
        this.bricks = [];
        this.powerUps = [];
        this.bullets = [];
        
        this.brickConfig = {
            rows: 5,
            cols: 8,
            padding: 10,
            offsetTop: 60,
            offsetLeft: 30,
            height: 24
        };

        // Input
        this.rightPressed = false;
        this.leftPressed = false;
        this.spacePressed = false;

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        document.addEventListener('keydown', (e) => this.keyDownHandler(e));
        document.addEventListener('keyup', (e) => this.keyUpHandler(e));
        document.addEventListener('mousemove', (e) => this.mouseMoveHandler(e));
        
        this.startBtn.addEventListener('click', () => this.startGame());
        this.muteBtn.addEventListener('click', () => this.toggleMute());

        this.highScoreEl.innerText = this.highScore;
        this.resetLevel();
        this.drawInitialState();
    }

    initAudio() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playSound(freq, type = 'square', duration = 0.1, volumeMult = 1) {
        if (this.isMuted || !this.audioCtx) return;
        
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        
        const vol = this.masterVolume * volumeMult;
        gain.gain.setValueAtTime(vol, this.audioCtx.currentTime);
        // Removed ramp for fixed volume as requested
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.muteBtn.innerHTML = this.isMuted ? '<span class="icon">🔇</span>' : '<span class="icon">🔊</span>';
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.ctx.scale(dpr, dpr);
        
        this.gameWidth = rect.width;
        this.gameHeight = rect.height;
        
        this.resetPaddle();
        this.refreshBricksPositions();
    }

    resetPaddle() {
        this.paddle.width = 120;
        this.paddle.laserMode = false;
        this.paddle.x = (this.gameWidth - this.paddle.width) / 2;
        this.paddle.y = this.gameHeight - 40;
    }

    resetBall() {
        this.balls = [{
            x: this.gameWidth / 2,
            y: this.paddle.y - 10,
            dx: (Math.random() - 0.5) * (6 + this.level * 0.5),
            dy: -(4 + this.level * 0.5),
            radius: 8
        }];
    }

    resetLevel() {
        this.levelEl.innerText = this.level;
        this.bricks = [];
        this.powerUps = [];
        this.bullets = [];
        this.paddle.laserMode = false;
        this.paddle.width = 120;

        // Reset bricks
        this.levelEl.innerText = this.level;
        this.bricks = [];
        this.powerUps = [];
        this.bullets = [];
        this.paddle.laserMode = false;
        this.paddle.width = 120;

        // Difficulty scaling
        const rows = 6; // Fixed at 6 layers as requested
        const cols = 12; // Denser grid
        
        const padding = 8;
        const offsetTop = 60;
        const offsetLeft = 30;
        const brickWidth = (this.gameWidth - (offsetLeft * 2) - (padding * (cols - 1))) / cols;

        this.brickConfig = { rows, cols, padding, offsetTop, offsetLeft, width: brickWidth, height: 26 };

        for (let c = 0; c < cols; c++) {
            this.bricks[c] = [];
            for (let r = 0; r < rows; r++) {
                // Randomly assign power-ups (15% chance)
                let type = null;
                if (Math.random() < 0.15) {
                    const types = ['EXPAND', 'MULTI', 'LASER', 'LIFE'];
                    type = types[Math.floor(Math.random() * types.length)];
                }

                this.bricks[c][r] = { 
                    x: 0, 
                    y: 0, 
                    status: 1, 
                    color: this.getBrickColor(r),
                    powerUp: type
                };
            }
        }
        this.refreshBricksPositions();
    }

    refreshBricksPositions() {
        for (let c = 0; c < this.brickConfig.cols; c++) {
            if (!this.bricks[c]) continue;
            for (let r = 0; r < this.brickConfig.rows; r++) {
                const brickX = c * (this.brickConfig.width + this.brickConfig.padding) + this.brickConfig.offsetLeft;
                const brickY = r * (this.brickConfig.height + this.brickConfig.padding) + this.brickConfig.offsetTop;
                this.bricks[c][r].x = brickX;
                this.bricks[c][r].y = brickY;
            }
        }
    }

    getBrickColor(row) {
        const colors = ['#ff00c1', '#00f2ff', '#39ff14', '#ffbd00', '#ff0000', '#8a2be2', '#00ff7f', '#ff1493'];
        return colors[row % colors.length];
    }

    keyDownHandler(e) {
        if (e.key === 'Right' || e.key === 'ArrowRight') this.rightPressed = true;
        else if (e.key === 'Left' || e.key === 'ArrowLeft') this.leftPressed = true;
        else if (e.key === ' ' || e.code === 'Space') {
            this.spacePressed = true;
            this.shoot();
        }
    }

    keyUpHandler(e) {
        if (e.key === 'Right' || e.key === 'ArrowRight') this.rightPressed = false;
        else if (e.key === 'Left' || e.key === 'ArrowLeft') this.leftPressed = false;
        else if (e.key === ' ' || e.code === 'Space') this.spacePressed = false;
    }

    mouseMoveHandler(e) {
        const rect = this.canvas.getBoundingClientRect();
        const relativeX = e.clientX - rect.left;
        if (relativeX > 0 && relativeX < this.gameWidth) {
            this.paddle.x = relativeX - this.paddle.width / 2;
        }
    }

    shoot() {
        if (this.paddle.laserMode && this.running) {
            this.bullets.push({ x: this.paddle.x + 10, y: this.paddle.y, dy: -7 });
            this.bullets.push({ x: this.paddle.x + this.paddle.width - 10, y: this.paddle.y, dy: -7 });
            this.playSound(800, 'sine', 0.05, 0.5);
        }
    }

    startGame() {
        this.initAudio();
        this.running = true;
        this.overlay.style.display = 'none';
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.updateStats();
        this.resetLevel();
        this.resetBall();
        this.requestUpdate();
    }

    updateStats() {
        this.scoreEl.innerText = this.score;
        this.livesEl.innerText = this.lives;
        this.levelEl.innerText = this.level;
    }

    requestUpdate() {
        if (this.running) {
            this.update();
            this.draw();
            requestAnimationFrame(() => this.requestUpdate());
        }
    }

    update() {
        // Move paddle
        if (this.rightPressed && this.paddle.x < this.gameWidth - this.paddle.width) {
            this.paddle.x += this.paddle.speed;
        } else if (this.leftPressed && this.paddle.x > 0) {
            this.paddle.x -= this.paddle.speed;
        }

        // Move bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            this.bullets[i].y += this.bullets[i].dy;
            if (this.bullets[i].y < 0) this.bullets.splice(i, 1);
        }

        // Move balls
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const ball = this.balls[i];
            ball.x += ball.dx;
            ball.y += ball.dy;

            // Wall collision
            if (ball.x + ball.radius > this.gameWidth || ball.x - ball.radius < 0) {
                ball.dx = -ball.dx;
                this.playSound(200, 'sine', 0.05);
            }
            if (ball.y - ball.radius < 0) {
                ball.dy = -ball.dy;
                this.playSound(200, 'sine', 0.05);
            }

            // Paddle collision
            if (ball.y + ball.radius > this.paddle.y && 
                ball.x > this.paddle.x && 
                ball.x < this.paddle.x + this.paddle.width) {
                
                ball.dy = -Math.abs(ball.dy);
                const hitPos = (ball.x - (this.paddle.x + this.paddle.width/2)) / (this.paddle.width/2);
                ball.dx = hitPos * (6 + this.level * 0.5);
                this.playSound(300, 'square', 0.1);
            } else if (ball.y + ball.radius > this.gameHeight) {
                this.balls.splice(i, 1);
                if (this.balls.length === 0) {
                    this.lives--;
                    this.livesEl.innerText = this.lives;
                    this.playSound(100, 'sawtooth', 0.3);
                    if (this.lives <= 0) {
                        this.gameOver(false);
                    } else {
                        this.paddle.width = 120;
                        this.paddle.laserMode = false;
                        this.resetBall();
                    }
                }
            }
        }

        // Move Power-ups
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const p = this.powerUps[i];
            p.y += 3;
            if (p.y > this.gameHeight) this.powerUps.splice(i, 1);
            else if (p.y > this.paddle.y && p.y < this.paddle.y + this.paddle.height &&
                     p.x > this.paddle.x && p.x < this.paddle.x + this.paddle.width) {
                this.applyPowerUp(p.type);
                this.powerUps.splice(i, 1);
                this.playSound(600, 'triangle', 0.2, 1.5);
            }
        }

        this.collisionDetection();
    }

    applyPowerUp(type) {
        switch(type) {
            case 'EXPAND': this.paddle.width += 40; break;
            case 'MULTI': 
                this.balls.push({
                    x: this.paddle.x + this.paddle.width/2,
                    y: this.paddle.y - 10,
                    dx: 4, dy: -4, radius: 8
                });
                break;
            case 'LASER': this.paddle.laserMode = true; break;
            case 'LIFE': this.lives++; this.livesEl.innerText = this.lives; break;
        }
    }

    collisionDetection() {
        let activeBricks = 0;
        for (let c = 0; c < this.brickConfig.cols; c++) {
            for (let r = 0; r < this.brickConfig.rows; r++) {
                const b = this.bricks[c][r];
                if (b.status === 1) {
                    activeBricks++;
                    // Ball collision
                    this.balls.forEach(ball => {
                        if (ball.x > b.x && ball.x < b.x + this.brickConfig.width && 
                            ball.y > b.y && ball.y < b.y + this.brickConfig.height) {
                            ball.dy = -ball.dy;
                            this.destroyBrick(b);
                        }
                    });
                    // Bullet collision
                    this.bullets.forEach((bullet, idx) => {
                        if (bullet.x > b.x && bullet.x < b.x + this.brickConfig.width && 
                            bullet.y > b.y && bullet.y < b.y + this.brickConfig.height) {
                            this.bullets.splice(idx, 1);
                            this.destroyBrick(b);
                        }
                    });
                }
            }
        }

        if (activeBricks === 0 && this.running) {
            if (this.level < this.maxLevels) {
                this.level++;
                this.resetLevel();
                this.resetBall();
                this.updateStats();
                this.playSound(523.25, 'sine', 0.3); // High Do
            } else {
                this.gameOver(true);
            }
        }
    }

    destroyBrick(brick) {
        brick.status = 0;
        this.score += 10;
        this.scoreEl.innerText = this.score;
        this.playSound(440, 'triangle', 0.1);
        if (brick.powerUp) {
            this.powerUps.push({ x: brick.x + this.brickConfig.width/2, y: brick.y, type: brick.powerUp });
        }
    }

    gameOver(won) {
        this.running = false;
        this.overlay.style.display = 'flex';
        this.statusText.innerText = won ? '完全通關！' : '遊戲結束';
        this.startBtn.innerText = '重新開始';
        
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('breakout-high-score', this.highScore);
            this.highScoreEl.innerText = this.highScore;
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.gameWidth, this.gameHeight);
        this.drawBricks();
        this.drawPowerUps();
        this.drawBullets();
        this.balls.forEach(ball => this.drawBall(ball));
        this.drawPaddle();
    }

    drawInitialState() {
        this.draw();
    }

    drawBall(ball) {
        this.ctx.beginPath();
        this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = "#ffffff";
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = "#ffffff";
        this.ctx.fill();
        this.ctx.closePath();
        this.ctx.shadowBlur = 0;
    }

    drawPaddle() {
        this.ctx.beginPath();
        this.ctx.roundRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height, 6);
        this.ctx.fillStyle = this.paddle.laserMode ? "#ff0000" : "#00f2ff";
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = this.paddle.laserMode ? "#ff0000" : "#00f2ff";
        this.ctx.fill();
        this.ctx.closePath();
        this.ctx.shadowBlur = 0;
    }

    drawBricks() {
        for (let c = 0; c < this.brickConfig.cols; c++) {
            for (let r = 0; r < this.brickConfig.rows; r++) {
                const b = this.bricks[c][r];
                if (b.status === 1) {
                    this.ctx.beginPath();
                    this.ctx.roundRect(b.x, b.y, this.brickConfig.width, this.brickConfig.height, 4);
                    this.ctx.fillStyle = b.color;
                    this.ctx.fill();
                    // Power-up indicator
                    if (b.powerUp) {
                        this.ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
                        this.ctx.font = "12px sans-serif";
                        this.ctx.textAlign = "center";
                        this.ctx.fillText("?", b.x + this.brickConfig.width/2, b.y + this.brickConfig.height/2 + 5);
                    }
                    this.ctx.closePath();
                }
            }
        }
    }

    drawPowerUps() {
        this.powerUps.forEach(p => {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
            this.ctx.fillStyle = "#ffff00";
            this.ctx.fill();
            this.ctx.fillStyle = "#000";
            this.ctx.font = "10px sans-serif";
            this.ctx.textAlign = "center";
            this.ctx.fillText(p.type[0], p.x, p.y + 3);
            this.ctx.closePath();
        });
    }

    drawBullets() {
        this.bullets.forEach(b => {
            this.ctx.fillStyle = "#ff0000";
            this.ctx.fillRect(b.x, b.y, 3, 10);
        });
    }
}

// Start core
window.onload = () => {
    new Game();
};
