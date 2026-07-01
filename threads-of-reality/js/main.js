import { initScene, render, getScene } from './scene.js';
import { initHands, detectHands, latestResult, setOnGesture, getHandGrowingState } from './hands.js';
import * as hands from './hands.js';
import { initStarfield, updateStarfield, crushImpulse } from './starfield.js';
import { createThread, updateThreads, activeThreads, crushThreads } from './threads.js';
import { initSolly, updateSolly, energizeSolly } from './solly.js';
import { initAudio, resumeAudio, playGestureSound } from './audio.js';
import { initHud, setGestureHint, updateThreadCount, drawSkeleton } from './hud.js';

const videoEl = document.getElementById('webcam');
const startOverlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');
const errorMsg = document.getElementById('error-msg');

let scene;
let started = false;

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

  const sceneData = initScene();
  scene = getScene();

  initStarfield(scene);
  initSolly(scene);
  initHud();

  setOnGesture(_handleGesture);

  startOverlay.style.display = 'none';
  started = true;
  requestAnimationFrame(_loop);
}

function _handleGesture(evt) {
  playGestureSound(evt.type);
  setGestureHint(evt.type, 'confirmed');

  if (evt.type === 'crush') {
    crushThreads(evt.originPoint);
    crushImpulse(evt.originPoint);
    energizeSolly(1.5);
  } else {
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

  updateStarfield(time, activeThreads);
  updateThreads(time);
  updateSolly(time, activeThreads);
  updateThreadCount(activeThreads.length);
  drawSkeleton(hands.latestResult);
  render();
}
