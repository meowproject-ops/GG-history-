import * as THREE from "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js";

let particles, geometry, material;

export function initParticles(scene) {
  geometry = new THREE.BufferGeometry();

  const positions = new Float32Array(1000 * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  material = new THREE.PointsMaterial({
    size: 0.02
  });

  particles = new THREE.Points(geometry, material);
  scene.add(particles);
}

export function updateParticles(landmarks) {
  if (!landmarks) return;

  const UPPER = [11,12,13,14,15,16];

  let positions = geometry.attributes.position.array;
  let index = 0;

  UPPER.forEach(i => {
    const lm = landmarks[i];

    for (let j = 0; j < 20; j++) {
      positions[index++] = (lm.x - 0.5) * 2;
      positions[index++] = -(lm.y - 0.5) * 2;
      positions[index++] = -lm.z;
    }
  });

  geometry.attributes.position.needsUpdate = true;
}
