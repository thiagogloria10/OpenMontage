import React, { useMemo } from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// ==================================================================
// BOLAS (parecido com a referência): estúdio cinza claro, uma pista-caixa preta com duas canaletas
// (reta à esquerda, ondulada à direita), barra que segura as bolas e sobe.
// Plano 1: câmera parada, alta, atrás da largada (as bolas rolam para longe).
// Corte rápido para preto. Plano 2: a mesma corrida de lado, câmera parada, pista na diagonal.
// Física real (energia); a ondulada fica sempre abaixo da reta e chega antes. Quase tempo real.
// ==================================================================
export const TOTAL = 12.8;
const L = 24, H = 5.0, A = 1.1, XS = -0.62, XW = 0.62, R = 0.36, GW = 0.5; // GW = meia largura da canaleta
const G = 9.8;
const yS = (s: number) => H * (1 - s);
const yW = (s: number) => H * (1 - s) - A * Math.sin(3 * Math.PI * s) ** 2;
const TOP = (s: number) => yS(s) + 0.42;            // borda de cima da caixa (acompanha a reta)
const BOT = (s: number) => yS(s) - A - 0.45;        // fundo da caixa (abaixo das ondas)
type Sim = { t: number[]; s: number[]; T: number };
const simulate = (yf: (s: number) => number): Sim => {
  const N = 3000, ts = [0], ss = [0]; let t = 0; const v0 = 0.4, y0 = yf(0);
  for (let i = 1; i <= N; i++) { const s0 = (i - 1) / N, s1 = i / N; const ds = Math.hypot(L / N, yf(s1) - yf(s0)); const v = Math.sqrt(v0 * v0 + 2 * G * (y0 - yf((s0 + s1) / 2))) * 0.96; t += ds / v; ts.push(t); ss.push(s1); }
  return { t: ts, s: ss, T: t };
};
const SS = simulate(yS), SW = simulate(yW);
const sAt = (sim: Sim, t: number) => { if (t <= 0) return 0; if (t >= sim.T) return 1; let lo = 0, hi = sim.t.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (sim.t[m] < t) lo = m; else hi = m; } const k = (t - sim.t[lo]) / (sim.t[hi] - sim.t[lo]); return sim.s[lo] + (sim.s[hi] - sim.s[lo]) * k; };
// cada plano tem sua largada (a barra sobe e as bolas saem); velocidade quase real
const SHOT2 = 6.45;          // início do plano 2
const REL = [0.85, SHOT2 + 0.55]; // largada em cada plano
const SPEED = 1.12;          // 1 = tempo real; um pouco mais lento para dar para ver
const raceT = (t: number) => { const r = t < SHOT2 ? REL[0] : REL[1]; return Math.max(0, (t - r) / SPEED); };
const ball = (w: boolean, t: number) => { const s = sAt(w ? SW : SS, raceT(t)); return { s, p: new THREE.Vector3(w ? XW : XS, (w ? yW : yS)(s) + R + 0.02, -L * s) }; };
export const FIN = { w: REL[1] + SW.T * SPEED, s: REL[1] + SS.T * SPEED, w1: REL[0] + SW.T * SPEED, s1: REL[0] + SS.T * SPEED };

