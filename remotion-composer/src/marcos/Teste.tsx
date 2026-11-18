import React, { useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// Série Marcos — teste de estilo (cartoon com contorno, luz quente de abajur, movimento fluido)
export const TOTAL = 6.6;
const W = 1080, H = 1920, FLOOR = 1400;
const INK = "#1b100a";
const BARLOW = "'Barlow Condensed', 'DejaVu Sans Condensed', sans-serif";

// ------------------------------------------------------------------ utilidades
type V = [number, number];
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (x: number) => { x = clamp01(x); return x * x * x * (x * (x * 6 - 15) + 10); }; // smootherstep
const backOut = (x: number) => { x = clamp01(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
// trilha de quadros-chave com entrada/saída suave (cada trecho usa smootherstep)
const kf = (t: number, keys: [number, number][]) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) { const [t0, v0] = keys[i - 1]; return lerp(v0, v1, smooth((t - t0) / (t1 - t0))); }
  }
  return keys[keys.length - 1][1];
};
const kv = (t: number, keys: [number, V][]): V => [kf(t, keys.map(([a, v]) => [a, v[0]])), kf(t, keys.map(([a, v]) => [a, v[1]]))];
const rad = (d: number) => (d * Math.PI) / 180;
const pt = (p: V) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
// cinemática inversa de 2 ossos: articulação do meio (joelho/cotovelo)
const ik = (a: V, c: V, l1: number, l2: number, s: number): V => {
  const dx = c[0] - a[0], dy = c[1] - a[1];
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.5);
  const th = Math.atan2(dy, dx);
  const al = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  return [a[0] + l1 * Math.cos(th + s * al), a[1] + l1 * Math.sin(th + s * al)];
};
// membro curvo que passa pela articulação
const limbPath = (a: V, b: V, c: V) => {
  const q: V = [2 * b[0] - (a[0] + c[0]) / 2, 2 * b[1] - (a[1] + c[1]) / 2];
  return `M${pt(a)} Q${pt(q)} ${pt(c)}`;
};
const along = (a: V, b: V, k: number): V => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];

const useFonts = () => {
  const [h] = useState(() => delayRender("fontes"));
  useEffect(() => {
    const f = new FontFace("Barlow Condensed", `url(${staticFile("noite_manha/barlow-condensed-latin-700-normal.woff2")})`, { weight: "700" });
    f.load().then((ff) => document.fonts.add(ff)).then(() => continueRender(h)).catch(() => continueRender(h));
  }, [h]);
};

