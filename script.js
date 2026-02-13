// ==========================================
// 💖 Valentine Heart - Bé Lợn
// ==========================================

const canvas = document.getElementById('heartCanvas');
const ctx = canvas.getContext('2d');
const video = document.getElementById('camera');
const sparklesContainer = document.getElementById('sparkles');
const cameraStatus = document.getElementById('cameraStatus');
const cameraText = document.getElementById('cameraText');
const cameraIcon = document.getElementById('cameraIcon');
const handInstruction = document.getElementById('handInstruction');
const clickCounterEl = document.getElementById('clickCounter');

// ==========================================
// Config
// ==========================================
const CONFIG = {
    // Change to 10 for testing, 300 for production (5 min)
    CLIMAX_TIME_SECONDS: 300,
    HEART_PARTICLE_COUNT: 600,
    EXPLOSION_PARTICLE_COUNT: 600,
    BASE_HEART_SCALE: 1.0,
    MIN_HEART_SCALE: 0.3,
    MAX_HEART_SCALE: 2.0,
    BEAT_SPEED: 0.03,
    SPARKLE_COUNT: 80,
    CLICKS_TO_EXPLODE: 3,
};

// ==========================================
// State
// ==========================================
let state = {
    width: 0,
    height: 0,
    heartScale: CONFIG.BASE_HEART_SCALE,
    targetScale: CONFIG.BASE_HEART_SCALE,
    handDetected: false,
    handOpenness: 0.5,
    beatPhase: 0,
    beatSpeed: CONFIG.BEAT_SPEED,
    startTime: Date.now(),
    phase: 'normal', // 'normal' | 'climax' | 'explosion' | 'aftermath'
    climaxProgress: 0,
    particles: [],
    explosionParticles: [],
    miniHearts: [],
    cameraReady: false,
    // Click explosion
    clickCount: 0,
    clickRipples: [],
    lastClickTime: 0,
    // Mouse/touch interaction
    mouseX: -1000,
    mouseY: -1000,
    mouseActive: false,
    // Audio
    audioStarted: false,
    audioCtx: null,
};

// ==========================================
// Resize
// ==========================================
function resize() {
    state.width = canvas.width = window.innerWidth;
    state.height = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ==========================================
// 🔊 Heartbeat Sound (Web Audio API)
// ==========================================
let heartbeatInterval = null;

function createHeartbeatSound() {
    if (state.audioStarted) return;
    state.audioStarted = true;

    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        state.audioCtx = new AudioContext();
        startHeartbeatLoop();
    } catch (e) {
        console.warn('Web Audio not supported:', e);
    }
}

function playLubDub() {
    if (!state.audioCtx || state.phase === 'explosion' || state.phase === 'aftermath') return;

    const ac = state.audioCtx;
    const now = ac.currentTime;

    // "Lub" - first heart sound (lower, stronger)
    playHeartTone(ac, now, 55, 0.15, 0.08, 0.6);
    // "Dub" - second heart sound (higher, softer, shortly after)
    playHeartTone(ac, now + 0.15, 70, 0.12, 0.06, 0.4);
    // Sub-bass thump
    playHeartTone(ac, now, 35, 0.2, 0.1, 0.3);
}

function playHeartTone(ac, startTime, freq, duration, attack, volume) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const filter = ac.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, startTime + duration);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, startTime);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
}

function startHeartbeatLoop() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    function scheduleNext() {
        playLubDub();

        // Calculate interval based on beat speed (faster beat = faster heartbeat)
        const bpm = Math.max(40, Math.min(200, state.beatSpeed * 1500));
        const intervalMs = (60 / bpm) * 1000;

        heartbeatInterval = setTimeout(scheduleNext, intervalMs);
    }
    scheduleNext();
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearTimeout(heartbeatInterval);
        heartbeatInterval = null;
    }
}

// ==========================================
// Background Sparkles (CSS)
// ==========================================
function createSparkles() {
    for (let i = 0; i < CONFIG.SPARKLE_COUNT; i++) {
        const s = document.createElement('div');
        s.className = 'sparkle';
        s.style.left = Math.random() * 100 + '%';
        s.style.top = Math.random() * 100 + '%';
        s.style.setProperty('--duration', (2 + Math.random() * 4) + 's');
        s.style.setProperty('--max-opacity', (0.3 + Math.random() * 0.7).toFixed(2));
        s.style.animationDelay = (Math.random() * 5) + 's';
        s.style.width = (1 + Math.random() * 3) + 'px';
        s.style.height = s.style.width;
        sparklesContainer.appendChild(s);
    }
}
createSparkles();

// ==========================================
// Heart Shape Math
// ==========================================
function heartX(t) {
    return 16 * Math.pow(Math.sin(t), 3);
}

function heartY(t) {
    return -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
}

// ==========================================
// ✨ Enhanced Particle System - Heart
// ==========================================
class HeartParticle {
    constructor() {
        this.reset();
    }

