// DOM 元素
const holes = document.querySelectorAll('.hole');
const scoreBoard = document.querySelector('#score');
const timeBoard = document.querySelector('#time');
const levelBoard = document.querySelector('#level');
const startBtn = document.querySelector('#startBtn');
const overlay = document.querySelector('#overlay');
const overlayTitle = document.querySelector('#overlayTitle');
const overlayMessage = document.querySelector('#overlayMessage');
const nextLevelBtn = document.querySelector('#nextLevelBtn');
const restartBtn = document.querySelector('#restartBtn');
const audioToggleBtn = document.querySelector('#audioToggle');
const fullscreenToggleBtn = document.querySelector('#fullscreenToggle');

// 遊戲狀態與設定
let lastHole;
let timeUp = false;
let score = 0;
let currentLevel = 1;
let countdownTimer;

// 音效 Context
let audioCtx;

// 10 個難度關卡設定
// minPeep/maxPeep: 瑪爾濟斯探出頭停留的毫秒數區間
// targetDelta: 晉升下一關需要「額外」獲得的分數 (每次擊中10分)
const levels = [
    { level: 1, minPeep: 1000, maxPeep: 1500, time: 20, targetDelta: 50 },  // 需擊中 5 次
    { level: 2, minPeep: 900,  maxPeep: 1300, time: 20, targetDelta: 60 },  // 需擊中 6 次
    { level: 3, minPeep: 800,  maxPeep: 1100, time: 20, targetDelta: 70 },  // 需擊中 7 次
    { level: 4, minPeep: 700,  maxPeep: 950,  time: 20, targetDelta: 80 },  // 需擊中 8 次
    { level: 5, minPeep: 600,  maxPeep: 800,  time: 20, targetDelta: 90 },  // 需擊中 9 次
    { level: 6, minPeep: 500,  maxPeep: 700,  time: 20, targetDelta: 100 }, // 需擊中 10 次
    { level: 7, minPeep: 400,  maxPeep: 600,  time: 20, targetDelta: 110 }, // 需擊中 11 次
    { level: 8, minPeep: 350,  maxPeep: 500,  time: 20, targetDelta: 120 }, // 需擊中 12 次
    { level: 9, minPeep: 300,  maxPeep: 450,  time: 20, targetDelta: 130 }, // 需擊中 13 次
    { level: 10, minPeep: 250, maxPeep: 400,  time: 20, targetDelta: 150 }  // 需擊中 15 次
];

let baseScore = 0; // 開始新關卡時的分數
let targetScore = levels[0].targetDelta; 

// 音效開關狀態
let isMuted = false;

// --- 音效系統 (Web Audio API) ---
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playTone(freq, type, duration, startTimeOffset = 0) {
    if(!audioCtx || isMuted) return;
    
    // 很多瀏覽器會掛起 AudioContext 直到有互動操作，所以手動恢復
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const t0 = audioCtx.currentTime + startTimeOffset;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    
    // 加入極短的起音(Attack)與平滑衰減(Decay)，避免波形截斷產生的爆音且音量穩定
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.1, t0 + 0.01);
    gain.gain.linearRampToValueAtTime(0, t0 + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(t0);
    osc.stop(t0 + duration);
}

function playHitSound() {
    // 使用精確內部計時取代 setTimeout，確保每次同時點擊音量都穩定一致
    playTone(600, 'sine', 0.1, 0);
    playTone(900, 'sine', 0.15, 0.05);
}

function playLevelUpSound() {
    playTone(400, 'triangle', 0.1, 0);
    playTone(500, 'triangle', 0.1, 0.1);
    playTone(600, 'triangle', 0.2, 0.2);
    playTone(800, 'triangle', 0.4, 0.4);
}

function playGameOverSound() {
    playTone(300, 'sawtooth', 0.3, 0);
    playTone(250, 'sawtooth', 0.3, 0.2);
    playTone(200, 'sawtooth', 0.5, 0.5);
}

function playWinSound() {
    playTone(523.25, 'square', 0.1, 0);
    playTone(659.25, 'square', 0.1, 0.15);
    playTone(783.99, 'square', 0.1, 0.3);
    playTone(1046.50, 'square', 0.4, 0.45);
}

// --- 遊戲邏輯 ---

// 產生隨機時間
function randomTime(min, max) {
    return Math.round(Math.random() * (max - min) + min);
}

// 隨機選擇地洞
function randomHole(holes) {
    const idx = Math.floor(Math.random() * holes.length);
    const hole = holes[idx];
    if (hole === lastHole) {
        return randomHole(holes);
    }
    lastHole = hole;
    return hole;
}

