console.log("SCRIPT LOADED");

let words = [];

document.getElementById("historyBtn").onclick = () => {
  console.log("CLICK HISTORY");
  window.postMessage({ type: "GET_HISTORY" }, "*");
};

document.getElementById("cameraBtn").onclick = () => {
  console.log("CLICK CAMERA");
  startCamera();
};

window.addEventListener("message", (event) => {
  console.log("RECEIVED:", event.data);

  if (event.data.type === "HISTORY_DATA") {
    const data = event.data.data;

    const text = data.map(d => d.title).join(" ");
    const tokens = text.toLowerCase().split(/\W+/);

    const freq = {};
    tokens.forEach(w => {
      if (w.length > 3) {
        freq[w] = (freq[w] || 0) + 1;
      }
    });

    words = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([word, count]) => ({
        word,
        size: Math.min(40, 10 + count)
      }));

    console.log("WORDS READY:", words.length);
  }
});

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

async function startCamera() {
  console.log("START CAMERA");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
  } catch (e) {
    console.error("CAMERA ERROR:", e);
    return;
  }

  const faceMesh = new FaceMesh({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true
  });

  faceMesh.onResults(draw);

  const camera = new Camera(video, {
    onFrame: async () => {
      await faceMesh.send({ image: video });
    },
    width: 640,
    height: 480
  });

  camera.start();
}

function draw(results) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!results.multiFaceLandmarks || words.length === 0) return;

  const landmarks = results.multiFaceLandmarks[0];

  let minX = 1, minY = 1, maxX = 0, maxY = 0;

  landmarks.forEach(p => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });

  const x = minX * canvas.width;
  const y = minY * canvas.height;
  const w = (maxX - minX) * canvas.width;
  const h = (maxY - minY) * canvas.height;

  words.forEach(wd => {
    ctx.font = `${wd.size}px Arial`;
    ctx.fillStyle = "white";

    const wx = x + Math.random() * w;
    const wy = y + Math.random() * h;

    ctx.fillText(wd.word, wx, wy);
  });
}