    reset() {
        const t = Math.random() * Math.PI * 2;
        this.baseX = heartX(t);
        this.baseY = heartY(t);
        this.x = 0;
        this.y = 0;
        this.prevX = 0;
        this.prevY = 0;
        this.size = 1.8 + Math.random() * 2.5;
        this.baseSize = this.size;
        this.opacity = 0.6 + Math.random() * 0.4;
        this.wobbleSpeed = 0.5 + Math.random() * 1.5;
        this.wobbleAmount = 0.15 + Math.random() * 0.4;
        this.phase = Math.random() * Math.PI * 2;

        // 🔴 Much redder color palette
        this.hue = 348 + Math.random() * 15; // 348-363 (deep red to crimson)
        this.saturation = 85 + Math.random() * 15; // 85-100%
        this.lightness = 35 + Math.random() * 20; // 35-55% (deeper, richer)

        // Fill factor - keep particles closer to heart outline for clearer shape
        this.fillFactor = 0.6 + Math.random() * 0.4;

        // ✨ Orbit animation - small to maintain shape
        this.orbitSpeed = (Math.random() - 0.5) * 0.008;
        this.orbitRadius = Math.random() * 0.8;
        this.orbitPhase = Math.random() * Math.PI * 2;

        // ✨ New: Pulse animation
        this.pulseSpeed = 1 + Math.random() * 3;
        this.pulseAmount = 0.3 + Math.random() * 0.5;

        // ✨ New: Trail
        this.trail = [];
        this.trailLength = Math.floor(2 + Math.random() * 4);

        // ✨ New: Sparkle flash
        this.sparkleTimer = Math.random() * 100;
        this.sparkleInterval = 50 + Math.random() * 150;
    }

    update(time, scale, centerX, centerY, beatPulse) {
        // Store previous position for trail
        this.prevX = this.x;
        this.prevY = this.y;

        // Wobble
        const wobble = Math.sin(time * this.wobbleSpeed + this.phase) * this.wobbleAmount;
        const wobbleY = Math.cos(time * this.wobbleSpeed * 0.7 + this.phase) * this.wobbleAmount * 0.6;

        // Orbit
        this.orbitPhase += this.orbitSpeed;
        const orbitX = Math.cos(this.orbitPhase) * this.orbitRadius;
        const orbitY = Math.sin(this.orbitPhase) * this.orbitRadius;

        const effectiveScale = scale * (12 + beatPulse * 3) * this.fillFactor;
        this.x = centerX + (this.baseX + wobble + orbitX) * effectiveScale;
        this.y = centerY + (this.baseY + wobbleY + orbitY) * effectiveScale;

        // Pulsing size
        this.size = this.baseSize * (1 + Math.sin(time * this.pulseSpeed) * this.pulseAmount * 0.3);

        // Size boost on beat
        this.size *= (1 + Math.abs(beatPulse) * 0.8);

        // Trail update
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.trailLength) {
            this.trail.shift();
        }

        // Sparkle timer
        this.sparkleTimer++;

