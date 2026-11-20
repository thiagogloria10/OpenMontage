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
const simTime = (t: number) => {
  const x = Math.max(0, t - START);
  // perto da chegada da ondulada, desacelera mais (câmera lenta)
  const tw = SIM_W.T * SLOW;
  if (x < tw - 1.2) return x / SLOW;
  const base = (tw - 1.2) / SLOW, extra = x - (tw - 1.2);
  return base + extra / (SLOW * 2.2);
};
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
  return <mesh geometry={geo}><meshStandardMaterial color="#14171e" metalness={0.6} roughness={0.45} side={THREE.DoubleSide} /></mesh>;
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
    scene.background = new THREE.Color("#04060b");
    scene.fog = new THREE.Fog("#04060b", 18, 46);
  }, [gl, scene]);
  return null;
};

// ---------------- câmeras (cortes) — cada plano: posição e alvo em função do tempo
type Shot = { t0: number; t1: number; cam: (t: number) => { pos: THREE.Vector3; look: THREE.Vector3; fov: number } };
const mid = (t: number) => posBall("w", t).clone().add(posBall("s", t)).multiplyScalar(0.5);
const SHOTS: Shot[] = [
  // 1. de frente, baixo, no começo (como a referência): as duas bolas grandes, pistas indo para longe
  { t0: 0, t1: 2.3, cam: (t) => { const k = Math.min(1, t / 2.3); const m = mid(t); return { pos: new THREE.Vector3(0, m.y + 2.1, m.z + 5.6 - k * 1.2), look: new THREE.Vector3(0, m.y - 0.6, m.z - 4), fov: 44 }; } },
  // 2. lateral acompanhando: mostra a ondulada descendo e subindo ao lado da reta
  { t0: 2.3, t1: 4.6, cam: (t) => { const m = mid(t); return { pos: new THREE.Vector3(7.5, m.y + 1.2, m.z + 1.5), look: new THREE.Vector3(0, m.y - 0.3, m.z - 0.6), fov: 40 }; } },
  // 3. atrás da bola da ondulada, rasante, entrando na descida
  { t0: 4.6, t1: 6.4, cam: (t) => { const p = posBall("w", t), q = posBall("w", t + 0.3); return { pos: new THREE.Vector3(p.x - 0.1, p.y + 1.15, p.z + 2.3), look: new THREE.Vector3(q.x - 0.4, q.y - 0.4, q.z - 3.5), fov: 52 }; } },
  // 4. do alto, de cima: a ondulada abrindo vantagem
  { t0: 6.4, t1: 8.2, cam: (t) => { const m = mid(t); return { pos: new THREE.Vector3(-2.2, m.y + 7.5, m.z + 2.5), look: new THREE.Vector3(0, m.y, m.z - 1.5), fov: 44 }; } },
  // 5. na chegada, olhando para trás: as bolas vêm na direção da câmera (câmera lenta)
  { t0: 8.2, t1: 10.6, cam: (t) => { const k = (t - 8.2) / 2.4; return { pos: new THREE.Vector3(0.15, 1.15, -L - 5.2 + k * 0.8), look: new THREE.Vector3(0.1, 1.5, -L + 6), fov: 34 }; } },
  // 6. lateral aberta final: as duas na chegada, a ondulada na frente
  { t0: 10.6, t1: TOTAL, cam: (t) => { const k = (t - 10.6) / (TOTAL - 10.6); return { pos: new THREE.Vector3(6.4 - k * 0.6, 2.6, -L + 4.2), look: new THREE.Vector3(0, 0.7, -L - 0.4), fov: 44 }; } },
];
const CamRig: React.FC<{ t: number }> = ({ t }) => {
  const { camera } = useThree();
  const sh = SHOTS.find((s) => t >= s.t0 && t < s.t1) ?? SHOTS[SHOTS.length - 1];
  const c = sh.cam(t);
  camera.position.copy(c.pos);
  (camera as THREE.PerspectiveCamera).fov = c.fov;
  (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  camera.lookAt(c.look);
  return null;
};

export const Bolas: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const pw = posBall("w", t), ps = posBall("s", t);
  const spinW = (-L * sOf("w", t)) / R, spinS = (-L * sOf("s", t)) / R;
  const glow = t >= T_FINISH_W ? Math.max(0, 1 - (t - T_FINISH_W) / 0.8) : 0;
  const cutFlash = SHOTS.some((s) => s.t0 > 0 && t >= s.t0 && t < s.t0 + 0.08) ? 0.12 : 0;
  return (
    <AbsoluteFill style={{ background: "#04060b" }}>
      <Audio src={staticFile("bolas/sfx.wav")} />
      <ThreeCanvas width={width} height={height} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }} camera={{ fov: 45, near: 0.05, far: 200, position: [0, 6, 3] }}>
        <Env />
        <CamRig t={t} />
        <ambientLight intensity={0.25} />
        <directionalLight position={[4, 12, 6]} intensity={1.6} color="#ffffff" />
        <directionalLight position={[-6, 4, -10]} intensity={1.2} color="#5fb8ff" />
        <pointLight position={[0, 6, -L]} intensity={3} distance={18} color="#5fe0ff" />
        <Floor />
        <Structure />
        <Trough yf={yStraight} x={XS} />
        <Trough yf={yWavy} x={XW} />
        {/* trilhos de metal de cada pista + filete de luz na borda */}
        {[-0.22, 0.22].map((dx) => <Rail key={`s${dx}`} yf={yStraight} x={XS} dx={dx} />)}
        {[-0.22, 0.22].map((dx) => <Rail key={`w${dx}`} yf={yWavy} x={XW} dx={dx} />)}
        <Rail yf={yStraight} x={XS} dx={-0.62} dy={0.3} r={0.022} emissive="#ffb84a" />
        <Rail yf={yWavy} x={XW} dx={0.62} dy={0.3} r={0.022} emissive="#5fe0ff" />
        <Finish glow={glow} />
        <Ball p={ps} spin={spinS} color="#e9e4d8" />
        <Ball p={pw} spin={spinW} color="#ffffff" />
      </ThreeCanvas>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.6) 100%)" }} />
      <AbsoluteFill style={{ background: "#fff", opacity: glow * 0.35 + cutFlash }} />
    </AbsoluteFill>
  );
};
