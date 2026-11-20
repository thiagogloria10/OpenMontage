import React, { useMemo } from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// ==================================================================
// CARROS — mesma ideia das bolas, numa cidade em ladeira ao pôr do sol. Dois carros iguais descem
// de motor desligado (só gravidade): o AZUL pela avenida elevada RETA, o VERMELHO pela rua de baixo,
// que acompanha os morros (desce e sobe). A rua ondulada fica sempre abaixo da reta, ganha velocidade
// nas descidas e o vermelho chega antes. Plano 1 atrás da largada, corte, plano 2 de lado.
// ==================================================================
const L = 60, H = 10, A = 2.2, XS = -1.6, XW = 1.6, LW = 1.25; // comprimento, desnível, amplitude, faixas, meia largura da rua
const G = 9.8, WR = 0.22; // raio da roda
const yS = (s: number) => H * (1 - s);
const yW = (s: number) => H * (1 - s) - A * Math.sin(3 * Math.PI * s) ** 2;
type Sim = { t: number[]; s: number[]; T: number };
const simulate = (yf: (s: number) => number): Sim => {
  const N = 3000, ts = [0], ss = [0]; let t = 0; const v0 = 0.6, y0 = yf(0);
  for (let i = 1; i <= N; i++) { const s0 = (i - 1) / N, s1 = i / N; const ds = Math.hypot(L / N, yf(s1) - yf(s0)); const v = Math.sqrt(v0 * v0 + 2 * G * (y0 - yf((s0 + s1) / 2))) * 0.96; t += ds / v; ts.push(t); ss.push(s1); }
  return { t: ts, s: ss, T: t };
};
const SS = simulate(yS), SW = simulate(yW);
const sAt = (sim: Sim, t: number) => { if (t <= 0) return 0; if (t >= sim.T) return 1; let lo = 0, hi = sim.t.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (sim.t[m] < t) lo = m; else hi = m; } const k = (t - sim.t[lo]) / (sim.t[hi] - sim.t[lo]); return sim.s[lo] + (sim.s[hi] - sim.s[lo]) * k; };
const SPEED = 0.75;                 // um pouco mais rápido que o real
const SHOT2 = 5.4;                  // início do plano 2
const REL = [0.9, SHOT2 + 0.6];     // largada em cada plano
export const TOTAL = REL[1] + SS.T * SPEED + 1.1;
const raceT = (t: number) => Math.max(0, (t - (t < SHOT2 ? REL[0] : REL[1])) / SPEED);
const S0 = 0.012; // posição de largada (o carro fica todo na rua)
const carAt = (w: boolean, t: number) => {
  const yf = w ? yW : yS;
  const s = S0 + (1 - S0 - 0.012) * sAt(w ? SW : SS, raceT(t));
  const e = 0.004, pitch = Math.atan((yf(Math.min(1, s + e)) - yf(Math.max(0, s - e))) / (L * 2 * e));
  return { s, pitch, p: new THREE.Vector3(w ? XW : XS, yf(s), -L * s) };
};

// ---------------- geometria seguindo a ladeira
const strip = (yf: (s: number) => number, x0: number, x1: number, dy = 0, s0 = 0, s1 = 1, n = 300) => {
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= n; i++) { const s = s0 + (s1 - s0) * (i / n), y = yf(s) + dy, z = -L * s; pos.push(x0, y, z, x1, y, z); if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
};
const wall = (x: number, ylo: (s: number) => number, yhi: (s: number) => number, n = 300) => {
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= n; i++) { const s = i / n, z = -L * s; pos.push(x, ylo(s), z, x, yhi(s), z); if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
};
// várias tiras curtas (faixa tracejada) numa geometria só
const dashes = (yf: (s: number) => number, x: number, w: number, dy: number, n: number, fill: number) => {
  const gs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) { const a = i / n, b = a + fill / n; gs.push(strip(yf, x - w, x + w, dy, a, b, 6)); }
  const pos: number[] = [], idx: number[] = []; let off = 0;
  gs.forEach((g) => { const p = g.getAttribute("position").array as ArrayLike<number>; for (let k = 0; k < p.length; k++) pos.push(p[k]); const ix = g.getIndex()!.array as ArrayLike<number>; for (let k = 0; k < ix.length; k++) idx.push(ix[k] + off); off += p.length / 3; });
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
};
const ext = (f: (s: number) => number) => (s: number) => f(Math.max(-0.25, Math.min(1.3, s)));
const GROUND = (s: number) => yW(s) - 0.02;

