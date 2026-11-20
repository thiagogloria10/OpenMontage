import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// ==================================================================
// ESCAPA — no formato da referência (curta de animação "pintado", quadro horizontal no meio da tela):
// uma pessoa distraída anda pela cidade e uma sombra de olhos brilhantes arma armadilhas;
// ela escapa de todas sem perceber. Personagens e situações próprios. Sem texto (a frase entra depois).
// Mundo em 1920×1080 (16:9), mostrado num quadro de 1080×608 centralizado.
// ==================================================================
const DUR = [5.2, 5.0, 5.4, 5.0, 4.2];
const ST = DUR.reduce<number[]>((a, d, i) => [...a, i === 0 ? 0 : a[i - 1] + DUR[i - 1]], []);
export const TOTAL = ST[ST.length - 1] + DUR[DUR.length - 1];
const GROUND = 905;
type V = [number, number];
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const sm = (x: number) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const er = (t: number, a: number, b: number) => sm((t - a) / (b - a));
const kf = (t: number, keys: [number, number][]) => { if (t <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) { const [t1, v1] = keys[i]; if (t <= t1) { const [t0, v0] = keys[i - 1]; return lerp(v0, v1, sm((t - t0) / (t1 - t0))); } } return keys[keys.length - 1][1]; };
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const sceneOf = (t: number) => { let s = 0; for (let i = 0; i < ST.length; i++) if (t >= ST[i]) s = i; return s; };

