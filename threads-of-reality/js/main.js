import { initScene, render, getScene, mpToWorld } from './scene.js';
import { initHands, detectHands, setOnGesture, getHandGrowingState, getHandInfo } from './hands.js';
import * as hands from './hands.js';
import { initStarfield, updateStarfield, crushImpulse, rotateImpulse } from './starfield.js';
import { createThread, updateThreads, activeThreads, crushThreads } from './threads.js';
import { initSolly, updateSolly, energizeSolly, onSollyTouch } from './solly.js';
import * as solly from './solly.js';
import { initAudio, resumeAudio, playGestureSound } from './audio.js';
import { initHud, setGestureHint, updateThreadCount, drawSkeleton } from './hud.js';

const videoEl = document.getElementById('webcam');
const startOverlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');
const errorMsg = document.getElementById('error-msg');

let scene;

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  startBtn.textContent = 'loading…';
  try {
    await _start();
  } catch (err) {
    console.error(err);
    errorMsg.textContent = `Error: ${err.message}`;
    errorMsg.style.display = 'flex';
    startOverlay.style.display = 'none';
  }
});

async function _start() {
  initAudio();
  resumeAudio();

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: 'user' },
  });
  videoEl.srcObject = stream;
  await new Promise(res => { videoEl.onloadedmetadata = res; });
  videoEl.play();

  await initHands();

  initScene();
  scene = getScene();

  initStarfield(scene);
  initSolly(scene);
  initHud();

  setOnGesture(_handleGesture);
  solly.onSollyTouch = () => playGestureSound('solly-touch');

  startOverlay.style.display = 'none';
  requestAnimationFrame(_loop);
}

function _handleGesture(evt) {
  playGestureSound(evt.type);

  if (evt.type === 'crush') {
    setGestureHint('crush', 'crush');
    crushThreads(evt.originPoint);
    crushImpulse(evt.originPoint);
    energizeSolly(1.5);
  } else if (evt.type === 'rotate') {
    setGestureHint('rotate', 'rotate');
    rotateImpulse(evt.originPoint, evt.direction);
  } else {
    setGestureHint(evt.type, 'confirmed');
    createThread(evt.type, evt.originPoint, evt.targetPoint, scene);
  }
}

let lastHint = null;

function _loop(time) {
  requestAnimationFrame(_loop);
  detectHands(videoEl);

  const growing0 = getHandGrowingState(0);
  const growing1 = getHandGrowingState(1);
  const hint = growing0 || growing1 || null;
  if (hint !== lastHint) {
    lastHint = hint;
    if (hint && hint !== 'crush') setGestureHint(hint, 'growing');
  }

  // collect active index-finger tip positions for Solly proximity
  const fingerPositions = [];
  for (const hi of [0, 1]) {
    const info = getHandInfo(hi);
    if (info.present && !info.orienting) {
      // tipsMp[0] = index finger tip (landmark 8)
      fingerPositions.push(mpToWorld(info.tipsMp[0].x, info.tipsMp[0].y));
    }
  }

  updateStarfield(time, activeThreads);
  updateThreads(time);
  updateSolly(time, activeThreads, fingerPositions);
  updateThreadCount(activeThreads.length);

  const handInfos = [getHandInfo(0), getHandInfo(1)];
  drawSkeleton(hands.latestResult, handInfos);

  render();
}
