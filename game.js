// Game state
const gameState = {
    score: 0,
    lives: 5,
    isGameActive: false,
    fruits: [],
    particles: [],
    lastFrameTime: 0,
    spawnInterval: 1500,
    lastSpawnTime: 0,
    handLandmarks: null,
    fingerTip: { x: 0, y: 0, z: 0 },
    prevFingerTip: { x: 0, y: 0, z: 0 },
    bladeTrails: [],
    defaultSpawnInterval: 1500,
    defaultLives: 5,
    desktopSpawnRange: 24,
    mobileSpawnRange: 14,
    frameCount: 0,
};

// DOM elements
const videoElement = document.getElementById('video');
const gameCanvas = document.getElementById('game-canvas');
const handCanvas = document.getElementById('hand-canvas');
const handCtx = handCanvas.getContext('2d');
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-button');
const gameOverScreen = document.getElementById('game-over');
const restartButton = document.getElementById('restart-button');
const finalScoreElement = document.getElementById('final-score');
const loadingScreen = document.getElementById('loading');

// Three.js setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, (window.innerWidth * 0.5) / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: gameCanvas, alpha: true, antialias: true });

function isMobileDevice() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Adjust renderer for performance
const pixelRatio = isMobileDevice() ? Math.min(window.devicePixelRatio, 1) : Math.min(window.devicePixelRatio, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth * 0.5, window.innerHeight);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

camera.position.z = 20;

// Fruit Geometries & Materials
const fruitGeometries = [
    new THREE.SphereGeometry(1.8, 16, 16),
    new THREE.SphereGeometry(1.6, 16, 16),
    new THREE.SphereGeometry(2.0, 16, 16),
    new THREE.TorusGeometry(1.2, 0.5, 12, 24),
    new THREE.ConeGeometry(1.2, 2.2, 16)
];

const fruitMaterials = [
    new THREE.MeshLambertMaterial({ color: 0xff0000 }), // Red
    new THREE.MeshLambertMaterial({ color: 0xff7f00 }), // Orange
    new THREE.MeshLambertMaterial({ color: 0x00cc00 }), // Green
    new THREE.MeshLambertMaterial({ color: 0x9900ff }), // Purple
    new THREE.MeshLambertMaterial({ color: 0xff6699 })  // Pink
];

// MediaPipe Setup
let hands;
async function setupHandTracking() {
    // Set Canvas dimensions to match CSS/Video
    handCanvas.width = window.innerWidth * 0.5;
    handCanvas.height = window.innerHeight;

    hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
    });

    hands.onResults(onHandResults);

    const cameraUtils = new Camera(videoElement, {
        onFrame: async () => { await hands.send({image: videoElement}); },
        width: isMobileDevice() ? 320 : 640,
        height: isMobileDevice() ? 180 : 360,
    });
    
    await cameraUtils.start();
    loadingScreen.style.display = 'none';
}

function onHandResults(results) {
    handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        gameState.handLandmarks = results.multiHandLandmarks[0];
        drawHandLandmarks(gameState.handLandmarks);

        gameState.prevFingerTip = { ...gameState.fingerTip };
        const indexTip = gameState.handLandmarks[8];
        gameState.fingerTip = { x: 1 - indexTip.x, y: indexTip.y };

        if (gameState.isGameActive) {
            const speed = calculateHandSpeed();
            if (speed > 0.02) {
                createBladeTrail(
                    gameState.fingerTip.x * handCanvas.width,
                    gameState.fingerTip.y * handCanvas.height,
                    gameState.prevFingerTip.x * handCanvas.width,
                    gameState.prevFingerTip.y * handCanvas.height
                );
            }
        }
    } else {
        gameState.handLandmarks = null;
    }
}

function drawHandLandmarks(landmarks) {
    handCtx.fillStyle = 'rgba(57, 255, 20, 0.8)';
    for (const landmark of landmarks) {
        const x = (1 - landmark.x) * handCanvas.width;
        const y = landmark.y * handCanvas.height;
        handCtx.beginPath();
        handCtx.arc(x, y, 4, 0, 2 * Math.PI);
        handCtx.fill();
    }
}

function createBladeTrail(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const trail = document.createElement('div');
    trail.className = 'blade-trail';
    trail.style.width = `${length}px`;
    trail.style.left = `${x1}px`; 
    trail.style.top = `${y1}px`;
    trail.style.transform = `rotate(${angle}rad)`;
    trail.style.backgroundColor = '#fff';
    trail.style.boxShadow = `0 0 10px #39ff14`;

    document.getElementById('game-container').appendChild(trail);
    gameState.bladeTrails.push({ element: trail, timestamp: Date.now() });
}

