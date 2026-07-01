const THREAD_COLORS = {
  structure: '#ffffff',
  energy: '#3aa0ff',
  gravity: '#ffcc33',
  ghost: 'rgba(255,255,255,0.4)',
};

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

let gestureEl = null;
let threadCountEl = null;
let skeletonCanvas = null;
let skeletonCtx = null;
let flashTimeout = null;
let lastCount = -1;

export function initHud() {
  gestureEl = document.getElementById('gesture-indicator');
  threadCountEl = document.getElementById('thread-count');
  skeletonCanvas = document.getElementById('skeleton-canvas');
  skeletonCtx = skeletonCanvas.getContext('2d');
  _resizeSkeleton();
  window.addEventListener('resize', _resizeSkeleton);
}

function _resizeSkeleton() {
  skeletonCanvas.width = window.innerWidth;
  skeletonCanvas.height = window.innerHeight;
}

export function setGestureHint(type, state) {
  if (!gestureEl) return;
  if (state === 'growing') {
    const color = THREAD_COLORS[type] || '#fff';
    gestureEl.style.color = color;
    gestureEl.textContent = `● ${type} thread forming…`;
    gestureEl.style.opacity = '0.6';
    clearTimeout(flashTimeout);
  } else if (state === 'confirmed') {
    const color = THREAD_COLORS[type] || '#fff';
    gestureEl.style.color = color;
    gestureEl.textContent = `✦ ${type.toUpperCase()} THREAD`;
    gestureEl.style.opacity = '1';
    clearTimeout(flashTimeout);
    flashTimeout = setTimeout(() => {
      if (gestureEl) gestureEl.style.opacity = '0';
    }, 600);
  } else if (state === 'crush') {
    gestureEl.style.color = '#ff6633';
    gestureEl.textContent = '✦ CRUSH';
    gestureEl.style.opacity = '1';
    clearTimeout(flashTimeout);
    flashTimeout = setTimeout(() => {
      if (gestureEl) gestureEl.style.opacity = '0';
    }, 400);
  } else {
    gestureEl.style.opacity = '0';
  }
}

export function updateThreadCount(count) {
  if (!threadCountEl || count === lastCount) return;
  lastCount = count;
  threadCountEl.textContent = `Threads: ${count}`;
}

export function drawSkeleton(handsResults) {
  if (!skeletonCtx) return;
  const w = skeletonCanvas.width;
  const h = skeletonCanvas.height;
  skeletonCtx.clearRect(0, 0, w, h);
  if (!handsResults || !handsResults.landmarks) return;

  for (const landmarks of handsResults.landmarks) {
    skeletonCtx.strokeStyle = 'rgba(255,255,255,0.10)';
    skeletonCtx.lineWidth = 1;
    skeletonCtx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      const ax = (1 - landmarks[a].x) * w;
      const ay = landmarks[a].y * h;
      const bx = (1 - landmarks[b].x) * w;
      const by = landmarks[b].y * h;
      skeletonCtx.moveTo(ax, ay);
      skeletonCtx.lineTo(bx, by);
    }
    skeletonCtx.stroke();

    skeletonCtx.fillStyle = 'rgba(255,255,255,0.15)';
    for (const lm of landmarks) {
      const x = (1 - lm.x) * w;
      const y = lm.y * h;
      skeletonCtx.beginPath();
      skeletonCtx.arc(x, y, 2, 0, Math.PI * 2);
      skeletonCtx.fill();
    }
  }
}