        // Mouse/touch interaction - particles attract or repel
        if (state.mouseActive) {
            const dx = this.x - state.mouseX;
            const dy = this.y - state.mouseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const interactionRadius = 120;

            if (dist < interactionRadius) {
                const force = (1 - dist / interactionRadius) * 4;
                // Attract towards cursor
                this.x -= (dx / dist) * force * 0.3;
                this.y -= (dy / dist) * force * 0.3;
                // Boost glow
                this.opacity = Math.min(1, this.opacity + 0.15);
                this.size *= 1.3;
            }
        }
    }

    draw(ctx) {
        // Draw trail
        if (this.trail.length > 1) {
            for (let i = 0; i < this.trail.length - 1; i++) {
                const alpha = (i / this.trail.length) * this.opacity * 0.3;
                const trailSize = this.size * (i / this.trail.length) * 0.6;
                ctx.beginPath();
                ctx.arc(this.trail[i].x, this.trail[i].y, trailSize, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${this.hue}, ${this.saturation}%, ${this.lightness + 10}%, ${alpha})`;
                ctx.fill();
            }
        }

        // Main particle
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, ${this.saturation}%, ${this.lightness}%, ${this.opacity})`;
        ctx.shadowColor = `hsla(${this.hue}, 100%, 50%, 0.8)`;
        ctx.shadowBlur = 10;
        ctx.fill();

        // Sparkle flash
        if (this.sparkleTimer >= this.sparkleInterval) {
            this.sparkleTimer = 0;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 2.5, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(0, 100%, 90%, 0.6)`;
            ctx.fill();
        }

        ctx.shadowBlur = 0;
    }
}

// Initialize heart particles
function initHeartParticles() {
    state.particles = [];
    for (let i = 0; i < CONFIG.HEART_PARTICLE_COUNT; i++) {
        state.particles.push(new HeartParticle());
    }
}
initHeartParticles();

// ==========================================
// Explosion Particles
// ==========================================
class ExplosionParticle {
    constructor(startX, startY) {
        this.x = startX;
        this.y = startY;
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 15;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.size = 2 + Math.random() * 5;
        this.opacity = 1;
        this.decay = 0.003 + Math.random() * 0.008;
        this.hue = 340 + Math.random() * 25;
        this.gravity = 0.02 + Math.random() * 0.03;
        this.friction = 0.98 + Math.random() * 0.01;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.1;
    }

    update() {
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.opacity -= this.decay;
        this.rotation += this.rotationSpeed;
    }

    draw(ctx) {
        if (this.opacity <= 0) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = `hsl(${this.hue}, 95%, 55%)`;
        ctx.shadowColor = `hsl(${this.hue}, 100%, 50%)`;
        ctx.shadowBlur = 12;
        // Draw mini heart shape
        const s = this.size;
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.3);
        ctx.bezierCurveTo(-s, -s, -s, s * 0.3, 0, s);
        ctx.bezierCurveTo(s, s * 0.3, s, -s, 0, -s * 0.3);
        ctx.fill();
        ctx.restore();
    }

    get alive() {
        return this.opacity > 0;
    }
}

// ==========================================
// Mini Floating Hearts (aftermath)
// ==========================================
class MiniHeart {
    constructor(canvasW, canvasH) {
        this.x = Math.random() * canvasW;
        this.y = -Math.random() * canvasH; // Start from above
        this.size = 4 + Math.random() * 16;
        this.speedY = 0.5 + Math.random() * 2.5; // Fall downward
        this.speedX = (Math.random() - 0.5) * 1.2;
        this.wobble = Math.random() * Math.PI * 2;
        this.wobbleSpeed = 0.01 + Math.random() * 0.03;
        this.opacity = 0.3 + Math.random() * 0.7;
        this.hue = 330 + Math.random() * 35;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.05;
        this.canvasW = canvasW;
        this.canvasH = canvasH;
    }

    update() {
        this.wobble += this.wobbleSpeed;
        this.x += this.speedX + Math.sin(this.wobble) * 0.8;
        this.y += this.speedY; // Fall down
        this.rotation += this.rotationSpeed;

        // Recycle at bottom
        if (this.y > this.canvasH + 30) {
            this.y = -30;
            this.x = Math.random() * this.canvasW;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = `hsl(${this.hue}, 90%, 55%)`;
        ctx.shadowColor = `hsl(${this.hue}, 100%, 50%)`;
        ctx.shadowBlur = 12;

        const s = this.size;
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.3);
        ctx.bezierCurveTo(-s, -s, -s, s * 0.3, 0, s);
        ctx.bezierCurveTo(s, s * 0.3, s, -s, 0, -s * 0.3);
        ctx.fill();
        ctx.restore();
    }
}

// ==========================================
// 💥 Click Ripple Effect
// ==========================================
class ClickRipple {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = 150;
        this.opacity = 0.8;
        this.speed = 4;
    }

    update() {
        this.radius += this.speed;
        this.opacity = 0.8 * (1 - this.radius / this.maxRadius);
    }

    draw(ctx) {
        if (this.opacity <= 0) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(350, 100%, 65%, ${this.opacity})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = `hsla(350, 100%, 50%, ${this.opacity})`;
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    get alive() {
        return this.radius < this.maxRadius;
    }
}

// ==========================================
// 👆 Click/Touch Handler - 3 clicks to explode
// ==========================================
function handleInteraction(x, y) {
    // Start heartbeat on first interaction
    if (!state.audioStarted) {
        createHeartbeatSound();
    }

    if (state.phase !== 'normal' && state.phase !== 'climax') return;

    // Reset click count if too much time passed (2 seconds)
    const now = Date.now();
    if (now - state.lastClickTime > 2000) {
        state.clickCount = 0;
    }
    state.lastClickTime = now;

    state.clickCount++;

    // Add ripple
    state.clickRipples.push(new ClickRipple(x, y));

    // Update counter display
    updateClickCounter();

    // Screen shake on click
    const shakeAmount = state.clickCount * 3;
    canvas.style.transform = `translate(${(Math.random() - 0.5) * shakeAmount}px, ${(Math.random() - 0.5) * shakeAmount}px)`;
    setTimeout(() => { canvas.style.transform = ''; }, 150);

    // Beat pulse on click
    state.beatPhase += 0.5;

    // 3rd click: EXPLODE!
    if (state.clickCount >= CONFIG.CLICKS_TO_EXPLODE) {
        state.clickCount = 0;
        updateClickCounter();
        // Brief dramatic pause then explode
        setTimeout(() => {
            triggerExplosion();
            stopHeartbeat();
        }, 200);
    }
}

function updateClickCounter() {
    if (!clickCounterEl) return;
    const hearts = [];
    for (let i = 0; i < state.clickCount; i++) {
        hearts.push('💖');
    }
    clickCounterEl.innerHTML = hearts.join(' ');
    clickCounterEl.className = state.clickCount > 0 ? 'click-counter visible' : 'click-counter';

    if (state.clickCount > 0) {
        clickCounterEl.style.animation = 'none';
        clickCounterEl.offsetHeight; // force reflow
        clickCounterEl.style.animation = 'counter-pop 0.4s ease';
    }
}

// Mouse/Touch event listeners
canvas.addEventListener('click', (e) => {
    handleInteraction(e.clientX, e.clientY);
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleInteraction(touch.clientX, touch.clientY);
}, { passive: false });

// Mouse tracking for particle interaction
canvas.addEventListener('mousemove', (e) => {
    state.mouseX = e.clientX;
    state.mouseY = e.clientY;
    state.mouseActive = true;
});

canvas.addEventListener('mouseleave', () => {
    state.mouseActive = false;
});

canvas.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    state.mouseX = touch.clientX;
    state.mouseY = touch.clientY;
    state.mouseActive = true;
}, { passive: true });

canvas.addEventListener('touchend', () => {
    state.mouseActive = false;
});

// ==========================================
// Camera & Hand Detection (MediaPipe)
// ==========================================
async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 320, height: 240 }
        });
        video.srcObject = stream;
        await video.play();

        cameraIcon.textContent = '✅';
        cameraText.textContent = 'Camera đã kết nối!';
        cameraStatus.classList.add('connected');

        // Show hand instruction
        handInstruction.classList.add('visible');

        // Hide status after 3s
        setTimeout(() => {
            cameraStatus.classList.add('hidden');
        }, 3000);

        state.cameraReady = true;
        setupHandDetection();
    } catch (err) {
        console.warn('Camera not available:', err);
        cameraIcon.textContent = '❌';
        cameraText.textContent = 'Không có camera - trái tim tự đập';
        cameraStatus.classList.add('error');
        setTimeout(() => {
            cameraStatus.classList.add('hidden');
        }, 4000);
    }
}

function setupHandDetection() {
    if (typeof Hands === 'undefined') {
        console.warn('MediaPipe Hands not loaded');
        return;
    }

    const hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
    });

    hands.onResults(onHandResults);

    const camera = new Camera(video, {
        onFrame: async () => {
            await hands.send({ image: video });
        },
        width: 320,
        height: 240,
    });

    camera.start();
}

function onHandResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        state.handDetected = true;

        // Calculate hand openness using distance between fingertips and wrist
        const wrist = landmarks[0];
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];

        // Average distance of all fingertips from wrist
        const distances = [thumbTip, indexTip, middleTip, ringTip, pinkyTip].map(tip => {
            const dx = tip.x - wrist.x;
            const dy = tip.y - wrist.y;
            return Math.sqrt(dx * dx + dy * dy);
        });
        const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;

        // Normalize (fist ≈ 0.1, open ≈ 0.4)
        state.handOpenness = Math.max(0, Math.min(1, (avgDist - 0.08) / 0.35));
    } else {
        state.handDetected = false;
    }
}

// ==========================================
// Phase Management
// ==========================================
function updatePhase() {
    const elapsed = (Date.now() - state.startTime) / 1000;
    const climaxTime = CONFIG.CLIMAX_TIME_SECONDS;

    if (state.phase === 'normal') {
        if (elapsed >= climaxTime - 30) {
            // Pre-climax: beat faster
            const progress = (elapsed - (climaxTime - 30)) / 30;
            state.beatSpeed = CONFIG.BEAT_SPEED + progress * 0.15;
            state.climaxProgress = progress;
        }
        if (elapsed >= climaxTime) {
            state.phase = 'climax';
            state.climaxProgress = 0;
        }
    }

    if (state.phase === 'climax') {
        state.climaxProgress += 0.005;
        state.beatSpeed = 0.15 + state.climaxProgress * 0.1;
        state.targetScale = CONFIG.BASE_HEART_SCALE + state.climaxProgress * 1.5;

        if (state.climaxProgress >= 1) {
            triggerExplosion();
            stopHeartbeat();
        }
    }

    if (state.phase === 'explosion') {
        // Update explosion particles
        state.explosionParticles = state.explosionParticles.filter(p => p.alive);
        state.explosionParticles.forEach(p => p.update());

        // When most particles are gone, switch to aftermath
        if (state.explosionParticles.length < 50) {
            state.phase = 'aftermath';
            createMiniHearts();
            showExplosionText();
        }
    }

    if (state.phase === 'aftermath') {
        state.miniHearts.forEach(h => h.update());
    }
}

function triggerExplosion() {
    state.phase = 'explosion';
    const cx = state.width / 2;
    const cy = state.height / 2 - 30;

    state.explosionParticles = [];
    for (let i = 0; i < CONFIG.EXPLOSION_PARTICLE_COUNT; i++) {
        state.explosionParticles.push(new ExplosionParticle(cx, cy));
    }

    // Big shockwave flash with multiple rings
    for (let ring = 0; ring < 3; ring++) {
        setTimeout(() => {
            const flashDiv = document.createElement('div');
            flashDiv.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: radial-gradient(circle at 50% 45%, rgba(255,20,60,${0.5 - ring * 0.12}) 0%, rgba(255,105,180,${0.3 - ring * 0.08}) 30%, transparent 70%);
                z-index: 25; pointer-events: none;
                animation: flashFade ${0.8 + ring * 0.3}s ease forwards;
            `;
            document.body.appendChild(flashDiv);
            setTimeout(() => flashDiv.remove(), 1500);
        }, ring * 150);
    }

    const style = document.createElement('style');
    style.textContent = `
        @keyframes flashFade {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; }
            100% { opacity: 0; transform: scale(1.5); }
        }
    `;
    document.head.appendChild(style);

    // Vibrate if available
    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 200]);
    }
}