// 讓瑪爾濟斯探出頭
function peep() {
    const lvlCfg = levels[currentLevel - 1];
    const time = randomTime(lvlCfg.minPeep, lvlCfg.maxPeep);
    const hole = randomHole(holes);
    
    hole.classList.add('up');
    
    setTimeout(() => {
        hole.classList.remove('up');
        // 清除被打中的狀態，準備下一次
        hole.querySelector('.maltese').classList.remove('hit');
        
        if (!timeUp) peep();
    }, time);
}

function showOverlay(title, msg, showNext, showRestart) {
    overlayTitle.textContent = title;
    overlayMessage.textContent = msg;
    
    if(showNext) {
        nextLevelBtn.classList.remove('hidden');
    } else {
        nextLevelBtn.classList.add('hidden');
    }
    
    if(showRestart) {
        restartBtn.classList.remove('hidden');
    } else {
        restartBtn.classList.add('hidden');
    }
    
    overlay.classList.remove('hidden');
}

function updateStatsUI() {
    scoreBoard.textContent = score;
    levelBoard.textContent = currentLevel;
}

// 開始關卡
function startLevel() {
    initAudio(); // 確保使用者互動後解鎖音頻
    updateStatsUI();
    const lvlCfg = levels[currentLevel - 1];
    
    let timeLeft = lvlCfg.time;
    timeBoard.textContent = timeLeft;
    
    timeUp = false;
    baseScore = score;
    targetScore = baseScore + lvlCfg.targetDelta;
    
    scoreBoard.textContent = score;
    overlay.classList.add('hidden');
    startBtn.disabled = true;
    startBtn.textContent = '遊戲進行中...';
    
    peep();
    
    // 倒數計時
    countdownTimer = setInterval(() => {
        timeLeft--;
        timeBoard.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(countdownTimer);
            timeUp = true;
            checkLevelResult();
        }
    }, 1000);
}

// 重設為第一關
function resetGame() {
    score = 0;
    currentLevel = 1;
    startLevel();
}

// 結算關卡
function checkLevelResult() {
    startBtn.disabled = false;
    startBtn.textContent = '開始遊戲';
    
    if (score >= targetScore) {
        // 過關
        if (currentLevel < 10) {
            playLevelUpSound();
            showOverlay('太棒了！過關！', `你獲得了 ${score} 分。準備好挑戰第 ${currentLevel + 1} 關了嗎？`, true, false);
        } else {
            // 全破
            playWinSound();
            showOverlay('不可思議！全破啦！', `你成功完成了全部 10 個關卡！總分：${score}，真是一位打地鼠大師！`, false, true);
        }
    } else {
        // 失敗
        playGameOverSound();
        showOverlay('時間到！闖關失敗', `你需要達到 ${targetScore} 分，但你只拿了 ${score} 分。再試一次吧！`, false, true);
    }
}

// 打中瑪爾濟斯
function bonk(e) {
    if (!e.isTrusted) return; // 防止程式作弊模擬點擊
    if (this.classList.contains('hit')) return; // 避免同一隻重複計分
    
    playHitSound();
    
    // 加分與變更 UI
    score += 10;
    this.parentNode.classList.remove('up');
    this.classList.add('hit');
    scoreBoard.textContent = score;
}

// 綁定事件
holes.forEach(hole => {
    // 選擇地鼠層來綁定點擊事件
    const maltese = hole.querySelector('.maltese');
    maltese.addEventListener('mousedown', bonk);
    maltese.addEventListener('touchstart', (e) => {
        e.preventDefault(); // 防止手機雙點擊縮放等問題
        bonk.call(maltese, e);
    });
});

startBtn.addEventListener('click', () => {
    if(currentLevel === 1 && score === 0) {
        resetGame();
    } else {
        startLevel();
    }
});

nextLevelBtn.addEventListener('click', () => {
    currentLevel++;
    startLevel();
});

restartBtn.addEventListener('click', resetGame);

// 音效開關邏輯
audioToggleBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    audioToggleBtn.textContent = isMuted ? '🔇' : '🔊';
});

// 全螢幕切換邏輯
fullscreenToggleBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
            console.error(`全螢幕失敗: ${err.message}`);
        });
        fullscreenToggleBtn.textContent = '⤡'; // 縮小圖示
        fullscreenToggleBtn.title = '退出全螢幕';
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
        fullscreenToggleBtn.textContent = '⤢'; // 放大圖示
        fullscreenToggleBtn.title = '切換全螢幕';
    }
});