function updateBladeTrails() {
    const now = Date.now();
    gameState.bladeTrails = gameState.bladeTrails.filter(trail => {
        const age = now - trail.timestamp;
        if (age > 300) {
            trail.element.remove();
            return false;
        }
        trail.element.style.opacity = 1 - (age / 300);
        return true;
    });
}

function spawnFruit() {
    const idx = Math.floor(Math.random() * fruitGeometries.length);
    const mesh = new THREE.Mesh(fruitGeometries[idx], fruitMaterials[idx].clone());
    
    const range = isMobileDevice() ? gameState.mobileSpawnRange : gameState.desktopSpawnRange;
    mesh.position.set((Math.random() * range) - (range / 2), -12, 0);

    const fruitObj = {
        mesh: mesh,
        velocity: { x: (Math.random() - 0.5) * 10, y: 18 + Math.random() * 5 },
        rotation: { x: Math.random() * 0.1, y: Math.random() * 0.1 },
        sliced: false
    };

    gameState.fruits.push(fruitObj);
    scene.add(mesh);
}

function updateObjects(dt) {
    gameState.fruits = gameState.fruits.filter(fruit => {
        fruit.velocity.y -= 25 * dt; // Gravity
        fruit.mesh.position.x += fruit.velocity.x * dt;
        fruit.mesh.position.y += fruit.velocity.y * dt;
        fruit.mesh.rotation.x += fruit.rotation.x;
        fruit.mesh.rotation.y += fruit.rotation.y;

        if (fruit.mesh.position.y < -15) {
            if (!fruit.sliced) {
                gameState.lives--;
                livesElement.textContent = gameState.lives;
                if (gameState.lives <= 0) endGame();
            }
            scene.remove(fruit.mesh);
            return false;
        }
        return true;
    });
}

function checkCollisions() {
    if (!gameState.handLandmarks) return;
    
    // Map hand coordinates (0 to 1) to Three.js world coordinates
    const fingerX = (gameState.fingerTip.x * 40) - 20;
    const fingerY = (0.5 - gameState.fingerTip.y) * 30;

    gameState.fruits.forEach(fruit => {
        if (!fruit.sliced) {
            const dist = fruit.mesh.position.distanceTo(new THREE.Vector3(fingerX, fingerY, 0));
            if (dist < 3.5 && calculateHandSpeed() > 0.03) {
                fruit.sliced = true;
                gameState.score++;
                scoreElement.textContent = gameState.score;
                createExplosion(fruit.mesh.position, fruit.mesh.material.color);
                scene.remove(fruit.mesh);
            }
        }
    });
}

function createExplosion(pos, color) {
    for (let i = 0; i < 8; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.4), new THREE.MeshBasicMaterial({ color }));
        p.position.copy(pos);
        const part = {
            mesh: p,
            vel: new THREE.Vector3((Math.random()-0.5)*20, (Math.random()-0.5)*20, (Math.random()-0.5)*10),
            life: 1.0
        };
        scene.add(p);
        gameState.particles.push(part);
    }
}

function updateParticles(dt) {
    gameState.particles = gameState.particles.filter(p => {
        p.life -= dt * 2;
        p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
        p.mesh.scale.setScalar(p.life);
        if (p.life <= 0) {
            scene.remove(p.mesh);
            return false;
        }
        return true;
    });
}

function calculateHandSpeed() {
    return Math.hypot(gameState.fingerTip.x - gameState.prevFingerTip.x, gameState.fingerTip.y - gameState.prevFingerTip.y);
}

function gameLoop(timestamp) {
    if (!gameState.isGameActive) return;
    const dt = Math.min((timestamp - gameState.lastFrameTime) / 1000, 0.1);
    gameState.lastFrameTime = timestamp;

    if (timestamp - gameState.lastSpawnTime > gameState.spawnInterval) {
        spawnFruit();
        gameState.lastSpawnTime = timestamp;
        gameState.spawnInterval = Math.max(600, gameState.spawnInterval * 0.98);
    }

    updateObjects(dt);
    updateParticles(dt);
    checkCollisions();
    updateBladeTrails();
    renderer.render(scene, camera);
    requestAnimationFrame(gameLoop);
}

function startGame() {
    gameState.score = 0;
    gameState.lives = 5;
    gameState.isGameActive = true;
    gameState.spawnInterval = 1500;
    gameState.fruits.forEach(f => scene.remove(f.mesh));
    gameState.fruits = [];
    scoreElement.textContent = "0";
    livesElement.textContent = "5";
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    gameState.lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function endGame() {
    gameState.isGameActive = false;
    gameOverScreen.style.display = 'flex';
    finalScoreElement.textContent = gameState.score;
}

// Listeners
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth * 0.5, window.innerHeight);
    camera.aspect = (window.innerWidth * 0.5) / window.innerHeight;
    camera.updateProjectionMatrix();
});

// Init
setupHandTracking();
        
