// camera.js — the orbit camera around Oikumene (tilt follows zoom), eased fly-to, the follow-path
// camera (Ride, first crossing, attract rides) and the attract camera. Runs on render time.
import * as THREE from 'three';

const R = 100;
export const ZOOM = { min: 112, max: 460, planet: 350, district: 140 };
const DEG = Math.PI / 180;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function latLonVec(lat, lon) { const la = lat * DEG, lo = lon * DEG; return new THREE.Vector3(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)); }
function vecLatLon(v) { const n = v.clone().normalize(); return [Math.asin(Math.max(-1, Math.min(1, n.y))) / DEG, Math.atan2(n.x, n.z) / DEG]; }
export { latLonVec, vecLatLon };

export class OrbitCam {
  constructor(camera) {
    this.camera = camera;
    this.lat = 20; this.lon = 0; this.dist = ZOOM.planet; this.tiltManual = 0;
    this.flight = null; this.mode = 'orbit'; // orbit | follow | attract
    this.follow = null; // { getPose: () => ({pos, look, up}) }
    this.smoothPos = new THREE.Vector3(); this.smoothLook = new THREE.Vector3(); this.followInit = false;
    this.viewShift = 0; this.viewShiftTarget = 0;
    this.shake = 0; this.shakeOn = true;
    this.attractT = 0;
    this.zoomVel = 0;
    this.apply();
  }
  autoTilt(d) { const t = Math.min(1, Math.max(0, (260 - d) / (260 - ZOOM.min))); return t * t * (3 - 2 * t) * 0.95; }
  tilt() { return Math.min(1.25, Math.max(0, this.autoTilt(this.dist) + this.tiltManual)); }
  focusVec() { return latLonVec(this.lat, this.lon); }

  /** Pixels → spin. dx, dy in CSS px. */
  drag(dx, dy, viewH) {
    this.cancelFlight();
    const h = Math.max(8, this.dist - R);
    const unitsPerPx = (2 * h * Math.tan((this.camera.fov * DEG) / 2)) / viewH;
    const radPerPx = unitsPerPx / R;
    const k = Math.min(0.012, radPerPx) / DEG;
    this.lon -= dx * k / Math.max(0.25, Math.cos(this.lat * DEG));
    this.lat += dy * k;
    this.clamp();
  }
  spin(dLat, dLon) { this.cancelFlight(); this.lat += dLat; this.lon += dLon; this.clamp(); }
  zoomBy(f) { this.cancelFlight(); this.dist = R + (this.dist - R) * f; this.clamp(); }
  tiltBy(d) { this.tiltManual = Math.max(-0.6, Math.min(0.8, this.tiltManual + d)); }
  clamp() {
    this.lat = Math.max(-82, Math.min(82, this.lat));
    this.lon = ((this.lon + 540) % 360) - 180;
    this.dist = Math.max(ZOOM.min, Math.min(ZOOM.max, this.dist));
  }
  cancelFlight() { this.flight = null; }

  /** Fly to a unit vector (or [lat, lon]) at distance d. topDown: end looking straight down (the zoom's auto tilt cancelled). */
  flyTo(target, d = null, dur = 1.1, { topDown = false } = {}) {
    const v = Array.isArray(target) ? latLonVec(target[0], target[1]) : target.clone().normalize();
    const d1 = Math.max(ZOOM.min, Math.min(ZOOM.max, d ?? this.dist));
    this.flight = { t: 0, dur, from: this.focusVec(), to: v, d0: this.dist, d1, tilt0: this.tiltManual, tilt1: topDown ? Math.max(-0.6, -this.autoTilt(d1)) : 0 };
    if (this.mode !== 'orbit') this.exitFollow();
  }
  jumpTo(target, d = null) { const v = Array.isArray(target) ? latLonVec(target[0], target[1]) : target; [this.lat, this.lon] = vecLatLon(v); if (d) this.dist = d; this.flight = null; this.clamp(); }

  startFollow(getPose, opts = {}) { this.mode = 'follow'; this.follow = { getPose, ...opts }; this.followInit = false; this.flight = null; }
  exitFollow() {
    if (this.mode === 'orbit') return;
    // hand back to the orbit camera at the same spot
    const p = this.camera.position.clone();
    [this.lat, this.lon] = vecLatLon(p);
    this.dist = Math.max(ZOOM.min + 8, Math.min(ZOOM.max, p.length()));
    this.tiltManual = 0;
    this.mode = 'orbit'; this.follow = null;
    this.clamp();
  }

  addShake(a) { if (this.shakeOn) this.shake = Math.min(1.5, this.shake + a); }

  update(dt) {
    if (this.flight) {
      const f = this.flight; f.t += dt; const u = Math.min(1, f.t / f.dur), e = ease(u);
      const ang = f.from.angleTo(f.to);
      let v;
      if (ang < 1e-5) v = f.to.clone();
      else { const s = Math.sin(ang); v = f.from.clone().multiplyScalar(Math.sin((1 - e) * ang) / s).add(f.to.clone().multiplyScalar(Math.sin(e * ang) / s)); }
      [this.lat, this.lon] = vecLatLon(v);
      // pull back mid-flight for long hops
      const hop = Math.min(1, ang / 1.2);
      this.dist = f.d0 + (f.d1 - f.d0) * e + Math.sin(u * Math.PI) * hop * 120;
      this.tiltManual = f.tilt0 * (1 - e) + f.tilt1 * e;
      this.clamp();
      if (u >= 1) this.flight = null;
    }
    this.viewShift += (this.viewShiftTarget - this.viewShift) * Math.min(1, dt * 3);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.apply(dt);
  }

  apply(dt = 0) {
    const cam = this.camera;
    if (this.mode === 'follow' && this.follow) {
      const pose = this.follow.getPose();
      if (pose) {
        const k = this.followInit ? Math.min(1, dt * 6) : 1;
        this.smoothPos.lerp(pose.pos, k); this.smoothLook.lerp(pose.look, k); this.followInit = true;
        cam.position.copy(this.smoothPos);
        cam.up.copy(pose.up || this.smoothPos.clone().normalize());
        cam.lookAt(this.smoothLook);
      }
    } else {
      const n = this.focusVec();
      const north = new THREE.Vector3(0, 1, 0).addScaledVector(n, -n.y);
      if (north.lengthSq() < 1e-6) north.set(0, 0, -1); north.normalize();
      const tilt = this.tilt();
      const h = this.dist - R;
      const P = n.clone().multiplyScalar(R);
      const off = n.clone().multiplyScalar(Math.cos(tilt) * h).addScaledVector(north, -Math.sin(tilt) * h);
      cam.position.copy(P).add(off);
      cam.up.copy(north.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(n, Math.sin(tilt)).normalize());
      // look slightly above the surface point when tilted, so the horizon shows
      cam.lookAt(P.clone().addScaledVector(n, Math.sin(tilt) * 4));
    }
    if (this.shake > 0) {
      const s = this.shake * 0.35;
      cam.position.add(new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s));
    }
    cam.updateMatrixWorld();
  }

  /** Distance to the planet centre (for LOD decisions). */
  distance() { return this.camera.position.length(); }

  state() { return { lat: +this.lat.toFixed(2), lon: +this.lon.toFixed(2), dist: +this.dist.toFixed(1), tilt: +this.tilt().toFixed(3), mode: this.mode, flying: !!this.flight }; }
}