// ------------------------------------------------------------------ cenário (sala à noite)
const Room: React.FC<{ t: number }> = ({ t }) => {
  const flick = 1 + 0.015 * Math.sin(t * 7.3) + 0.01 * Math.sin(t * 13.1);
  return (
    <g>
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a170e" /><stop offset="1" stopColor="#4a2b1a" />
        </linearGradient>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2215" /><stop offset="1" stopColor="#160c07" />
        </linearGradient>
        <radialGradient id="lampGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffbf6b" stopOpacity="0.75" /><stop offset="0.35" stopColor="#e88a3c" stopOpacity="0.32" /><stop offset="1" stopColor="#e88a3c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd08a" stopOpacity="0.35" /><stop offset="1" stopColor="#ffd08a" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="moonGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#9fb4ff" stopOpacity="0.25" /><stop offset="1" stopColor="#9fb4ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sofa" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6a4a38" /><stop offset="1" stopColor="#3e2a1f" />
        </linearGradient>
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a5a33" /><stop offset="1" stopColor="#5a3820" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={W} height={FLOOR} fill="url(#wall)" />
      {/* tábuas do piso */}
      <rect x={0} y={FLOOR} width={W} height={H - FLOOR} fill="url(#floor)" />
      {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={0} x2={W} y1={FLOOR + 40 + i * i * 22} y2={FLOOR + 40 + i * i * 22} stroke="#0f0805" strokeWidth={3} opacity={0.5} />)}
      <rect x={0} y={FLOOR - 26} width={W} height={26} fill="#2b170d" stroke={INK} strokeWidth={5} />
      {/* janela com lua */}
      <g transform="translate(560,430)">
        <circle cx={130} cy={140} r={260} fill="url(#moonGlow)" />
        <rect x={0} y={0} width={270} height={300} rx={6} fill="#0b1020" stroke="#5b3a22" strokeWidth={18} />
        {[[40, 50], [200, 40], [90, 200], [230, 240], [150, 110], [60, 260]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.4} fill="#e9ecff" opacity={0.5 + 0.5 * Math.sin(t * 2 + i * 1.7)} />
        ))}
        <path d="M200,62 a34,34 0 1,0 30,52 a27,27 0 1,1 -30,-52 z" fill="#f4e7b5" />
        <line x1={135} y1={0} x2={135} y2={300} stroke="#5b3a22" strokeWidth={12} />
        <line x1={0} y1={150} x2={270} y2={150} stroke="#5b3a22" strokeWidth={12} />
        <rect x={0} y={0} width={270} height={300} rx={6} fill="none" stroke={INK} strokeWidth={5} />
        <rect x={-24} y={300} width={318} height={26} rx={4} fill="#6a4426" stroke={INK} strokeWidth={5} />
      </g>
      {/* quadro na parede */}
      <g transform="translate(150,520) rotate(-2)">
        <rect x={0} y={0} width={170} height={130} rx={6} fill="#24160e" stroke="#7a4f2c" strokeWidth={12} />
        <path d="M14,110 L60,58 L92,88 L118,66 L156,110 Z" fill="#3b4a3a" opacity={0.8} />
        <rect x={0} y={0} width={170} height={130} rx={6} fill="none" stroke={INK} strokeWidth={4} />
      </g>
      {/* luz do abajur (cone e brilho) */}
      <g opacity={flick}>
        <circle cx={250} cy={780} r={720} fill="url(#lampGlow)" style={{ mixBlendMode: "screen" }} />
        <path d={`M168,760 L332,760 L560,${FLOOR} L-60,${FLOOR} Z`} fill="url(#cone)" style={{ mixBlendMode: "screen" }} />
      </g>
      {/* sofá */}
      <g transform="translate(90,1130)">
        <ellipse cx={200} cy={272} rx={230} ry={18} fill="#000" opacity={0.35} />
        <rect x={20} y={0} width={360} height={150} rx={30} fill="url(#sofa)" stroke={INK} strokeWidth={6} />
        <rect x={0} y={110} width={400} height={130} rx={26} fill="url(#sofa)" stroke={INK} strokeWidth={6} />
        <rect x={-10} y={80} width={70} height={170} rx={24} fill="#5a3e2f" stroke={INK} strokeWidth={6} />
        <rect x={340} y={80} width={70} height={170} rx={24} fill="#5a3e2f" stroke={INK} strokeWidth={6} />
        <path d="M70,150 L330,150" stroke={INK} strokeWidth={4} opacity={0.6} />
        <path d="M200,118 L200,236" stroke={INK} strokeWidth={4} opacity={0.6} />
        <rect x={40} y={240} width={20} height={26} fill={INK} /><rect x={340} y={240} width={20} height={26} fill={INK} />
      </g>
      {/* abajur de pé */}
      <g>
        <rect x={238} y={760} width={22} height={FLOOR - 772} fill="#a07a52" stroke={INK} strokeWidth={5} />
        <ellipse cx={249} cy={FLOOR - 12} rx={60} ry={14} fill="#6d5236" stroke={INK} strokeWidth={5} />
        <path d="M180,640 L318,640 L350,770 L148,770 Z" fill="#ffd9a0" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        <path d="M180,640 L318,640 L350,770 L148,770 Z" fill="#fff3d6" opacity={0.35 * flick} />
      </g>
      {/* mesinha com planta */}
      <g transform="translate(800,1180)">
        <ellipse cx={90} cy={222} rx={120} ry={14} fill="#000" opacity={0.35} />
        <rect x={0} y={0} width={180} height={30} rx={6} fill="url(#wood)" stroke={INK} strokeWidth={5} />
        <rect x={14} y={30} width={152} height={120} fill="#5a3820" stroke={INK} strokeWidth={5} />
        <circle cx={90} cy={92} r={6} fill="#c79a54" stroke={INK} strokeWidth={2} />
        <rect x={20} y={150} width={14} height={66} fill="#4a2e1a" stroke={INK} strokeWidth={4} /><rect x={146} y={150} width={14} height={66} fill="#4a2e1a" stroke={INK} strokeWidth={4} />
        <path d="M60,0 L70,-56 L110,-56 L120,0 Z" fill="#b8643c" stroke={INK} strokeWidth={5} />
        {[-38, -12, 14, 40].map((a, i) => (
          <path key={i} d={`M90,-56 q${a * 0.6},-70 ${a * 1.4},-${100 + (i % 2) * 30}`} stroke="#3e6b3a" strokeWidth={14} fill="none" strokeLinecap="round"
            transform={`rotate(${2 * Math.sin(t * 1.3 + i)} 90 -56)`} />
        ))}
      </g>
      {/* tapete */}
      <path d={`M300,${FLOOR + 60} L860,${FLOOR + 60} L940,${FLOOR + 170} L220,${FLOOR + 170} Z`} fill="#5e3226" stroke={INK} strokeWidth={5} />
      <path d={`M330,${FLOOR + 80} L840,${FLOOR + 80} L905,${FLOOR + 150} L255,${FLOOR + 150} Z`} fill="none" stroke="#8a4a35" strokeWidth={4} />
    </g>
  );
};

