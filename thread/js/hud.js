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

const ORIENTATION_MS  = 2000;
const FADE_DURATION   = 800;
const OPACITY_HOLD    = 0.85;
const OPACITY_END     = 0.70; // hand always clearly visible

let gestureEl = null;
let threadCountEl = null;
let hand0dot = null;
let hand1dot = null;
let skeletonCanvas = null;
let skeletonCtx = null;
let flashTimeout = null;
let lastCount = -1;

// per-hand first-seen timestamp for fade
const handFirstSeen = [null, null];

export function initHud() {
  gestureEl = document.getElementById('gesture-indicator');
  threadCountEl = document.getElementById('thread-count');
  skeletonCanvas = document.getElementById('skeleton-canvas');
  skeletonCtx = skeletonCanvas.getContext('2d');

  // inject hand indicator dots into the HUD
  const hud = document.getElementById('hud');
  const indicators = document.createElement('div');
  indicators.id = 'hand-indicators';
  indicators.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;';
  hand0dot = _makeDot();
  hand1dot = _makeDot();
  indicators.appendChild(hand0dot);
  indicators.appendChild(hand1dot);
  hud.insertBefore(indicators, hud.firstChild);

  _resizeSkeleton();
  window.addEventListener('resize', _resizeSkeleton);
}

function _makeDot() {
  const d = document.createElement('div');
  d.style.cssText = `
    width:8px;height:8px;border-radius:50%;
    background:rgba(255,255,255,0.15);
    transition:background 0.3s,box-shadow 0.3s;
  `;
  return d;
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
  } else if (state === 'rotate') {
    gestureEl.style.color = '#cc88ff';
    gestureEl.textContent = '↻ ROTATE';
    gestureEl.style.opacity = '1';
    clearTimeout(flashTimeout);
    flashTimeout = setTimeout(() => {
      if (gestureEl) gestureEl.style.opacity = '0';
    }, 500);
  } else {
    gestureEl.style.opacity = '0';
  }
}

export function updateThreadCount(count) {
  if (!threadCountEl || count === lastCount) return;
  lastCount = count;
  threadCountEl.textContent = `Threads: ${count}`;
}

const HAND_OUTLINE   = [0, 1, 2, 3, 4, 8, 12, 16, 20, 19, 18, 17];
const FINGERTIPS     = [4, 8, 12, 16, 20];
const SPARKLE_LMS    = [0, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15, 17, 18, 19];

function _drawSparkle(ctx, x, y, size, alpha) {
  const rg = ctx.createRadialGradient(x, y, 0, x, y, size);
  rg.addColorStop(0,   `rgba(255,220,100,${alpha})`);
  rg.addColorStop(0.5, `rgba(255,180,50,${alpha * 0.4})`);
  rg.addColorStop(1,   `rgba(255,160,30,0)`);
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  // bright white core
  ctx.fillStyle = `rgba(255,255,220,${alpha * 0.95})`;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.18, 0, Math.PI * 2);
  ctx.fill();
  // cross flare
  ctx.strokeStyle = `rgba(255,240,160,${alpha * 0.5})`;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x - size * 1.4, y); ctx.lineTo(x + size * 1.4, y);
  ctx.moveTo(x, y - size * 1.4); ctx.lineTo(x, y + size * 1.4);
  ctx.stroke();
}

