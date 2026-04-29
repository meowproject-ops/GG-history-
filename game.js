// --- Responsive Game State ---
const gameState = {
    score: 0,
    lives: 5,
    isGameActive: false,
    fruits: [],
    particles: [],
    lastSpawnTime: 0,
    spawnInterval: 1500,
    fingerTip: new THREE.Vector2(),
    isHandVisible: false,
    // Screen boundaries in 3D units
    viewBounds: { x: 0, y: 0 }
};

const videoElement = document.getElementById('video');
const gameCanvas = document.getElementById('game-canvas');
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const finalScoreElement = document.getElementById('final-score');
const loadingScreen = document.getElementById('loading');

// --- Three.js Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: gameCanvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// --- Lighting ---
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

camera.position.z = 15;

// --- Visual Pointer ---
const pointerGeo = new THREE.SphereGeometry(0.4, 16, 16);
const pointerMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });
const handPointer = new THREE.Mesh(pointerGeo, pointerMat);
handPointer.visible = false;
scene.add(handPointer);

// --- Calculation for Responsive Boundaries ---
function updateViewBounds() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    // Calculate visible width/height at Z=0
    const vFOV = THREE.MathUtils.degToRad(camera.fov);
    const height = 2 * Math.tan(vFOV / 2) * camera.position.z;
    const width = height * camera.aspect;
    
    gameState.viewBounds.x = width / 2;
    gameState.viewBounds.y = height / 2;
}
updateViewBounds();

// --- Hand Tracking ---
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
        
        // Map normalized MP coordinates to the calculated 3D view bounds
        gameState.fingerTip.x = (1 - indexTip.x) * 2 - 1;
        gameState.fingerTip.y = -(indexTip.y * 2 - 1);

        handPointer.position.x = gameState.fingerTip.x * gameState.viewBounds.x;
        handPointer.position.y = gameState.fingerTip.y * gameState.viewBounds.y;
        handPointer.position.z = 0;
        handPointer.visible = true;
    } else {
        gameState.isHandVisible = false;
        handPointer.visible = false;
    }
});

const mpCamera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({ image: videoElement }); },
    width: 640, height: 480
});
mpCamera.start();

// --- Responsive Slicing & Physics ---
function spawnFruit() {
    const geo = new THREE.SphereGeometry(1, 16, 16);
    const mat = new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff });
    const mesh = new THREE.Mesh(geo, mat);
    
    // Spawn randomly along the bottom edge
    const spawnX = (Math.random() - 0.5) * (gameState.viewBounds.x * 1.5);
    mesh.position.set(spawnX, -gameState.viewBounds.y - 2, 0);
    
    // SMART VELOCITY: If spawned on left, push right. If spawned on right, push left.
    const horizontalPush = spawnX > 0 ? -Math.random() * 5 : Math.random() * 5;
    const verticalPush = 18 + Math.random() * 5; // Balanced height
    
    const velocity = new THREE.Vector3(horizontalPush, verticalPush, 0);
    
    gameState.fruits.push({ mesh, velocity, sliced: false });
    scene.add(mesh);
}

function update(dt) {
    for (let i = gameState.fruits.length - 1; i >= 0; i--) {
        const f = gameState.fruits[i];
        f.velocity.y -= 15 * dt; // Consistent gravity
        f.mesh.position.addScaledVector(f.velocity, dt);
        f.mesh.rotation.x += 0.05;

        // Dynamic cleanup based on screen height
        if (f.mesh.position.y < -gameState.viewBounds.y - 5) {
            if (!f.sliced) {
                gameState.lives--;
                livesElement.textContent = gameState.lives;
                if (gameState.lives <= 0) endGame();
            }
            scene.remove(f.mesh);
            gameState.fruits.splice(i, 1);
        }
    }
}

function checkSlicing() {
    if (!gameState.isHandVisible || !gameState.isGameActive) return;
    const bladePos = handPointer.position;

    gameState.fruits.forEach(fruit => {
        if (!fruit.sliced) {
            if (bladePos.distanceTo(fruit.mesh.position) < 1.8) {
                fruit.sliced = true;
                gameState.score++;
                scoreElement.textContent = gameState.score;
                scene.remove(fruit.mesh);
            }
        }
    });
}

function gameLoop(time) {
    if (!gameState.isGameActive) return;
    const dt = 0.016;

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
window.onresize = updateViewBounds;
            