function createMiniHearts() {
    state.miniHearts = [];
    for (let i = 0; i < 150; i++) {
        const h = new MiniHeart(state.width, state.height);
        // Distribute evenly across screen height for "universe" feel
        h.y = -Math.random() * state.height * 2;
        state.miniHearts.push(h);
    }
}

function showExplosionText() {
    const textOverlay = document.getElementById('textOverlay');
    textOverlay.style.display = 'none';

    // Hide click counter and tap instruction
    if (clickCounterEl) clickCounterEl.style.display = 'none';
    const tapInstr = document.getElementById('tapInstruction');
    if (tapInstr) tapInstr.style.display = 'none';

    const explosionText = document.createElement('div');
    explosionText.className = 'explosion-text';
    explosionText.innerHTML = 'Yêu Bé Lợn<br>Mãi Mãi 💖';
    document.getElementById('app').appendChild(explosionText);

    // After 5 seconds, transition to letter
    setTimeout(() => {
        showLoveLetter();
    }, 5000);
}

// ==========================================
// Update & Draw
// ==========================================
function update(time) {
    // Update target scale based on hand
    if (state.handDetected && state.phase === 'normal') {
        state.targetScale = CONFIG.MIN_HEART_SCALE + state.handOpenness * (CONFIG.MAX_HEART_SCALE - CONFIG.MIN_HEART_SCALE);
    } else if (state.phase === 'normal') {
        state.targetScale = CONFIG.BASE_HEART_SCALE;
    }

    // Smooth lerp scale
    state.heartScale += (state.targetScale - state.heartScale) * 0.08;

    // Beat animation
    state.beatPhase += state.beatSpeed;
    const beat = Math.sin(state.beatPhase) * 0.18;

    // Update heart particles
    const cx = state.width / 2;
    const cy = state.height / 2 - 30;
    const scale = state.heartScale + beat;

    state.particles.forEach(p => {
        p.update(time / 1000, scale, cx, cy, beat);
    });

    // Update click ripples
    state.clickRipples = state.clickRipples.filter(r => r.alive);
    state.clickRipples.forEach(r => r.update());

    updatePhase();
}