// ---------------- pessoa (de perfil, olhando para a direita), estilo pintado: sem contorno, volumes com luz e sombra
type Pose = { x: number; y?: number; ph: number; amp: number; bend?: number; umb?: number; hold?: "coin" | "bread" | null; look?: number; smile?: number; s?: number; op?: number; face?: number };
const COAT = "#d9a441", COAT_D = "#a8742a", PANTS = "#3c4a5e", SKIN = "#e8b894", SKIN_D = "#c48e6c", HAIR = "#4a2c1d";
const rot = (p: V, a: number): V => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const Walker: React.FC<{ p: Pose }> = ({ p }) => {
  const bend = p.bend ?? 0, umb = p.umb ?? 0, s = p.s ?? 1;
  const hip: V = [0, -178 + bend * 58];
  const ta = 0.06 * p.amp + bend * 1.05; // inclinação do tronco (para a frente)
  const sh = add(hip, rot([0, -150], ta));
  const leg = (i: number) => {
    const q = p.ph + i * Math.PI;
    let th = Math.sin(q) * 0.48 * p.amp, kb = Math.max(0, Math.cos(q)) * 0.75 * p.amp;
    // abaixada (amarrar o tênis / pegar a moeda): um joelho na frente, o outro dobrado atrás
    th = lerp(th, i === 0 ? 1.25 : -0.15, bend); kb = lerp(kb, i === 0 ? 1.25 : 1.3, bend);
    const knee = add(hip, rot([0, 92], -th)); const foot = add(knee, rot([0, 92], -th + kb));
    return { knee, foot };
  };
  const L0 = leg(0), L1 = leg(1);
  const lift = Math.max(L0.foot[1], L1.foot[1]); // pé mais baixo encosta no chão
  const dy = -lift;
  const arm = (i: number) => {
    const q = p.ph + i * Math.PI;
    let a = -Math.sin(q) * 0.5 * p.amp + ta * 0.3, eb = 0.35 + Math.max(0, Math.sin(q)) * 0.4 * p.amp;
    if (bend > 0) { a = lerp(a, -0.9 - ta * 0.2, bend); eb = lerp(eb, 0.3, bend); }
    if (i === 0 && umb > 0) { a = lerp(a, 2.6, umb); eb = lerp(eb, -1.2, umb); }
    const el = add(sh, rot([0, 72], -a)); const hd = add(el, rot([0, 68], -a + eb));
    return { el, hd };
  };
  const A0 = arm(0), A1 = arm(1);
  const neck = add(sh, rot([0, -20], ta * 0.7)); const head = add(neck, rot([0, -34], ta * 0.5 - (p.look ?? 0) * 0.25));
  const limb = (a: V, b: V, c: V, w: number, col: string) => <path d={`M${a[0]},${a[1]} Q${b[0] * 2 - (a[0] + c[0]) / 2},${b[1] * 2 - (a[1] + c[1]) / 2} ${c[0]},${c[1]}`} stroke={col} strokeWidth={w} strokeLinecap="round" fill="none" />;
  const coatPts = [add(sh, rot([-26, 4], ta)), add(sh, rot([24, 4], ta)), add(hip, rot([34, 22], ta * 0.6)), add(hip, rot([-34, 22], ta * 0.6))];
  return (
    <g transform={`translate(${p.x},${p.y ?? GROUND}) scale(${s}) translate(0,${dy})`} opacity={p.op ?? 1}>
      <ellipse cx={0} cy={-dy} rx={70} ry={12} fill="#000" opacity={0.18} />
      {/* perna e braço de trás (mais escuros) */}
      {limb(hip, L1.knee, L1.foot, 30, "#2c3646")}
      <ellipse cx={L1.foot[0] + 12} cy={L1.foot[1] + 4} rx={24} ry={10} fill="#3a2a22" />
      {limb(sh, A1.el, A1.hd, 22, COAT_D)}
      <circle cx={A1.hd[0]} cy={A1.hd[1]} r={11} fill={SKIN_D} />
      {/* casaco */}
      <path d={`M${coatPts[0][0]},${coatPts[0][1]} L${coatPts[1][0]},${coatPts[1][1]} Q${coatPts[2][0] + 10},${coatPts[2][1] - 60} ${coatPts[2][0]},${coatPts[2][1]} L${coatPts[3][0]},${coatPts[3][1]} Q${coatPts[3][0] - 6},${coatPts[3][1] - 70} ${coatPts[0][0]},${coatPts[0][1]} Z`} fill="url(#coatG)" />
      {/* perna da frente */}
      {limb(hip, L0.knee, L0.foot, 32, PANTS)}
      <ellipse cx={L0.foot[0] + 12} cy={L0.foot[1] + 4} rx={25} ry={11} fill="#4a3428" />
      {/* cabeça, cabelo e fone */}
      <rect x={neck[0] - 8} y={neck[1] - 4} width={16} height={22} fill={SKIN_D} transform={`rotate(${ta * 40} ${neck[0]} ${neck[1]})`} />
      <circle cx={head[0]} cy={head[1]} r={30} fill="url(#skinG)" />
      <path d={`M${head[0] - 30},${head[1] + 2} Q${head[0] - 32},${head[1] - 34} ${head[0] + 2},${head[1] - 33} Q${head[0] + 28},${head[1] - 31} ${head[0] + 27},${head[1] - 12} Q${head[0] + 8},${head[1] - 22} ${head[0] - 8},${head[1] - 14} Q${head[0] - 16},${head[1] - 4} ${head[0] - 22},${head[1] + 12} Z`} fill={HAIR} />
      <path d={`M${head[0] + 6},${head[1] + 18} Q${head[0] + 18},${head[1] + 30} ${head[0] + 28},${head[1] + 16}`} stroke="#6a4a3a" strokeWidth={3} fill="none" opacity={0.35} />
      <path d={`M${head[0] - 22},${head[1] - 22} Q${head[0]},${head[1] - 46} ${head[0] + 20},${head[1] - 24}`} stroke="#1d1d22" strokeWidth={6} fill="none" />
      <ellipse cx={head[0] - 4} cy={head[1] + 2} rx={9} ry={12} fill="#1d1d22" />
      <circle cx={head[0] + 16} cy={head[1] - 4} r={3} fill="#2a1a12" />
      <path d={`M${head[0] + 14},${head[1] + 12} Q${head[0] + 20},${head[1] + 16 + (p.smile ?? 0.5) * 4} ${head[0] + 26},${head[1] + 10}`} stroke="#8a4a3a" strokeWidth={2.6} fill="none" />
      <ellipse cx={head[0] + 12} cy={head[1] + 6} rx={6} ry={4} fill="#e88a7a" opacity={0.45} />
      {/* braço da frente */}
      {limb(sh, A0.el, A0.hd, 24, COAT)}
      <circle cx={A0.hd[0]} cy={A0.hd[1]} r={12} fill={SKIN} />
      {p.hold === "coin" && <g transform={`translate(${A0.hd[0] + 6},${A0.hd[1] - 6})`}><circle r={10} fill="#f2cf5a" /><circle r={6} fill="#ffe89a" /></g>}
      {p.hold === "bread" && <g transform={`translate(${A1.hd[0]},${A1.hd[1]}) rotate(-60)`}><rect x={-12} y={-70} width={24} height={110} rx={12} fill="#d39a52" /><path d="M-6,-50 l12,8 M-6,-25 l12,8 M-6,0 l12,8" stroke="#a8682a" strokeWidth={3} /></g>}
      {umb > 0.05 && (
        <g transform={`translate(${A0.hd[0]},${A0.hd[1]})`} opacity={clamp01(umb * 2)}>
          <line x1={0} y1={0} x2={-10} y2={-150 * umb} stroke="#2a2a30" strokeWidth={5} />
          <path d={`M${-10 - 120 * umb},${-120 * umb} Q-10,${-210 * umb} ${-10 + 120 * umb},${-120 * umb} Q${-10 + 60 * umb},${-138 * umb} -10,${-120 * umb} Q${-10 - 60 * umb},${-138 * umb} ${-10 - 120 * umb},${-120 * umb} Z`} fill="#3d7fb8" />
          <path d={`M${-10 - 120 * umb},${-120 * umb} Q-10,${-210 * umb} ${-10 + 120 * umb},${-120 * umb}`} stroke="#6fb0e0" strokeWidth={6} fill="none" opacity={0.6} />
        </g>
      )}
    </g>
  );
};
const walkX = (t: number, keys: [number, number][]) => kf(t, keys);

