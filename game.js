// Game State & Configuration
const gameState = {
    score: 0,
    lives: 5,
    isGameActive: false,
    fruits: [],
    particles: [],
    fruitPool: [], // Object pooling for performance
    lastSpawnTime: 0,
    spawnInterval: 1500,
    prevFingerTip: new THREE.Vector2(),
    fingerTip: new THREE.Vector2(),
    isHandVisible: false
};

// DOM Elements
const videoElement = document.getElementById('video');
const gameCanvas = document.getElementById('game-canvas');
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const finalScoreElement = document.getElementById('final-score');
const loadingScreen = document.getElementById('loading');

// Three.js Core Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: gameCanvas, alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Raycaster for advanced precision slicing
const raycaster = new THREE.Raycaster();

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7);
scene.add(light);

camera.position.z = 15;

// Assets
const fruitGeometries = [
    new THREE.SphereGeometry(1, 16, 16),
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.TorusGeometry(0.7, 0.3, 12, 24)
];
const fruitMaterials = [
    new THREE.MeshLambertMaterial({ color: 0xff0000 }), // Red
    new THREE.MeshLambertMaterial({ color: 0x00ff00 }), // Green
    new THREE.MeshLambertMaterial({ color: 0xffa500 }), // Orange
    new THREE.MeshLambertMaterial({ color: 0xffff00 })  // Yellow
];

// Initialize MediaPipe Hands
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});

hands.onResults(results => {
    if (loadingScreen.style.display !== 'none') loadingScreen.style.display = 'none';

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        gameState.isHandVisible = true;
        const indexTip = results.multiHandLandmarks[0][8];
        
        gameState.prevFingerTip.copy(gameState.fingerTip);
        // Map normalized coordinates (0 to 1) to Screen Space (-1 to 1)
        gameState.fingerTip.x = (1 - indexTip.x) * 2 - 1;
        gameState.fingerTip.y = -(indexTip.y * 2 - 1);
    } else {
        gameState.isHandVisible = false;
    }
});

const mpCamera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({ image: videoElement }); },
    width: 640,
    height: 480
});
mpCamera.start();

// Slicing Logic via Raycasting
function checkSlicing() {
    if (!gameState.isHandVisible || !gameState.isGameActive) return;

    // Check speed of hand movement
    const movement = gameState.fingerTip.distanceTo(gameState.prevFingerTip);
    if (movement < 0.02) return;

    // Cast ray from camera through finger position
    raycaster.setFromCamera(gameState.fingerTip, camera);
    const intersects = raycaster.intersectObjects(gameState.fruits.map(f => f.mesh));

    intersects.forEach(hit => {
        const fruitObj = gameState.fruits.find(f => f.mesh === hit.object);
        if (fruitObj && !fruitObj.sliced) {
            sliceFruit(fruitObj);
        }
    });
}

function sliceFruit(fruit) {
    fruit.sliced = true;
    gameState.score++;
    scoreElement.textContent = gameState.score;
    
    createExplosion(fruit.mesh.position, fruit.mesh.material.color);
    scene.remove(fruit.mesh);
}

function createExplosion(pos, color) {
    for (let i = 0; i < 8; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshLambertMaterial({ color }));
        p.position.copy(pos);
        const vel = new THREE.Vector3((Math.random()-0.5)*10, (Math.random()-0.5)*10, (Math.random()-0.5)*10);
        gameState.particles.push({ mesh: p, velocity: vel, life: 1.0 });
        scene.add(p);
    }
}

function spawnFruit() {
    const mesh = new THREE.Mesh(
        fruitGeometries[Math.floor(Math.random() * fruitGeometries.length)],
        fruitMaterials[Math.floor(Math.random() * fruitMaterials.length)]
    );
    
    mesh.position.set((Math.random() - 0.5) * 20, -10, 0);
    const velocity = new THREE.Vector3((Math.random() - 0.5) * 5, 15 + Math.random() * 5, 0);
    
    gameState.fruits.push({ mesh, velocity, sliced: false });
    scene.add(mesh);
}

function update(dt) {
    // Update Fruits
    for (let i = gameState.fruits.length - 1; i >= 0; i--) {
        const f = gameState.fruits[i];
        f.velocity.y -= 20 * dt; // Gravity
        f.mesh.position.addScaledVector(f.velocity, dt);
        f.mesh.rotation.x += 0.02;

        if (f.mesh.position.y < -12) {
            if (!f.sliced) {
                gameState.lives--;
                livesElement.textContent = gameState.lives;
                if (gameState.lives <= 0) endGame();
            }
            scene.remove(f.mesh);
            gameState.fruits.splice(i, 1);
        }
    }

    // Update Particles
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
        const p = gameState.particles[i];
        p.life -= dt;
        p.mesh.position.addScaledVector(p.velocity, dt);
        p.mesh.material.opacity = p.life;
        if (p.life <= 0) {
            scene.remove(p.mesh);
            gameState.particles.splice(i, 1);
        }
    }
}

function gameLoop(time) {
    if (!gameState.isGameActive) return;
    const dt = 0.016; // Approx 60fps

    if (time - gameState.lastSpawnTime > gameState.spawnInterval) {
        spawnFruit();
        gameState.lastSpawnTime = time;
        gameState.spawnInterval = Math.max(600, gameState.spawnInterval * 0.99);
    }

    checkSlicing();
    update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(gameLoop);
}

function startGame() {
    gameState.score = 0;
    gameState.lives = 5;
    gameState.fruits.forEach(f => scene.remove(f.mesh));
    gameState.fruits = [];
    gameState.isGameActive = true;
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    requestAnimationFrame(gameLoop);
}

function endGame() {
    gameState.isGameActive = false;
    gameOverScreen.style.display = 'flex';
    finalScoreElement.textContent = gameState.score;
}

document.getElementById('start-button').onclick = startGame;
document.getElementById('restart-button').onclick = startGame;

window.onresize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};