function draw() {
    ctx.clearRect(0, 0, state.width, state.height);

    if (state.phase === 'normal' || state.phase === 'climax') {
        // Draw glow behind heart - MUCH bigger and redder
        const cx = state.width / 2;
        const cy = state.height / 2 - 30;
        const glowSize = 160 * state.heartScale;

        // Outer ambient glow
        const outerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowSize * 1.5);
        outerGlow.addColorStop(0, 'rgba(220, 20, 60, 0.08)');
        outerGlow.addColorStop(0.5, 'rgba(220, 20, 60, 0.03)');
        outerGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = outerGlow;
        ctx.fillRect(cx - glowSize * 1.5, cy - glowSize * 1.5, glowSize * 3, glowSize * 3);

        // Inner core glow
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowSize);
        gradient.addColorStop(0, 'rgba(255, 20, 60, 0.18)');
        gradient.addColorStop(0.3, 'rgba(255, 23, 68, 0.10)');
        gradient.addColorStop(0.7, 'rgba(255, 23, 68, 0.04)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(cx - glowSize, cy - glowSize, glowSize * 2, glowSize * 2);

        // Draw particles
        state.particles.forEach(p => p.draw(ctx));

        // Draw click ripples
        state.clickRipples.forEach(r => r.draw(ctx));

        // Climax screen shake
        if (state.phase === 'climax') {
            const shake = state.climaxProgress * 4;
            canvas.style.transform = `translate(${(Math.random() - 0.5) * shake}px, ${(Math.random() - 0.5) * shake}px)`;
        }
    }

    if (state.phase === 'explosion') {
        state.explosionParticles.forEach(p => p.draw(ctx));
        // Still draw ripples during explosion
        state.clickRipples.forEach(r => r.draw(ctx));
    }

    if (state.phase === 'aftermath') {
        state.miniHearts.forEach(h => h.draw(ctx));
    }
}

// ==========================================
// 💌 Love Letter System
// ==========================================
function showLoveLetter() {
    const overlay = document.getElementById('letterOverlay');
    overlay.classList.remove('hidden');

    // Create falling hearts for letter background
    createLetterFallingHearts();

    // Start music
    startMusic();

    // Set up envelope click
    const envelope = document.getElementById('letterEnvelope');
    envelope.addEventListener('click', openEnvelope);
}

function createLetterFallingHearts() {
    const container = document.getElementById('letterHearts');
    const heartEmojis = ['💖', '💕', '❤️', '💗', '💝', '🩷'];

    for (let i = 0; i < 30; i++) {
        const heart = document.createElement('div');
        heart.className = 'letter-falling-heart';
        heart.textContent = heartEmojis[Math.floor(Math.random() * heartEmojis.length)];
        heart.style.left = Math.random() * 100 + '%';
        heart.style.fontSize = (0.6 + Math.random() * 1.2) + 'rem';
        heart.style.animationDuration = (5 + Math.random() * 8) + 's';
        heart.style.animationDelay = (Math.random() * 6) + 's';
        heart.style.opacity = (0.15 + Math.random() * 0.25).toFixed(2);
        container.appendChild(heart);
    }
}

