import * as THREE from 'three';
import { BLOOM_LAYER } from './scene.js';

const BASE_COLOR    = new THREE.Color(0xffd76a);
const TOUCH_COLOR   = new THREE.Color(0xffffff);
const PROXIMITY_RADIUS = 2.0;
const TOUCH_RADIUS     = 0.55;
const TOUCH_COOLDOWN   = 1200; // ms between touch sounds

let mesh;
const velocity    = new THREE.Vector3();
const SPRING      = 0.004;
const DAMPING     = 0.92;
let energizeBoost = 0;
let proximityLevel = 0;
let lastTouchTime  = 0;
let touchFlash     = 0; // decays 1→0 after a touch
const origin = new THREE.Vector3(0, 0, 0);

export let onSollyTouch = null; // main.js can set this for sound callback

export function initSolly(scene) {
  const geo = new THREE.TetrahedronGeometry(0.45, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: BASE_COLOR.clone(),
    emissive: BASE_COLOR.clone(),
    emissiveIntensity: 0.4,
    metalness: 0.8,
    roughness: 0.15,
  });
  mesh = new THREE.Mesh(geo, mat);
  mesh.layers.enable(BLOOM_LAYER);
  scene.add(mesh);
  return mesh;
}

const _tmp    = new THREE.Vector3();
const _cp     = new THREE.Vector3();

export function updateSolly(time, activeThreads, fingerPositions = []) {
  let energySum = 0;
  let gravityTarget = null;
  let nearestGravityDist = Infinity;

  for (const t of activeThreads) {
    if (t.dying) continue;
    const d = Math.min(mesh.position.distanceTo(t.start), mesh.position.distanceTo(t.end));
    if ((t.type === 'energy' || t.type === 'gravity') && d < 4) {
      energySum += t.strength / Math.max(d, 0.3);
    }
    if (t.type === 'gravity') {
      const cp = _closestPointOnSegment(mesh.position, t.start, t.end, _cp);
      const dist = mesh.position.distanceTo(cp);
      if (dist < nearestGravityDist) {
        nearestGravityDist = dist;
        gravityTarget = cp.clone();
      }
    }
  }

  // spring toward gravity thread or back to origin
  const target = gravityTarget || origin;
  _tmp.copy(target).sub(mesh.position);
  velocity.addScaledVector(_tmp, SPRING);
  velocity.multiplyScalar(DAMPING);
  mesh.position.add(velocity);

  // proximity to finger tips
  let closestFinger = Infinity;
  for (const fp of fingerPositions) {
    const d = mesh.position.distanceTo(fp);
    if (d < closestFinger) closestFinger = d;
  }
  const newProx = fingerPositions.length > 0
    ? Math.max(0, 1 - closestFinger / PROXIMITY_RADIUS)
    : 0;

  // touch event
  const now = performance.now();
  if (closestFinger < TOUCH_RADIUS && now - lastTouchTime > TOUCH_COOLDOWN) {
    lastTouchTime = now;
    touchFlash = 1.0;
    if (onSollyTouch) onSollyTouch();
  }

  proximityLevel = proximityLevel * 0.85 + newProx * 0.15; // smooth
  touchFlash    *= 0.92; // decay
  energizeBoost *= Math.pow(0.001, 0.016);

  // rotation — full 3D tumble, faster when touched
  const rotSpeed = 0.0003 + proximityLevel * 0.0008 + touchFlash * 0.003;
  mesh.rotation.y = time * rotSpeed * 1.0;
  mesh.rotation.x = time * rotSpeed * 0.6;
  mesh.rotation.z = time * rotSpeed * 0.4;

  // scale
  const totalEnergy = energySum + energizeBoost;
  const baseScale = 1 + proximityLevel * 0.25 + touchFlash * 0.5;
  const pulse = 1 + 0.08 * Math.sin(time * 0.003) * Math.min(totalEnergy + 0.5, 2);
  mesh.scale.setScalar(Math.max(0.5, Math.min(baseScale * pulse, 2.8)));

  // emissive color: base gold → white on touch
  const colorT = Math.min(proximityLevel * 0.6 + touchFlash, 1);
  mesh.material.color.lerpColors(BASE_COLOR, TOUCH_COLOR, colorT * 0.4);
  mesh.material.emissive.lerpColors(BASE_COLOR, TOUCH_COLOR, colorT);
  mesh.material.emissiveIntensity = 0.4 + proximityLevel * 1.0 + touchFlash * 2.0 + totalEnergy * 0.1;
}

export function energizeSolly(amount = 1.5) {
  energizeBoost += amount;
}

function _closestPointOnSegment(p, a, b, out) {
  const ax = b.x - a.x, ay = b.y - a.y;
  const bx = p.x - a.x, by = p.y - a.y;
  const t = Math.max(0, Math.min(1, (bx * ax + by * ay) / (ax * ax + ay * ay + 1e-8)));
  out.set(a.x + ax * t, a.y + ay * t, 0);
  return out;
}
