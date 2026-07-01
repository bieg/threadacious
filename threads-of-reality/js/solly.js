import * as THREE from 'three';
import { BLOOM_LAYER } from './scene.js';

const BASE_COLOR = new THREE.Color(0xffd76a);
const BRIGHT_COLOR = new THREE.Color(0xffffff);

let mesh;
const velocity = new THREE.Vector3();
const SPRING = 0.004;
const DAMPING = 0.92;
let energizeBoost = 0;
const origin = new THREE.Vector3(0, 0, 0);

export function initSolly(scene) {
  const shape = new THREE.Shape();
  const r = 0.35;
  shape.moveTo(0, r);
  shape.lineTo(-r * 0.866, -r * 0.5);
  shape.lineTo( r * 0.866, -r * 0.5);
  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape);
  const mat = new THREE.MeshBasicMaterial({ color: BASE_COLOR.clone(), side: THREE.DoubleSide });
  mesh = new THREE.Mesh(geo, mat);
  mesh.layers.enable(BLOOM_LAYER);
  scene.add(mesh);
  return mesh;
}

const _tmp = new THREE.Vector3();
const _cp = new THREE.Vector3();

export function updateSolly(time, activeThreads) {
  let energySum = 0;
  let nearestGravityDist = Infinity;
  let gravityTarget = null;

  for (const t of activeThreads) {
    if (t.dying) continue;
    const dist = mesh.position.distanceTo(t.start);
    const dist2 = mesh.position.distanceTo(t.end);
    const nearest = Math.min(dist, dist2);

    if ((t.type === 'energy' || t.type === 'gravity') && nearest < 4) {
      energySum += t.strength / Math.max(nearest, 0.3);
    }
    if (t.type === 'gravity') {
      const cp = _closestPointOnSegment(mesh.position, t.start, t.end, _cp);
      const d = mesh.position.distanceTo(cp);
      if (d < nearestGravityDist) {
        nearestGravityDist = d;
        gravityTarget = cp.clone();
      }
    }
  }

  const target = gravityTarget || origin;
  _tmp.copy(target).sub(mesh.position);
  velocity.addScaledVector(_tmp, SPRING);
  velocity.multiplyScalar(DAMPING);
  mesh.position.add(velocity);

  energizeBoost *= Math.pow(0.001, 0.016);

  const totalEnergy = energySum + energizeBoost;
  const scale = 1 + 0.15 * Math.sin(time * 0.003) * Math.min(totalEnergy, 2) + energizeBoost * 0.3;
  mesh.scale.setScalar(Math.max(0.5, Math.min(scale, 2.5)));

  const t2 = Math.min(totalEnergy * 0.2, 1);
  mesh.material.color.lerpColors(BASE_COLOR, BRIGHT_COLOR, t2);

  mesh.rotation.z = time * 0.0003;
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
