import { initPose } from './pose.js';
import { initParticles, updateParticles } from './particles.js';
import * as THREE from "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js";

// Scene
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.z = 2;

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("three-canvas"),
  alpha: true
});

renderer.setSize(window.innerWidth, window.innerHeight);

// Init particles
initParticles(scene);

// Pose callback
function onResults(results) {
  if (results.poseLandmarks) {
    updateParticles(results.poseLandmarks);
  }
}

// Start MediaPipe
initPose(onResults);

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