function openEnvelope() {
    const envelope = document.getElementById('letterEnvelope');
    const paper = document.getElementById('letterPaper');

    // Animate envelope opening
    envelope.classList.add('opened');

    // After envelope animation, show letter paper
    setTimeout(() => {
        envelope.style.display = 'none';
        paper.classList.add('visible');

        // Typewriter effect for letter content
        typewriterEffect();
    }, 800);
}

function typewriterEffect() {
    const content = document.getElementById('letterContent');
    const tapHint = document.getElementById('letterTapHint');

    // Get all text elements
    const elements = content.querySelectorAll('.letter-greeting, .letter-body, .letter-closing, .letter-signature');

    // Hide all initially
    elements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        el.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
    });

    // Reveal one by one
    let delay = 300;
    elements.forEach((el, i) => {
        setTimeout(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, delay);
        delay += 1200;
    });

    // Show tap hint after all text appears
    setTimeout(() => {
        tapHint.style.display = 'block';
        tapHint.addEventListener('click', showRingBox);
    }, delay + 500);
}

// ==========================================
// 🎵 Background Music (Nơi này có anh)
// ==========================================
function startMusic() {
    const musicPlayer = document.getElementById('musicPlayer');

    // Use YouTube IFrame to play "Nơi này có anh" - Sơn Tùng MTP
    // YouTube video ID: FN7ALfpGxiI
    const iframe = document.createElement('iframe');
    iframe.width = '1';
    iframe.height = '1';
    iframe.src = 'https://www.youtube.com/embed/FN7ALfpGxiI?autoplay=1&loop=1&playlist=FN7ALfpGxiI&controls=0&showinfo=0&start=0';
    iframe.allow = 'autoplay; encrypted-media';
    iframe.setAttribute('frameborder', '0');
    iframe.style.opacity = '0';
    iframe.style.position = 'absolute';
    iframe.style.pointerEvents = 'none';

    musicPlayer.appendChild(iframe);
}

// ==========================================
// 💍 Ring Box Proposal
// ==========================================
function showRingBox() {
    // Hide letter overlay
    const letterOverlay = document.getElementById('letterOverlay');
    letterOverlay.classList.add('hidden');

    // Show ring overlay after letter fades
    setTimeout(() => {
        const ringOverlay = document.getElementById('ringOverlay');
        ringOverlay.classList.remove('hidden');

        // Create ring sparkles
        createRingSparkles();

        // Open box lid after a moment
        setTimeout(() => {
            const ringBox = document.getElementById('ringBox');
            ringBox.classList.add('opened');

            // Show proposal text after lid opens
            setTimeout(() => {
                const proposalText = document.getElementById('proposalText');
                proposalText.classList.add('visible');

                // Setup button handlers
                setupProposalButtons();
            }, 800);
        }, 1500);
    }, 1200);
}

function createRingSparkles() {
    const container = document.getElementById('ringSparkles');
    for (let i = 0; i < 50; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'ring-sparkle';
        sparkle.style.left = Math.random() * 100 + '%';
        sparkle.style.top = Math.random() * 100 + '%';
        sparkle.style.setProperty('--dur', (2 + Math.random() * 4) + 's');
        sparkle.style.setProperty('--op', (0.3 + Math.random() * 0.7).toFixed(2));
        sparkle.style.animationDelay = Math.random() * 5 + 's';
        sparkle.style.width = (2 + Math.random() * 4) + 'px';
        sparkle.style.height = sparkle.style.width;
        container.appendChild(sparkle);
    }
}

function setupProposalButtons() {
    const yesBtn = document.getElementById('yesBtn');
    const noBtn = document.getElementById('noBtn');

    yesBtn.addEventListener('click', () => {
        showCelebration();
    });

    // The No button runs away!
    let noClickCount = 0;
    noBtn.addEventListener('mouseenter', () => {
        noClickCount++;
        const maxOffset = Math.min(noClickCount * 40, 200);
        const randomX = (Math.random() - 0.5) * maxOffset * 2;
        const randomY = (Math.random() - 0.5) * maxOffset * 2;
        noBtn.style.transform = `translate(${randomX}px, ${randomY}px) scale(${Math.max(0.5, 1 - noClickCount * 0.1)})`;
        noBtn.style.opacity = Math.max(0.2, 1 - noClickCount * 0.15);

        if (noClickCount >= 5) {
            noBtn.textContent = '😭';
            noBtn.style.fontSize = '0.6rem';
        }
    });

    noBtn.addEventListener('click', () => {
        // Even if they manage to click No, say "Hông được đâu!"
        noBtn.textContent = 'Hông được đâu! 😤💖';
        noBtn.style.pointerEvents = 'none';
        setTimeout(() => {
            noBtn.style.display = 'none';
            yesBtn.style.transform = 'scale(1.3)';
            yesBtn.style.boxShadow = '0 10px 50px rgba(255, 23, 68, 0.7)';
        }, 1000);
    });
}

