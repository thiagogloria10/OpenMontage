import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, Img, Sequence, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// ==================================================================
// "A sua janela de energia" — animação 2D moderna (evolução do modelo "Placar" da 8+8+8):
// boneco vetorial liso, cartões de vidro, gráfico de energia das 24 h costurando o vídeo, movimento com mola.
// Narração PROVISÓRIA (Piper) frase a frase em public/janela_energia/fala/nN.wav.
// ==================================================================
const D = "janela_energia";
export const FPS = 30;
const BG1 = "#0d1117", BG2 = "#161d29";
const GOLD = "#e8b04b", GOLD2 = "#ffd27a", TEAL = "#4fb3bf", TEAL2 = "#2b6f78", RED = "#ef5a5a", WHITE = "#f4f1ea", MUTED = "#8a93a6";
const BARLOW = "'Barlow Condensed', sans-serif";
const HOOK = ["VOCÊ NÃO É PREGUIÇOSO.", "ESTÁ NO HORÁRIO ERRADO."]; // v2 (análise)

// ------------------------------------------------------------------ falas e cenas
const DUR = [4.76, 4.01, 3.78, 3.63, 4.25, 2.28, 5.46, 2.76, 5.17, 5.29, 3.12, 4.2, 4.13]; // v3: cenas 0,15 s antes de cada fala em narrador.wav (voz do narrador do Marcos, áudio inteiro)
const ST = DUR.reduce<number[]>((a, d, i) => [...a, i === 0 ? 0 : a[i - 1] + DUR[i - 1]], []);
export const TOTAL = ST[ST.length - 1] + DUR[DUR.length - 1];
// [texto, arquivo, início na cena, duração da fala]
const LINES: [string, number, number, number][] = [
  ["Você passa a tarde inteira travado e só destrava às dez da noite?", 0, 0.18, 4.12],
  ["Sabe aquela tarefa que pesa quando você começa o dia...", 1, 0.15, 3.1],
  ["e some de repente em meia hora, lá pelo fim da tarde?", 2, 0.15, 3.17],
  ["Isso tem a ver com o horário em que a sua energia aparece.", 3, 0.15, 3.02],
  ["Tem gente que pensa melhor cedo. Tem gente que só engata de noite.", 4, 0.15, 3.64],
  ["Cada corpo tem a sua janela.", 5, 0.15, 1.67],
  ["O erro é colocar a tarefa mais difícil na hora em que você já está esgotado,", 6, 0.15, 4.85],
  ["e depois concluir que falta disciplina.", 7, 0.15, 2.15],
  ["Faz um teste: anote de hora em hora, de 1 a 5, o quanto você rende.", 8, 0.15, 4.56],
  ["No fim da semana, olha onde ficaram as notas mais altas. Essa é a sua janela.", 9, 0.15, 4.68],
  ["Coloca ali a tarefa que mais pesa no seu dia.", 10, 0.15, 2.51],
  ["O resto, tipo mensagem e planilha, vai para as horas baixas.", 11, 0.15, 3.59],
  ["Comenta aqui a hora em que você mais rende.", 12, 0.15, 2.5],
];
const WORDT: Record<number, number[]> = { 0: [0, 0.26, 0.64, 0.86, 1.08, 1.48, 2.04, 2.42, 2.62, 3.14, 3.34, 3.72, 3.72], 1: [0.23, 0.49, 0.97, 1.15, 1.55, 1.79, 2.15, 2.55, 2.75, 3.59], 2: [0.0, 0.04, 0.36, 0.54, 0.94, 1.18, 1.46, 1.94, 2.22, 2.4, 2.6, 2.74], 3: [0.08, 0.28, 0.5, 0.6, 0.78, 0.94, 1.08, 1.4, 1.56, 1.68, 1.8, 1.96, 2.4], 4: [0, 0.07, 0.39, 0.57, 0.87, 1.13, 1.87, 2.01, 2.31, 2.49, 2.67, 3.05, 3.23], 5: [0, 0.18, 0.62, 0.88, 0.96, 1.14], 6: [0, 0.12, 0.32, 0.58, 0.84, 1.12, 1.52, 1.78, 2.14, 2.46, 2.74, 3.04, 3.12, 3.42, 3.66, 3.92], 7: [0, 0.04, 0.32, 0.94, 1.12, 1.42], 8: [0, 0.2, 0.36, 1.08, 1.46, 1.66, 1.84, 1.96, 2.42, 2.62, 2.74, 2.82, 3.18, 3.52, 3.8, 4.14], 9: [0, 0.17, 0.39, 0.53, 1.29, 1.55, 1.71, 2.19, 2.29, 2.63, 2.81, 3.59, 3.83, 3.95, 4.03, 4.17], 10: [0, 0.4, 0.58, 0.68, 1.08, 1.24, 1.5, 1.88, 1.98, 2.14], 11: [0, 0.1, 0.68, 0.9, 1.5, 1.64, 2.38, 2.5, 2.66, 2.84, 2.98], 12: [0, 0.42, 0.66, 0.86, 1.1, 1.38, 1.48, 1.76, 2.1] }; // tempos reais (faster-whisper)
const KEY = ["travado", "dez", "pesa", "meia", "energia", "cedo", "noite", "janela", "difícil", "esgotado", "disciplina", "teste", "5", "altas", "tarefa", "dia", "baixas", "comenta", "rende"];