// ------------------------------------------------------------------ Marcos
type Face = {
  lx: number; ly: number; open: number; eyeS: number; pupil: number; px: number; py: number;
  raise: number; worry: number; curve: number; mo: number;
};
const L = { head: 72, neck: 22, torso: 232, ua: 124, fa: 118, th: 158, sh: 152, w: 30 };
const SKIN = "#f3efe7", SKIN2 = "#d8d1c4", SHIRT = "#4c6b92", SHIRT2 = "#3a5576", PANTS = "#3a3d47", PANTS2 = "#2b2d35", SHOE = "#2a1b12", HAIR = "#3b2a1e";

type Rig = {
  hip: V; lean: number; slump: number; headTilt: number; face: Face;
  feet: [V, V]; footLift: [number, number]; hands: [V, V]; phone: number; glow: number; tremble: number;
};

const Tube: React.FC<{ d: string; color: string; w?: number }> = ({ d, color, w = L.w }) => (
  <g>
    <path d={d} stroke={INK} strokeWidth={w + 9} fill="none" strokeLinecap="round" />
    <path d={d} stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" />
  </g>
);

const Marcos: React.FC<{ r: Rig; t: number }> = ({ r, t }) => {
  const tr = r.tremble * Math.sin(t * 95) * 2.2;
  const hip: V = [r.hip[0] + tr, r.hip[1]];
  const la = rad(r.lean);
  const sh: V = [hip[0] + Math.sin(la) * L.torso, hip[1] - Math.cos(la) * L.torso];
  const ha = rad(r.lean + r.headTilt);
  const neck: V = [sh[0] + Math.sin(la) * 6, sh[1] - Math.cos(la) * 6];
  const head: V = [neck[0] + Math.sin(ha) * (L.neck + L.head), neck[1] - Math.cos(ha) * (L.neck + L.head)];
  const hipJ: [V, V] = [[hip[0] - 8, hip[1]], [hip[0] + 8, hip[1]]];
  const shJ: [V, V] = [[sh[0] - 20, sh[1] + 16], [sh[0] + 20, sh[1] + 16]];
  const knees = [0, 1].map((i) => ik(hipJ[i], r.feet[i], L.th, L.sh, -1)) as [V, V];
  const elbows = [0, 1].map((i) => ik(shJ[i], r.hands[i], L.ua, L.fa, 1)) as [V, V];
  // tronco: cápsula que curva para a frente com o "slump"
  const mid: V = [lerp(hip[0], sh[0], 0.5) + r.slump * 26, lerp(hip[1], sh[1], 0.5)];
  const leg = (i: number, back: boolean) => {
    const f = r.feet[i];
    const toe: V = [f[0] + 30, f[1] + 2 - r.footLift[i] * 4];
    return (
      <g key={`l${i}`}>
        <Tube d={limbPath(hipJ[i], knees[i], f)} color={back ? PANTS2 : PANTS} w={L.w + 6} />
        <g transform={`rotate(${-r.footLift[i] * 14} ${f[0]} ${f[1]})`}>
          <path d={`M${f[0] - 18},${f[1] - 8} Q${f[0] - 20},${f[1] + 14} ${f[0]},${f[1] + 14} L${toe[0] + 8},${f[1] + 14} Q${toe[0] + 22},${f[1] + 12} ${toe[0] + 12},${f[1] - 4} Q${f[0] + 10},${f[1] - 16} ${f[0] - 18},${f[1] - 8} Z`}
            fill={back ? "#1c120c" : SHOE} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        </g>
      </g>
    );
  };
  const arm = (i: number, back: boolean) => {
    const h = r.hands[i];
    const sleeveEnd = along(shJ[i], elbows[i], 0.62);
    return (
      <g key={`a${i}`}>
        <Tube d={limbPath(shJ[i], elbows[i], h)} color={back ? SKIN2 : SKIN} w={L.w - 4} />
        <Tube d={`M${pt(shJ[i])} L${pt(sleeveEnd)}`} color={back ? SHIRT2 : SHIRT} w={L.w + 8} />
        <circle cx={h[0]} cy={h[1]} r={17} fill={back ? SKIN2 : SKIN} stroke={INK} strokeWidth={5} />
      </g>
    );
  };
  const f = r.face;
  const fx = head[0] + f.lx * 22, fy = head[1] + f.ly * 16;
  const eye = (side: number) => {
    const far = side < 0 ? 0.86 : 1;
    const ex = fx + side * 23 * (side < 0 ? 0.9 : 1), ey = fy - 6;
    const ry = 13 * f.eyeS * Math.max(0.06, f.open);
    const rx = 10.5 * f.eyeS * far;
    const by = ey - 26 - f.raise * 12;
    const inner = ex - side * 13, outer = ex + side * 13;
    return (
      <g key={`e${side}`}>
        <ellipse cx={ex} cy={ey} rx={rx} ry={ry} fill="#fff" stroke={INK} strokeWidth={3.5} />
        {f.open > 0.2 && <circle cx={ex + f.px * 4} cy={ey + f.py * 4} r={Math.min(ry, 6.5 * f.pupil)} fill={INK} />}
        {f.open < 0.75 && f.open > 0.08 && (
          <path d={`M${ex - rx - 1},${ey - ry * 0.2} Q${ex},${ey - ry * 1.5} ${ex + rx + 1},${ey - ry * 0.2}`} fill={SKIN} stroke={INK} strokeWidth={3} />
        )}
        <path d={`M${inner},${by - f.worry * 9 + f.raise * 0} Q${ex},${by - 5 - f.raise * 3} ${outer},${by + f.worry * 3}`} stroke={INK} strokeWidth={5.5} fill="none" strokeLinecap="round" />
      </g>
    );
  };
  const mx = fx + 4, my = fy + 32;
  const mw = 34 * (1 - f.mo * 0.55);
  const mouth = f.mo > 0.08
    ? <ellipse cx={mx} cy={my + 4} rx={mw / 2} ry={4 + f.mo * 13} fill="#3a1410" stroke={INK} strokeWidth={4} />
    : <path d={`M${mx - mw / 2},${my - f.curve * 4} Q${mx},${my + f.curve * 14} ${mx + mw / 2},${my - f.curve * 4}`} stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />;
  const phoneAt = r.hands[1];
  return (
    <g>
      <ellipse cx={hip[0] + 12} cy={FLOOR + 8} rx={120} ry={18} fill="#000" opacity={0.4} />
      {arm(0, true)}
      {leg(0, true)}
      {/* tronco (camisa) */}
      <path d={`M${hip[0] - 42},${hip[1] + 18} Q${mid[0] - 58},${mid[1]} ${sh[0] - 50},${sh[1] + 12} Q${sh[0]},${sh[1] - 20} ${sh[0] + 46},${sh[1] + 10} Q${mid[0] + 54},${mid[1]} ${hip[0] + 44},${hip[1] + 18} Z`}
        fill={SHIRT} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      <path d={`M${hip[0] - 38},${hip[1] + 14} Q${mid[0] - 52},${mid[1]} ${sh[0] - 44},${sh[1] + 16} L${sh[0] - 24},${sh[1] + 18} Q${mid[0] - 26},${mid[1]} ${hip[0] - 16},${hip[1] + 14} Z`} fill={SHIRT2} opacity={0.7} />
      <path d={`M${hip[0] - 44},${hip[1] + 6} L${hip[0] + 46},${hip[1] + 6}`} stroke={INK} strokeWidth={5} />
      <path d={`M${sh[0] - 22},${sh[1] - 2} L${sh[0] + 4},${sh[1] + 26} L${sh[0] + 26},${sh[1] - 2}`} stroke={INK} strokeWidth={4} fill="none" strokeLinejoin="round" />
      {leg(1, false)}
      {/* pescoço e cabeça */}
      <Tube d={`M${pt(sh)} L${pt([head[0] - Math.sin(ha) * L.head * 0.6, head[1] + Math.cos(ha) * L.head * 0.6])}`} color={SKIN} w={24} />
      <defs>
        <radialGradient id="headG" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" /><stop offset="0.7" stopColor={SKIN} /><stop offset="1" stopColor="#cfc7b8" />
        </radialGradient>
        <radialGradient id="phoneGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#7fb2ff" stopOpacity="0.85" /><stop offset="1" stopColor="#7fb2ff" stopOpacity="0" />
        </radialGradient>
        <clipPath id="headClip"><circle cx={head[0]} cy={head[1]} r={L.head} /></clipPath>
      </defs>
      <ellipse cx={head[0] - f.lx * 40 - 4} cy={head[1] + 8} rx={11} ry={16} fill={SKIN2} stroke={INK} strokeWidth={4} />
      <circle cx={head[0]} cy={head[1]} r={L.head} fill="url(#headG)" stroke={INK} strokeWidth={6} />
      {/* cabelo curto */}
      <g clipPath="url(#headClip)">
        <path d={`M${head[0] - 80},${head[1] - 10 + f.ly * 6} Q${head[0] - 40 - f.lx * 10},${head[1] - 52 + f.ly * 10} ${head[0] + 20 + f.lx * 14},${head[1] - 46 + f.ly * 10} Q${head[0] + 50 + f.lx * 10},${head[1] - 44 + f.ly * 8} ${head[0] + 70},${head[1] - 30 + f.ly * 8} L${head[0] + 80},${head[1] - 90} L${head[0] - 90},${head[1] - 90} Z`} fill={HAIR} />
        <circle cx={head[0]} cy={head[1]} r={L.head} fill="url(#phoneGlow)" opacity={r.glow * 0.55} style={{ mixBlendMode: "screen" }} />
      </g>
      <circle cx={head[0]} cy={head[1]} r={L.head} fill="none" stroke={INK} strokeWidth={6} />
      {eye(-1)}
      {eye(1)}
      {mouth}
      {/* bochecha corada sutil */}
      <ellipse cx={fx + 32} cy={fy + 16} rx={10} ry={6} fill="#e7a28a" opacity={0.35} />
      {/* celular + braço da frente */}
      {r.phone > 0.01 && (
        <g opacity={r.phone}>
          <circle cx={phoneAt[0] + 10} cy={phoneAt[1] - 20} r={120} fill="url(#phoneGlow)" opacity={r.glow * 0.7} style={{ mixBlendMode: "screen" }} />
          <g transform={`translate(${phoneAt[0] + 6},${phoneAt[1] - 22}) rotate(-18)`}>
            <rect x={-16} y={-28} width={32} height={56} rx={6} fill="#14161c" stroke={INK} strokeWidth={4} />
            <rect x={-12} y={-23} width={24} height={46} rx={3} fill="#8fc0ff" opacity={0.3 + 0.7 * r.glow} />
          </g>
        </g>
      )}
      {arm(1, false)}
    </g>
  );
};

