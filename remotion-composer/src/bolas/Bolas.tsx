import React, { useMemo } from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// ==================================================================
// BOLAS — duas bolas de metal descem: uma na pista RETA, outra na pista ONDULADA.
// A física é real (energia: v = sqrt(2 g Δh)); a ondulada fica sempre abaixo da reta,
// ganha velocidade nas descidas e chega antes. Vários ângulos de câmera. Sem texto.
// ==================================================================
export const TOTAL = 13.8;
const L = 24, H = 5.2, A = 1.15, XS = -0.72, XW = 0.72, R = 0.3; // comprimento, altura, amplitude, posição das pistas, raio da bola
const G = 9.8;
// pista em função do progresso s (0..1): z vai de 0 a -L
const yStraight = (s: number) => H * (1 - s);
const yWavy = (s: number) => H * (1 - s) - A * Math.sin(3 * Math.PI * s) ** 2;
type Sim = { t: number[]; s: number[]; T: number };
const simulate = (yf: (s: number) => number): Sim => {
  const N = 4000, ts = [0], ss = [0];
  let t = 0; const v0 = 0.6, y0 = yf(0);
  for (let i = 1; i <= N; i++) {
    const s0 = (i - 1) / N, s1 = i / N;
    const dz = L / N, dy = yf(s1) - yf(s0);
    const ds = Math.hypot(dz, dy);
    const ym = yf((s0 + s1) / 2);
    const v = Math.sqrt(v0 * v0 + 2 * G * (y0 - ym)) * 0.97; // pequena perda
    t += ds / v; ts.push(t); ss.push(s1);
  }
  return { t: ts, s: ss, T: t };
};
const SIM_S = simulate(yStraight), SIM_W = simulate(yWavy);
const sAt = (sim: Sim, t: number) => {
  if (t <= 0) return 0; if (t >= sim.T) return 1;
  let lo = 0, hi = sim.t.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (sim.t[m] < t) lo = m; else hi = m; }
  const k = (t - sim.t[lo]) / (sim.t[hi] - sim.t[lo]);
  return sim.s[lo] + (sim.s[hi] - sim.s[lo]) * k;
};
// tempo do vídeo → tempo da simulação (câmera lenta no começo e na chegada)
const START = 0.15;              // as bolas ficam paradas no começo por 0,6 s
const SLOW = 2.0;               // fator de câmera lenta geral
const rate = (x: number, tw: number) => { const u = Math.max(0, Math.min(1, (x - (tw - 2.2)) / 1.6)); const k = u * u * (3 - 2 * u); return (1 / SLOW) * (1 - k) + (1 / (SLOW * 2.2)) * k; };
const SIMT: number[] = (() => { const out = [0]; const tw = SIM_W.T * SLOW; let acc = 0; for (let i = 1; i <= 6000; i++) { const x = i / 300; acc += rate(x - 1 / 600, tw) / 300; out.push(acc); } return out; })();
const simTime = (t: number) => { const x = Math.max(0, t - START) * 300; const i = Math.min(SIMT.length - 2, Math.floor(x)); return SIMT[i] + (SIMT[i + 1] - SIMT[i]) * (x - i); };
export const T_FINISH_W = (() => { let t = 0; while (simTime(t) < SIM_W.T) t += 1 / 60; return t; })();
export const T_FINISH_S = (() => { let t = 0; while (simTime(t) < SIM_S.T) t += 1 / 60; return t; })();
const posBall = (which: "s" | "w", t: number): THREE.Vector3 => {
  const sim = which === "s" ? SIM_S : SIM_W, yf = which === "s" ? yStraight : yWavy;
  const s = sAt(sim, simTime(t));
  return new THREE.Vector3(which === "s" ? XS : XW, yf(s) + R + 0.06, -L * s);
};
const sOf = (which: "s" | "w", t: number) => sAt(which === "s" ? SIM_S : SIM_W, simTime(t));