// ---------------- a sombra (o "mal"): bolha escura com bordas de fumaça e olhos brilhando
type Mood = "sly" | "shock" | "sad" | "angry";
const Shadow: React.FC<{ x: number; y: number; s?: number; t: number; mood?: Mood; arm?: number; tilt?: number; op?: number; look?: number }> = ({ x, y, s = 1, t, mood = "sly", arm = 0, tilt = 0, op = 1, look = 0 }) => {
  const wob = (i: number) => Math.sin(t * 5 + i * 1.7) * 6;
  const pts: string[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI + (i / 24) * Math.PI; // de -180 a 0 graus (topo)
    const r = 100 + wob(i) * 0.4;
    pts.push(`${(Math.cos(a) * r * 0.95).toFixed(1)},${(-130 + Math.sin(a) * r * 1.25).toFixed(1)}`);
  }
  const fringe = Array.from({ length: 9 }).map((_, i) => { const xx = 95 - i * 23.75; return `${xx.toFixed(1)},${(-8 + (i % 2 ? 10 : -4) + wob(i + 5)).toFixed(1)}`; });
  const eyeH = mood === "shock" ? 15 : mood === "sad" ? 6 : mood === "angry" ? 7 : 8;
  return (
    <g transform={`translate(${x},${y}) scale(${s}) rotate(${tilt})`} opacity={op}>
      <ellipse cx={0} cy={2} rx={95} ry={14} fill="#000" opacity={0.25} />
      {Array.from({ length: 5 }).map((_, i) => { const q = (t * 0.6 + i / 5) % 1; return <circle key={i} cx={-60 + i * 30 + Math.sin(t * 2 + i) * 10} cy={-60 - q * 260} r={14 + q * 18} fill="#15121c" opacity={0.35 * (1 - q)} />; })}
      <path d={`M${pts.join(" L")} L${fringe.join(" L")} Z`} fill="url(#shadowG)" />
      {arm > 0 && <path d={`M60,-120 Q${100 + arm * 40},${-130 - arm * 10} ${120 + arm * 60},${-120 + arm * 6}`} stroke="#0f0d15" strokeWidth={22} strokeLinecap="round" fill="none" />}
      {[-1, 1].map((sd) => (
        <g key={sd} transform={`translate(${sd * 30 + 18 + look * 14},-170)`}>
          <ellipse rx={12} ry={eyeH} fill="#e9fbff" style={{ filter: "drop-shadow(0 0 8px #8fe6ff)" }} transform={mood === "angry" ? `rotate(${sd * -18})` : mood === "sad" ? `rotate(${sd * 14})` : ""} />
          {mood === "sly" && <rect x={-14} y={-12} width={28} height={8} fill="#141019" transform={`rotate(${sd * -14})`} />}
        </g>
      ))}
    </g>
  );
};

// ---------------- cenários pintados (gradientes suaves, luz de sol diagonal)
const Defs: React.FC = () => (
  <defs>
    <linearGradient id="coatG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f2c05a" /><stop offset="0.6" stopColor={COAT} /><stop offset="1" stopColor={COAT_D} /></linearGradient>
    <radialGradient id="skinG" cx="0.65" cy="0.35" r="0.8"><stop offset="0" stopColor="#f8d2b2" /><stop offset="1" stopColor={SKIN_D} /></radialGradient>
    <radialGradient id="shadowG" cx="0.4" cy="0.25" r="0.9"><stop offset="0" stopColor="#2a2433" /><stop offset="0.6" stopColor="#120f18" /><stop offset="1" stopColor="#07060a" /></radialGradient>
    <linearGradient id="brick" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8e4a36" /><stop offset="1" stopColor="#6b3426" /></linearGradient>
    <linearGradient id="walk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#cdbba3" /><stop offset="1" stopColor="#a8957d" /></linearGradient>
    <linearGradient id="road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5d5a5c" /><stop offset="1" stopColor="#3c3a3e" /></linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3b4a5a" /><stop offset="0.5" stopColor="#1f2833" /><stop offset="1" stopColor="#2c3846" /></linearGradient>
    <linearGradient id="warmWin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd890" /><stop offset="1" stopColor="#d98a3a" /></linearGradient>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9fc4dc" /><stop offset="1" stopColor="#f0dcc0" /></linearGradient>
    <linearGradient id="rays" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff2cf" stopOpacity={0.55} /><stop offset="1" stopColor="#fff2cf" stopOpacity={0} /></linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="1.4" /></filter>
    <filter id="far"><feGaussianBlur stdDeviation="3.5" /></filter>
  </defs>
);
const Rays: React.FC<{ o?: number }> = ({ o = 1 }) => (
  <g style={{ mixBlendMode: "screen" }} opacity={o}>
    {[0, 1, 2, 3].map((i) => <path key={i} d={`M${-200 + i * 380},-50 L${80 + i * 380},-50 L${900 + i * 380},1100 L${560 + i * 380},1100 Z`} fill="url(#rays)" opacity={0.35 + (i % 2) * 0.15} />)}
  </g>
);
const Sidewalk: React.FC<{ road?: boolean }> = ({ road = true }) => (
  <g>
    <rect x={0} y={GROUND - 40} width={1920} height={road ? 150 : 260} fill="url(#walk)" />
    {Array.from({ length: 9 }).map((_, i) => <line key={i} x1={i * 240 + 60} y1={GROUND - 40} x2={i * 240 + 20} y2={GROUND + 110} stroke="#9a8870" strokeWidth={3} opacity={0.5} />)}
    {road && <rect x={0} y={GROUND + 110} width={1920} height={20} fill="#b8a890" />}
    {road && <rect x={0} y={GROUND + 130} width={1920} height={500} fill="url(#road)" />}
  </g>
);
// fachada de tijolos com janelas, cornija, escada de incêndio
const Facade: React.FC<{ x0: number; w: number; col?: string; windows?: number[]; floors?: number; fire?: boolean; door?: number }> = ({ x0, w, windows = [], floors = 2, fire = false, door }) => (
  <g>
    <rect x={x0} y={-20} width={w} height={GROUND - 20} fill="url(#brick)" />
    {Array.from({ length: 30 }).map((_, i) => <line key={i} x1={x0} y1={i * 30} x2={x0 + w} y2={i * 30} stroke="#5a2a1e" strokeWidth={1.5} opacity={0.25} />)}
    <rect x={x0 - 10} y={-20} width={w + 20} height={40} fill="#5a2c20" />
    {Array.from({ length: floors }).map((_, f) => windows.map((wx, i) => (
      <g key={`${f}-${i}`} transform={`translate(${x0 + wx},${120 + f * 270})`}>
        <rect x={-8} y={-8} width={136} height={196} fill="#d8c8b0" />
        <rect x={0} y={0} width={120} height={180} fill="url(#glass)" />
        <path d="M0,0 L60,0 L0,90 Z" fill="#9fb8cc" opacity={0.25} />
        <line x1={60} y1={0} x2={60} y2={180} stroke="#d8c8b0" strokeWidth={6} />
        <rect x={-14} y={186} width={148} height={14} fill="#c9b79c" />
      </g>
    )))}
    {fire && <g stroke="#1f1a1a" strokeWidth={4} fill="none" opacity={0.85}>{[0, 1].map((f) => <g key={f}><rect x={x0 + 40} y={310 + f * 270} width={w - 80} height={10} fill="#1f1a1a" /><line x1={x0 + 40} y1={310 + f * 270} x2={x0 + 40} y2={250 + f * 270} /><line x1={x0 + w - 40} y1={310 + f * 270} x2={x0 + w - 40} y2={250 + f * 270} /><line x1={x0 + 40} y1={250 + f * 270} x2={x0 + w - 40} y2={250 + f * 270} /></g>)}</g>}
    {door !== undefined && <g transform={`translate(${x0 + door},${GROUND - 300})`}><rect x={-10} y={-14} width={150} height={274} fill="#c9b79c" /><rect x={0} y={0} width={130} height={260} fill="#2b1d16" /><rect x={10} y={10} width={110} height={110} fill="url(#warmWin)" opacity={0.8} /></g>}
  </g>
);
const Grain: React.FC<{ t: number }> = ({ t }) => (
  <g style={{ mixBlendMode: "multiply" }} opacity={0.12}>
    <filter id="grainF"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={Math.floor(t * 12) % 50} /><feColorMatrix type="saturate" values="0" /></filter>
    <rect width={1920} height={1080} filter="url(#grainF)" />
  </g>
);
const Tree: React.FC<{ x: number; s?: number; blur?: boolean }> = ({ x, s = 1, blur }) => (
  <g transform={`translate(${x},${GROUND - 40}) scale(${s})`} filter={blur ? "url(#far)" : undefined}>
    <path d="M-10,0 L-6,-260 L6,-260 L10,0 Z" fill="#4a3426" />
    {[[-60, -300, 110], [40, -340, 120], [-10, -420, 120], [80, -260, 90], [-90, -240, 80]].map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} fill={i % 2 ? "#5e7d3e" : "#7a9a4a"} opacity={0.95} />)}
  </g>
);