// ------------------------------------------------------------------ utilidades
type V = [number, number];
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (x: number) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const er = (t: number, a: number, b: number) => ease((t - a) / (b - a));
// mola: entra passando um pouco do ponto e volta
const spring = (t: number, a: number, dur = 0.5) => { const x = (t - a) / dur; if (x <= 0) return 0; if (x >= 1) return 1; return 1 - Math.exp(-6 * x) * Math.cos(9 * x); };
const sceneOf = (t: number) => { let s = 0; for (let i = 0; i < ST.length; i++) if (t >= ST[i]) s = i; return s; };
const blink = (t: number, p = 3.1, o = 0) => { const q = ((t + o) % p + p) % p; return q < 0.12 ? 1 - Math.abs(q - 0.06) / 0.06 : 0; };
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(Math.floor(min % 60)).padStart(2, "0")}`;

const useFonts = () => {
  const [h] = useState(() => delayRender("fontes"));
  useEffect(() => {
    const f7 = new FontFace("Barlow Condensed", `url(${staticFile(`${D}/barlow-condensed-latin-700-normal.woff2`)})`, { weight: "700" });
    const f6 = new FontFace("Barlow Condensed", `url(${staticFile(`${D}/barlow-condensed-latin-600-normal.woff2`)})`, { weight: "600" });
    Promise.all([f7.load(), f6.load()]).then((fs) => { fs.forEach((f) => document.fonts.add(f)); continueRender(h); }).catch(() => continueRender(h));
  }, [h]);
};

// ------------------------------------------------------------------ peças de design
const Defs: React.FC = () => (
  <defs>
    <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity={0.11} /><stop offset="1" stopColor="#ffffff" stopOpacity={0.04} /></linearGradient>
    <linearGradient id="goldG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={GOLD2} /><stop offset="1" stopColor={GOLD} /></linearGradient>
    <linearGradient id="tealG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7fd6df" /><stop offset="1" stopColor={TEAL2} /></linearGradient>
    <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe1c4" /><stop offset="1" stopColor="#f2c39c" /></linearGradient>
    <linearGradient id="hood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b4a66" /><stop offset="1" stopColor="#26324a" /></linearGradient>
    <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={GOLD} stopOpacity={0.45} /><stop offset="1" stopColor={GOLD} stopOpacity={0} /></linearGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="18" floodColor="#000" floodOpacity="0.45" /></filter>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14" /></filter>
  </defs>
);
// cartão de vidro
const Glass: React.FC<{ x: number; y: number; w: number; h: number; r?: number; p?: number; children?: React.ReactNode; hl?: number }> = ({ x, y, w, h, r = 34, p = 1, children, hl = 0 }) => {
  const k = p;
  if (k <= 0.001) return null;
  return (
    <g transform={`translate(${x + w / 2},${y + h / 2}) scale(${lerp(0.86, 1, k)}) translate(${-x - w / 2},${-y - h / 2})`} opacity={clamp01(k * 1.4)}>
      <rect x={x} y={y} width={w} height={h} rx={r} fill="url(#glass)" stroke={hl > 0 ? GOLD : "#ffffff"} strokeOpacity={hl > 0 ? 0.4 + hl * 0.5 : 0.16} strokeWidth={hl > 0 ? 3 : 2} filter="url(#soft)" />
      <rect x={x + 2} y={y + 2} width={w - 4} height={Math.min(60, h / 3)} rx={r - 2} fill="#ffffff" opacity={0.04} />
      {children}
    </g>
  );
};
const Pill: React.FC<{ x: number; y: number; txt: string; color?: string; size?: number; p?: number; bg?: string }> = ({ x, y, txt, color = WHITE, size = 40, p = 1, bg = "#ffffff" }) => {
  if (p <= 0.001) return null;
  const w = txt.length * size * 0.52 + size * 1.1;
  return (
    <g transform={`translate(${x},${y}) scale(${lerp(0.6, 1, p)})`} opacity={clamp01(p * 1.5)}>
      <rect x={-w / 2} y={-size * 0.78} width={w} height={size * 1.56} rx={size * 0.78} fill={bg} fillOpacity={0.09} stroke="#ffffff" strokeOpacity={0.18} strokeWidth={2} />
      <text x={0} y={size * 0.34} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={size} fill={color} letterSpacing={2}>{txt}</text>
    </g>
  );
};

// ------------------------------------------------------------------ boneco moderno (vetorial liso)
type Pose = { x: number; y: number; s: number; mood: number; lean?: number; sit?: boolean; typing?: number; armL?: V; armR?: V; look?: number; drain?: number; hop?: number; t: number };
const Buddy: React.FC<Pose> = ({ x, y, s, mood, lean = 0, sit = false, typing = 0, armL, armR, look = 0, drain = 0, hop = 0, t }) => {
  const by = -hop * 40 + drain * 18 + Math.sin(t * 2.2) * 3; // respiração
  const headY = -250 + by + drain * 14;
  const sh: V = [0, -175 + by];
  const tl = (Math.sin(t * 22) * 8) * typing;
  const aL: V = armL ?? (sit ? [-70, -95 + by + tl] : [-82, -40 + by]);
  const aR: V = armR ?? (sit ? [70, -95 + by - tl] : [82, -40 + by]);
  const elbow = (a: V, side: number): V => [lerp(sh[0] + side * 52, a[0], 0.5) + side * 22, lerp(sh[1] + 10, a[1], 0.5) + 18];
  const arm = (a: V, side: number) => { const e = elbow(a, side); return `M${sh[0] + side * 48},${sh[1] + 12} Q${e[0]},${e[1]} ${a[0]},${a[1]}`; };
  const op = 1 - blink(t, 3.2, x * 0.01) * 0.9;
  return (
    <g transform={`translate(${x},${y}) scale(${s}) rotate(${lean})`}>
      <ellipse cx={0} cy={6} rx={92} ry={14} fill="#000" opacity={0.3} />
      {/* pernas */}
      {sit ? (
        <g stroke="#1c2436" strokeWidth={30} strokeLinecap="round" fill="none">
          <path d={`M-24,-60 L-24,-30 L-36,0`} /><path d={`M24,-60 L24,-30 L36,0`} />
        </g>
      ) : (
        <g stroke="#1c2436" strokeWidth={32} strokeLinecap="round" fill="none">
          <path d={`M-22,${-70 + by} Q-26,${-30} -30,-6`} /><path d={`M22,${-70 + by} Q26,${-30} 30,-6`} />
        </g>
      )}
      <g fill="#f4f1ea">{sit ? <><ellipse cx={-42} cy={0} rx={22} ry={10} /><ellipse cx={42} cy={0} rx={22} ry={10} /></> : <><ellipse cx={-34} cy={-2} rx={24} ry={11} /><ellipse cx={34} cy={-2} rx={24} ry={11} /></>}</g>
      {/* corpo (moletom) */}
      <path d={`M-64,${-60 + by} Q-70,${-170 + by} -40,${-188 + by} L40,${-188 + by} Q70,${-170 + by} 64,${-60 + by} Q0,${-44 + by} -64,${-60 + by} Z`} fill="url(#hood)" />
      <path d={`M-22,${-188 + by} Q0,${-160 + by} 22,${-188 + by}`} stroke="#ffffff" strokeOpacity={0.18} strokeWidth={5} fill="none" />
      <rect x={-30} y={-120 + by} width={60} height={26} rx={10} fill="#ffffff" opacity={0.06} />
      {/* braços */}
      <g stroke="url(#hood)" strokeWidth={28} strokeLinecap="round" fill="none"><path d={arm(aL, -1)} /><path d={arm(aR, 1)} /></g>
      <circle cx={aL[0]} cy={aL[1]} r={16} fill="url(#skin)" /><circle cx={aR[0]} cy={aR[1]} r={16} fill="url(#skin)" />
      {/* cabeça */}
      <circle cx={look * 6} cy={headY} r={72} fill="url(#skin)" />
      <path d={`M${-72 + look * 6},${headY - 8} Q${-70 + look * 6},${headY - 86} ${look * 6 + 6},${headY - 80} Q${70 + look * 6},${headY - 78} ${72 + look * 6},${headY - 12} Q${30 + look * 6},${headY - 50} ${-72 + look * 6},${headY - 8} Z`} fill="#2a2230" />
      {/* olhos */}
      {[-1, 1].map((sd) => (
        <ellipse key={sd} cx={sd * 26 + look * 14} cy={headY + 8 + drain * 4} rx={9} ry={12 * op * (1 - drain * 0.45)} fill="#1c1720" />
      ))}
      {[-1, 1].map((sd) => <path key={sd} d={`M${sd * 14 + look * 14},${headY - 14 - mood * 3 + drain * 4} L${sd * 38 + look * 14},${headY - 16 + (mood < 0 ? sd * 0 + 4 : -2) + drain * 6}`} stroke="#1c1720" strokeWidth={5} strokeLinecap="round" />)}
      <path d={`M${-18 + look * 12},${headY + 36} Q${look * 12},${headY + 36 + mood * 16} ${18 + look * 12},${headY + 36}`} stroke="#1c1720" strokeWidth={5} strokeLinecap="round" fill={mood > 0.6 ? "#1c1720" : "none"} />
      {[-1, 1].map((sd) => <ellipse key={sd} cx={sd * 46 + look * 10} cy={headY + 30} rx={10} ry={6} fill="#ff8f7a" opacity={0.35 + Math.max(0, mood) * 0.25} />)}
    </g>
  );
};
const Desk: React.FC<{ x: number; y: number; glow?: number; t: number }> = ({ x, y, glow = 0, t }) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={-80} y={-150} width={160} height={110} rx={12} fill="#20283a" stroke="#ffffff" strokeOpacity={0.15} strokeWidth={2} />
    <rect x={-70} y={-140} width={140} height={90} rx={8} fill={glow > 0 ? "#2a3550" : "#182030"} />
    {glow > 0 && [0, 1, 2, 3].map((i) => <rect key={i} x={-58} y={-128 + i * 20} width={(40 + ((i * 37 + Math.floor(t * 12) * 13) % 70)) * glow} height={8} rx={4} fill={GOLD} opacity={0.8} />)}
    <rect x={-120} y={-40} width={240} height={14} rx={7} fill="#2b3550" />
    <rect x={-220} y={-30} width={440} height={22} rx={11} fill="#33405e" />
    <rect x={-200} y={-8} width={18} height={130} rx={8} fill="#222b40" /><rect x={182} y={-8} width={18} height={130} rx={8} fill="#222b40" />
  </g>
);
const Battery: React.FC<{ x: number; y: number; lvl: number; t: number; p?: number }> = ({ x, y, lvl, t, p = 1 }) => {
  if (p <= 0) return null;
  const c = lvl < 0.3 ? RED : lvl < 0.6 ? GOLD : "#6ad08a";
  const bl = lvl < 0.3 ? 0.5 + 0.5 * Math.sin(t * 9) : 1;
  return (
    <g transform={`translate(${x},${y}) scale(${lerp(0.5, 1, p)})`} opacity={p}>
      <rect x={-50} y={-24} width={92} height={48} rx={12} fill="none" stroke={WHITE} strokeOpacity={0.8} strokeWidth={5} />
      <rect x={44} y={-10} width={10} height={20} rx={4} fill={WHITE} opacity={0.8} />
      <rect x={-42} y={-16} width={Math.max(6, 76 * lvl)} height={32} rx={7} fill={c} opacity={bl} />
    </g>
  );
};
const Bulb: React.FC<{ x: number; y: number; p: number }> = ({ x, y, p }) => p <= 0 ? null : (
  <g transform={`translate(${x},${y}) scale(${p})`}>
    <circle r={70} fill={GOLD} opacity={0.35} filter="url(#glow)" />
    <path d="M-30,10 Q-44,-40 0,-52 Q44,-40 30,10 L18,30 L-18,30 Z" fill="url(#goldG)" />
    <rect x={-16} y={32} width={32} height={16} rx={5} fill="#c9cfdb" />
    {[0, 1, 2, 3, 4].map((i) => { const a = -Math.PI / 2 + (i - 2) * 0.55; return <line key={i} x1={Math.cos(a) * 64} y1={Math.sin(a) * 64 - 10} x2={Math.cos(a) * 84} y2={Math.sin(a) * 84 - 10} stroke={GOLD2} strokeWidth={7} strokeLinecap="round" />; })}
  </g>
);
const ClockPill: React.FC<{ x: number; y: number; min: number; p?: number; hot?: boolean }> = ({ x, y, min, p = 1, hot = false }) => (
  <g opacity={p} transform={`translate(${x},${y}) scale(${lerp(0.7, 1, p)})`}>
    <rect x={-130} y={-50} width={260} height={100} rx={50} fill="#ffffff" fillOpacity={0.08} stroke={hot ? GOLD : "#ffffff"} strokeOpacity={hot ? 0.9 : 0.2} strokeWidth={3} />
    <circle cx={-78} cy={0} r={26} fill="none" stroke={hot ? GOLD : WHITE} strokeWidth={5} />
    <line x1={-78} y1={0} x2={-78 + Math.sin((min / 60) * Math.PI / 6) * 14} y2={-Math.cos((min / 60) * Math.PI / 6) * 14} stroke={hot ? GOLD : WHITE} strokeWidth={5} strokeLinecap="round" />
    <line x1={-78} y1={0} x2={-78 + Math.sin(min * Math.PI / 30) * 20} y2={-Math.cos(min * Math.PI / 30) * 20} stroke={hot ? GOLD : WHITE} strokeWidth={3} strokeLinecap="round" />
    <text x={30} y={20} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={60} fill={hot ? GOLD : WHITE} letterSpacing={2}>{hhmm(min)}</text>
  </g>
);
const TaskCard: React.FC<{ x: number; y: number; label: string; p: number; done?: number; wobble?: number; heavy?: boolean; s?: number; color?: string }> = ({ x, y, label, p, done = 0, wobble = 0, heavy = true, s = 1, color = GOLD }) => {
  if (p <= 0.001) return null;
  return (
    <g transform={`translate(${x},${y}) rotate(${wobble}) scale(${s * lerp(0.6, 1, p) * (1 - done * 0.25)})`} opacity={clamp01(p * 1.5) * (1 - er(done, 0.6, 1))}>
      <rect x={heavy ? -215 : -170} y={-62} width={heavy ? 430 : 340} height={124} rx={28} fill="#1c2436" stroke={color} strokeOpacity={0.8} strokeWidth={3} filter="url(#soft)" />
      {heavy && <g transform="translate(-150,0)"><path d="M-26,-6 Q-26,-34 0,-34 Q26,-34 26,-6" stroke={WHITE} strokeWidth={8} fill="none" /><rect x={-38} y={-10} width={76} height={50} rx={14} fill={color} /><text x={0} y={25} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={26} fill="#1c1720">50kg</text></g>}
      <text x={heavy ? 45 : 0} y={14} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={heavy ? 42 : 40} fill={WHITE} letterSpacing={2}>{label}</text>
      {done > 0 && <g opacity={er(done, 0, 0.3)}><circle cx={190} cy={-56} r={34} fill="#5fd08a" /><path d="M174,-56 L186,-44 L208,-68" stroke="#fff" strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>}
    </g>
  );
};

// ------------------------------------------------------------------ gráfico de energia (24 h)
const CX0 = 150, CX1 = 930;
const hx = (h: number) => CX0 + (h / 24) * (CX1 - CX0);
const energy = (h: number, peak: number) => {
  const d = Math.min(Math.abs(h - peak), 24 - Math.abs(h - peak));
  return 0.12 + 0.82 * Math.exp(-(d * d) / 9) + 0.08 * Math.exp(-((Math.abs(h - peak) - 7) ** 2) / 6);
};
const EnergyChart: React.FC<{ y: number; h: number; peak: number; draw: number; win?: number; label?: string; color?: string; low?: number; t: number; p?: number; axis?: boolean }> = ({ y, h, peak, draw, win = 0, label, color = GOLD, low = 0, t, p = 1, axis = true }) => {
  const pts: V[] = [];
  for (let i = 0; i <= 96; i++) { const hh = (i / 96) * 24; if (hh / 24 > draw) break; pts.push([hx(hh), y + h - energy(hh, peak) * h]); }
  const path = pts.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ");
  const fill = pts.length > 1 ? `${path} L${pts[pts.length - 1][0]},${y + h} L${pts[0][0]},${y + h} Z` : "";
  const head = pts[pts.length - 1];
  return (
    <g opacity={p}>
      {[0, 6, 12, 18, 24].map((hh) => <g key={hh}><line x1={hx(hh)} y1={y} x2={hx(hh)} y2={y + h} stroke="#ffffff" strokeOpacity={0.07} strokeWidth={2} />{axis && <text x={hx(hh)} y={y + h + 44} textAnchor="middle" fontFamily={BARLOW} fontWeight={600} fontSize={40} fill={MUTED}>{hh}h</text>}</g>)}
      <line x1={CX0} y1={y + h} x2={CX1} y2={y + h} stroke="#ffffff" strokeOpacity={0.2} strokeWidth={2} />
      {win > 0 && (
        <g opacity={win}>
          <rect x={hx(peak - 2)} y={y - 10} width={hx(peak + 2) - hx(peak - 2)} height={h + 10} rx={18} fill={GOLD} opacity={0.14} />
          <rect x={hx(peak - 2)} y={y - 10} width={hx(peak + 2) - hx(peak - 2)} height={h + 10} rx={18} fill="none" stroke={GOLD} strokeWidth={3} strokeDasharray="10 8" />
        </g>
      )}
      {low > 0 && <rect x={hx(peak + 5)} y={y + h * 0.55} width={hx(peak + 10) - hx(peak + 5)} height={h * 0.45} rx={14} fill={TEAL} opacity={0.14 * low} />}
      {fill && <path d={fill} fill="url(#curveFill)" opacity={color === GOLD ? 1 : 0.6} />}
      {path && <path d={path} stroke={color} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      {head && draw < 1 && <circle cx={head[0]} cy={head[1]} r={12} fill={color} />}
      {draw >= 1 && <g><circle cx={hx(peak)} cy={y + h - energy(peak, peak) * h} r={30 + Math.sin(t * 4) * 4} fill={color} opacity={0.3} filter="url(#glow)" /><circle cx={hx(peak)} cy={y + h - energy(peak, peak) * h} r={12} fill={color} /></g>}
      {label && <text x={CX0} y={y - 30} fontFamily={BARLOW} fontWeight={700} fontSize={46} fill={WHITE} letterSpacing={3}>{label}</text>}
    </g>
  );
};

// ------------------------------------------------------------------ cenas (t = tempo local)
const S0 = (t: number) => {
  const min = lerp(14 * 60, 22 * 60, er(t, 0.3, 2.3));
  const on = t > 2.35;
  const night = er(t, 0.6, 2.3);
  return (
    <g>
      <Glass x={120} y={420} w={840} h={820}>
        {/* janela com o céu escurecendo */}
        <rect x={640} y={470} width={260} height={220} rx={20} fill={night > 0.5 ? "#0b1530" : "#f2a65a"} opacity={0.9} />
        <circle cx={lerp(700, 860, night)} cy={lerp(560, 520, night)} r={30} fill={night > 0.5 ? "#e8ecf5" : "#ffe08a"} />
        <ClockPill x={330} y={540} min={min} hot={on} />
        <g transform="translate(540,1100) scale(1.15) translate(-540,-1100)"><Desk x={540} y={1080} glow={on ? 1 : 0.1} t={t} /></g>
        <Buddy x={540} y={1190} s={1.08} sit mood={on ? 0.9 : -0.5} drain={on ? 0 : 0.6} typing={on ? 1 : 0} t={t} />
        <Battery x={760} y={800} lvl={on ? 0.95 : 0.15} t={t} p={spring(t, 0.2)} />
        <Bulb x={540} y={760} p={spring(t, 2.35, 0.45)} />
      </Glass>
    </g>
  );
};
const S1 = (t: number) => { // boneco empurrando o cartão pesado
  const push = Math.sin(t * 7) * er(t, 0.9, 1.2);
  return (
    <g>
      <Glass x={120} y={420} w={840} h={820}>
        <rect x={640} y={470} width={260} height={220} rx={20} fill="#9fd0f0" opacity={0.85} />
        <circle cx={700} cy={540} r={30} fill="#ffe08a" />
        <ClockPill x={330} y={540} min={8 * 60} p={spring(t, 0)} />
        <Buddy x={320} y={1200} s={1.12} mood={-0.4} lean={12 * er(t, 0.8, 1.1)} armL={[110, -150]} armR={[130, -120]} t={t} />
        <TaskCard x={680} y={1060} label="TAREFA DIFÍCIL" p={spring(t, 0.25)} wobble={push * 3} />
        {t > 1.1 && [0, 1, 2].map((i) => <path key={i} d={`M${430 + i * 6},${960 + i * 30} l-26,-8`} stroke={WHITE} strokeOpacity={0.5} strokeWidth={5} strokeLinecap="round" />)}
      </Glass>
    </g>
  );
};
const S2 = (t: number) => {
  const min = t < 0.4 ? 8 * 60 : 17 * 60 + 30;
  const timer = er(t, 0.9, 2.1);
  const done = er(t, 2.1, 2.5);
  return (
    <g>
      <Glass x={120} y={420} w={840} h={820}>
        <rect x={640} y={470} width={260} height={220} rx={20} fill="#f2a65a" opacity={0.9} />
        <circle cx={790} cy={600} r={30} fill="#ffcf7a" />
        <ClockPill x={330} y={540} min={min} hot={t > 0.4} p={1} />
        {t > 0.35 && t < 0.5 && <rect x={200} y={480} width={260} height={120} rx={50} fill={GOLD} opacity={0.4} />}
        <Buddy x={320} y={1200} s={1.12} mood={lerp(0.2, 1, done)} armL={[110, -150]} armR={[130, -120]} hop={done > 0.5 ? Math.max(0, Math.sin((t - 2.4) * 10)) * 0.4 : 0} t={t} />
        <TaskCard x={680} y={1060} label="TAREFA DIFÍCIL" p={1} done={done} />
        <g transform="translate(640,850)" opacity={1 - done}>
          <circle r={64} fill="none" stroke="#ffffff" strokeOpacity={0.15} strokeWidth={12} />
          <circle r={64} fill="none" stroke={GOLD} strokeWidth={12} strokeDasharray={`${timer * 402} 402`} transform="rotate(-90)" strokeLinecap="round" />
          <text y={14} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={40} fill={WHITE}>30 MIN</text>
        </g>
      </Glass>
    </g>
  );
};
const S3 = (t: number) => (
  <g>
    <Glass x={120} y={470} w={840} h={720} p={spring(t, 0, 0.45)}>
      <EnergyChart y={640} h={380} peak={17.5} draw={er(t, 0.1, 1.3)} label="SUA ENERGIA AO LONGO DO DIA" t={t} />
    </Glass>
  </g>
);
const MiniSun: React.FC<{ x: number; y: number; moon?: boolean }> = ({ x, y, moon }) => moon
  ? <path transform={`translate(${x},${y})`} d="M10,-30 A32,32 0 1 0 30,14 A26,26 0 1 1 10,-30 Z" fill="#cfd8ef" />
  : <g transform={`translate(${x},${y})`}><circle r={22} fill={GOLD2} />{Array.from({ length: 8 }).map((_, i) => <line key={i} x1={Math.cos(i * 0.785) * 30} y1={Math.sin(i * 0.785) * 30} x2={Math.cos(i * 0.785) * 40} y2={Math.sin(i * 0.785) * 40} stroke={GOLD2} strokeWidth={5} strokeLinecap="round" />)}</g>;
const Split = (t: number, win: number) => (
  <g>
    <Glass x={120} y={430} w={840} h={390} p={spring(t, 0)} hl={win}>
      <MiniSun x={170} y={500} />
      <text x={220} y={516} fontFamily={BARLOW} fontWeight={700} fontSize={48} fill={WHITE} letterSpacing={3}>CEDO</text>
      <g transform="translate(0,-170) scale(1,0.62)" ><EnergyChart y={1000} h={300} peak={9} draw={er(t, 0.2, 1.4)} win={win} t={t} axis={false} /></g>
    </Glass>
    <Glass x={120} y={850} w={840} h={390} p={spring(t, 0.9)} hl={win}>
      <MiniSun x={170} y={920} moon />
      <text x={220} y={936} fontFamily={BARLOW} fontWeight={700} fontSize={48} fill={WHITE} letterSpacing={3}>DE NOITE</text>
      <g transform="translate(0,252) scale(1,0.62)"><EnergyChart y={1000} h={300} peak={21} draw={er(t, 1.1, 2.4)} win={win} color={TEAL} t={t} axis={false} /></g>
    </Glass>
  </g>
);
const S4 = (t: number) => Split(t, 0);
const S5 = (t: number) => (
  <g>
    {Split(t + 3, er(t, 0.2, 0.6))}
    <Pill x={540} y={835} txt="CADA CORPO, SUA JANELA" color={GOLD} size={44} p={spring(t, 0.4)} bg={GOLD} />
  </g>
);
const PEAK = 10;
const BLOCK_PATH = (t: number) => {
  const k = er(t, 0.6, 2.4);
  return { x: lerp(hx(PEAK), hx(PEAK + 7), k), y: lerp(560, 930, k) };
};
const S6 = (t: number) => {
  const b = BLOCK_PATH(t);
  const drained = er(t, 2.2, 3.2);
  return (
    <g>
      <Glass x={120} y={430} w={840} h={810} p={spring(t, 0, 0.4)}>
        <EnergyChart y={620} h={380} peak={PEAK} draw={1} low={er(t, 0.3, 0.8)} t={t} />
        <text x={hx(PEAK + 7.5)} y={1080} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={42} fill={TEAL} opacity={er(t, 0.3, 0.8)}>ESGOTADO</text>
        <TaskCard x={b.x} y={b.y} label="DIFÍCIL" p={spring(t, 0.1)} s={0.62} wobble={Math.sin(t * 5) * 4 * (1 - drained)} />
        {/* cursor arrastando */}
        {t > 0.5 && t < 2.6 && <path transform={`translate(${b.x + 40},${b.y + 30})`} d="M0,0 L0,46 L12,34 L22,56 L32,52 L22,30 L38,30 Z" fill={WHITE} stroke="#1c1720" strokeWidth={3} />}
        <Buddy x={240} y={1215} s={0.72} mood={lerp(0, -0.8, drained)} drain={drained} lean={-drained * 6} t={t} />
        <Battery x={330} y={1060} lvl={lerp(0.6, 0.1, drained)} t={t} p={spring(t, 1.8)} />
      </Glass>
    </g>
  );
};
const S7 = (t: number) => {
  const st = spring(t, 0.3, 0.35); // v3: carimbo no "e depois concluir"
  const cross = er(t, 1.62, 1.9); // risca no "disciplina"
  return (
    <g>
      <Glass x={120} y={430} w={840} h={810}>
        <EnergyChart y={620} h={380} peak={PEAK} draw={1} low={1} t={t} p={0.35} />
        {st > 0 && (
          <g transform={`translate(540,700) rotate(-6) scale(${lerp(1.6, 1, Math.min(1, st))})`} opacity={clamp01(st * 2)}>
            <rect x={-330} y={-58} width={660} height={116} rx={18} fill="#2a0f12" fillOpacity={0.6} stroke={RED} strokeWidth={8} />
            <text y={22} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={64} fill={RED} letterSpacing={3}>FALTA DE DISCIPLINA?</text>
            <line x1={-300} y1={0} x2={lerp(-300, 300, cross)} y2={0} stroke={WHITE} strokeWidth={10} strokeLinecap="round" opacity={cross > 0 ? 1 : 0} />
          </g>
        )}
        <Pill x={540} y={950} txt="HORÁRIO ERRADO." color={GOLD} size={62} p={spring(t, 1.95, 0.4)} bg={GOLD} />
      </Glass>
    </g>
  );
};
const HOURS = [8, 10, 12, 14, 16, 18, 20, 22];
const RATE = (h: number, day = 0) => Math.max(1, Math.min(5, Math.round(1 + energy(h, PEAK) * 4.4 + ((day * 7 + h * 3) % 3) * 0.3 - 0.4)));
const S8 = (t: number) => (
  <g>
    <Glass x={120} y={430} w={840} h={820} p={spring(t, 0, 0.45)}>
      <text x={170} y={512} fontFamily={BARLOW} fontWeight={700} fontSize={50} fill={WHITE} letterSpacing={3}>TESTE DA SEMANA</text>
      <text x={910} y={512} textAnchor="end" fontFamily={BARLOW} fontWeight={700} fontSize={44} fill={GOLD}>DE 1 A 5</text>
      {HOURS.map((h, r) => {
        const y = 590 + r * 82;
        const appear = er(t, 0.3 + r * 0.42, 0.55 + r * 0.42);
        const n = RATE(h);
        return (
          <g key={h} opacity={lerp(0.35, 1, appear)}>
            <text x={170} y={y + 16} fontFamily={BARLOW} fontWeight={700} fontSize={46} fill={WHITE}>{String(h).padStart(2, "0")}h</text>
            {[1, 2, 3, 4, 5].map((k) => {
              const on = appear > 0.5 && k <= n;
              const pop = on ? spring(t, 0.4 + r * 0.42 + k * 0.05, 0.35) : 0;
              return <circle key={k} cx={330 + k * 108} cy={y} r={lerp(24, 31, pop)} fill={on ? (n >= 4 ? GOLD : TEAL) : "none"} stroke={on ? "none" : "#ffffff"} strokeOpacity={0.25} strokeWidth={3} />;
            })}
          </g>
        );
      })}
    </Glass>
  </g>
);
const DAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const S9 = (t: number) => {
  const fill = er(t, 0.2, 1.8);
  const hl = er(t, 2.6, 3.0);
  const best = HOURS.indexOf(PEAK);
  return (
    <g>
      <Glass x={120} y={430} w={840} h={820} p={1}>
        {DAYS.map((d, c) => <text key={d} x={300 + c * 92} y={522} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={40} fill={MUTED}>{d}</text>)}
        {HOURS.map((h, r) => (
          <g key={h}>
            <text x={150} y={586 + r * 82} fontFamily={BARLOW} fontWeight={700} fontSize={42} fill={WHITE}>{String(h).padStart(2, "0")}h</text>
            {DAYS.map((d, c) => {
              const v = RATE(h, c);
              const on = fill * (HOURS.length + DAYS.length) > r + c;
              const col = v >= 5 ? GOLD : v >= 4 ? "#c99a45" : v >= 3 ? TEAL2 : "#24304a";
              return <rect key={d} x={262 + c * 92} y={545 + r * 82} width={76} height={66} rx={14} fill={on ? col : "#ffffff"} fillOpacity={on ? 1 : 0.05} />;
            })}
          </g>
        ))}
        {hl > 0 && <rect x={250} y={535 + best * 82} width={652} height={86} rx={20} fill="none" stroke={GOLD2} strokeWidth={6} opacity={hl} />}
        <Pill x={576} y={1218} txt="SUA JANELA ↑" color={GOLD} size={40} p={spring(t, 2.8, 0.4)} bg={GOLD} />
      </Glass>
    </g>
  );
};
const S10 = (t: number) => {
  const fall = spring(t, 0.3, 0.55);
  const burst = er(t, 0.75, 1.3);
  return (
    <g>
      <Glass x={120} y={430} w={840} h={810}>
        <EnergyChart y={620} h={380} peak={PEAK} draw={1} win={1} t={t} />
        <TaskCard x={hx(PEAK)} y={lerp(360, 760, fall)} label="TAREFA Nº 1" p={1} s={0.92} heavy={false} />
        {burst > 0 && burst < 1 && Array.from({ length: 10 }).map((_, i) => { const a = (i / 10) * Math.PI * 2; return <line key={i} x1={hx(PEAK) + Math.cos(a) * 110 * burst} y1={760 + Math.sin(a) * 80 * burst} x2={hx(PEAK) + Math.cos(a) * 150 * burst} y2={760 + Math.sin(a) * 110 * burst} stroke={GOLD2} strokeWidth={7} strokeLinecap="round" opacity={1 - burst} />; })}
        <text x={hx(PEAK)} y={1130} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={44} fill={GOLD} opacity={er(t, 0.9, 1.3)}>O QUE MAIS PESA NO SEU DIA</text>
      </Glass>
    </g>
  );
};
const Chip: React.FC<{ x: number; y: number; label: string; icon: "msg" | "sheet"; p: number }> = ({ x, y, label, icon, p }) => p <= 0 ? null : (
  <g transform={`translate(${x},${y}) scale(${lerp(0.6, 1, Math.min(1, p))})`} opacity={clamp01(p * 2)}>
    <rect x={-130} y={-40} width={260} height={80} rx={40} fill="#1c2436" stroke={TEAL} strokeWidth={3} />
    {icon === "msg" ? <path d="M-104,-16 h48 a10,10 0 0 1 10,10 v22 a10,10 0 0 1 -10,10 h-28 l-14,12 v-12 h-6 a10,10 0 0 1 -10,-10 v-22 a10,10 0 0 1 10,-10 z" fill={TEAL} />
      : <g fill="none" stroke={TEAL} strokeWidth={5}><rect x={-108} y={-20} width={56} height={44} rx={6} /><line x1={-108} y1={-4} x2={-52} y2={-4} /><line x1={-80} y1={-20} x2={-80} y2={24} /></g>}
    <text x={26} y={14} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={40} fill={WHITE} letterSpacing={1}>{label}</text>
  </g>
);
const S11 = (t: number) => {
  const a = spring(t, 0.5, 0.6), b = spring(t, 1.6, 0.6);
  return (
    <g>
      <Glass x={120} y={430} w={840} h={810}>
        <EnergyChart y={620} h={380} peak={PEAK} draw={1} win={1} low={1} t={t} />
        <TaskCard x={hx(PEAK)} y={760} label="TAREFA Nº 1" p={1} s={0.92} heavy={false} />
        <Chip x={lerp(540, hx(PEAK + 8), a)} y={lerp(560, 905, a)} label="MENSAGENS" icon="msg" p={a} />
        <Chip x={lerp(540, hx(PEAK + 8.5), b)} y={lerp(560, 1000, b)} label="PLANILHA" icon="sheet" p={b} />
        <text x={hx(PEAK + 8)} y={1130} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={42} fill={TEAL} opacity={er(t, 2.0, 2.4)}>HORAS BAIXAS</text>
      </Glass>
    </g>
  );
};
const S12 = (t: number) => {
  // v2: um pedido só — comentar a hora (o "salva" vai para a legenda do post)
  const typed = "10h";
  const n = Math.floor(clamp01((t - 1.0) / 0.6) * typed.length);
  const send = spring(t, 2.0, 0.45);
  return (
    <g>
      <Glass x={120} y={440} w={840} h={400} p={spring(t, 0.05, 0.45)} hl={send}>
        <circle cx={200} cy={540} r={40} fill="#33405e" />
        <text x={262} y={556} fontFamily={BARLOW} fontWeight={700} fontSize={46} fill={WHITE}>Que horas você mais rende?</text>
        <rect x={170} y={640} width={740} height={130} rx={65} fill="#ffffff" fillOpacity={0.07} stroke={GOLD} strokeOpacity={0.7} strokeWidth={4} />
        <text x={230} y={728} fontFamily={BARLOW} fontWeight={700} fontSize={76} fill={GOLD}>{typed.slice(0, n)}{Math.floor(t * 2) % 2 === 0 && n < 3 ? "|" : ""}</text>
        <g transform={`translate(840,705) scale(${lerp(0.7, 1.15, send)})`}><circle r={44} fill={GOLD} /><path d="M-16,-18 L22,0 L-16,18 L-8,0 Z" fill="#1c1720" /></g>
      </Glass>
      <Buddy x={540} y={1215} s={1.05} mood={0.95} armR={[90, -300 + Math.sin(t * 10) * 20]} t={t} hop={Math.max(0, Math.sin(t * 4)) * 0.15} />
      {send > 0 && [0, 1, 2].map((i) => { const q = ((t * 0.7 + i / 3) % 1); return <path key={i} transform={`translate(${640 + i * 40},${930 - q * 120}) scale(${1.2 + q * 0.6})`} d="M0,14 C-16,2 -12,-10 -4,-10 C-1,-10 0,-7 0,-5 C0,-7 1,-10 4,-10 C12,-10 16,2 0,14 Z" fill={GOLD} opacity={Math.sin(q * Math.PI) * send} />; })}
    </g>
  );
};
const SCENES = [S0, S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12];

// ------------------------------------------------------------------ legenda palavra por palavra
const Caption: React.FC<{ t: number }> = ({ t }) => {
  const s = sceneOf(t);
  const [txt, id, st, dur] = LINES[s];
  const t0 = ST[s] + st;
  const words = txt.split(" ");
  const total = txt.replace(/ /g, "").length;
  let acc = 0;
  const real = WORDT[id];
  const times = real && real.length === words.length ? real.map((v) => t0 + v) : words.map((w) => { const a = t0 + (acc / total) * dur; acc += w.length; return a; });
  const chunks: number[][] = [];
  let cur: number[] = [], len = 0;
  words.forEach((w, i) => { if (len + w.length > 24 && cur.length) { chunks.push(cur); cur = []; len = 0; } cur.push(i); len += w.length + 1; if (/[.!?:,]$/.test(w) && len > 12) { chunks.push(cur); cur = []; len = 0; } });
  if (cur.length) chunks.push(cur);
  const idx = Math.max(0, chunks.findIndex((c, i) => t < (chunks[i + 1] ? times[chunks[i + 1][0]] : 1e9)));
  if (t < t0 - 0.05) return null;
  return (
    <div style={{ position: "absolute", left: 120, right: 120, top: 1300, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 68, lineHeight: 1.06, letterSpacing: 1 }}>
      {chunks[idx].map((i) => {
        const p = ease((t - times[i]) / 0.16);
        const clean = words[i].toLowerCase().replace(/[^a-zà-ú0-9]/g, "");
        return <span key={i} style={{ display: "inline-block", margin: "0 9px", color: KEY.includes(clean) ? GOLD : WHITE, opacity: p, transform: `translateY(${(1 - p) * 12}px)`, textShadow: "0 4px 18px rgba(0,0,0,.6)" }}>{words[i].toUpperCase()}</span>;
      })}
    </div>
  );
};

// ------------------------------------------------------------------ raiz
export const Janela: React.FC = () => {
  useFonts();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const s = sceneOf(t);
  const lt = t - ST[s];
  // zoom suave de entrada em cada cena + leve deriva contínua
  const z = lerp(1.06, 1, ease(lt / 0.5)) * (1 + Math.sin(t * 0.4) * 0.006);
  const fade = Math.max(0, 1 - lt / 0.18);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 35%, ${BG2} 0%, ${BG1} 70%)` }}>
      <Audio src={staticFile(`${D}/narrador.wav`)} />
      <Audio src={staticFile(`${D}/sfx.wav`)} volume={0.4} />
      {/* brilhos de fundo que se movem devagar */}
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${30 + Math.sin(t * 0.3) * 10}% ${40 + Math.cos(t * 0.25) * 8}%, rgba(232,176,75,.10) 0%, rgba(0,0,0,0) 35%), radial-gradient(circle at ${72 + Math.cos(t * 0.27) * 8}% ${70 + Math.sin(t * 0.33) * 8}%, rgba(79,179,191,.10) 0%, rgba(0,0,0,0) 35%)` }} />
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <Defs />
        <g transform={`translate(540,830) scale(${z}) translate(-540,-830)`} opacity={1 - fade * 0.6}>{SCENES[s](lt)}</g>
      </svg>
      {/* frase fixa em cima */}
      <div style={{ position: "absolute", top: 232, left: 120, right: 120, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 60, lineHeight: 1.0, letterSpacing: 3 }}>
        <div style={{ color: WHITE }}>{HOOK[0]}</div>
        <div style={{ color: GOLD }}>{HOOK[1]}</div>
      </div>
      <Caption t={t} />
      {/* assinatura */}
      <div style={{ position: "absolute", left: 0, top: 1556, width: 1080, height: 96, display: "flex", justifyContent: "center", alignItems: "center", gap: 22, color: "#edeae3", fontFamily: BARLOW }}>
        <Img src={staticFile(`${D}/avatar.png`)} style={{ width: 96, height: 96, borderRadius: "50%" }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: 700, fontSize: 44, lineHeight: "48px", letterSpacing: 1, opacity: 0.92 }}>Foco no essencial</span>
          <span style={{ fontWeight: 600, fontSize: 32, lineHeight: "38px", letterSpacing: 1.5, opacity: 0.55 }}>@foco_noessencial</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
