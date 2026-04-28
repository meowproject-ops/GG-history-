const videoElement = document.getElementById('video');
const loadingScreen = document.getElementById('loading');
const startButton = document.getElementById('start-button');
const startScreen = document.getElementById('start-screen');

// 1. Initialize MediaPipe Hands
const hands = new Hands({
    locateFile: (file) => {
        // This directs the browser to the CDN for the heavy model files
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// 2. Handle Hand Results
hands.onResults((results) => {
    // Hide loading screen once first results come in
    if (loadingScreen.style.display !== 'none') {
        loadingScreen.style.display = 'none';
    }
    
    // Logic for slicing goes here (using results.multiHandLandmarks)
    console.log("Hand tracked");
});

// 3. Initialize Camera
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480
});

// 4. Start Button Logic
startButton.addEventListener('click', () => {
    startScreen.style.display = 'none';
    loadingScreen.style.display = 'block'; // Show loading while camera/AI starts
    
    camera.start().catch(err => {
        alert("Camera error: Please ensure you have granted permission.");
        console.error(err);
    });
});

// Simple Three.js Setup (Place-holder for your actual game logic)
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, new THREE.Camera());
}
animate();
