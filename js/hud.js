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

const FINGERTIPS = [4, 8, 12, 16, 20];

// deterministic particle cloud offsets per landmark — computed once
const _LAND_PARTICLES = (() => {
  const out = [];
  for (let li = 0; li < 21; li++) {
    const isFt = FINGERTIPS.includes(li);
    const n = isFt ? 18 : 9;
    const maxR = isFt ? 13 : 7;
    const arr = [];
    for (let p = 0; p < n; p++) {
      // deterministic angle/distance via integer hashing
      const angle = (li * 41 + p * 17) * 0.613; // incommensurable with 2π
      const frac  = ((li * 23 + p * 37 + 7) % 97) / 97;
      const dist  = maxR * (0.15 + 0.85 * frac);
      const sizeF = ((li * 7  + p * 13 + 3) % 10) / 10; // 0..1
      const alphaF = ((li * 3  + p *  7 + 1) % 60) / 100; // 0..0.60
      arr.push({
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        r:  0.7 + sizeF * 1.1,
        a:  0.38 + alphaF,
      });
    }
    out.push(arr);
  }
  return out;
})();

function _drawHand(ctx, landmarks, w, h, opacity = 1) {
  const X = lm => (1 - lm.x) * w;
  const Y = lm => lm.y * h;

  // faint dots along each bone (replaces solid lines)
  for (const [a, b] of HAND_CONNECTIONS) {
    const ax = X(landmarks[a]), ay = Y(landmarks[a]);
    const bx = X(landmarks[b]), by = Y(landmarks[b]);
    const steps = 5;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const mx = ax + (bx - ax) * t;
      const my = ay + (by - ay) * t;
      // stable jitter per bone+step
      const jx = Math.sin(a * 7.3 + b * 3.1 + s * 11.7) * 1.8;
      const jy = Math.cos(a * 5.9 + b * 9.3 + s *  7.1) * 1.8;
      ctx.fillStyle = `rgba(200,220,255,${0.22 * opacity})`;
      ctx.beginPath();
      ctx.arc(mx + jx, my + jy, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // particle clusters at each joint
  for (let li = 0; li < landmarks.length; li++) {
    const lm = landmarks[li];
    const cx = X(lm), cy = Y(lm);
    const isFt = FINGERTIPS.includes(li);

    if (isFt) {
      // golden radial glow halo
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
      grd.addColorStop(0,   `rgba(255,225,100,${0.28 * opacity})`);
      grd.addColorStop(0.5, `rgba(255,190,50,${0.10 * opacity})`);
      grd.addColorStop(1,   'rgba(255,160,30,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of _LAND_PARTICLES[li]) {
      const alpha = p.a * opacity;
      ctx.fillStyle = isFt
        ? `rgba(255,228,120,${alpha})`
        : `rgba(210,228,255,${alpha * 0.75})`;
      ctx.beginPath();
      ctx.arc(cx + p.dx, cy + p.dy, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
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

    _drawHand(skeletonCtx, landmarks, w, h, opacity);

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