// ---------------- geometria das pistas
const curveOf = (yf: (s: number) => number, x: number, dx: number, dy: number) => {
  const pts: THREE.Vector3[] = [];
  for (let i = -6; i <= 206; i++) { const s = i / 200; pts.push(new THREE.Vector3(x + dx, yf(Math.max(0, Math.min(1, s))) + dy + (s < 0 ? 0 : 0), -L * s)); }
  return new THREE.CatmullRomCurve3(pts);
};
const Rail: React.FC<{ yf: (s: number) => number; x: number; dx: number; color?: string; r?: number; dy?: number; emissive?: string }> = ({ yf, x, dx, color = "#c9ced8", r = 0.05, dy = 0, emissive }) => {
  const geo = useMemo(() => new THREE.TubeGeometry(curveOf(yf, x, dx, dy), 600, r, 12, false), [yf, x, dx, r, dy]);
  return (
    <mesh geometry={geo}>
      {emissive ? <meshBasicMaterial color={emissive} toneMapped={false} /> : <meshStandardMaterial color={color} metalness={1} roughness={0.18} />}
    </mesh>
  );
};
// calha escura embaixo das bolas (fita larga seguindo a pista)
const Trough: React.FC<{ yf: (s: number) => number; x: number }> = ({ yf, x }) => {
  const geo = useMemo(() => {
    const N = 400, w = 0.52, pos: number[] = [], idx: number[] = [];
    for (let i = 0; i <= N; i++) {
      const s = i / N, y = yf(s) - 0.04, z = -L * s;
      pos.push(x - w, y, z, x + w, y, z, x - w - 0.08, y + 0.32, z, x + w + 0.08, y + 0.32, z);
      if (i < N) { const a = i * 4, b = (i + 1) * 4; idx.push(a, b, a + 1, a + 1, b, b + 1, a + 2, b + 2, a, a, b + 2, b, a + 1, b + 1, a + 3, a + 3, b + 1, b + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }, [yf, x]);
  return <mesh geometry={geo}><meshStandardMaterial color="#202329" metalness={0.5} roughness={0.5} side={THREE.DoubleSide} /></mesh>;
};
// estrutura: base da pista (bloco escuro sob as duas calhas) com pilares
const Structure: React.FC = () => {
  const pillars = useMemo(() => Array.from({ length: 8 }).map((_, i) => (i + 1) / 8), []);
  return (
    <group>
      {pillars.map((s, i) => {
        const y = Math.min(yStraight(s), yWavy(s)) - 0.1;
        return <mesh key={i} position={[0, (y - 0.5) / 2 - 1.55, -L * s]}><boxGeometry args={[2.6, y + 1.05, 0.16]} /><meshStandardMaterial color="#1b1f28" metalness={0.8} roughness={0.35} /></mesh>;
      })}
    </group>
  );
};
const Ball: React.FC<{ p: THREE.Vector3; spin: number; color: string }> = ({ p, spin, color }) => (
  <group position={p}>
    <mesh rotation={[spin, 0, 0]}>
      <sphereGeometry args={[R, 64, 64]} />
      <meshStandardMaterial color={color} metalness={1} roughness={0.06} envMapIntensity={1.4} />
    </mesh>
    <pointLight color={color === "#ffffff" ? "#9fdcff" : "#ffd27a"} intensity={0.6} distance={2.2} />
  </group>
);
// chão futurista: grade luminosa
const Floor: React.FC = () => {
  const grid = useMemo(() => { const g = new THREE.GridHelper(80, 80, "#2aa8ff", "#13324a"); (g.material as THREE.Material).transparent = true; (g.material as THREE.Material).opacity = 0.45; return g; }, []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, -12]}><planeGeometry args={[120, 120]} /><meshStandardMaterial color="#05070c" metalness={0.9} roughness={0.35} /></mesh>
      <primitive object={grid} position={[0, -1.58, -12]} />
    </group>
  );
};
const Finish: React.FC<{ glow: number }> = ({ glow }) => {
  const y = 0.0, z = -L;
  return (
    <group position={[0, y, z - 0.2]}>
      {[-1.7, 1.7].map((x) => <mesh key={x} position={[x, 1.1, 0]}><boxGeometry args={[0.12, 2.6, 0.12]} /><meshBasicMaterial color="#5fe0ff" toneMapped={false} /></mesh>)}
      <mesh position={[0, 2.4, 0]}><boxGeometry args={[3.52, 0.12, 0.12]} /><meshBasicMaterial color="#5fe0ff" toneMapped={false} /></mesh>
      <mesh position={[0, 1.1, 0]}><planeGeometry args={[3.3, 2.5]} /><meshBasicMaterial color="#5fe0ff" transparent opacity={0.05 + glow * 0.35} toneMapped={false} side={THREE.DoubleSide} /></mesh>
    </group>
  );
};
const Env: React.FC = () => {
  const { gl, scene } = useThree();
  useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.background = new THREE.Color("#cfd1d6");
    scene.fog = new THREE.Fog("#cfd1d6", 22, 60);
  }, [gl, scene]);
  return null;
};