// ---------------- geometria: tiras e paredes que seguem a pista
const N = 300;
const strip = (yf: (s: number) => number, x0: number, x1: number, dy = 0) => {
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= N; i++) { const s = i / N, y = yf(s) + dy, z = -L * s; pos.push(x0, y, z, x1, y, z); if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
};
const wall = (x: number, ylo: (s: number) => number, yhi: (s: number) => number) => {
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= N; i++) { const s = i / N, z = -L * s; pos.push(x, ylo(s), z, x, yhi(s), z); if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
};
const Track: React.FC = () => {
  const geo = useMemo(() => {
    const W = 1.32; // meia largura da caixa
    return {
      floorS: strip(yS, XS - GW, XS + GW), stripeS: strip(yS, XS - 0.07, XS + 0.07, 0.004),
      floorW: strip(yW, XW - GW, XW + GW), stripeW: strip(yW, XW - 0.07, XW + 0.07, 0.004),
      walls: [wall(XS - GW, yS, TOP), wall(XS + GW, yS, TOP), wall(XW - GW, yW, TOP), wall(XW + GW, yW, TOP)],
      outer: [wall(-W, BOT, TOP), wall(W, BOT, TOP)],
      topL: strip(TOP, -W, XS - GW), topM: strip(TOP, XS + GW, XW - GW), topR: strip(TOP, XW + GW, W), bottom: strip(BOT, -W, W),
      rims: [-W, XS - GW, XS + GW, XW - GW, XW + GW, W].map((x) => strip(TOP, x - 0.025, x + 0.025, 0.003)),
    };
  }, []);
  const black = <meshStandardMaterial color="#141416" metalness={0.55} roughness={0.42} side={THREE.DoubleSide} />;
  return (
    <group>
      <mesh geometry={geo.floorS}><meshStandardMaterial color="#3a3c40" roughness={0.9} metalness={0.05} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={geo.stripeS}><meshStandardMaterial color="#6b6e74" roughness={0.9} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={geo.floorW}><meshStandardMaterial color="#3a3c40" roughness={0.9} metalness={0.05} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={geo.stripeW}><meshStandardMaterial color="#6b6e74" roughness={0.9} side={THREE.DoubleSide} /></mesh>
      {geo.walls.map((g, i) => <mesh key={i} geometry={g}>{black}</mesh>)}
      {geo.outer.map((g, i) => <mesh key={i} geometry={g}>{black}</mesh>)}
      {[geo.topL, geo.topM, geo.topR, geo.bottom].map((g, i) => <mesh key={i} geometry={g}>{black}</mesh>)}
      {geo.rims.map((g, i) => <mesh key={i} geometry={g}><meshStandardMaterial color="#c9ccd2" metalness={1} roughness={0.2} side={THREE.DoubleSide} /></mesh>)}
      {/* tampas das pontas da caixa */}
      <mesh position={[0, yS(0) - 0.12, 0.04]}><boxGeometry args={[2.64, 1.08, 0.06]} /><meshStandardMaterial color="#141416" metalness={0.55} roughness={0.42} /></mesh>
      <mesh position={[0, (TOP(1) + BOT(1)) / 2, -L - 0.02]}><boxGeometry args={[2.64, TOP(1) - BOT(1), 0.06]} /><meshStandardMaterial color="#141416" metalness={0.55} roughness={0.42} /></mesh>
    </group>
  );
};
// barra que segura as bolas na largada e sobe
const Gate: React.FC<{ t: number }> = ({ t }) => {
  const r = t < SHOT2 ? REL[0] : REL[1];
  const up = Math.max(0, Math.min(1, (t - (r - 0.35)) / 0.45));
  const k = up * up * (3 - 2 * up);
  return (
    <mesh position={[0, yS(0) + R + 0.05 + k * 1.4, -R - 0.42]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.07, 0.07, 3.0, 32]} />
      <meshStandardMaterial color="#d8dbe0" metalness={1} roughness={0.12} />
    </mesh>
  );
};
const Ball: React.FC<{ p: THREE.Vector3; s: number }> = ({ p, s }) => (
  <mesh position={p} rotation={[(-L * s) / R, 0, 0]}>
    <sphereGeometry args={[R, 64, 64]} />
    <meshStandardMaterial color="#ffffff" metalness={1} roughness={0.14} envMapIntensity={1.2} />
  </mesh>
);
const Env: React.FC = () => {
  const { gl, scene } = useThree();
  useMemo(() => { const pm = new THREE.PMREMGenerator(gl); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.background = null; }, [gl, scene]);
  return null;
};
const SX = 11.5, SY = 9.5, SR = 0.24;
const CamRig: React.FC<{ t: number }> = ({ t }) => {
  const { camera } = useThree();
  const c = camera as THREE.PerspectiveCamera;
  if (t < SHOT2) {
    // plano 1: parado, alto, atrás da largada, olhando a pista descer
    c.up.set(0, 1, 0); c.position.set(0, TOP(0) + 1.05, 2.45); c.fov = 42; c.updateProjectionMatrix(); c.lookAt(0, TOP(0) - 0.55, -7);
  } else {
    // plano 2: de lado, parado, um pouco de cima; a pista atravessa a tela na diagonal (câmera girada)
    const target = new THREE.Vector3(0, H * 0.5, -L * 0.5);
    c.position.set(SX, H * 0.45 + SY, -L * 0.5 + 1.5);
    const roll = SR; // gira a imagem para a pista ficar na diagonal comprida da tela vertical
    c.up.set(0, Math.cos(roll), Math.sin(roll)); c.fov = 52; c.updateProjectionMatrix(); c.lookAt(target);
  }
  return null;
};

export const BolasRef: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const w = ball(true, t), s = ball(false, t);
  // corte rápido para preto entre os planos
  const black = Math.max(0, 1 - Math.abs(t - SHOT2) / 0.18);
  const VW = 1080, VH = 760, VY = 580;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Audio src={staticFile("bolas_ref/sfx.wav")} />
      <div style={{ position: "absolute", left: 0, top: VY, width: VW, height: VH, overflow: "hidden", background: "radial-gradient(ellipse at 50% 42%, #d7d8da 0%, #b9babd 45%, #7e8084 100%)" }}>
      <ThreeCanvas width={VW} height={VH} gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }} camera={{ fov: 50, near: 0.05, far: 200, position: [0, 7, 3] }}>
        <Env />
        <CamRig t={t} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 12, 8]} intensity={1.6} />
        <directionalLight position={[-4, 6, -12]} intensity={0.5} />
        <Track />
        <Gate t={t} />
        <Ball p={s.p} s={s.s} />
        <Ball p={w.p} s={w.s} />
      </ThreeCanvas>
      <div style={{ position: "absolute", inset: 0, background: "#000", opacity: black }} />
      </div>
    </AbsoluteFill>
  );
};
