// --- Game State & Configuration ---
const gameState = {
    score: 0,
    lives: 5,
    isGameActive: false,
    fruits: [],
    particles: [],
    lastSpawnTime: 0,
    spawnInterval: 1500,
    fingerTip: new THREE.Vector2(),
    prevFingerTip: new THREE.Vector2(),
    isHandVisible: false
};

// --- DOM Elements ---
const videoElement = document.getElementById('video');
const gameCanvas = document.getElementById('game-canvas');
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const finalScoreElement = document.getElementById('final-score');
const loadingScreen = document.getElementById('loading');

// --- Three.js Core Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: gameCanvas, alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// --- Lighting ---
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

camera.position.z = 15;

// --- Visual Pointer (The Tracker) ---
const pointerGeo = new THREE.SphereGeometry(0.4, 16, 16);
const pointerMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });
const handPointer = new THREE.Mesh(pointerGeo, pointerMat);
handPointer.visible = false; // Hide until hand is detected
scene.add(handPointer);

// --- Fruit Assets ---
const fruitGeometries = [
    new THREE.SphereGeometry(1.2, 16, 16),
    new THREE.IcosahedronGeometry(1.2, 1),
    new THREE.TorusGeometry(0.8, 0.4, 12, 24)
];
const fruitMaterials = [
    new THREE.MeshLambertMaterial({ color: 0xff0000 }), // Red
    new THREE.MeshLambertMaterial({ color: 0x00ff00 }), // Green
    new THREE.MeshLambertMaterial({ color: 0xffa500 }), // Orange
    new THREE.MeshLambertMaterial({ color: 0xffff00 })  // Yellow
];

// --- MediaPipe Hands Setup ---
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
});

hands.onResults(results => {
    if (loadingScreen.style.display !== 'none') loadingScreen.style.display = 'none';

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        gameState.isHandVisible = true;
        const indexTip = results.multiHandLandmarks[0][8];
        
        gameState.prevFingerTip.copy(gameState.fingerTip);
        
        // Map hand coordinates to screen space
        gameState.fingerTip.x = (1 - indexTip.x) * 2 - 1;
        gameState.fingerTip.y = -(indexTip.y * 2 - 1);

        // Update 3D Pointer Position
        handPointer.position.x = gameState.fingerTip.x * 14; 
        handPointer.position.y = gameState.fingerTip.y * 10;
        handPointer.position.z = 0;
        handPointer.visible = true;
    } else {
        gameState.isHandVisible = false;
        handPointer.visible = false;
    }
});

const mpCamera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({ image: videoElement }); },
    width: 640,
    height: 480
});
mpCamera.start();

// --- Slicing Logic ---
function checkSlicing() {
    if (!gameState.isHandVisible || !gameState.isGameActive) return;

    const bladePos = handPointer.position;

    gameState.fruits.forEach(fruit => {
        if (!fruit.sliced) {
            // Distance check between pointer and fruit mesh
            const dist = bladePos.distanceTo(fruit.mesh.position);

            // Hitbox size 1.8 (generous for easy cutting)
            if (dist < 1.8) { 
                sliceFruit(fruit);
            }
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
    for (let i = 0; i < 10; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshLambertMaterial({ color }));
        p.position.copy(pos);
        const vel = new THREE.Vector3((Math.random()-0.5)*12, (Math.random()-0.5)*12, (Math.random()-0.5)*12);
        gameState.particles.push({ mesh: p, velocity: vel, life: 1.0 });
        scene.add(p);
    }
}

// --- Spawn & Physics ---
function spawnFruit() {
    const mesh = new THREE.Mesh(
        fruitGeometries[Math.floor(Math.random() * fruitGeometries.length)],
        fruitMaterials[Math.floor(Math.random() * fruitMaterials.length)]
    );
    
    // Spawn at bottom with random horizontal spread
    mesh.position.set((Math.random() - 0.5) * 22, -12, 0);
    
    // Higher Jump Velocity
    const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 6, 
        25 + Math.random() * 6, 
        0
    );
    
    gameState.fruits.push({ mesh, velocity, sliced: false });
    scene.add(mesh);
}

function update(dt) {
    // Update Fruits
    for (let i = gameState.fruits.length - 1; i >= 0; i--) {
        const f = gameState.fruits[i];
        
        // Reduced Gravity for longer air time
        f.velocity.y -= 13 * dt; 
        
        f.mesh.position.addScaledVector(f.velocity, dt);
        f.mesh.rotation.x += 0.03;
        f.mesh.rotation.z += 0.03;

        // Missed fruit cleanup
        if (f.mesh.position.y < -15) {
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
        p.mesh.material.transparent = true;
        p.mesh.material.opacity = p.life;
        if (p.life <= 0) {
            scene.remove(p.mesh);
            gameState.particles.splice(i, 1);
        }
    }
}

// --- Core Game Loop ---
function gameLoop(time) {
    if (!gameState.isGameActive) return;
    
    const dt = 0.016; 

    if (time - gameState.lastSpawnTime > gameState.spawnInterval) {
        spawnFruit();
        gameState.lastSpawnTime = time;
        // Increase difficulty over time
        gameState.spawnInterval = Math.max(500, gameState.spawnInterval * 0.98);
    }

    checkSlicing();
    update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(gameLoop);
}

// --- Start / Stop ---
function startGame() {
    gameState.score = 0;
    gameState.lives = 5;
    gameState.spawnInterval = 1500;
    gameState.fruits.forEach(f => scene.remove(f.mesh));
    gameState.particles.forEach(p => scene.remove(p.mesh));
    gameState.fruits = [];
    gameState.particles = [];
    
    gameState.isGameActive = true;
    scoreElement.textContent = "0";
    livesElement.textContent = "5";
    
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    requestAnimationFrame(gameLoop);
}

function endGame() {
    gameState.isGameActive = false;
    gameOverScreen.style.display = 'flex';
    finalScoreElement.textContent = gameState.score;
}

// --- Event Listeners ---
document.getElementById('start-button').onclick = startGame;
document.getElementById('restart-button').onclick = startGame;

window.onresize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};