// ---------------- câmera contínua: passa por vários ângulos sem cortes (transições longas e suaves)
type CamK = { pos: THREE.Vector3; look: THREE.Vector3; fov: number };
const mid = (t: number) => posBall("w", t).clone().add(posBall("s", t)).multiplyScalar(0.5);
const VIEWS: ((t: number) => CamK)[] = [
  // de frente, de cima (como a referência)
  (t) => { const m = mid(t); return { pos: new THREE.Vector3(0, m.y + 2.2, m.z + 5.4), look: new THREE.Vector3(0, m.y - 0.6, m.z - 4), fov: 44 }; },
  // de lado, acompanhando (mostra a ondulada descendo e subindo)
  (t) => { const m = mid(t); return { pos: new THREE.Vector3(7.2, m.y + 1.0, m.z + 0.8), look: new THREE.Vector3(0, m.y - 0.3, m.z - 0.8), fov: 40 }; },
  // atrás da bola da ondulada, mais baixo
  (t) => { const p = posBall("w", t), q = posBall("w", t + 0.35); return { pos: new THREE.Vector3(p.x - 0.2, p.y + 1.25, p.z + 2.6), look: new THREE.Vector3(q.x - 0.4, q.y - 0.4, q.z - 3.5), fov: 50 }; },
  // de cima, inclinado
  (t) => { const m = mid(t); return { pos: new THREE.Vector3(-3.0, m.y + 6.8, m.z + 2.4), look: new THREE.Vector3(0, m.y, m.z - 1.5), fov: 44 }; },
  // na chegada, olhando para as bolas que vêm
  (_t) => ({ pos: new THREE.Vector3(0.15, 1.3, -L - 5.0), look: new THREE.Vector3(0.1, 1.4, -L + 6), fov: 36 }),
  // lateral final, chegada no centro
  (_t) => ({ pos: new THREE.Vector3(6.0, 2.5, -L + 4.0), look: new THREE.Vector3(0, 0.7, -L - 0.4), fov: 44 }),
];
// [início da troca, fim da troca] entre a vista i e a i+1
const BLEND: [number, number][] = [[1.6, 3.2], [4.0, 5.4], [6.2, 7.5], [8.0, 9.2], [10.6, 11.8]];
const sm = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
const camAt = (t: number): CamK => {
  let i = 0; while (i < BLEND.length && t >= BLEND[i][1]) i++;
  if (i < BLEND.length && t > BLEND[i][0]) {
    const u = sm((t - BLEND[i][0]) / (BLEND[i][1] - BLEND[i][0])), a = VIEWS[i](t), b = VIEWS[i + 1](t);
    const pos = a.pos.clone().lerp(b.pos, u); pos.y += Math.sin(u * Math.PI) * (i === 3 ? 3.2 : 1.4); // sobe num arco para não atravessar a pista
    return { pos, look: a.look.clone().lerp(b.look, u), fov: a.fov + (b.fov - a.fov) * u };
  }
  return VIEWS[i](t);
};
const CamRig: React.FC<{ t: number }> = ({ t }) => {
  const { camera } = useThree();
  // média de alguns instantes: movimento ainda mais macio
  let p = new THREE.Vector3(), l = new THREE.Vector3(), f = 0, n = 0;
  for (let k = -3; k <= 3; k++) { const w = 4 - Math.abs(k); const c = camAt(Math.max(0, t + k / 60)); p.addScaledVector(c.pos, w); l.addScaledVector(c.look, w); f += c.fov * w; n += w; }
  camera.position.copy(p.multiplyScalar(1 / n));
  (camera as THREE.PerspectiveCamera).fov = f / n;
  (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  camera.lookAt(l.multiplyScalar(1 / n));
  return null;
};

export const Bolas: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const pw = posBall("w", t), ps = posBall("s", t);
  const spinW = (-L * sOf("w", t)) / R, spinS = (-L * sOf("s", t)) / R;
  const glow = t >= T_FINISH_W ? Math.max(0, 1 - (t - T_FINISH_W) / 0.8) : 0;
  const cutFlash = 0;
  return (
    <AbsoluteFill style={{ background: "#04060b" }}>
      <Audio src={staticFile("bolas/sfx.wav")} />
      <ThreeCanvas width={width} height={height} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }} camera={{ fov: 45, near: 0.05, far: 200, position: [0, 6, 3] }}>
        <Env />
        <CamRig t={t} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[5, 14, 4]} intensity={1.7} color="#ffffff" />
        <directionalLight position={[-6, 6, -8]} intensity={0.6} color="#e8eefc" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.2, -12]}><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#c6c8cd" roughness={0.95} metalness={0} /></mesh>
        <Trough yf={yStraight} x={XS} />
        <Trough yf={yWavy} x={XW} />
        {/* trilhos de metal de cada pista + filete de luz na borda */}
        {[-0.22, 0.22].map((dx) => <Rail key={`s${dx}`} yf={yStraight} x={XS} dx={dx} />)}
        {[-0.22, 0.22].map((dx) => <Rail key={`w${dx}`} yf={yWavy} x={XW} dx={dx} />)}

        <Ball p={ps} spin={spinS} color="#e9e4d8" />
        <Ball p={pw} spin={spinW} color="#ffffff" />
      </ThreeCanvas>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(0,0,0,0.25) 100%)" }} />
      <AbsoluteFill style={{ background: "#fff", opacity: glow * 0.18 + cutFlash }} />
    </AbsoluteFill>
  );
};