const City: React.FC<{ side?: boolean }> = ({ side = false }) => {
  const geo = useMemo(() => {
    const gs = (s0: number, s1: number) => s0; void gs;
    return {
      // chão (morros) dos dois lados e entre as ruas
      groundR: strip(ext(GROUND), XW + LW + 1.6, 60, -0.03, -0.25, 1.3, 400),
      groundL: strip(ext(GROUND), -60, XS - LW - 0.4, -0.03, -0.25, 1.3, 400),
      groundM: strip(ext(GROUND), XS + LW + 0.4, XW - LW, -0.03, -0.25, 1.3, 400),
      // rua de baixo (ondulada): asfalto, bordas brancas, faixa amarela tracejada, calçada com meio-fio
      roadW: strip(yW, XW - LW, XW + LW, 0, -0.03, 1.03),
      edgeW: [strip(yW, XW - LW + 0.06, XW - LW + 0.13, 0.006), strip(yW, XW + LW - 0.13, XW + LW - 0.06, 0.006)],
      dashW: dashes(yW, XW, 0.05, 0.007, 22, 0.5),
      sideW: strip(yW, XW + LW, XW + LW + 1.6, 0.16, -0.03, 1.03), curbW: wall(XW + LW, yW, (s) => yW(s) + 0.16),
      // avenida elevada (reta): tabuleiro, laterais de concreto, faixas
      roadS: strip(yS, XS - LW, XS + LW, 0, -0.03, 1.03),
      edgeS: [strip(yS, XS - LW + 0.06, XS - LW + 0.13, 0.006), strip(yS, XS + LW - 0.13, XS + LW - 0.06, 0.006)],
      dashS: dashes(yS, XS, 0.05, 0.007, 22, 0.5),
      deckL: wall(XS - LW - 0.4, (s) => yS(s) - 0.55, (s) => yS(s) + 0.45), deckR: wall(XS + LW + 0.4, (s) => yS(s) - 0.55, (s) => yS(s) + 0.45),
      deckBot: strip(yS, XS - LW - 0.4, XS + LW + 0.4, -0.55), deckTopL: strip(yS, XS - LW - 0.4, XS - LW, 0.45), deckTopR: strip(yS, XS + LW, XS + LW + 0.4, 0.45),
      shoulderL: strip(yS, XS - LW - 0.4, XS - LW, 0.01), shoulderR: strip(yS, XS + LW, XS + LW + 0.4, 0.01),
      innerL: wall(XS - LW, yS, (s) => yS(s) + 0.45), innerR: wall(XS + LW, yS, (s) => yS(s) + 0.45),
    };
  }, []);
  // prédios, árvores, postes e pilares (posições fixas)
  const props = useMemo(() => {
    const rnd = (i: number) => { const x = Math.sin(i * 91.7 + 13.1) * 43758.5453; return x - Math.floor(x); };
    const cols = ["#e9c9a4", "#d98f6b", "#b9c7d6", "#efe3cf", "#a5b8a0", "#d6b0b8", "#c7a77f"];
    const bld: { x: number; s: number; w: number; d: number; h: number; c: string }[] = [];
    for (let i = 0; i < 26; i++) { const s = -0.15 + (i / 26) * 1.4; bld.push({ x: 9 + rnd(i) * 9, s, w: 3.5 + rnd(i + 5) * 3, d: 3 + rnd(i + 9) * 2.5, h: 4 + rnd(i + 3) * 10, c: cols[i % cols.length] }); }
    for (let i = 0; i < 26; i++) { const s = -0.12 + (i / 26) * 1.4; bld.push({ x: -(9 + rnd(i + 40) * 9), s, w: 3.5 + rnd(i + 45) * 3, d: 3 + rnd(i + 49) * 2.5, h: 4 + rnd(i + 43) * 11, c: cols[(i + 3) % cols.length] }); }
    const trees = Array.from({ length: 22 }).map((_, i) => ({ x: i % 2 ? XW + LW + 2.6 : -(XS * -1 + LW + 3.2), s: -0.05 + (Math.floor(i / 2) / 11) * 1.12 + rnd(i + 70) * 0.02, k: 0.8 + rnd(i + 80) * 0.5 }));
    const lamps = Array.from({ length: 9 }).map((_, i) => ({ s: 0.02 + i * 0.12 }));
    const pillars = Array.from({ length: 13 }).map((_, i) => i / 12).filter((s) => yS(s) - yW(s) > 0.8);
    return { bld, trees, lamps, pillars };
  }, []);
  const winTex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 64; c.height = 128; const g = c.getContext("2d")!;
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, 64, 128);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { const lit = (x * 7 + y * 3) % 5 === 0; g.fillStyle = lit ? "#ffe2a0" : "#5b6878"; g.fillRect(6 + x * 14, 6 + y * 15, 9, 10); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  const asphalt = <meshStandardMaterial color="#2b2d31" roughness={0.92} side={THREE.DoubleSide} />;
  const white = <meshStandardMaterial color="#f2f2ee" roughness={0.6} side={THREE.DoubleSide} />;
  const yellow = <meshStandardMaterial color="#f2c230" roughness={0.6} side={THREE.DoubleSide} />;
  const concrete = <meshStandardMaterial color="#b8b4ac" roughness={0.85} side={THREE.DoubleSide} />;
  const grass = <meshStandardMaterial color="#7f9a5a" roughness={1} side={THREE.DoubleSide} />;
  return (
    <group>
      {[geo.groundR, geo.groundL, geo.groundM].map((g, i) => <mesh key={i} geometry={g}>{grass}</mesh>)}
      <mesh geometry={geo.roadW}>{asphalt}</mesh>
      {geo.edgeW.map((g, i) => <mesh key={i} geometry={g}>{white}</mesh>)}
      <mesh geometry={geo.dashW}>{yellow}</mesh>
      <mesh geometry={geo.sideW}><meshStandardMaterial color="#cfc9bd" roughness={0.9} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={geo.curbW}>{concrete}</mesh>
      <mesh geometry={geo.roadS}>{asphalt}</mesh>
      {geo.edgeS.map((g, i) => <mesh key={i} geometry={g}>{white}</mesh>)}
      <mesh geometry={geo.dashS}>{yellow}</mesh>
      {[geo.deckL, geo.deckR, geo.deckBot, geo.deckTopL, geo.deckTopR, geo.shoulderL, geo.shoulderR, geo.innerL, geo.innerR].map((g, i) => <mesh key={i} geometry={g}>{concrete}</mesh>)}
      {/* pilares da avenida elevada */}
      {props.pillars.map((s, i) => { const top = yS(s) - 0.55, bot = yW(s) - 0.3; return <mesh key={i} position={[XS, (top + bot) / 2, -L * s]}><boxGeometry args={[1.2, top - bot, 0.7]} />{concrete}</mesh>; })}
      {/* prédios */}
      {props.bld.filter((b) => !(side && b.x > 0)).map((b, i) => {
        const base = yW(b.s) - 0.6; const t = winTex.clone(); t.repeat.set(Math.max(1, Math.round(b.w / 2)), Math.max(1, Math.round(b.h / 3))); t.needsUpdate = true;
        return (
          <group key={i} position={[b.x, base + b.h / 2, -L * b.s]}>
            <mesh><boxGeometry args={[b.w, b.h, b.d]} /><meshStandardMaterial color={b.c} map={t} roughness={0.8} /></mesh>
            <mesh position={[0, b.h / 2 + 0.08, 0]}><boxGeometry args={[b.w + 0.2, 0.16, b.d + 0.2]} /><meshStandardMaterial color="#8a7f75" roughness={0.9} /></mesh>
          </group>
        );
      })}
      {/* árvores */}
      {props.trees.map((tr, i) => { const y = yW(tr.s); return (
        <group key={i} position={[tr.x, y, -L * tr.s]} scale={tr.k}>
          <mesh position={[0, 0.7, 0]}><cylinderGeometry args={[0.1, 0.14, 1.4, 8]} /><meshStandardMaterial color="#6b4a32" /></mesh>
          <mesh position={[0, 1.9, 0]}><sphereGeometry args={[0.85, 14, 12]} /><meshStandardMaterial color={i % 3 ? "#4f7d3c" : "#6b8f3a"} roughness={1} /></mesh>
        </group>); })}
      {/* postes de luz na calçada */}
      {props.lamps.map((l, i) => { const y = yW(l.s) + 0.16; return (
        <group key={i} position={[XW + LW + 1.25, y, -L * l.s]}>
          <mesh position={[0, 1.6, 0]}><cylinderGeometry args={[0.05, 0.06, 3.2, 8]} /><meshStandardMaterial color="#3b3f45" metalness={0.6} roughness={0.4} /></mesh>
          <mesh position={[-0.45, 3.15, 0]}><boxGeometry args={[0.9, 0.06, 0.08]} /><meshStandardMaterial color="#3b3f45" /></mesh>
          <mesh position={[-0.85, 3.08, 0]}><boxGeometry args={[0.3, 0.08, 0.16]} /><meshBasicMaterial color="#ffe7b0" toneMapped={false} /></mesh>
        </group>); })}
    </group>
  );
};