// ------------------------------------------------------------------ animação
const rigAt = (t: number): Rig => {
  // caminhada: x desacelera até parar; fase da passada vem da distância (sem pé deslizando)
  const T_STOP = 2.3, X0 = -140, X1 = 520;
  const u = clamp01(t / T_STOP);
  const x = t < T_STOP ? X0 + (X1 - X0) * Math.sin((u * Math.PI) / 2) : X1;
  const v = t < T_STOP ? ((X1 - X0) * (Math.PI / 2) * Math.cos((u * Math.PI) / 2)) / T_STOP : 0;
  const amp = Math.pow(clamp01(v / 330), 0.7);
  const S = 78;
  const ph = (x - X0) / S;
  const legOff = (i: number) => ph + i * Math.PI;
  const breath = Math.sin(t * 2.4) * 3;

  // reações
  const shock = kf(t, [[3.28, 0], [3.42, 1], [3.9, 1], [4.4, 0]]);
  const antic = kf(t, [[3.18, 0], [3.3, 1], [3.4, 0]]);
  const sad = kf(t, [[3.95, 0], [4.9, 1]]);
  const sigh = kf(t, [[5.0, 0], [5.25, 1], [5.9, 0]]);
  const look = kf(t, [[2.55, 0], [2.95, 1]]) * (1 - shock * 0.7);

  const baseHipY = FLOOR - (L.th + L.sh) * 0.965 - 12;
  const bob = -9 * Math.pow(Math.cos(ph), 2) * amp + 5 * amp;
  const hipY = baseHipY + bob + antic * 10 - shock * 12 + sad * 10 + sigh * 7 + breath * 0.3;
  const lean = 6 * amp + look * 4 - shock * 9 + sad * 5 + sigh * 2;
  const headTilt = look * 16 - shock * 16 + sad * 16 + Math.sin(ph) * 2 * amp + Math.sin(t * 1.7) * 1.2;

  const feet = [0, 1].map((i) => {
    const p = legOff(i);
    const rel = S * 0.9 * Math.sin(p) * amp;
    const lift = Math.pow(Math.max(0, Math.cos(p)), 1.6) * amp;
    const stand = i === 0 ? -26 : 22;
    return [x + rel + stand * (1 - amp), FLOOR - 12 - lift * 46] as V;
  }) as [V, V];
  const footLift = [0, 1].map((i) => Math.max(0, Math.cos(legOff(i))) * amp) as [number, number];

  // ombro aproximado para posicionar as mãos
  const la = rad(lean);
  const shX = x + Math.sin(la) * L.torso, shY = hipY - Math.cos(la) * L.torso;
  const hang = (i: number): V => {
    const p = legOff(i);
    const sw = -S * 0.85 * Math.sin(p) * amp;
    return [shX + (i === 0 ? -14 : 12) + sw + sad * 10, shY + 14 + 222 - Math.abs(sw) * 0.18 + breath * 0.4];
  };
  const pocket: V = [x + 34, hipY + 26];
  const phoneHold: V = [shX + 74, shY + 92];
  const front = kv(t, [[2.3, hang(1)], [2.55, pocket], [2.95, phoneHold], [3.3, phoneHold], [3.45, [phoneHold[0] + 18, phoneHold[1] - 16]], [3.9, [phoneHold[0] + 10, phoneHold[1] - 6]], [4.3, phoneHold], [5.1, hang(1)]]);
  const hands: [V, V] = [hang(0), t < 2.3 ? hang(1) : front];
  const phone = kf(t, [[2.5, 0], [2.58, 1]]);
  const glow = kf(t, [[2.75, 0], [3.0, 1], [4.6, 1], [5.1, 0.3]]);

  const blink = (c: number, d = 0.16) => { const k = clamp01(1 - Math.abs(t - c) / (d / 2)); return k; };
  const blinks = Math.max(blink(1.1), blink(2.8, 0.14), blink(5.65, 0.42));
  const face: Face = {
    lx: 0.7 - look * 0.1 - shock * 0.25,
    ly: look * 0.55 - shock * 0.4 + sad * 0.45,
    open: (1 - blinks) * (1 - sad * 0.32) * (1 + shock * 0.0),
    eyeS: 1 + shock * 0.38,
    pupil: 1 - shock * 0.35,
    px: 0.5 + look * 0.1, py: look * 0.8 - shock * 0.3 + sad * 0.6,
    raise: shock * 1.1 + sad * 0.15,
    worry: sad * 1 + shock * 0.3,
    curve: 0.25 * (1 - look) + look * 0.05 - sad * 0.8,
    mo: shock * 1 + sigh * 0.28,
  };
  return { hip: [x, hipY], lean, slump: sad * 0.6 + sigh * 0.3, headTilt, face, feet, footLift, hands, phone, glow, tremble: kf(t, [[3.42, 0], [3.5, 1], [3.85, 0]]) };
};