function showCelebration() {
    // Hide ring overlay
    const ringOverlay = document.getElementById('ringOverlay');
    ringOverlay.classList.add('hidden');

    setTimeout(() => {
        // Create celebration overlay
        const celebration = document.createElement('div');
        celebration.className = 'celebration-overlay';
        celebration.id = 'celebrationOverlay';

        const text = document.createElement('div');
        text.className = 'celebration-text';
        text.innerHTML = '💖 Yêu Bé Lợn<br>Mãi Mãi Nhen! 💍✨';
        celebration.appendChild(text);

        document.body.appendChild(celebration);

        // Burst confetti hearts
        launchCelebrationHearts();

        // After 5 seconds, show photo capture
        setTimeout(() => {
            showPhotoCapture();
        }, 5000);
    }, 1500);
}

function launchCelebrationHearts() {
    const heartEmojis = ['💖', '💕', '❤️', '💗', '💝', '🩷', '💍', '✨', '🌹'];

    function createBurst() {
        for (let i = 0; i < 8; i++) {
            const heart = document.createElement('div');
            heart.textContent = heartEmojis[Math.floor(Math.random() * heartEmojis.length)];
            heart.style.cssText = `
                position: fixed;
                font-size: ${1 + Math.random() * 2}rem;
                left: ${Math.random() * 100}%;
                top: -20px;
                z-index: 400;
                pointer-events: none;
                animation: celebration-fall ${3 + Math.random() * 4}s linear forwards;
                opacity: ${0.5 + Math.random() * 0.5};
            `;
            document.body.appendChild(heart);
            setTimeout(() => heart.remove(), 8000);
        }
    }

    // Add celebration-fall animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes celebration-fall {
            0% { transform: translateY(-20px) rotate(0deg) scale(0); opacity: 0; }
            10% { transform: translateY(0) rotate(30deg) scale(1); opacity: 1; }
            100% { transform: translateY(110vh) rotate(720deg) scale(0.5); opacity: 0; }
        }
        @keyframes celebration-pop {
            0% { transform: scale(0); opacity: 0; }
            60% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    // Continuous bursts
    createBurst();
    state.celebrationInterval = setInterval(createBurst, 800);

    // Stop after 20 seconds
    setTimeout(() => {
        if (state.celebrationInterval) clearInterval(state.celebrationInterval);
    }, 20000);
}

// ==========================================
// 📸 Photo Capture System
// ==========================================
let selfieCameraStream = null;
let capturedPhotoData = null;

function showPhotoCapture() {
    // Hide celebration overlay
    const celebrationOverlay = document.getElementById('celebrationOverlay');
    if (celebrationOverlay) {
        celebrationOverlay.style.opacity = '0';
        celebrationOverlay.style.transition = 'opacity 1s ease';
        setTimeout(() => celebrationOverlay.remove(), 1000);
    }
    // Stop celebration hearts
    if (state.celebrationInterval) clearInterval(state.celebrationInterval);

    // Show photo overlay
    setTimeout(() => {
        const photoOverlay = document.getElementById('photoOverlay');
        photoOverlay.classList.remove('hidden');

        // Create sparkles
        createPhotoSparkles();

        // Start selfie camera
        startSelfieCamera();

        // Set up buttons
        setupPhotoButtons();
    }, 1000);
}

function createPhotoSparkles() {
    const container = document.getElementById('photoSparklesBg');
    for (let i = 0; i < 40; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'ring-sparkle';
        sparkle.style.left = Math.random() * 100 + '%';
        sparkle.style.top = Math.random() * 100 + '%';
        sparkle.style.setProperty('--dur', (2 + Math.random() * 4) + 's');
        sparkle.style.setProperty('--op', (0.2 + Math.random() * 0.5).toFixed(2));
        sparkle.style.animationDelay = Math.random() * 5 + 's';
        sparkle.style.width = (2 + Math.random() * 3) + 'px';
        sparkle.style.height = sparkle.style.width;
        container.appendChild(sparkle);
    }
}

async function startSelfieCamera() {
    const selfieVideo = document.getElementById('selfieCamera');
    try {
        selfieCameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 640, height: 640 }
        });
        selfieVideo.srcObject = selfieCameraStream;
        await selfieVideo.play();
    } catch (err) {
        console.warn('Selfie camera not available:', err);
        // Show only upload option
        const snapBtn = document.getElementById('snapBtn');
        snapBtn.style.display = 'none';
    }
}