function _drawHand(ctx, landmarks, alpha, w, h) {
  const X = lm => (1 - lm.x) * w;
  const Y = lm => lm.y * h;

  // scale finger width to actual hand size on screen
  const wrist = landmarks[0], mcp9 = landmarks[9];
  const dx = X(mcp9) - X(wrist), dy = Y(mcp9) - Y(wrist);
  const handLen = Math.sqrt(dx * dx + dy * dy);
  const fw = Math.max(8, handLen * 0.14); // finger tube width

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const _strokeBones = (lw, color) => {
    ctx.beginPath();
    ctx.lineWidth = lw;
    ctx.strokeStyle = color;
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.moveTo(X(landmarks[a]), Y(landmarks[a]));
      ctx.lineTo(X(landmarks[b]), Y(landmarks[b]));
    }
    ctx.stroke();
  };

  // 4-pass rendering: outer glow → body → mid highlight → bright edge
  _strokeBones(fw * 2.8, `rgba(255,230,150,${alpha * 0.05})`);
  _strokeBones(fw * 1.8, `rgba(255,245,220,${alpha * 0.30})`);
  _strokeBones(fw * 0.9, `rgba(255,252,238,${alpha * 0.50})`);
  _strokeBones(fw * 0.15, `rgba(255,255,255,${alpha * 0.85})`);

  // palm fill
  ctx.beginPath();
  [0, 5, 9, 13, 17].forEach((i, idx) => {
    idx === 0 ? ctx.moveTo(X(landmarks[i]), Y(landmarks[i]))
              : ctx.lineTo(X(landmarks[i]), Y(landmarks[i]));
  });
  ctx.closePath();
  ctx.fillStyle = `rgba(255,240,210,${alpha * 0.18})`;
  ctx.fill();

  // palm center warm glow
  const palmX = X(mcp9), palmY = Y(mcp9);
  const pg = ctx.createRadialGradient(palmX, palmY, 0, palmX, palmY, handLen * 0.5);
  pg.addColorStop(0, `rgba(255,200,80,${alpha * 0.12})`);
  pg.addColorStop(1, `rgba(255,200,80,0)`);
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.arc(palmX, palmY, handLen * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // golden fingertip glow
  for (const ti of FINGERTIPS) {
    const x = X(landmarks[ti]), y = Y(landmarks[ti]);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, fw * 1.2);
    rg.addColorStop(0, `rgba(255,220,100,${alpha * 0.95})`);
    rg.addColorStop(1, `rgba(255,180,40,0)`);
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, y, fw * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // scattered sparkles
  const now = performance.now();
  for (let si = 0; si < SPARKLE_LMS.length; si++) {
    const lm = landmarks[SPARKLE_LMS[si]];
    const flicker = 0.4 + 0.6 * Math.abs(Math.sin(now * 0.0025 + si * 1.9));
    _drawSparkle(ctx, X(lm), Y(lm), fw * 0.25 + flicker * fw * 0.35, alpha * flicker * 0.75);
  }
}

export function drawSkeleton(handsResults, handInfos) {
  if (!skeletonCtx) return;
  const w = skeletonCanvas.width;
  const h = skeletonCanvas.height;
  skeletonCtx.clearRect(0, 0, w, h);

  const now = performance.now();

  for (let hi = 0; hi < 2; hi++) {
    const dot = hi === 0 ? hand0dot : hand1dot;
    const landmarks = handsResults && handsResults.landmarks ? handsResults.landmarks[hi] : null;
    const info = handInfos ? handInfos[hi] : null;

    if (!landmarks) {
      handFirstSeen[hi] = null;
      if (dot) {
        dot.style.background = 'rgba(255,255,255,0.15)';
        dot.style.boxShadow = 'none';
      }
      continue;
    }

    // hand indicator dot — pulse white during orientation, gold after
    if (dot) {
      const orienting = info && info.orienting;
      if (orienting) {
        dot.style.background = 'rgba(255,255,255,0.9)';
        dot.style.boxShadow = '0 0 8px 3px rgba(255,255,255,0.5)';
      } else {
        dot.style.background = '#ffcc33';
        dot.style.boxShadow = '0 0 6px 2px rgba(255,204,51,0.6)';
      }
    }

    // orientation hold then fade
    if (handFirstSeen[hi] === null) handFirstSeen[hi] = now;
    const elapsed = now - handFirstSeen[hi];
    let opacity;
    if (elapsed < ORIENTATION_MS) {
      // hold at 20% during orientation window (fade in over first 300ms)
      opacity = OPACITY_HOLD * Math.min(elapsed / 300, 1);
    } else {
      // fade from 20% to dim over FADE_DURATION
      const t = Math.min((elapsed - ORIENTATION_MS) / FADE_DURATION, 1);
      opacity = OPACITY_HOLD + (OPACITY_END - OPACITY_HOLD) * t;
    }

    _drawHand(skeletonCtx, landmarks, opacity, w, h);

    // draw progress arcs for growing gestures
    if (info && info.present) {
      const FINGERS = ['structure', 'energy', 'gravity', 'ghost'];
      for (let fi = 0; fi < 4; fi++) {
        if (info.fingerStates[fi] !== 'growing') continue;
        const ratio = info.ratios[fi];
        const armT = info.armThresholds[fi];
        const relT = info.releaseThresholds[fi];
        const progress = Math.max(0, Math.min(1, (ratio - relT) / (armT - relT)));
        if (progress <= 0) continue;

        const tx = (1 - info.thumbMp.x) * w;
        const ty = info.thumbMp.y * h;
        const color = THREAD_COLORS[FINGERS[fi]];

        // outer dim ring
        skeletonCtx.beginPath();
        skeletonCtx.arc(tx, ty, 14, 0, Math.PI * 2);
        skeletonCtx.strokeStyle = 'rgba(255,255,255,0.12)';
        skeletonCtx.lineWidth = 2;
        skeletonCtx.stroke();

        // progress arc (filled clockwise from top)
        skeletonCtx.beginPath();
        skeletonCtx.arc(tx, ty, 14, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        skeletonCtx.strokeStyle = color;
        skeletonCtx.lineWidth = 2.5;
        skeletonCtx.stroke();
      }
    }
  }
}