const BalanceCard: React.FC<{ t: number; at: V }> = ({ t, at }) => {
  const k = backOut((t - 3.0) / 0.32) * (1 - smooth((t - 4.05) / 0.35));
  if (k <= 0.001) return null;
  const zero = smooth((t - 3.2) / 0.12);
  const shake = t > 3.3 && t < 3.8 ? Math.sin(t * 80) * 4 * (1 - (t - 3.3) / 0.5) : 0;
  return (
    <g transform={`translate(${at[0] + shake},${at[1]}) scale(${k})`}>
      <path d="M-190,-110 h380 a22,22 0 0 1 22,22 v136 a22,22 0 0 1 -22,22 h-380 a22,22 0 0 1 -22,-22 v-136 a22,22 0 0 1 22,-22 z" fill="#f4f1ea" stroke={INK} strokeWidth={6} />
      <text x={0} y={-56} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={40} fill="#6b5a4a">SALDO</text>
      <text x={0} y={22} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={84} fill={zero > 0.5 ? "#d2402f" : "#2b2b2b"}>R$ {zero > 0.5 ? "0,00" : "1.840,00"}</text>
    </g>
  );
};

export const MarcosTeste: React.FC = () => {
  useFonts();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const r = rigAt(t);
  // câmera: aproxima no rosto a partir do susto
  const z = kf(t, [[0, 1.16], [3.25, 1.2], [3.45, 1.34], [6.6, 1.5]]);
  const fx = kf(t, [[0, 520], [3.3, 560], [6.6, r.hip[0] + 40]]);
  const fy = kf(t, [[0, 1010], [3.3, 960], [6.6, r.hip[1] - 280]]);
  const cam = `translate(540,960) scale(${z}) translate(${-fx},${-fy})`;
  return (
    <AbsoluteFill style={{ backgroundColor: "#120a06" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <radialGradient id="vig" cx="0.5" cy="0.48" r="0.75">
            <stop offset="0.55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.75" />
          </radialGradient>
        </defs>
        <g transform={cam}>
          <Room t={t} />
          <Marcos r={r} t={t} />
        </g>
        <BalanceCard t={t} at={[540, 470]} />
        <rect x={0} y={0} width={W} height={H} fill="url(#vig)" />
      </svg>
    </AbsoluteFill>
  );
};