// ---------------- carro (formas simples, arredondado onde importa)
const Car: React.FC<{ p: THREE.Vector3; pitch: number; s: number; color: string }> = ({ p, pitch, s, color }) => {
  const spin = (L * s) / WR;
  const paint = <meshStandardMaterial color={color} metalness={0.6} roughness={0.28} envMapIntensity={1.1} />;
  const glass = <meshStandardMaterial color="#1c2733" metalness={0.9} roughness={0.08} />;
  return (
    <group position={p} rotation={[pitch, 0, 0]}>
      <group position={[0, WR, 0]}>
        {/* carroceria */}
        <mesh position={[0, 0.26, 0]}><boxGeometry args={[1.05, 0.36, 2.2]} />{paint}</mesh>
        <mesh position={[0, 0.2, -1.08]}><boxGeometry args={[1.0, 0.24, 0.14]} />{paint}</mesh>
        {/* cabine */}
        <mesh position={[0, 0.6, 0.12]}><boxGeometry args={[0.9, 0.34, 1.1]} />{paint}</mesh>
        <mesh position={[0, 0.6, -0.45]} rotation={[0.55, 0, 0]}><boxGeometry args={[0.84, 0.36, 0.04]} />{glass}</mesh>
        <mesh position={[0, 0.6, 0.69]} rotation={[-0.5, 0, 0]}><boxGeometry args={[0.84, 0.32, 0.04]} />{glass}</mesh>
        {[-1, 1].map((sd) => <mesh key={sd} position={[sd * 0.452, 0.62, 0.12]}><boxGeometry args={[0.01, 0.24, 0.95]} />{glass}</mesh>)}
        {/* faróis e lanternas */}
        {[-0.34, 0.34].map((x) => <mesh key={`f${x}`} position={[x, 0.3, -1.105]}><boxGeometry args={[0.2, 0.08, 0.02]} /><meshBasicMaterial color="#fff6dc" toneMapped={false} /></mesh>)}
        {[-0.36, 0.36].map((x) => <mesh key={`t${x}`} position={[x, 0.32, 1.105]}><boxGeometry args={[0.22, 0.08, 0.02]} /><meshBasicMaterial color="#ff3b30" toneMapped={false} /></mesh>)}
        <mesh position={[0, 0.1, 0]}><boxGeometry args={[1.08, 0.1, 2.0]} /><meshStandardMaterial color="#1a1a1c" roughness={0.6} /></mesh>
      </group>
      {/* rodas */}
      {[[-0.5, -0.7], [0.5, -0.7], [-0.5, 0.72], [0.5, 0.72]].map(([x, z], i) => (
        <group key={i} position={[x, WR, z]} rotation={[-spin, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[WR, WR, 0.16, 20]} /><meshStandardMaterial color="#141416" roughness={0.8} /></mesh>
          <mesh position={[x > 0 ? 0.085 : -0.085, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[WR * 0.55, WR * 0.55, 0.01, 12]} /><meshStandardMaterial color="#c9ccd2" metalness={1} roughness={0.25} /></mesh>
        </group>
      ))}
    </group>
  );
};
// cancela da largada (sobe) e faixa de chegada quadriculada
const Gate: React.FC<{ t: number }> = ({ t }) => {
  const r = t < SHOT2 ? REL[0] : REL[1];
  const up = Math.max(0, Math.min(1, (t - (r - 0.4)) / 0.5)); const k = up * up * (3 - 2 * up);
  const z = -L * S0 - 1.45, y = yS(0) - 0.12;
  return (
    <group position={[XS - LW - 0.6, y, z]}>
      <mesh position={[0, 0.55, 0]}><boxGeometry args={[0.25, 1.1, 0.25]} /><meshStandardMaterial color="#e9e6df" /></mesh>
      <group position={[0, 1.0, 0]} rotation={[0, 0, k * 1.35]}>
        {Array.from({ length: 10 }).map((_, i) => <mesh key={i} position={[0.25 + i * 0.6 + 0.3, 0, 0]}><boxGeometry args={[0.6, 0.1, 0.08]} /><meshStandardMaterial color={i % 2 ? "#ffffff" : "#d8261c"} /></mesh>)}
      </group>
    </group>
  );
};
const Finish: React.FC = () => {
  const tex = useMemo(() => { const c = document.createElement("canvas"); c.width = 256; c.height = 32; const g = c.getContext("2d")!; for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? "#111" : "#fff"; g.fillRect(x * 16, y * 16, 16, 16); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }, []);
  const z = -L, yb = yW(1);
  return (
    <group position={[0, yb, z]}>
      {[XS - LW - 0.6, XW + LW + 0.4].map((x) => <mesh key={x} position={[x, 2.2, 0]}><boxGeometry args={[0.18, 4.4, 0.18]} /><meshStandardMaterial color="#e9e6df" /></mesh>)}
      <mesh position={[0, 4.1, 0]}><boxGeometry args={[XW - XS + 2 * LW + 1.0, 0.5, 0.06]} /><meshStandardMaterial map={tex} /></mesh>
    </group>
  );
};
const Env: React.FC = () => {
  const { gl, scene } = useThree();
  useMemo(() => { const pm = new THREE.PMREMGenerator(gl); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.background = null; scene.fog = new THREE.Fog("#f0b289", 45, 120); }, [gl, scene]);
  return null;
};
const CamRig: React.FC<{ t: number }> = ({ t }) => {
  const { camera } = useThree();
  const c = camera as THREE.PerspectiveCamera;
  if (t < SHOT2) {
    // plano 1: atrás da largada, alto, olhando a ladeira (como as bolas)
    const k = Math.min(1, t / SHOT2);
    c.up.set(0, 1, 0); c.position.set(0, yS(0) + 3.4 - k * 0.3, 7.5 - k * 0.8); c.fov = 46; c.updateProjectionMatrix(); c.lookAt(0, yS(0) - 2.2, -24);
  } else {
    // plano 2: de lado, parado, a ladeira atravessa a tela na diagonal
    c.up.set(0, 1, 0); c.position.set(CX, H * 0.5 + CY, -L * 0.5 + 2); c.fov = 44; c.updateProjectionMatrix(); c.lookAt(0, H * 0.42, -L * 0.5);
  }
  return null;
};
const CX = 46, CY = 14;

export const Carros: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const w = carAt(true, t), s = carAt(false, t);
  const black = Math.max(0, 1 - Math.abs(t - SHOT2) / 0.18);
  const VW = 1080, VH = 760, VY = 580;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Audio src={staticFile("carros/sfx.wav")} />
      <div style={{ position: "absolute", left: 0, top: VY, width: VW, height: VH, overflow: "hidden", background: "linear-gradient(180deg, #3d5a8a 0%, #8f7aa8 30%, #f2a77a 62%, #ffd39a 80%)" }}>
        <ThreeCanvas width={VW} height={VH} gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }} camera={{ fov: 46, near: 0.1, far: 300, position: [0, 14, 8] }}>
          <Env />
          <CamRig t={t} />
          <hemisphereLight args={["#ffd9b0", "#4a5a3a", 0.75]} />
          <directionalLight position={[-30, 22, -40]} intensity={2.0} color="#ffc48a" />
          <directionalLight position={[20, 30, 20]} intensity={0.6} color="#b8c8ff" />
          <City side={t >= SHOT2} />
          <Gate t={t} />
          <Finish />
          <Car p={s.p} pitch={s.pitch} s={s.s} color="#2f6ad8" />
          <Car p={w.p} pitch={w.pitch} s={w.s} color="#d8322a" />
        </ThreeCanvas>
        <div style={{ position: "absolute", inset: 0, background: "#000", opacity: black }} />
      </div>
    </AbsoluteFill>
  );
};