function setupPhotoButtons() {
    const snapBtn = document.getElementById('snapBtn');
    const fileInput = document.getElementById('fileInput');
    const confirmBtn = document.getElementById('confirmPhotoBtn');
    const retakeBtn = document.getElementById('retakeBtn');
    const previewImage = document.getElementById('previewImage');
    const selfieVideo = document.getElementById('selfieCamera');
    const photoButtonsDiv = document.querySelector('.photo-buttons');

    // Snap button
    snapBtn.addEventListener('click', () => {
        const selfieCanvas = document.getElementById('selfieCanvas');
        selfieCanvas.width = selfieVideo.videoWidth || 640;
        selfieCanvas.height = selfieVideo.videoHeight || 640;
        const sCtx = selfieCanvas.getContext('2d');

        // Mirror the image
        sCtx.translate(selfieCanvas.width, 0);
        sCtx.scale(-1, 1);
        sCtx.drawImage(selfieVideo, 0, 0);

        capturedPhotoData = selfieCanvas.toDataURL('image/jpeg', 0.9);
        previewImage.src = capturedPhotoData;
        previewImage.classList.remove('hidden');
        selfieVideo.style.display = 'none';

        // Show confirm/retake, hide snap/upload
        photoButtonsDiv.style.display = 'none';
        confirmBtn.classList.remove('hidden');
        retakeBtn.classList.remove('hidden');
    });

    // File upload
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            capturedPhotoData = ev.target.result;
            previewImage.src = capturedPhotoData;
            previewImage.classList.remove('hidden');
            selfieVideo.style.display = 'none';

            photoButtonsDiv.style.display = 'none';
            confirmBtn.classList.remove('hidden');
            retakeBtn.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    });

    // Retake
    retakeBtn.addEventListener('click', () => {
        previewImage.classList.add('hidden');
        selfieVideo.style.display = 'block';
        photoButtonsDiv.style.display = 'flex';
        confirmBtn.classList.add('hidden');
        retakeBtn.classList.add('hidden');
        capturedPhotoData = null;
    });

    // Confirm
    confirmBtn.addEventListener('click', () => {
        if (!capturedPhotoData) return;

        // Stop selfie camera
        if (selfieCameraStream) {
            selfieCameraStream.getTracks().forEach(t => t.stop());
        }

        showHeartPhotoDisplay(capturedPhotoData);
    });
}

// ==========================================
// 💖 Heart Photo Display with Orbiting Hearts
// ==========================================
function showHeartPhotoDisplay(photoSrc) {
    // Hide photo overlay
    const photoOverlay = document.getElementById('photoOverlay');
    photoOverlay.classList.add('hidden');

    setTimeout(() => {
        // Show heart photo overlay
        const heartPhotoOverlay = document.getElementById('heartPhotoOverlay');
        heartPhotoOverlay.classList.remove('hidden');

        // Set photo
        const img = document.getElementById('heartPhotoImg');
        img.src = photoSrc;

        // Create background sparkles
        createHeartPhotoSparkles();

        // Create orbiting hearts
        createOrbitingHearts();

        // Restart heartbeat sound
        restartHeartbeat();
    }, 1200);
}

function createHeartPhotoSparkles() {
    const container = document.getElementById('heartPhotoBgSparkles');
    for (let i = 0; i < 60; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'ring-sparkle';
        sparkle.style.left = Math.random() * 100 + '%';
        sparkle.style.top = Math.random() * 100 + '%';
        sparkle.style.setProperty('--dur', (2 + Math.random() * 5) + 's');
        sparkle.style.setProperty('--op', (0.3 + Math.random() * 0.7).toFixed(2));
        sparkle.style.animationDelay = Math.random() * 5 + 's';
        sparkle.style.width = (2 + Math.random() * 3) + 'px';
        sparkle.style.height = sparkle.style.width;
        container.appendChild(sparkle);
    }
}

function createOrbitingHearts() {
    const container = document.getElementById('orbitingHearts');
    const heartEmojis = ['💖', '💕', '❤️', '💗', '💝', '🩷', '💘'];
    const heartCount = 12;

    for (let i = 0; i < heartCount; i++) {
        const heart = document.createElement('div');
        heart.className = 'orbiting-heart';
        heart.textContent = heartEmojis[i % heartEmojis.length];

        const angle = (i / heartCount) * 360;
        const radius = 180 + Math.random() * 40;
        const duration = 6 + Math.random() * 4;
        const fontSize = 1 + Math.random() * 1.2;

        heart.style.setProperty('--start-angle', angle + 'deg');
        heart.style.setProperty('--orbit-radius', radius + 'px');
        heart.style.setProperty('--orbit-duration', duration + 's');
        heart.style.fontSize = fontSize + 'rem';
        heart.style.animationDelay = (i * 0.3) + 's';

        container.appendChild(heart);
    }

    // Second ring - smaller, faster, opposite direction
    for (let i = 0; i < 8; i++) {
        const heart = document.createElement('div');
        heart.className = 'orbiting-heart';
        heart.textContent = heartEmojis[i % heartEmojis.length];

        const angle = (i / 8) * 360 + 22.5;
        const radius = 130 + Math.random() * 20;
        const duration = 4 + Math.random() * 3;

        heart.style.setProperty('--start-angle', angle + 'deg');
        heart.style.setProperty('--orbit-radius', radius + 'px');
        heart.style.setProperty('--orbit-duration', duration + 's');
        heart.style.fontSize = '0.9rem';
        heart.style.animationDirection = 'reverse';
        heart.style.opacity = '0.7';

        container.appendChild(heart);
    }
}

function restartHeartbeat() {
    // Create heartbeat sound again for this phase
    if (state.audioCtx) {
        startHeartbeatLoop();
    } else {
        createHeartbeatSound();
    }
}

// ==========================================
// Animation Loop
// ==========================================
function animate(time) {
    update(time);
    draw();
    requestAnimationFrame(animate);
}

// ==========================================
// Init
// ==========================================
function init() {
    console.log('💖 Valentine Heart for Bé Lợn - Starting...');
    setupCamera();
    requestAnimationFrame(animate);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