// ---------------- cenas
// 1) vaso de flor cai da janela; ela para para amarrar o tênis
const S1 = (t: number) => {
  const tFall = 1.75, potX = 1135, land = tFall + Math.sqrt((2 * (GROUND - 470)) / 2600);
  const potY = t < tFall ? 470 : Math.min(GROUND - 14, 470 + 0.5 * 2600 * (t - tFall) ** 2);
  const x = walkX(t, [[0, 330], [1.85, 860], [3.5, 860], [5.2, 1460]]);
  const walking = t < 1.85 || t > 3.5;
  const bend = er(t, 1.9, 2.15) * (1 - er(t, 3.15, 3.45));
  const ph = (x / 300) * Math.PI * 2;
  const crashed = t >= land;
  const k = clamp01((t - land) / 0.5);
  return (
    <g>
      <rect width={1920} height={1080} fill="url(#sky)" />
      <g filter="url(#soft)">
        <Facade x0={380} w={1240} windows={[120, 420, 720, 1020]} fire />
        <Facade x0={-120} w={480} windows={[120, 300]} />
        <Facade x0={1640} w={420} windows={[90]} />
      </g>
      {/* janela com a sombra e o vaso no parapeito */}
      <g transform="translate(1100,390)">
        <rect x={-8} y={-8} width={136} height={196} fill="#d8c8b0" />
        <rect x={0} y={0} width={120} height={180} fill="#1a1f28" />
      </g>
      <g transform="translate(1110,380)" clipPath="url(#winClip)">
        <Shadow x={60} y={240} s={0.5} t={t} mood={crashed ? (t > land + 0.6 ? "sad" : "shock") : "sly"} arm={er(t, 1.4, 1.7) * (1 - er(t, 2.0, 2.3))} look={1} />
      </g>
      <defs><clipPath id="winClip"><rect x={-10} y={10} width={120} height={180} /></clipPath></defs>
      <rect x={1086} y={576} width={148} height={14} fill="#c9b79c" />
      {!crashed && (
        <g transform={`translate(${potX + (t > tFall ? (t - tFall) * 30 : 0)},${potY}) rotate(${t > tFall ? (t - tFall) * 200 : 0})`}>
          <path d="M-24,-40 L24,-40 L18,0 L-18,0 Z" fill="#c4643c" /><rect x={-28} y={-48} width={56} height={10} fill="#d47a4a" />
          {[[-14, -70], [0, -84], [14, -72]].map(([fx, fy], i) => <g key={i}><line x1={0} y1={-40} x2={fx} y2={fy} stroke="#4f7d3c" strokeWidth={4} /><circle cx={fx} cy={fy} r={10} fill={["#e85a6a", "#f2c14e", "#e85a6a"][i]} /></g>)}
        </g>
      )}
      <Sidewalk />
      {crashed && (
        <g transform={`translate(${potX + 18},${GROUND - 10})`}>
          <ellipse cx={0} cy={4} rx={70 + k * 20} ry={14} fill="#5a3a22" opacity={0.85} />
          {Array.from({ length: 7 }).map((_, i) => { const a = (i / 7) * Math.PI + Math.PI; const r = 30 + k * (40 + i * 6); return <path key={i} d="M-12,-8 L12,-10 L8,6 L-10,6 Z" fill="#c4643c" transform={`translate(${Math.cos(a) * r},${Math.sin(a) * r * 0.25 - (1 - k) * 30}) rotate(${i * 50})`} />; })}
          <g transform={`translate(${20 + k * 30},-6) rotate(70)`}><line x1={0} y1={0} x2={0} y2={-40} stroke="#4f7d3c" strokeWidth={4} /><circle cx={0} cy={-44} r={10} fill="#e85a6a" /></g>
          {k < 1 && Array.from({ length: 10 }).map((_, i) => <circle key={i} cx={(rnd(i) - 0.5) * 160 * k} cy={-k * 60 * rnd(i + 3)} r={5} fill="#6a4a30" opacity={1 - k} />)}
        </g>
      )}
      <Walker p={{ x, ph: walking ? ph : ph, amp: walking ? 1 : 0, bend, smile: 0.6 }} />
      <Rays />
    </g>
  );
};
// 2) óleo na calçada; ela se abaixa para pegar uma moeda e passa pulando de alegria. A sombra escorrega no próprio óleo
const S2 = (t: number) => {
  const oil = er(t, 0.5, 1.4);
  const x = walkX(t, [[0, 150], [1.95, 740], [2.95, 740], [5.0, 1500]]);
  const bend = er(t, 2.0, 2.25) * (1 - er(t, 2.65, 2.9));
  const hop = x > 900 && x < 1200 ? Math.sin(((x - 900) / 300) * Math.PI) * 70 : 0;
  const walking = t < 1.95 || t > 2.95;
  const shX = kf(t, [[0, 1240], [0.4, 1100], [1.5, 1100], [1.9, 1420], [4.0, 1420], [4.4, 1230]]);
  const slip = er(t, 4.35, 4.75);
  return (
    <g>
      <rect width={1920} height={1080} fill="url(#sky)" />
      <g filter="url(#soft)">
        <Facade x0={-60} w={2040} windows={[150, 520, 1180, 1550]} floors={2} door={860} />
        {/* porta de aço de loja fechada */}
        <rect x={1700} y={GROUND - 330} width={260} height={290} fill="#8a8f96" />
        {Array.from({ length: 12 }).map((_, i) => <line key={i} x1={1700} y1={GROUND - 330 + i * 24} x2={1960} y2={GROUND - 330 + i * 24} stroke="#6a6f76" strokeWidth={4} />)}
      </g>
      <Sidewalk />
      <ellipse cx={1010} cy={GROUND - 4} rx={150 * oil} ry={20 * oil} fill="#141216" opacity={0.92} />
      <ellipse cx={980} cy={GROUND - 8} rx={60 * oil} ry={5 * oil} fill="#6a6f90" opacity={0.5} />
      {/* moeda brilhando */}
      {t < 2.5 && <g transform={`translate(800,${GROUND - 6})`}><ellipse rx={10} ry={4} fill="#f2cf5a" /><path d="M0,-18 L3,-6 L14,-4 L3,-2 L0,10 L-3,-2 L-14,-4 L-3,-6 Z" fill="#fff6c8" opacity={0.6 + 0.4 * Math.sin(t * 12)} /></g>}
      {/* lata de lixo */}
      <g transform={`translate(1460,${GROUND - 30})`}><rect x={-70} y={-170} width={140} height={170} rx={10} fill="#4f6a5a" /><rect x={-78} y={-186} width={156} height={22} rx={8} fill="#3d5546" />{[-40, 0, 40].map((xx) => <line key={xx} x1={xx} y1={-150} x2={xx} y2={-20} stroke="#3d5546" strokeWidth={6} />)}</g>
      <Shadow x={shX} y={GROUND - 4 - slip * 0} s={0.82} t={t} mood={slip > 0 ? "shock" : t > 3.2 ? "angry" : "sly"} arm={t > 0.5 && t < 1.5 ? 0.8 : 0} tilt={slip * -85} look={t > 1.8 && t < 4 ? -1 : 0} />
      {t > 0.5 && t < 1.5 && <g transform={`translate(${shX + 120},${GROUND - 120}) rotate(120)`}><rect x={-14} y={-40} width={28} height={70} rx={8} fill="#c9a640" /><rect x={-6} y={-56} width={12} height={18} fill="#8a7020" /></g>}
      <Walker p={{ x, y: GROUND - hop, ph: (x / 300) * Math.PI * 2, amp: walking ? 1 : 0, bend, hold: t > 2.5 && t < 3.6 ? "coin" : null, smile: t > 2.6 ? 1 : 0.5 }} />
      <Rays />
    </g>
  );
};
// 3) a placa da padaria despenca; ela tinha entrado na padaria um segundo antes
const S3 = (t: number) => {
  const doorX = 960;
  const x = t < 2.7 ? walkX(t, [[0, 220], [2.7, doorX]]) : walkX(t, [[4.0, doorX], [5.4, 1420]]);
  const op = t < 2.5 ? 1 : t < 2.75 ? 1 - (t - 2.5) / 0.25 : t < 3.95 ? 0 : clamp01((t - 3.95) / 0.25);
  const snip = 2.9, signY = t < snip ? 560 : Math.min(GROUND - 60, 560 + 0.5 * 2600 * (t - snip) ** 2);
  const landed = signY >= GROUND - 60;
  return (
    <g>
      <rect width={1920} height={1080} fill="url(#sky)" />
      <g filter="url(#soft)">
        <rect x={-20} y={-20} width={1960} height={GROUND - 20} fill="#e6d3b3" />
        <rect x={-20} y={-20} width={1960} height={60} fill="#b89a74" />
        {[200, 520, 1500, 1720].map((wx) => <g key={wx} transform={`translate(${wx},150)`}><rect x={-8} y={-8} width={156} height={206} fill="#f2e6d0" /><rect x={0} y={0} width={140} height={190} fill="url(#glass)" /></g>)}
        {/* vitrine da padaria */}
        <rect x={500} y={GROUND - 330} width={380} height={290} fill="url(#warmWin)" />
        {[560, 660, 760].map((bx) => <ellipse key={bx} cx={bx} cy={GROUND - 120} rx={40} ry={18} fill="#c98a4a" />)}
        <rect x={doorX - 10} y={GROUND - 330} width={150} height={290} fill="#c9b79c" />
        <rect x={doorX} y={GROUND - 320} width={130} height={280} fill="#3a2418" />
        <rect x={doorX + 10} y={GROUND - 310} width={110} height={120} fill="url(#warmWin)" opacity={0.85} />
        {/* toldo listrado */}
        {Array.from({ length: 12 }).map((_, i) => <path key={i} d={`M${480 + i * 56},${GROUND - 400} L${536 + i * 56},${GROUND - 400} L${546 + i * 56},${GROUND - 340} L${490 + i * 56},${GROUND - 340} Z`} fill={i % 2 ? "#f4efe6" : "#c8443a"} />)}
      </g>
      {/* cheirinho de pão saindo da porta */}
      {Array.from({ length: 3 }).map((_, i) => { const q = (t * 0.5 + i / 3) % 1; return <path key={i} d={`M${doorX + 40 + i * 20},${GROUND - 260 - q * 120} q12,-16 0,-32 q-12,-16 0,-32`} stroke="#fff6e0" strokeWidth={5} fill="none" opacity={0.6 * Math.sin(q * Math.PI)} />; })}
      {/* suporte e placa */}
      <rect x={1150} y={470} width={200} height={10} fill="#2a2420" />
      {t < snip && [1180, 1320].map((rx) => <line key={rx} x1={rx} y1={480} x2={rx} y2={signY} stroke="#5a4a3a" strokeWidth={3} />)}
      <g transform={`translate(1250,${signY}) rotate(${t > snip ? Math.min(25, (t - snip) * 80) : 0})`}>
        <rect x={-110} y={0} width={220} height={70} rx={10} fill="#3d5a3a" />
        <rect x={-100} y={8} width={200} height={54} rx={6} fill="none" stroke="#e8d29a" strokeWidth={3} />
        <text x={0} y={46} textAnchor="middle" fontFamily="Georgia, serif" fontSize={34} fill="#f2e2b0" fontWeight={700}>PADARIA</text>
      </g>
      {/* sombra no telhado com tesoura */}
      <Shadow x={1255} y={420} s={0.55} t={t} mood={landed ? (t > 4.2 ? "sad" : "angry") : "sly"} arm={t > 1.2 && t < 3.0 ? 0.6 + 0.2 * Math.sin(t * 20) : 0} look={-0.6} />
      <Sidewalk />
      {landed && <g>{Array.from({ length: 12 }).map((_, i) => { const k = clamp01((t - (snip + 0.42)) / 0.6); return <circle key={i} cx={1250 + (rnd(i) - 0.5) * 300 * k} cy={GROUND - 30 - k * 80 * rnd(i + 2)} r={8 + 10 * rnd(i + 4)} fill="#e6d8c0" opacity={(1 - k) * 0.8} />; })}</g>}
      <Walker p={{ x, ph: (x / 300) * Math.PI * 2, amp: 1, op, look: t > 1.9 && t < 2.7 ? 1 : 0, hold: t > 3.9 ? "bread" : null, smile: t > 3.9 ? 1 : 0.6 }} />
      <Rays />
    </g>
  );
};
// 4) carro passa voando na poça; ela tinha aberto o guarda-chuva por causa de umas gotinhas
const S4 = (t: number) => {
  const x = walkX(t, [[0, 220], [1.4, 590], [2.05, 590], [5.0, 1240]]);
  const walking = t < 1.4 || t > 2.05;
  const umb = er(t, 1.5, 1.95);
  const carX = kf(t, [[1.9, 2400], [3.4, -700]]);
  const splash = clamp01((t - 2.62) / 0.7);
  const puddle = 700;
  return (
    <g>
      <rect width={1920} height={1080} fill="#b9c4cc" />
      <g filter="url(#far)" opacity={0.85}>
        {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={i * 330 - 40} y={200 + (i % 3) * 60} width={300} height={GROUND} fill={["#8a6a5a", "#7a7f88", "#9a7a62", "#6f7a6a"][i % 4]} />)}
      </g>
      <g filter="url(#soft)"><Facade x0={-40} w={2000} windows={[160, 600, 1060, 1500]} floors={1} /></g>
      <Sidewalk />
      {/* poça */}
      <ellipse cx={puddle} cy={GROUND + 175} rx={170} ry={22} fill="#7f8f9f" opacity={0.85} />
      {/* garoa */}
      {Array.from({ length: 40 }).map((_, i) => { const q = ((t * 1.3 + rnd(i)) % 1); return <line key={i} x1={rnd(i + 9) * 1920} y1={q * 1100 - 40} x2={rnd(i + 9) * 1920 - 6} y2={q * 1100 - 14} stroke="#e8f0f8" strokeWidth={2} opacity={0.45} />; })}
      {t > 1.25 && t < 1.55 && <circle cx={x + 30} cy={GROUND - 395 + (t - 1.25) * 300} r={6} fill="#d8ecff" />}
      <Walker p={{ x, ph: (x / 300) * Math.PI * 2, amp: walking ? 0.9 : 0, umb, look: t > 1.3 && t < 1.6 ? 1 : 0, smile: 0.7 }} />
      {/* jato de água batendo no guarda-chuva */}
      {splash > 0 && splash < 1 && (
        <g>
          {Array.from({ length: 22 }).map((_, i) => { const a = -Math.PI / 2 - 0.9 + rnd(i) * 1.1; const r = 80 + splash * (260 + rnd(i + 2) * 200); const px = puddle + Math.cos(a) * r * 0.9 - 40, py = GROUND + 160 + Math.sin(a) * r + splash * splash * 300; return <circle key={i} cx={Math.max(px, x - 60)} cy={Math.max(py, GROUND - 480)} r={7 + rnd(i + 5) * 9} fill="#c9dcec" opacity={0.85 * (1 - splash)} />; })}
          <path d={`M${puddle - 160},${GROUND + 170} Q${puddle - 60},${GROUND - 200 * splash} ${x - 40},${GROUND - 420}`} stroke="#d6e6f2" strokeWidth={30 * (1 - splash)} fill="none" opacity={0.7} />
        </g>
      )}
      {/* carro vermelho com a sombra ao volante */}
      <g transform={`translate(${carX},${GROUND + 200})`}>
        <ellipse cx={0} cy={6} rx={260} ry={18} fill="#000" opacity={0.3} />
        <path d="M-260,-30 Q-250,-90 -170,-100 L-110,-170 Q-90,-190 -40,-190 L120,-190 Q160,-188 190,-120 L250,-100 Q275,-90 270,-30 Z" fill="#c23a2e" />
        <path d="M-100,-160 L-60,-178 L40,-178 L40,-110 L-140,-110 Z" fill="#26313c" />
        <path d="M60,-178 L120,-178 Q150,-170 172,-110 L60,-110 Z" fill="#26313c" />
        <g transform="translate(-40,-120)"><Shadow x={0} y={10} s={0.28} t={t} mood="sly" look={-1} /></g>
        {[-160, 160].map((wx) => <g key={wx}><circle cx={wx} cy={-20} r={44} fill="#1a1a1e" /><circle cx={wx} cy={-20} r={20} fill="#9aa0a8" /></g>)}
        <rect x={250} y={-80} width={22} height={18} rx={4} fill="#fff2c0" />
        {Array.from({ length: 4 }).map((_, i) => <line key={i} x1={280 + i * 40} y1={-120 + i * 26} x2={420 + i * 60} y2={-120 + i * 26} stroke="#ffffff" strokeWidth={4} opacity={0.4} />)}
      </g>
    </g>
  );
};
// 5) a sombra solta um carrinho de mão; o sinal abre e ela atravessa — o carrinho passa atrás e derruba as caixas
const S5 = (t: number) => {
  const xIn = walkX(t, [[0, 520], [1.2, 900]]);
  const cross = er(t, 2.45, 4.6);
  const pY = GROUND + cross * 230, pS = 1 + cross * 0.35;
  const pX = xIn + cross * 40;
  const walking = t < 1.2 || t > 2.45;
  const green = t > 2.35;
  const cartRel = 1.45;
  const cartX = t < cartRel ? kf(t, [[0.6, 1780], [cartRel, 1640]]) : 1640 - 250 * (t - cartRel) - 0.5 * 520 * (t - cartRel) ** 2;
  const hitBoxes = cartX < 420;
  const cx = Math.max(cartX, 420);
  const shX = t < cartRel ? cartX + 200 : kf(t, [[cartRel, 1840], [3.6, 1840], [4.4, 520]]);
  const fall = er(t, 4.3, 4.7);
  return (
    <g>
      <rect width={1920} height={1080} fill="url(#sky)" />
      <g filter="url(#soft)"><Facade x0={-40} w={2000} windows={[140, 520, 1300, 1660]} floors={2} /></g>
      <Tree x={1180} s={0.9} />
      <Sidewalk />
      {/* faixa de pedestres */}
      {Array.from({ length: 4 }).map((_, i) => <path key={i} d={`M${820 + i * 4},${GROUND + 140 + i * 24} L${1080 + i * 14},${GROUND + 140 + i * 24} L${1084 + i * 14},${GROUND + 156 + i * 24} L${818 + i * 4},${GROUND + 156 + i * 24} Z`} fill="#eeeae0" opacity={0.85} />)}
      {/* semáforo de pedestre */}
      <g transform={`translate(1110,${GROUND - 40})`}><rect x={-8} y={-360} width={16} height={360} fill="#2a2a30" /><rect x={-34} y={-460} width={68} height={110} rx={10} fill="#1a1a20" /><circle cx={0} cy={-432} r={18} fill={green ? "#3a1414" : "#ff4a3a"} /><circle cx={0} cy={-378} r={18} fill={green ? "#4aff8a" : "#143a1e"} style={green ? { filter: "drop-shadow(0 0 8px #4aff8a)" } : undefined} /></g>
      {/* pilha de caixas */}
      {[[330, 0], [400, 0], [365, 1], [330, 2]].map(([bx, row], i) => { const tumble = hitBoxes ? clamp01((t - 3.15) / 0.5) : 0; const ang = tumble * (i % 2 ? -70 : 60) * (row + 1) * 0.6; const off = tumble * (i % 2 ? -40 : 30) * (row + 1); return <g key={i} transform={`translate(${bx + off},${GROUND - 40 - row * 70 + tumble * row * 70}) rotate(${ang})`}><rect x={-36} y={-70} width={72} height={70} fill="#c49a62" /><line x1={-36} y1={-35} x2={36} y2={-35} stroke="#9a7442" strokeWidth={4} /></g>; })}
      {/* carrinho de mão */}
      <g transform={`translate(${cx},${GROUND - 40}) rotate(${hitBoxes ? Math.min(60, (t - 3.15) * 160) : 0})`}>
        <circle cx={-70} cy={-28} r={28} fill="#2a2a30" /><circle cx={-70} cy={-28} r={10} fill="#8a8f96" transform={`rotate(${-cartX})`} />
        <path d="M-120,-60 L60,-60 L30,-130 L-110,-130 Z" fill="#3d7f6a" />
        {[-90, -50, -10, 20].map((bx) => <rect key={bx} x={bx} y={-150} width={34} height={22} fill="#b8563a" />)}
        <line x1={50} y1={-90} x2={150} y2={-70} stroke="#6a4a30" strokeWidth={8} />
      </g>
      <Shadow x={shX} y={GROUND - 30} s={0.8} t={t} mood={fall > 0 ? "shock" : t > 3.2 ? "angry" : "sly"} arm={t > 0.6 && t < cartRel ? 0.7 : 0} look={-1} tilt={fall * -40} />
      {fall > 0 && <g transform={`translate(${shX - 10},${GROUND - 200 + fall * 120}) rotate(${fall * 20})`}><rect x={-36} y={-70} width={72} height={70} fill="#c49a62" /></g>}
      <Walker p={{ x: pX, y: pY, s: pS, ph: (t * 2.2) * Math.PI, amp: walking ? 0.9 : 0, look: t > 2.0 && t < 2.6 ? 1 : 0, smile: 0.7 }} />
      <Rays o={0.8} />
    </g>
  );
};
// 6) a sombra soterrada nas caixas; ela some no fim da rua, ao sol, com o fone
const S6 = (t: number) => {
  const x = walkX(t, [[0, 1150], [4.2, 1520]]);
  return (
    <g>
      <rect width={1920} height={1080} fill="url(#sky)" />
      <g filter="url(#far)"><Facade x0={1050} w={900} windows={[120, 480]} floors={2} /></g>
      <g filter="url(#soft)"><Facade x0={-60} w={1060} windows={[140, 520]} floors={2} /></g>
      <rect x={1000} y={0} width={60} height={GROUND} fill="#fff2cf" opacity={0.25} />
      <Sidewalk />
      {/* monte de caixas com a sombra embaixo; só os olhos piscando */}
      <g transform={`translate(480,${GROUND - 40})`}>
        {[[-140, 0, -12], [-60, 0, 8], [20, 0, -4], [100, 0, 14], [-100, -66, 22], [-20, -70, -10], [60, -64, 6], [-60, -134, -18], [20, -130, 12]].map(([bx, by, a], i) => <g key={i} transform={`translate(${bx},${by}) rotate(${a})`}><rect x={-40} y={-70} width={80} height={70} fill={i % 2 ? "#c49a62" : "#b48a52"} /><line x1={-40} y1={-35} x2={40} y2={-35} stroke="#9a7442" strokeWidth={4} /></g>)}
        <rect x={-110} y={-110} width={150} height={48} fill="#0d0b12" />
        {[-1, 1].map((sd) => <ellipse key={sd} cx={-40 + sd * 26} cy={-86} rx={10} ry={t % 1.6 < 0.12 ? 1 : 5} fill="#e9fbff" style={{ filter: "drop-shadow(0 0 6px #8fe6ff)" }} transform={`rotate(${sd * 14} ${-40 + sd * 26} -86)`} />)}
        <g transform={`translate(-20,${t < 1.2 ? -400 + 0.5 * 2600 * (t ** 2) : -200})`}>{t < 1.35 && <rect x={-40} y={-70} width={80} height={70} fill="#c49a62" />}</g>
      </g>
      <Walker p={{ x, s: 0.62, y: GROUND - 18, ph: (x / 180) * Math.PI * 2, amp: 1, hold: "bread", smile: 1 }} />
      {Array.from({ length: 3 }).map((_, i) => { const q = (t * 0.5 + i / 3) % 1; return <text key={i} x={x + 40 + q * 40} y={GROUND - 270 - q * 80} fontSize={34} fill="#3a2a22" opacity={Math.sin(q * Math.PI) * 0.8} fontFamily="DejaVu Sans">♪</text>; })}
      <Rays />
    </g>
  );
};
const SCENES = [S1, S2, S3, S4, S6];
// câmera de cada cena: ponto do mundo que fica no centro do quadro + zoom
const CAMS: [number, number, number][] = [[1.3, 1000, 690], [1.3, 1020, 690], [1.25, 1060, 650], [1.12, 860, 790], [1.22, 820, 700]];

export const Escapa: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const s = sceneOf(t), lt = t - ST[s];
  const fade = Math.max(0, 1 - lt / 0.15) * (s > 0 ? 1 : 0);
  const VW = 1080, VH = 608, VY = Math.round((1920 - VH) / 2);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Audio src={staticFile("escapa/sfx.wav")} />
      <div style={{ position: "absolute", left: 0, top: VY, width: VW, height: VH, overflow: "hidden" }}>
        <svg width={VW} height={VH} viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
          <Defs />
          <g transform={`translate(960,540) scale(${CAMS[s][0] + lt * 0.006}) translate(${-CAMS[s][1]},${-CAMS[s][2]})`}>{SCENES[s](lt)}</g>
          <Grain t={t} />
          <radialGradient id="vg" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stopColor="#000" stopOpacity={0} /><stop offset="1" stopColor="#000" stopOpacity={0.45} /></radialGradient>
          <rect width={1920} height={1080} fill="url(#vg)" />
          <rect width={1920} height={1080} fill="#000" opacity={fade} />
        </svg>
      </div>
    </AbsoluteFill>
  );
};
