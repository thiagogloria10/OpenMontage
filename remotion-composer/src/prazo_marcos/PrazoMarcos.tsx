import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// ==================================================================
// "30 dias pra entregar" — formato da referência (lado a lado, um quarto só)
// no estilo do teste do Marcos: cartoon com contorno, luz quente, movimento fluido (IK,
// quadros-chave suaves) e expressões contínuas. Tudo em código (SVG).
// Esquerda: SEM DISCIPLINA. Direita: COM DISCIPLINA.
// ==================================================================
const TXT = {
  hook: ["MESMO TRABALHO.", "30 DIAS PRA ENTREGAR."],
  titleR: ["FAZ ANTES"],
  titleL: ["DEIXA PRA DEPOIS"],
  final: ["O PRAZO ERA O MESMO.", "O PREÇO NÃO."],
};
const AUDIO = "prazo_marcos/audio_final.wav";
const FONT_DIR = "prazo_marcos";

export const TOTAL = 26.25;
const LOOP = 25.3;
const FINAL = 22;
const B = [0, 3, 6, 9, 12, 16, 19];
const Shift = React.createContext(0);

const GOLD = "#E8B84A", RED = "#e0554a", WHITE = "#f4f1ea", INK = "#1b100a", GREEN = "#5fd08a";
const BARLOW = "'Barlow Condensed', 'DejaVu Sans Condensed', sans-serif";
const MONO = "'JetBrains Mono', 'DejaVu Sans Mono', monospace";

// ------------------------------------------------------------------ utilidades
type V = [number, number];
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (x: number) => { x = clamp01(x); return x * x * x * (x * (x * 6 - 15) + 10); };
const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const er = (t: number, a: number, b: number) => smooth(ramp(t, a, b));
const kf = (t: number, keys: [number, number][]) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) { const [t0, v0] = keys[i - 1]; return lerp(v0, v1, smooth((t - t0) / (t1 - t0))); }
  }
  return keys[keys.length - 1][1];
};
const kv = (t: number, keys: [number, V][]): V => [kf(t, keys.map(([a, v]) => [a, v[0]])), kf(t, keys.map(([a, v]) => [a, v[1]]))];
const mixV = (a: V, b: V, k: number): V => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
const pt = (p: V) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
const blockOf = (t: number) => B.filter((b) => t >= b).length - 1;
const useT = () => {
  const off = React.useContext(Shift);
  const f0 = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frame = f0 - Math.round(off * fps);
  return { t: frame / fps, frame, fps };
};
const useFonts = () => {
  const [h] = useState(() => delayRender("fontes"));
  useEffect(() => {
    const faces = [700, 600].map((w) => new FontFace("Barlow Condensed", `url(${staticFile(`${FONT_DIR}/barlow-condensed-latin-${w}-normal.woff2`)})`, { weight: String(w) }));
    Promise.all(faces.map((f) => f.load().then((ff) => document.fonts.add(ff)))).then(() => continueRender(h)).catch(() => continueRender(h));
  }, [h]);
};
// IK de 2 ossos: escolhe o cotovelo mais afastado do centro do corpo
const ik = (a: V, c: V, l1: number, l2: number, side: number): V => {
  const dx = c[0] - a[0], dy = c[1] - a[1];
  const d = Math.max(1, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.5));
  const th = Math.atan2(dy, dx);
  const al = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const p1: V = [a[0] + l1 * Math.cos(th + al), a[1] + l1 * Math.sin(th + al)];
  const p2: V = [a[0] + l1 * Math.cos(th - al), a[1] + l1 * Math.sin(th - al)];
  return (p1[0] - p2[0]) * side > 0 ? p1 : p2;
};
const limbPath = (a: V, b: V, c: V) => {
  const q: V = [2 * b[0] - (a[0] + c[0]) / 2, 2 * b[1] - (a[1] + c[1]) / 2];
  return `M${pt(a)} Q${pt(q)} ${pt(c)}`;
};
const Tube: React.FC<{ d: string; color: string; w: number }> = ({ d, color, w }) => (
  <g>
    <path d={d} stroke={INK} strokeWidth={w + 9} fill="none" strokeLinecap="round" />
    <path d={d} stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" />
  </g>
);

// ------------------------------------------------------------------ cena: medidas
const LX = 300, RX = 780;
const KL = LX, KR = RX; // notebook bem na frente de cada um, virado para ele
const DESK_TOP = 1108, DESK_EDGE = 1152, FLOOR_Y = 1470, WALL_Y = 360;
const SH_Y = 992; // altura dos ombros sentado
const DESK = { L: [110, 500] as V, R: [580, 970] as V };

// ------------------------------------------------------------------ personagem (do peito para cima, sentado atrás da mesa)
type Face = { lx: number; ly: number; open: number; eyeS: number; pupil: number; px: number; py: number; raise: number; worry: number; curve: number; mo: number };
type Look = { shirt: string; shirt2: string; hair: string; hood?: boolean; glow: number };
type Ch = {
  cx: number; sy: number; lean: number; hx: number; hy: number; tilt: number; face: Face;
  hands: [V, V]; back: boolean; messy: number; tired: number; sweat: number; tremble: number;
  holdR?: React.ReactNode; stand: number; walk: number;
};
const LOOK_R: Look = { shirt: "#2f4f80", shirt2: "#24406a", hair: "#2a1d14", glow: 1 };
const LOOK_L: Look = { shirt: "#6d6878", shirt2: "#57536a", hair: "#4a3426", hood: true, glow: 0 };
const SKIN = "#f3efe7", SKIN2 = "#d9d2c5";
const HEAD_R = 74;

const headOf = (c: Ch): V => [c.cx + c.lean * 0.7 + c.hx, SH_Y + c.sy - 122 + c.hy];

const Person: React.FC<{ c: Ch; look: Look; t: number; layer: "body" | "arms" }> = ({ c, look, t, layer }) => {
  const tr = c.tremble * Math.sin(t * 90) * 3;
  const S = SH_Y + c.sy;
  const shL: V = [c.cx - 70 + c.lean + tr, S + 12], shR: V = [c.cx + 70 + c.lean + tr, S + 12];
  const elL = ik(shL, c.hands[0], 106, 100, -1), elR = ik(shR, c.hands[1], 106, 100, 1);
  // braço = uma curva só (ombro → cotovelo → mão); a manga é a MESMA curva cortada (sem a pele escapar)
  const arm = (sh: V, el: V, h: V, i: number) => {
    const q: V = [2 * el[0] - (sh[0] + h[0]) / 2, 2 * el[1] - (sh[1] + h[1]) / 2];
    const at = (u: number): V => [(1 - u) * (1 - u) * sh[0] + 2 * (1 - u) * u * q[0] + u * u * h[0], (1 - u) * (1 - u) * sh[1] + 2 * (1 - u) * u * q[1] + u * u * h[1]];
    const sub = (u: number) => { const c1: V = [lerp(sh[0], q[0], u), lerp(sh[1], q[1], u)]; return `M${pt(sh)} Q${pt(c1)} ${pt(at(u))}`; };
    const full = `M${pt(sh)} Q${pt(q)} ${pt(h)}`;
    const su = look.hood ? 0.86 : 0.44;
    const ang = (Math.atan2(h[1] - q[1], h[0] - q[0]) * 180) / Math.PI;
    const side = i === 0 ? -1 : 1;
    const cuff = at(su);
    const cuffAng = (Math.atan2(at(su + 0.02)[1] - at(su - 0.02)[1], at(su + 0.02)[0] - at(su - 0.02)[0]) * 180) / Math.PI;
    return (
      <g key={i}>
        <path d={full} stroke={INK} strokeWidth={37} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d={full} stroke={SKIN} strokeWidth={28} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d={sub(su)} stroke={INK} strokeWidth={43} fill="none" strokeLinecap="butt" strokeLinejoin="round" />
        <path d={sub(su)} stroke={look.shirt} strokeWidth={34} fill="none" strokeLinecap="butt" strokeLinejoin="round" />
        <circle cx={sh[0]} cy={sh[1]} r={17} fill={look.shirt} />
        {look.hood && <rect x={-6} y={-21} width={12} height={42} rx={5} fill={look.shirt2} stroke={INK} strokeWidth={4} transform={`translate(${cuff[0]},${cuff[1]}) rotate(${cuffAng})`} />}
        {/* mão em luva com polegar, virada para onde o antebraço aponta */}
        <g transform={`translate(${h[0]},${h[1]}) rotate(${ang})`}>
          <ellipse cx={-4 * side * 0} cy={-15 * side} rx={9} ry={7} transform={`rotate(${-30 * side})`} fill={SKIN} stroke={INK} strokeWidth={4} />
          <ellipse cx={6} cy={0} rx={21} ry={17} fill={SKIN} stroke={INK} strokeWidth={4.5} />
          <path d={`M14,${-8} q6,8 0,16`} stroke={INK} strokeWidth={2.5} fill="none" opacity={0.5} />
        </g>
      </g>
    );
  };
  const arms = (
    <g>
      {arm(shL, elL, c.hands[0], 0)}
      {arm(shR, elR, c.hands[1], 1)}
      {c.holdR && <g transform={`translate(${c.hands[1][0]},${c.hands[1][1]})`}>{c.holdR}</g>}
    </g>
  );
  if (layer === "arms") return c.back ? null : arms;

  const hd = headOf({ ...c, hx: c.hx + tr });
  const f = c.face;
  const fx = hd[0] + f.lx * 24, fy = hd[1] + f.ly * 18;
  const eye = (side: number) => {
    const turnedAway = (side < 0 && f.lx > 0.2) || (side > 0 && f.lx < -0.2);
    const far = turnedAway ? 0.86 : 1;
    const ex = fx + side * 25 * far, ey = fy - 6;
    const ry = 14 * f.eyeS * Math.max(0.06, f.open);
    const rx = 11 * f.eyeS * far;
    const by = ey - 28 - f.raise * 13;
    const inner = ex - side * 14, outer = ex + side * 14;
    return (
      <g key={side}>
        {c.tired > 0 && <path d={`M${ex - 13},${ey + 15} Q${ex},${ey + 24} ${ex + 13},${ey + 15}`} stroke="#8a6d7a" strokeWidth={4} fill="none" opacity={c.tired} strokeLinecap="round" />}
        <ellipse cx={ex} cy={ey} rx={rx} ry={ry} fill={c.tired > 0.5 ? "#fbeeee" : "#fff"} stroke={INK} strokeWidth={3.5} />
        {f.open > 0.2 && <circle cx={ex + f.px * 4.5} cy={ey + f.py * 4.5} r={Math.min(ry, 6.8 * f.pupil)} fill={INK} />}
        {f.open < 0.78 && f.open > 0.08 && <path d={`M${ex - rx - 1},${ey - ry * 0.15} Q${ex},${ey - ry * 1.55} ${ex + rx + 1},${ey - ry * 0.15}`} fill={SKIN} stroke={INK} strokeWidth={3} />}
        {f.open <= 0.08 && <path d={`M${ex - rx},${ey} Q${ex},${ey + 6} ${ex + rx},${ey}`} stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />}
        <path d={`M${inner},${by - f.worry * 10} Q${ex},${by - 5 - f.raise * 3} ${outer},${by + f.worry * 3}`} stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />
      </g>
    );
  };
  const mx = fx, my = fy + 34;
  const mw = 36 * (1 - f.mo * 0.5);
  const mouth = f.mo > 0.08
    ? <ellipse cx={mx} cy={my + 4} rx={mw / 2} ry={4 + f.mo * 14} fill="#3a1410" stroke={INK} strokeWidth={4} />
    : <path d={`M${mx - mw / 2},${my - f.curve * 4} Q${mx},${my + f.curve * 15} ${mx + mw / 2},${my - f.curve * 4}`} stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />;
  const spikes = Math.round(c.messy * 6);
  const S2 = S + 12;
  const id = look.glow ? "R" : "L";
  return (
    <g>
      {look.glow > 0 && <circle cx={hd[0]} cy={hd[1] + 90} r={230} fill="url(#auraGold)" opacity={0.5} />}
      {/* pernas (só aparecem quando ele levanta e sai) */}
      {c.stand > 0.01 && [-1, 1].map((sd) => {
        const sw = Math.sin(c.walk) * 26 * sd;
        const hip: V = [c.cx + sd * 30, S + 230];
        return <Tube key={sd} d={`M${pt(hip)} L${pt([hip[0] + sw, hip[1] + 260])}`} color="#2a2f45" w={40} />;
      })}
      {/* tronco */}
      <path d={`M${shL[0] - 8},${S2 + 8} Q${c.cx - 78 + c.lean * 0.4},${S2 + 130} ${c.cx - 64},${S2 + 250} L${c.cx + 64},${S2 + 250} Q${c.cx + 78 + c.lean * 0.4},${S2 + 130} ${shR[0] + 8},${S2 + 8} Q${c.cx + c.lean},${S2 - 26} ${shL[0] - 8},${S2 + 8} Z`}
        fill={look.shirt} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      <path d={`M${shL[0]},${S2 + 16} Q${c.cx - 66},${S2 + 130} ${c.cx - 54},${S2 + 246} L${c.cx - 30},${S2 + 246} Q${c.cx - 40},${S2 + 130} ${shL[0] + 24},${S2 + 18} Z`} fill={look.shirt2} opacity={0.75} />
      {look.hood
        ? <path d={`M${c.cx - 46 + c.lean},${S2 - 4} Q${c.cx + c.lean},${S2 + 40} ${c.cx + 46 + c.lean},${S2 - 4}`} stroke={INK} strokeWidth={5} fill={look.shirt2} />
        : <path d={`M${c.cx - 26 + c.lean},${S2 - 6} L${c.cx + c.lean},${S2 + 26} L${c.cx + 26 + c.lean},${S2 - 6}`} stroke={GOLD} strokeWidth={5} fill="none" strokeLinejoin="round" />}
      {c.back && arms}
      {/* pescoço e cabeça */}
      <Tube d={`M${pt([c.cx + c.lean, S2])} L${pt([hd[0], hd[1] + HEAD_R * 0.7])}`} color={SKIN} w={30} />
      <g transform={`rotate(${c.tilt} ${hd[0]} ${hd[1] + 60})`}>
        <defs>
          <radialGradient id={`headG${id}`} cx="0.38" cy="0.3" r="0.8"><stop offset="0" stopColor="#ffffff" /><stop offset="0.7" stopColor={SKIN} /><stop offset="1" stopColor="#cfc7b8" /></radialGradient>
          <clipPath id={`hc${id}`}><circle cx={hd[0]} cy={hd[1]} r={HEAD_R} /></clipPath>
        </defs>
        {[-1, 1].map((sd) => <ellipse key={sd} cx={hd[0] + sd * (HEAD_R - 2) - f.lx * 10} cy={hd[1] + 8} rx={12} ry={18} fill={SKIN2} stroke={INK} strokeWidth={4} />)}
        <circle cx={hd[0]} cy={hd[1]} r={HEAD_R} fill={`url(#headG${id})`} stroke={INK} strokeWidth={6} />
        <g clipPath={`url(#hc${id})`}>
          <path d={`M${hd[0] - 90},${hd[1] - 16 + f.ly * 6} Q${hd[0] - 50 + f.lx * 14},${hd[1] - 60 + f.ly * 10} ${hd[0] + 10 + f.lx * 18},${hd[1] - 50 + f.ly * 10} Q${hd[0] + 55 + f.lx * 10},${hd[1] - 54 + f.ly * 8} ${hd[0] + 90},${hd[1] - 22 + f.ly * 6} L${hd[0] + 90},${hd[1] - 100} L${hd[0] - 90},${hd[1] - 100} Z`} fill={look.hair} />
        </g>
        {Array.from({ length: spikes }).map((_, i) => {
          const a = -150 + i * 22, r0 = HEAD_R - 6;
          const x0 = hd[0] + Math.cos((a * Math.PI) / 180) * r0, y0 = hd[1] + Math.sin((a * Math.PI) / 180) * r0;
          const x1 = hd[0] + Math.cos(((a + 6) * Math.PI) / 180) * (r0 + 26 + (i % 2) * 10), y1 = hd[1] + Math.sin(((a + 6) * Math.PI) / 180) * (r0 + 26 + (i % 2) * 10);
          return <path key={i} d={`M${x0 - 8},${y0} L${x1},${y1} L${x0 + 8},${y0 + 4} Z`} fill={look.hair} stroke={INK} strokeWidth={3} strokeLinejoin="round" />;
        })}
        <circle cx={hd[0]} cy={hd[1]} r={HEAD_R} fill="none" stroke={INK} strokeWidth={6} />
        <circle cx={hd[0]} cy={hd[1]} r={HEAD_R} fill="url(#phoneFace)" opacity={id === "L" ? 0 : 0} />
        {eye(-1)}
        {eye(1)}
        {mouth}
        <ellipse cx={fx + 36} cy={fy + 18} rx={11} ry={6} fill="#e7a28a" opacity={0.35} />
        <ellipse cx={fx - 36} cy={fy + 18} rx={11} ry={6} fill="#e7a28a" opacity={0.35} />
        {c.sweat > 0 && <path d={`M${hd[0] + 62} ${hd[1] - 30 + c.sweat * 40} q-10 18 0 24 q10 -6 0 -24`} fill="#8fd0ff" stroke={INK} strokeWidth={2.5} opacity={c.sweat < 0.95 ? 1 : 0} />}
      </g>
    </g>
  );
};

// ------------------------------------------------------------------ objetos
const CalPage: React.FC<{ v: number }> = ({ v }) => {
  const hoje = v <= 0, one = v === 1;
  return (
    <g>
      <rect x={0} y={0} width={74} height={88} rx={5} fill={hoje || one ? "#d84a3c" : "#f4f1ea"} stroke={INK} strokeWidth={3.5} />
      {!hoje && (
        <>
          <rect x={1.5} y={1.5} width={71} height={19} rx={3} fill={one ? "#a8302a" : "#d84a3c"} />
          <text x={37} y={15} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={13} fill="#fff">{one ? "FALTA" : "FALTAM"}</text>
          <text x={37} y={63} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={44} fill={one ? "#fff" : "#22222c"}>{v}</text>
          <text x={37} y={81} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={12} fill={one ? "#fff" : "#55525f"}>{one ? "DIA" : "DIAS"}</text>
        </>
      )}
      {hoje && (
        <>
          <text x={37} y={46} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={24} fill="#fff">PRAZO</text>
          <text x={37} y={68} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={16} fill="#fff">É HOJE</text>
        </>
      )}
    </g>
  );
};
const Calendar: React.FC<{ n: number; prev: number; tear: number; note: number; fly: number }> = ({ n, prev, tear, note, fly }) => (
  <g transform="translate(476,596) scale(1.73)">
    <CalPage v={n} />
    {tear > 0 && tear < 1 && (
      <g transform={`translate(${tear * 30},${tear * 170}) rotate(${tear * 75} 37 0)`} opacity={1 - tear * 0.8}>
        <CalPage v={prev} />
      </g>
    )}
    {[18, 56].map((x) => <rect key={x} x={x - 3} y={-7} width={6} height={13} rx={2} fill={INK} />)}
    {note > 0 && (
      <g transform={`translate(${lerp(150, -12, fly)},${lerp(270, 64, fly)}) rotate(${lerp(-30, -8, fly)}) scale(${lerp(0.6, 1, fly)})`}>
        <rect x={0} y={0} width={60} height={44} fill="#f5d36a" stroke={INK} strokeWidth={2.5} />
        <text x={30} y={19} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={16} fill="#2a2836">SEG 19H</text>
        <text x={30} y={36} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={13} fill="#2a2836">PARTE 1</text>
      </g>
    )}
  </g>
);

type Screen = "doc" | "done" | "sent" | "late" | "sending" | "off";
const ScreenFace: React.FC<{ kind: Screen; pct: number; t: number }> = ({ kind, pct, t }) => {
  if (kind === "off") return <rect x={0} y={0} width={58} height={44} fill="#15161c" />;
  if (kind === "doc")
    return (
      <g>
        <rect x={0} y={0} width={58} height={44} fill="#eef3fb" />
        {Array.from({ length: 7 }).map((_, i) => (i / 7 < pct ? <rect key={i} x={5} y={5 + i * 5.5} width={i % 3 === 2 ? 30 : 46} height={2.6} fill="#7d8aa8" /> : null))}
      </g>
    );
  if (kind === "done")
    return (
      <g>
        <rect x={0} y={0} width={58} height={44} fill="#2f9a5a" />
        <path d="M17 20 l7 7 l15 -15" stroke="#fff" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <text x={29} y={40} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={9} fill="#fff">PRONTO</text>
      </g>
    );
  if (kind === "sent")
    return (
      <g>
        <rect x={0} y={0} width={58} height={44} fill="#2f9a5a" />
        <text x={29} y={20} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={11} fill="#fff">ENVIADO ✓</text>
        <text x={29} y={34} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={9} fill="#dff5e6">09:12</text>
      </g>
    );
  if (kind === "sending")
    return (
      <g>
        <rect x={0} y={0} width={58} height={44} fill="#2a2d3d" />
        <text x={29} y={18} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={10} fill="#fff">ENVIANDO...</text>
        <rect x={6} y={26} width={46} height={6} rx={3} fill="#454a63" />
        <rect x={6} y={26} width={46 * pct} height={6} rx={3} fill={RED} />
      </g>
    );
  const blink = Math.floor(t * 4) % 2 === 0;
  return (
    <g>
      <rect x={0} y={0} width={58} height={44} fill={blink ? "#b8352c" : "#7e231d"} />
      <text x={29} y={20} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={11} fill="#fff">ENVIADO</text>
      <text x={29} y={35} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={11} fill="#fff">23:59</text>
    </g>
  );
};
// notebook de frente para a pessoa: vemos a tampa por trás; as mãos ficam no teclado atrás dela
const LaptopBack: React.FC<{ cx: number; lid: number; gold: boolean; shake: number }> = ({ cx, lid, gold, shake }) => (
  <g transform={`translate(${cx},${DESK_TOP + 16 + shake})`}>
    <rect x={-108} y={-6} width={216} height={14} rx={5} fill="#4a4d5c" stroke={INK} strokeWidth={4} />
    <g transform={`scale(1,${Math.max(0.06, lid)})`}>
      <rect x={-98} y={-124} width={196} height={122} rx={12} fill="#3d404e" stroke={INK} strokeWidth={5} />
      <rect x={-86} y={-112} width={172} height={98} rx={8} fill="#454959" />
      <circle cx={0} cy={-63} r={13} fill={gold ? GOLD : "#6b6e7c"} stroke={INK} strokeWidth={3} />
    </g>
  </g>
);
const StatusChip: React.FC<{ cx: number; screen: Screen; pct: number; t: number; at: number }> = ({ cx, screen, pct, t, at }) => {
  if (screen === "off" || screen === "doc") return null;
  const pop = backPop(t - at);
  const blink = Math.floor(t * 4) % 2 === 0;
  const cfg = screen === "done" ? { bg: "#2f9a5a", txt: "✓ PRONTO" } : screen === "sent" ? { bg: "#2f9a5a", txt: "✓ ENVIADO 09:12" } : screen === "sending" ? { bg: "#2a2d3d", txt: "ENVIANDO..." } : { bg: blink ? "#c43d30" : "#7e231d", txt: "ENVIADO 23:59" };
  return (
    <g transform={`translate(${cx},${DESK_TOP - 150}) scale(${pop})`}>
      <rect x={-112} y={-30} width={224} height={60} rx={14} fill={cfg.bg} stroke={INK} strokeWidth={5} />
      <text x={0} y={screen === "sending" ? 0 : 11} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={screen === "sending" ? 26 : 34} fill="#fff">{cfg.txt}</text>
      {screen === "sending" && <><rect x={-90} y={8} width={180} height={12} rx={6} fill="#454a63" /><rect x={-90} y={8} width={180 * pct} height={12} rx={6} fill={RED} /></>}
    </g>
  );
};
const backPop = (x: number) => { if (x <= 0) return 0; if (x >= 0.3) return 1; const k = x / 0.3; return 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); };
const Laptop: React.FC<{ cx: number; lid: number; screen: Screen; pct: number; t: number }> = ({ cx, lid, screen, pct, t }) => (
  <g transform={`translate(${cx},${DESK_TOP + 18})`}>
    <path d="M-70,2 L70,2 L58,-20 L-58,-20 Z" fill="#4a4d5c" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
    {[-14, -8, -2].map((y, i) => <line key={i} x1={-50 - i * 3} y1={y} x2={50 + i * 3} y2={y} stroke="#2e3038" strokeWidth={2.5} strokeDasharray="7 3" />)}
    <g transform={`scale(1,${Math.max(0.05, lid)})`}>
      <rect x={-58} y={-104} width={116} height={92} rx={7} fill="#2a2a33" stroke={INK} strokeWidth={5} />
      <g transform="translate(-50,-97) scale(1.72,1.75)"><ScreenFace kind={screen} pct={pct} t={t} /></g>
    </g>
  </g>
);
const Mug: React.FC<{ steam?: number; t?: number }> = ({ steam = 0, t = 0 }) => (
  <g>
    <path d="M12 -6 q12 0 12 10 q0 10 -12 10" stroke={INK} strokeWidth={9} fill="none" />
    <path d="M12 -6 q12 0 12 10 q0 10 -12 10" stroke="#f2efe6" strokeWidth={4} fill="none" />
    <rect x={-14} y={-18} width={28} height={34} rx={5} fill="#f2efe6" stroke={INK} strokeWidth={4} />
    <rect x={-12} y={-16} width={24} height={7} fill="#6b4a36" />
    {steam > 0 && [0, 1].map((i) => {
      const q = ((t * 0.8 + i * 0.5) % 1 + 1) % 1;
      return <path key={i} d={`M${-5 + i * 10} ${-24 - q * 34} q6 -7 0 -14 q-6 -7 0 -14`} stroke="#ffffff" strokeWidth={3} fill="none" opacity={steam * 0.6 * (1 - q)} />;
    })}
  </g>
);
const Phone: React.FC<{ t: number }> = ({ t }) => (
  <g transform="rotate(-10)">
    <rect x={-17} y={-30} width={34} height={58} rx={7} fill="#15161c" stroke={INK} strokeWidth={4} />
    <rect x={-13} y={-25} width={26} height={46} rx={3} fill="#7cc4ff" />
    {[0, 1, 2].map((i) => <rect key={i} x={-10} y={-24 + (((i * 15 + t * 60) % 46) + 46) % 46} width={20} height={7} fill={i === 1 ? "#ff7aa8" : "#e9f6ff"} opacity={0.9} />)}
  </g>
);
const Cloud: React.FC<{ x: number; y: number; s: number; rain: number; t: number; flash?: boolean }> = ({ x, y, s, rain, t, flash }) => (
  <g transform={`translate(${x},${y + Math.sin(t * 2.2) * 5}) scale(${s})`}>
    {rain > 0 && Array.from({ length: 16 }).map((_, i) => {
      const q = ((t * 2.3 + i * 0.173) % 1 + 1) % 1;
      const xx = -60 + ((i * 37) % 120);
      return <line key={i} x1={xx} y1={20 + q * 130} x2={xx - 4} y2={34 + q * 130} stroke="#8fb4e8" strokeWidth={4} strokeLinecap="round" opacity={rain * (1 - q * 0.6)} />;
    })}
    <path d="M-70,22 Q-92,22 -88,0 Q-86,-22 -60,-20 Q-56,-52 -22,-50 Q0,-74 30,-54 Q62,-58 64,-26 Q92,-24 88,2 Q86,24 62,22 Z" fill={flash ? "#a8a8bc" : "#56566a"} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
    <path d="M-50,-12 Q-40,-32 -16,-30" stroke="#7a7a90" strokeWidth={5} fill="none" strokeLinecap="round" />
    {flash && <path d="M6 22 l-14 30 h14 l-10 30" stroke="#ffe27a" strokeWidth={6} fill="none" strokeLinejoin="round" />}
  </g>
);
const FlyPaper: React.FC<{ t: number; n: number; cx: number; cy: number }> = ({ t, n, cx, cy }) => (
  <g>
    {Array.from({ length: n }).map((_, i) => {
      const q = ((t * 0.55 + i / n) % 1 + 1) % 1;
      const x = cx + Math.sin(i * 2.1 + q * 6) * (60 + i * 10) + (i % 2 ? 1 : -1) * q * 120;
      const y = cy - 60 - Math.sin(q * Math.PI) * 220;
      return <rect key={i} x={-24} y={-16} width={48} height={32} fill="#f1ede2" stroke={INK} strokeWidth={3} transform={`translate(${x},${y}) rotate(${q * 360 * (i % 2 ? 1 : -1)})`} opacity={Math.sin(q * Math.PI)} />;
    })}
  </g>
);

const Desk: React.FC<{ x0: number; x1: number }> = ({ x0, x1 }) => (
  <g>
    <path d={`M${x0 + 30},${DESK_TOP} L${x1 - 30},${DESK_TOP} L${x1},${DESK_EDGE} L${x0},${DESK_EDGE} Z`} fill="url(#woodTop)" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
    <rect x={x0} y={DESK_EDGE} width={x1 - x0} height={24} fill="#6e4a30" stroke={INK} strokeWidth={5} />
    <rect x={x0 + 12} y={DESK_EDGE + 24} width={x1 - x0 - 24} height={FLOOR_Y - DESK_EDGE - 24} fill="url(#woodFront)" stroke={INK} strokeWidth={5} />
    {[0, 1].map((i) => (
      <g key={i}>
        <rect x={x0 + 34} y={DESK_EDGE + 46 + i * 120} width={x1 - x0 - 68} height={98} rx={6} fill="#7a5236" stroke={INK} strokeWidth={4} />
        <rect x={(x0 + x1) / 2 - 24} y={DESK_EDGE + 88 + i * 120} width={48} height={10} rx={5} fill="#c99a54" stroke={INK} strokeWidth={2.5} />
      </g>
    ))}
  </g>
);
const Chair: React.FC<{ cx: number }> = ({ cx }) => (
  <g>
    <rect x={cx - 98} y={SH_Y - 70} width={196} height={260} rx={36} fill="#3a2a22" stroke={INK} strokeWidth={6} />
    <rect x={cx - 80} y={SH_Y - 52} width={160} height={220} rx={28} fill="#4a362b" />
  </g>
);
const DeskLamp: React.FC<{ x: number; dir: 1 | -1; on: boolean }> = ({ x, dir, on }) => (
  <g>
    <ellipse cx={x} cy={DESK_TOP + 22} rx={34} ry={10} fill="#3a3a44" stroke={INK} strokeWidth={4} />
    <path d={`M${x},${DESK_TOP + 16} L${x - dir * 14},${DESK_TOP - 120} L${x + dir * 46},${DESK_TOP - 150}`} stroke={INK} strokeWidth={13} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    <path d={`M${x},${DESK_TOP + 16} L${x - dir * 14},${DESK_TOP - 120} L${x + dir * 46},${DESK_TOP - 150}`} stroke="#4a4a56" strokeWidth={6} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    <path d={`M${x + dir * 26},${DESK_TOP - 176} L${x + dir * 92},${DESK_TOP - 142} L${x + dir * 62},${DESK_TOP - 108} Z`} fill="#3a3a44" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
    <ellipse cx={x + dir * 77} cy={DESK_TOP - 125} rx={22} ry={10} transform={`rotate(${dir * -50} ${x + dir * 77} ${DESK_TOP - 125})`} fill={on ? "#ffe6a8" : "#55555f"} />
  </g>
);
const WallClock: React.FC<{ x: number; y: number; txt: string; col: string }> = ({ x, y, txt, col }) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={0} y={0} width={98} height={42} rx={8} fill="#14100c" stroke={INK} strokeWidth={4} />
    <text x={49} y={31} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={26} fill={col} style={{ filter: `drop-shadow(0 0 5px ${col})` }}>{txt}</text>
  </g>
);

const Room: React.FC<{ t: number; dawn: number }> = ({ t, dawn }) => {
  const c = (a: string, b: string) => {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], dawn))).join(",")})`;
  };
  return (
    <g>
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a170e" /><stop offset="1" stopColor="#4d2d1b" /></linearGradient>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a2215" /><stop offset="1" stopColor="#160c07" /></linearGradient>
        <linearGradient id="win" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor={c("#121a36", "#ffb36b")} /><stop offset="1" stopColor={c("#0a0f22", "#8fa6e6")} /></linearGradient>
        <linearGradient id="woodTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a8734a" /><stop offset="1" stopColor="#8a5a36" /></linearGradient>
        <linearGradient id="woodFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6a4429" /><stop offset="1" stopColor="#4a2e1b" /></linearGradient>
      </defs>
      <rect x={0} y={WALL_Y} width={1080} height={FLOOR_Y - WALL_Y} fill="url(#wall)" />
      <rect x={0} y={FLOOR_Y - 30} width={1080} height={30} fill="#2b170d" stroke={INK} strokeWidth={5} />
      <rect x={0} y={FLOOR_Y} width={1080} height={200} fill="url(#floor)" />
      {/* mural de recados (esquerda) */}
      <g transform="translate(140,600) rotate(-1.5)">
        <rect x={0} y={0} width={200} height={146} rx={8} fill="#a07448" stroke={INK} strokeWidth={6} />
        <rect x={12} y={12} width={176} height={122} rx={4} fill="#b88a5a" />
        {[[22, 22, "#e8b84a"], [80, 18, "#7cc4ff"], [138, 26, "#ff9a8a"], [34, 78, "#a8e08a"], [104, 80, "#e8b84a"]].map(([x, y, col], i) => (
          <g key={i} transform={`rotate(${i % 2 ? 6 : -5} ${(x as number) + 20} ${(y as number) + 20})`}>
            <rect x={x as number} y={y as number} width={42} height={40} fill={col as string} stroke={INK} strokeWidth={2.5} />
            <circle cx={(x as number) + 21} cy={(y as number) + 5} r={4} fill={RED} stroke={INK} strokeWidth={1.5} />
          </g>
        ))}
      </g>
      {/* janela (direita) */}
      <g transform="translate(738,592)">
        <rect x={0} y={0} width={196} height={176} rx={6} fill="url(#win)" />
        {[0, 1, 2, 3, 4].map((i) => {
          const h = [60, 96, 74, 112, 56][i];
          return <rect key={i} x={2 + i * 39} y={176 - h} width={35} height={h} fill={dawn > 0.5 ? "#3a3045" : "#120f1c"} />;
        })}
        {dawn < 0.6 && <path d="M150,30 a22,22 0 1,0 20,34 a18,18 0 1,1 -20,-34 z" fill="#f4e7b5" opacity={1 - dawn * 1.6} />}
        {[[30, 30], [70, 50], [110, 22]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.5} fill="#e9ecff" opacity={(1 - dawn) * (0.5 + 0.5 * Math.sin(t * 2 + i))} />)}
        <rect x={0} y={0} width={196} height={176} rx={6} fill="none" stroke="#6a4426" strokeWidth={16} />
        <line x1={98} y1={0} x2={98} y2={176} stroke="#6a4426" strokeWidth={10} />
        <line x1={0} y1={88} x2={196} y2={88} stroke="#6a4426" strokeWidth={10} />
        <rect x={-8} y={-8} width={212} height={192} rx={8} fill="none" stroke={INK} strokeWidth={5} />
        <rect x={-20} y={176} width={236} height={22} rx={4} fill="#7a5030" stroke={INK} strokeWidth={5} />
      </g>
      {/* estante ao fundo entre as mesas */}
      <g transform="translate(502,990)">
        <rect x={0} y={0} width={76} height={480} fill="#5a3a24" stroke={INK} strokeWidth={5} />
        {[40, 140, 240, 340].map((y, i) => (
          <g key={i}>
            {[0, 1, 2, 3].map((j) => <rect key={j} x={6 + j * 16} y={y + (j % 2) * 10} width={14} height={86 - (j % 2) * 10} fill={["#b8483c", "#3f6aa8", "#d9a440", "#5a9a5a"][(i + j) % 4]} stroke={INK} strokeWidth={2} />)}
            <rect x={0} y={y + 86} width={76} height={10} fill="#3e2616" stroke={INK} strokeWidth={3} />
          </g>
        ))}
      </g>
    </g>
  );
};
// planta em primeiro plano (borda direita): esconde a saída do dourado
const Plant: React.FC<{ t: number }> = ({ t }) => (
  <g transform="translate(1010,1470)">
    <path d="M-50,0 L-40,-120 L40,-120 L50,0 Z" fill="#a85a34" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
    {[-60, -30, -5, 20, 45, 70].map((a, i) => (
      <path key={i} d={`M0,-120 q${a * 0.5},-140 ${a * 1.6},-${300 + (i % 3) * 70}`} stroke={INK} strokeWidth={30} fill="none" strokeLinecap="round" transform={`rotate(${2 * Math.sin(t * 1.2 + i)} 0 -120)`} />
    ))}
    {[-60, -30, -5, 20, 45, 70].map((a, i) => (
      <path key={i} d={`M0,-120 q${a * 0.5},-140 ${a * 1.6},-${300 + (i % 3) * 70}`} stroke={i % 2 ? "#3e6b3a" : "#4f8048"} strokeWidth={20} fill="none" strokeLinecap="round" transform={`rotate(${2 * Math.sin(t * 1.2 + i)} 0 -120)`} />
    ))}
  </g>
);

// ------------------------------------------------------------------ textos
const R_LABELS = ["MARCOU DIA E HORA", "1 HORA POR DIA", "UM POUCO TODO DIA", "TERMINOU CEDO", "NOITE TRANQUILA", "ENTREGOU NA HORA", "E DESCANSADO"];
const L_LABELS = ["TEM TEMPO", "SÓ MAIS UM", "COMEÇO AMANHÃ", "AINDA DÁ TEMPO?", "VIROU A NOITE", "NO ÚLTIMO MINUTO", "E ESGOTADO"];
const DAYS = [30, 24, 15, 7, 1, 0, 0];
const pctAt = (t: number, right: boolean) =>
  right
    ? interpolate(t, [0, 3, 6, 6.01, 9, 9.01, 10, 99], [0, 0, 0.2, 0.35, 0.55, 0.8, 1, 1], clamp)
    : interpolate(t, [0, 12, 16, 16.2, 18, 99], [0, 0, 0.7, 0.7, 1, 1], clamp);
const minutesAt = (t: number, right: boolean) => {
  const b = blockOf(t);
  if (right) return b === 4 ? (t < 14.7 ? 1330 : 1350) : [1140, 1140, 1170, 1200, 1330, 480, 540][b];
  if (b === 4) return Math.floor(interpolate(t, [12, 16], [1420, 1630], clamp));
  if (b === 5) return Math.floor(interpolate(t, [16, 18], [1390, 1439], clamp));
  return [1140, 1430, 1200, 1260, 1420, 1390, 540][b];
};
const fmt = (m: number) => {
  const mm = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`;
};

const SideLabel: React.FC<{ cx: number; title: string[]; sub: string; subAt: number; right: boolean; hide: number }> = ({ cx, title, sub, subAt, right, hide }) => {
  const { t, fps } = useT();
  const p = spring({ frame: Math.round((t - subAt) * fps), fps, config: { damping: 14, stiffness: 200 } });
  const pct = pctAt(t, right);
  const b = blockOf(t);
  const barCol = pct >= 1 ? GREEN : right ? GOLD : b >= 4 ? RED : "#9a8f8a";
  const mins = minutesAt(t, right);
  const clockCol = !right && ((mins >= 1440 && mins < 1800) || (b === 5 && mins >= 1430)) ? RED : "#ffb84a";
  return (
    <div style={{ position: "absolute", left: cx - 210, width: 420, top: 372, textAlign: "center", opacity: 1 - hide }}>
      <div style={{ height: 62, display: "flex", flexDirection: "column", justifyContent: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 51, whiteSpace: "nowrap", color: right ? WHITE : "#e2d8cf", letterSpacing: 1.5, lineHeight: 1, textShadow: "0 3px 0 rgba(0,0,0,.6), 0 4px 12px rgba(0,0,0,.8)" }}>
        {title.map((l) => <div key={l}>{l}</div>)}
      </div>
      <div style={{ fontFamily: BARLOW, fontWeight: 600, fontSize: 42, color: right ? GOLD : "#f0a89c", letterSpacing: 2, marginTop: 4, height: 46, opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 10}px)`, textShadow: "0 2px 0 rgba(0,0,0,.6), 0 2px 10px rgba(0,0,0,.9)" }}>{sub}</div>
      <div style={{ margin: "8px auto 0", width: 360, display: "flex", gap: 8 }}>
        {/* relógio de cada um, junto do seu progresso */}
        <div style={{ width: 104, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(14,9,6,.82)", borderRadius: 10, border: "3px solid #1b100a", fontFamily: MONO, fontWeight: 800, fontSize: 30, color: clockCol, textShadow: `0 0 8px ${clockCol}` }}>{fmt(mins)}</div>
        <div style={{ flex: 1, padding: "5px 10px 8px", background: "rgba(14,9,6,.82)", borderRadius: 10, border: "3px solid #1b100a" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: BARLOW, fontWeight: 700, fontSize: 26, color: WHITE, letterSpacing: 1 }}>
            <span>TRABALHO</span><span style={{ color: barCol }}>{Math.round(pct * 100)}%</span>
          </div>
          <div style={{ height: 12, marginTop: 4, borderRadius: 6, background: "#33261d", overflow: "hidden" }}>
            <div style={{ width: `${pct * 100}%`, height: "100%", background: barCol }} />
          </div>
        </div>
      </div>
    </div>
  );
};
const ResultCard: React.FC<{ cx: number; right: boolean }> = ({ cx, right }) => {
  const { t, fps } = useT();
  const p = spring({ frame: Math.round((t - 19.25) * fps), fps, config: { damping: 13, stiffness: 170 } });
  const p2 = spring({ frame: Math.round((t - 19.75) * fps), fps, config: { damping: 13, stiffness: 170 } });
  return (
    <div style={{ position: "absolute", left: cx - 175, top: 600, width: 350, padding: "14px 14px", textAlign: "center", background: "#f4ede0", border: `5px solid ${INK}`, borderRadius: 16, boxShadow: `0 6px 0 ${INK}`, transform: `scale(${p}) rotate(${right ? 2 : -2}deg)`, opacity: Math.min(1, p * 2) }}>
      <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 52, color: "#2f9a5a", letterSpacing: 2, lineHeight: 1 }}>✓ ENTREGUE</div>
      <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 38, color: right ? "#b9862a" : "#c43d30", lineHeight: 1.05, marginTop: 8, opacity: Math.min(1, p2 * 1.6), transform: `translateY(${(1 - p2) * 12}px)` }}>
        {right ? "+ DORMIU 8H" : "+ 3 NOITES SEM DORMIR"}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ animação dos dois
const baseFace = (o: Partial<Face> = {}): Face => ({ lx: 0, ly: 0, open: 1, eyeS: 1, pupil: 1, px: 0, py: 0, raise: 0, worry: 0, curve: 0.2, mo: 0, ...o });
const blinkAt = (t: number, period: number, off: number) => {
  const q = ((t + off) % period + period) % period;
  return q < 0.14 ? 1 - Math.abs(q - 0.07) / 0.07 : 0;
};
// mãos no teclado do notebook (kx = centro do notebook)
const typing = (kx: number, t: number, amp: number, sp: number): [V, V] => [
  [kx - 36 + Math.sin(t * sp * 0.37) * 8 * amp, DESK_TOP + 8 - (0.5 - 0.5 * Math.cos(t * sp)) * 12 * amp],
  [kx + 36 + Math.sin(t * sp * 0.31 + 2) * 8 * amp, DESK_TOP + 8 - (0.5 - 0.5 * Math.cos(t * sp + 2.4)) * 12 * amp],
];
const restHands = (cx: number): [V, V] => [[cx - 60, DESK_TOP + 18], [cx + 60, DESK_TOP + 18]];

const rightAt = (t: number, fin: boolean): { c: Ch; lamp: boolean; dark: number; dawn: number; lid: number; screen: Screen; note: number; fly: number; book: number } => {
  const b = fin ? 6 : blockOf(t);
  const breath = Math.sin(t * 2.1) * 3;
  const c: Ch = { cx: RX, sy: breath, lean: 0, hx: 0, hy: 0, tilt: 0, face: baseFace({ lx: -0.15, curve: 0.45 }), hands: typing(KR, t, 1, 13), back: false, messy: 0, tired: 0, sweat: 0, tremble: 0, stand: 0, walk: 0 };
  let lamp = true, dark = 0.18, dawn = 0, lid = 1, screen: Screen = "doc", note = 0, fly = 0, book = 0;
  const bl = blinkAt(t, 3.1, 0.4);
  c.face.open = 1 - bl;
  if (b === 0) {
    lid = 0; screen = "off";
    const w = t < 1.0;
    // escreve o plano no papel; depois olha o calendário e sorri
    const wr = 1 - er(t, 1.5, 1.9);
    c.hands = [[RX - 40, DESK_TOP + 20], mixV([RX + 50, DESK_TOP + 16], [RX + 6 + Math.sin(t * 9) * 16, DESK_TOP + 10 + Math.sin(t * 18) * 4], wr)];
    c.holdR = wr > 0.3 ? <rect x={-3} y={-30} width={7} height={32} rx={2} fill="#e04a3c" stroke={INK} strokeWidth={2.5} transform="rotate(25)" /> : undefined;
    c.face = baseFace({ lx: kf(t, [[0, 0.1], [1.1, 0.1], [1.5, -0.85]]), ly: kf(t, [[0, 0.55], [1.0, 0.55], [1.4, -0.1]]), py: kf(t, [[0, 0.8], [1.0, 0.8], [1.4, -0.4]]), px: kf(t, [[1.0, 0], [1.4, -0.9]]), curve: kf(t, [[1.4, 0.3], [1.9, 0.75]]), open: 1 - bl });
    c.tilt = kf(t, [[1.0, 0], [1.5, -6]]);
    c.hx = kf(t, [[1.0, 0], [1.5, -10]]);
    note = 0; fly = 0;
  } else if (b === 1 || b === 2) {
    c.hands = typing(KR, t, 1, 13);
    c.face = baseFace({ lx: 0, ly: 0.35, px: 0, py: 0.7, curve: 0.45, open: 1 - bl });
    c.hy = Math.sin(t * 3.3) * 3; c.tilt = -3 + Math.sin(t * 1.4) * 2;
    note = 0; fly = 0;
  } else if (b === 3) {
    note = 0; fly = 0;
    const st = er(t, 10.2, 10.55) * (1 - er(t, 11.1, 11.4));
    screen = t < 10 ? "doc" : "done";
    lid = 1 - er(t, 11.45, 11.85);
    const up: [V, V] = [[RX - 110, SH_Y - 260], [RX + 110, SH_Y - 260]];
    const close: [V, V] = [[RX - 60, DESK_TOP + 18], [KR, DESK_TOP - 92 + er(t, 11.45, 11.85) * 92]];
    const typ = typing(KR, t, t < 10 ? 1 : 0.2, 13);
    c.hands = t < 10.2 ? typ : t < 11.3 ? [mixV(typ[0], up[0], st), mixV(typ[1], up[1], st)] : close;
    c.back = st > 0.4;
    c.sy = breath - st * 14; c.lean = 0;
    c.face = baseFace({ lx: 0, ly: lerp(0.35, -0.3, st), px: 0, py: 0.7, open: st > 0.5 ? 0 : 1 - bl, curve: lerp(0.5, 0.2, st), mo: st > 0.5 ? 0.45 : 0, raise: t > 10 && t < 10.3 ? 0.6 : 0 });
    c.tilt = st * 4;
  } else if (b === 4) {
    note = 0; fly = 0; lid = 0; screen = "off"; dark = 0.42;
    if (t < 14.4) {
      book = 1;
      c.hands = [[RX - 50, SH_Y + 10], [RX + 50, SH_Y + 10]];
      const yawn = er(t, 13.6, 13.8) * (1 - er(t, 14.1, 14.3));
      c.face = baseFace({ ly: 0.6, py: 0.9, curve: 0.4, mo: yawn * 0.9, open: yawn > 0.5 ? 0 : 1 - bl, raise: yawn * 0.5 });
      c.tilt = Math.sin(t * 0.9) * 3 + yawn * 6;
    } else {
      book = 1 - er(t, 14.4, 14.55);
      const reach = er(t, 14.4, 14.65) * (1 - er(t, 14.75, 14.95));
      c.hands = [[RX - 60, DESK_TOP + 18], mixV([RX + 60, DESK_TOP + 18], [912, DESK_TOP - 140], reach)];
      lamp = t < 14.7;
      dark = t < 14.7 ? 0.42 : 0.74;
      const up = er(t, 14.95, 15.3);
      c.sy = breath - up * 170;
      c.stand = up;
      c.cx = interpolate(t, [15.3, 16.0], [RX, 1220], clamp);
      c.walk = t * 12;
      if (up > 0.02) c.hands = [[c.cx - 80, SH_Y + c.sy + 210], [c.cx + 80, SH_Y + c.sy + 210 - Math.sin(t * 12) * 10]];
      c.face = baseFace({ lx: t > 15.2 ? 0.7 : 0.2, curve: 0.6, open: t > 14.75 ? 0 : 1 - bl });
    }
  } else if (b === 5) {
    note = 0; fly = 0; lamp = false; dark = 0.04; dawn = 1;
    screen = t < 17.0 ? "doc" : "sent";
    const click = er(t, 16.7, 16.85) * (1 - er(t, 16.9, 17.1));
    const typ = typing(KR, t, 0.4, 8);
    c.hands = [mixV(typ[0], [KR + 10, DESK_TOP - 2], click), typ[1]];
    const happy = er(t, 17.05, 17.4);
    c.face = baseFace({ lx: 0, ly: lerp(0.35, 0, happy), px: 0, py: lerp(0.7, 0, happy), curve: lerp(0.4, 0.85, happy), raise: happy * 0.3, open: 1 - bl });
    c.sy = breath - happy * 8; c.tilt = happy * -4;
  } else {
    note = 0; fly = 0; lamp = false; dark = 0.04; dawn = 1;
    lid = fin ? 0 : 1 - er(t, 19.0, 19.35); screen = lid > 0.5 ? "sent" : "off";
    const k = fin ? 1 : er(t, 19.2, 19.6);
    const sipT = fin ? t - FINAL : t - 19;
    const sip = fin ? er(sipT, 1.5, 1.8) * (1 - er(sipT, 2.3, 2.6)) : 0;
    const mugHand: V = mixV([RX + 70, SH_Y + 60], [RX + 30, SH_Y - 100], sip);
    c.hands = [[RX - 62, DESK_TOP + 16], mixV([RX + 60, DESK_TOP + 18], mugHand, k)];
    c.holdR = k > 0.3 ? <Mug steam={1} t={t} /> : undefined;
    c.face = baseFace({ lx: 0, curve: 0.85, open: sip > 0.5 ? 0 : 1 - bl, raise: 0.2 });
    c.sy = breath - 6; c.tilt = Math.sin(t * 1.2) * 2;
    void sipT;
  }
  return { c, lamp, dark, dawn, lid, screen, note, fly, book };
};

const leftAt = (t: number, fin: boolean): { c: Ch; lamp: boolean; dark: number; phone: number; lid: number; screen: Screen; mugs: number; papers: number; stack: number; cloud: number; rain: number; flash: boolean } => {
  const b = fin ? 6 : blockOf(t);
  const breath = Math.sin(t * 2.3 + 1) * 3;
  const bl = blinkAt(t, 2.7, 1.3);
  const c: Ch = { cx: LX, sy: breath, lean: 0, hx: 0, hy: 0, tilt: 0, face: baseFace({ open: 1 - bl }), hands: restHands(LX), back: false, messy: 0, tired: 0, sweat: 0, tremble: 0, stand: 0, walk: 0 };
  let lamp = true, dark = 0.2, phone = 0, lid = 0, screen: Screen = "off", mugs = 1, papers = 0, stack = 0, cloud = 0, rain = 0, flash = false;
  if (b <= 1) {
    phone = 1; dark = b === 0 ? 0.3 : 0.6; lamp = b === 0;
    const thumb = Math.sin(t * 9) * 3;
    c.hands = [[LX - 58, DESK_TOP + 18], [LX + 18, SH_Y + 30 + thumb]];
    c.holdR = <Phone t={t * (b === 1 ? 2 : 1)} />;
    c.sy = breath + 10; c.lean = -6; c.tilt = -5;
    if (b === 0) c.face = baseFace({ ly: 0.55, py: 1, px: 0.3, curve: 0.25, open: 1 - bl });
    else {
      const laugh = 0.5 + 0.5 * Math.sin(t * 9);
      const burst = Math.sin(((t - 3) / 3) * Math.PI * 3) > 0 ? 1 : 0;
      c.face = baseFace({ ly: 0.45, py: 0.9, px: 0.3, curve: 0.9, mo: burst * (0.35 + 0.35 * laugh), open: burst ? 0.15 : 1 - bl, raise: 0.3 });
      c.hy = burst * Math.sin(t * 22) * 4;
      c.tired = 0.2;
    }
  } else if (b === 2) {
    lid = er(t, 6.15, 6.5) * (1 - er(t, 7.55, 7.9)); screen = "doc";
    const back = er(t, 7.95, 8.4);
    const hd = headOf(c);
    const typ: [V, V] = [[LX - 58, DESK_TOP + 18], kv(t, [[6.0, [LX + 58, DESK_TOP + 18]], [6.15, [KL, DESK_TOP - 10]], [6.5, [KL, DESK_TOP - 92]], [6.7, [KL + 30, DESK_TOP + 8]], [7.45, [KL + 30, DESK_TOP + 8]], [7.55, [KL, DESK_TOP - 92]], [7.9, [KL, DESK_TOP - 8]], [8.0, [LX + 58, DESK_TOP + 18]]])];
    const bh: [V, V] = [[hd[0] - 66, hd[1] + 6], [hd[0] + 66, hd[1] + 6]];
    c.hands = back > 0.01 ? [mixV(typ[0], bh[0], back), mixV(typ[1], bh[1], back)] : typ;
    c.back = back > 0.5;
    c.sy = breath + back * 10; c.tilt = back * -6;
    c.face = baseFace({
      lx: 0, ly: kf(t, [[6.3, 0], [6.6, 0.3], [7.8, 0.3], [8.2, -0.2]]),
      px: 0, py: kf(t, [[6.3, 0], [6.6, 0.5], [7.8, 0.5], [8.2, -0.6]]),
      eyeS: kf(t, [[6.4, 1], [6.7, 1.22], [7.2, 1.22], [7.5, 1]]), worry: kf(t, [[6.5, 0], [6.9, 0.9], [7.6, 0.9], [8.0, 0]]),
      curve: kf(t, [[6.5, 0.2], [6.9, -0.5], [7.6, -0.5], [8.1, 0.55]]), open: back > 0.6 ? 0.08 : 1 - bl, raise: kf(t, [[6.4, 0], [6.7, 0.7], [7.3, 0]]),
    });
    cloud = 0.7 * er(t, 7.9, 8.5);
  } else if (b === 3) {
    const shock = er(t, 9.4, 9.55);
    const antic = er(t, 9.3, 9.4) * (1 - er(t, 9.4, 9.5));
    const hd = headOf({ ...c, hx: 18 * shock });
    const cheeks: [V, V] = [[hd[0] - 62, hd[1] + 30], [hd[0] + 62, hd[1] + 30]];
    c.hands = shock > 0.01 ? [mixV(restHands(LX)[0], cheeks[0], shock), mixV(restHands(LX)[1], cheeks[1], shock)] : restHands(LX);
    c.hx = kf(t, [[9.0, 0], [9.3, 14], [9.55, 18]]);
    c.sy = breath + antic * 12 - shock * 22;
    c.tremble = kf(t, [[9.55, 0], [9.65, 1], [10.6, 1], [11, 0.3]]);
    c.messy = 0.3; c.sweat = ramp(t, 9.7, 11.5);
    c.face = baseFace({ lx: kf(t, [[9.0, 0.2], [9.3, 0.8]]), ly: kf(t, [[9.0, 0], [9.3, -0.4]]), px: 1, py: -0.6, eyeS: lerp(1, 1.45, shock), pupil: lerp(1, 0.6, shock), raise: shock * 1.2, worry: shock * 0.5, mo: shock, open: 1 });
    cloud = 0.8 + 0.4 * er(t, 9.5, 10.0);
  } else if (b === 4) {
    dark = 0.7; lid = 1; screen = "doc";
    const sips = [13.15, 14.35];
    const sip = Math.max(...sips.map((s) => er(t, s - 0.2, s) * (1 - er(t, s + 0.25, s + 0.45))));
    const typ = typing(KL, t, 1.8, 24);
    const hd = headOf(c);
    c.hands = [typ[0], mixV(typ[1], [hd[0] + 40, hd[1] + 40], sip)];
    c.holdR = sip > 0.3 ? <Mug t={t} /> : undefined;
    c.messy = kf(t, [[12, 0.6], [16, 1]]); c.tired = kf(t, [[12, 0.5], [16, 1]]);
    c.lean = Math.sin(t * 24) * 2; c.sy = breath + 8;
    c.face = baseFace({ lx: 0.05, ly: 0.35, px: 0.1, py: 0.7, open: 0.55 - bl * 0.5, worry: 0.8, curve: -0.6, mo: sip * 0.3 });
    mugs = t < 13.2 ? 1 : t < 14.4 ? 2 : 3; papers = Math.floor(interpolate(t, [12, 16], [2, 9], clamp)); stack = interpolate(t, [12, 16], [0.2, 0.75], clamp);
    cloud = 1.35; rain = 1; flash = [13.0, 15.1].some((s0) => t > s0 && t < s0 + 0.12);
  } else if (b === 5) {
    dark = 0.6; lid = 1; mugs = 3; papers = 9; stack = 0.85;
    screen = t < 16.9 ? "doc" : t < 18.0 ? "sending" : "late";
    const typ = typing(KL, t, 1.9, 26);
    const stop = er(t, 16.85, 17.1);
    c.hands = [mixV(typ[0], [LX - 60, DESK_TOP + 18], stop), mixV(typ[1], [LX + 60, DESK_TOP + 18], stop)];
    const relief = er(t, 18.0, 18.4);
    c.messy = 1; c.tired = 1; c.sweat = ramp(t, 16.9, 18.2);
    c.sy = breath + 8 + relief * 18; c.tilt = relief * 8;
    c.face = baseFace({ lx: 0.05, ly: lerp(0.3, 0.5, relief), px: 0.1, py: 0.6, eyeS: lerp(1.2, 0.95, relief), open: lerp(1, 0.4, relief), worry: lerp(0.9, 1, relief), raise: lerp(0.8, 0, relief), curve: -0.6, mo: lerp(0.4, 0.55, relief) });
    cloud = 1.45; rain = 1;
  } else {
    lamp = false; dark = 0.1; mugs = 3; papers = 9; stack = 1; lid = 0;
    const k = fin ? 1 : er(t, 19.0, 19.5);
    c.hands = [mixV([LX - 60, DESK_TOP + 18], [LX - 96, DESK_TOP + 6], k), mixV([LX + 60, DESK_TOP + 18], [LX + 96, DESK_TOP + 6], k)];
    c.sy = breath * 1.4 + k * 78; c.hy = k * 10; c.tilt = k * 12;
    c.messy = 1; c.tired = 1;
    c.face = baseFace({ ly: 0.6, open: k > 0.5 ? 0 : 0.4, worry: 0.6, curve: -0.3, mo: k * (0.3 + 0.08 * Math.sin(t * 2.2)) });
    cloud = 1.5; rain = 1;
  }
  return { c, lamp, dark, phone, lid, screen, mugs, papers, stack, cloud, rain, flash };
};

// ------------------------------------------------------------------ cena
const Scene: React.FC = () => {
  const { t, frame } = useT();
  const fin = t >= FINAL;
  const b = fin ? 6 : blockOf(t);
  const since = t - B[b];
  const cut = b > 0 && !fin;
  const tear = cut ? ramp(since, 0, 0.55) : 0;
  const pulse = cut ? interpolate(since, [0, 0.25], [1.03, 1], clamp) : 1;
  const flash = cut ? interpolate(since, [0, 0.16], [0.22, 0], clamp) : 0;
  const R = rightAt(t, fin);
  const Lf = leftAt(t, fin);
  // mãos seguem o alvo com um leve atraso (média de amostras anteriores do mesmo bloco) → braços soltos
  const key = (x: number) => (x >= FINAL ? 99 : blockOf(x));
  const follow = (fn: (x: number) => Ch): [V, V] => {
    const W = [0.32, 0.26, 0.2, 0.13, 0.09];
    let sx: [number, number, number, number] = [0, 0, 0, 0], sw = 0;
    W.forEach((w, i) => {
      const x = t - i * 0.035;
      if (key(x) !== key(t)) return;
      const h = fn(x).hands;
      sx = [sx[0] + h[0][0] * w, sx[1] + h[0][1] * w, sx[2] + h[1][0] * w, sx[3] + h[1][1] * w];
      sw += w;
    });
    return [[sx[0] / sw, sx[1] / sw], [sx[2] / sw, sx[3] / sw]];
  };
  R.c.hands = follow((x) => rightAt(x, x >= FINAL).c);
  Lf.c.hands = follow((x) => leftAt(x, x >= FINAL).c);
  // ombros acompanham as mãos (movimento secundário)
  for (const c of [R.c, Lf.c]) {
    if (c.stand > 0.01) continue;
    c.lean += ((c.hands[0][0] + c.hands[1][0]) / 2 - c.cx) * 0.07;
    c.sy += (Math.min(c.hands[0][1], c.hands[1][1]) < SH_Y ? -6 : 0) * 0.5;
  }
  const lh = headOf(Lf.c);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${pulse})`, transformOrigin: "540px 1000px" }}>
        <svg width={1080} height={1920} viewBox="0 0 1080 1920">
          <defs>
            <radialGradient id="auraGold" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#ffcf6a" stopOpacity={0.55} /><stop offset="1" stopColor="#ffcf6a" stopOpacity={0} /></radialGradient>
            <radialGradient id="lampL" cx={DESK.L[0] + 120} cy={DESK_TOP - 120} r="520" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ffbf6b" stopOpacity={0.5} /><stop offset="0.4" stopColor="#e88a3c" stopOpacity={0.2} /><stop offset="1" stopColor="#e88a3c" stopOpacity={0} /></radialGradient>
            <radialGradient id="lampR" cx={DESK.R[1] - 120} cy={DESK_TOP - 120} r="520" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ffbf6b" stopOpacity={0.5} /><stop offset="0.4" stopColor="#e88a3c" stopOpacity={0.2} /><stop offset="1" stopColor="#e88a3c" stopOpacity={0} /></radialGradient>
            <radialGradient id="phoneL" cx={LX + 20} cy={SH_Y - 40} r="300" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#7fb2ff" stopOpacity={0.42} /><stop offset="1" stopColor="#7fb2ff" stopOpacity={0} /></radialGradient>
            <radialGradient id="screenL" cx={LX} cy={SH_Y - 110} r="300" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#bcd6ff" stopOpacity={0.28} /><stop offset="1" stopColor="#bcd6ff" stopOpacity={0} /></radialGradient>
            <radialGradient id="sunR" cx="836" cy="680" r="640" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ffd28a" stopOpacity={0.5} /><stop offset="1" stopColor="#ffd28a" stopOpacity={0} /></radialGradient>
            <linearGradient id="shadeL" x1="0" x2="1"><stop offset="0.82" stopColor="#0c0604" /><stop offset="1" stopColor="#0c0604" stopOpacity={0} /></linearGradient>
            <linearGradient id="shadeR" x1="0" x2="1"><stop offset="0" stopColor="#0c0604" stopOpacity={0} /><stop offset="0.18" stopColor="#0c0604" /></linearGradient>
            <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0a0605" stopOpacity={1} /><stop offset="1" stopColor="#0a0605" stopOpacity={0} /></linearGradient>
            <radialGradient id="vig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stopColor="#000" stopOpacity={0} /><stop offset="1" stopColor="#000" stopOpacity={0.7} /></radialGradient>
          </defs>
          <rect width={1080} height={1920} fill="#0a0605" />
          <Room t={t} dawn={R.dawn} />
          <Calendar n={DAYS[b]} prev={DAYS[Math.max(0, b - 1)]} tear={tear} note={R.note} fly={R.fly} />
          {/* nuvem atrás da cabeça? não: fica por cima no fim */}
          <Chair cx={LX} />
          <Chair cx={RX} />
          <Person c={Lf.c} look={LOOK_L} t={t} layer="body" />
          <Person c={R.c} look={LOOK_R} t={t} layer="body" />
          {R.book > 0 && (
            <g transform={`translate(${RX},${SH_Y + 6}) scale(${R.book})`}>
              <path d="M-72,-50 Q-36,-62 0,-50 L0,46 Q-36,34 -72,46 Z" fill="#f4ecd8" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
              <path d="M72,-50 Q36,-62 0,-50 L0,46 Q36,34 72,46 Z" fill="#f4ecd8" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
              {[-28, -14, 0, 14].map((y) => <g key={y}><line x1={-60} y1={y} x2={-12} y2={y - 4} stroke="#a89a80" strokeWidth={3} /><line x1={12} y1={y - 4} x2={60} y2={y} stroke="#a89a80" strokeWidth={3} /></g>)}
              <rect x={-80} y={-46} width={10} height={96} rx={3} fill={GOLD} stroke={INK} strokeWidth={3} />
            </g>
          )}
          <Desk x0={DESK.L[0]} x1={DESK.L[1]} />
          <Desk x0={DESK.R[0]} x1={DESK.R[1]} />
          {/* mesa da esquerda */}
          <DeskLamp x={DESK.L[0] + 50} dir={1} on={Lf.lamp} />
          {Lf.stack > 0 && Array.from({ length: Math.round(Lf.stack * 14) }).map((_, i) => (
            <rect key={i} x={150 + ((i * 7) % 11) - 5} y={DESK_TOP + 6 - i * 13} width={96} height={13} fill={i % 2 ? "#ece7da" : "#f6f2e8"} stroke={INK} strokeWidth={2.5} />
          ))}
          {Array.from({ length: Lf.papers }).map((_, i) => (
            <rect key={i} x={150 + ((i * 41) % 260)} y={DESK_TOP + 14 + (i % 3) * 8} width={56} height={14} fill="#f1ede2" stroke={INK} strokeWidth={2.5} transform={`rotate(${((i * 23) % 30) - 15} ${178 + ((i * 41) % 260)} ${DESK_TOP + 20})`} />
          ))}
          {Array.from({ length: Lf.mugs }).map((_, i) => <g key={i} transform={`translate(${230 + i * 34},${DESK_TOP + 12})`}><Mug steam={i === Lf.mugs - 1 && b >= 4 ? 1 : 0} t={t} /></g>)}
                              {/* mesa da direita */}
          <DeskLamp x={DESK.R[1] - 50} dir={-1} on={R.lamp} />
          {b >= 1 && b !== 6 && <g transform={`translate(${DESK.R[1] - 150},${DESK_TOP + 12})`}><Mug steam={b >= 5 ? 1 : 0} t={t} /></g>}
          {b === 0 && <rect x={RX - 60} y={DESK_TOP + 6} width={96} height={26} fill="#f6f2e8" stroke={INK} strokeWidth={3} transform={`rotate(-4 ${RX} ${DESK_TOP + 18})`} />}
                              {/* braços por cima da mesa */}
          <Person c={Lf.c} look={LOOK_L} t={t} layer="arms" />
          <Person c={R.c} look={LOOK_R} t={t} layer="arms" />
          <LaptopBack cx={LX} lid={Lf.lid} gold={false} shake={b === 4 || (b === 5 && t < 16.9) ? Math.sin(t * 50) * 1.2 : 0} />
          <LaptopBack cx={RX} lid={R.lid} gold shake={0} />
          {/* luz de cada lado */}
          <rect x={0} y={WALL_Y} width={600} height={1320} fill="url(#shadeL)" opacity={Lf.dark} />
          <rect x={480} y={WALL_Y} width={600} height={1320} fill="url(#shadeR)" opacity={R.dark} />
          {Lf.lamp && <rect x={0} y={WALL_Y} width={560} height={1320} fill="url(#lampL)" style={{ mixBlendMode: "screen" }} />}
          {R.lamp && <rect x={520} y={WALL_Y} width={560} height={1320} fill="url(#lampR)" style={{ mixBlendMode: "screen" }} />}
          {Lf.phone > 0 && <rect x={0} y={WALL_Y} width={600} height={1320} fill="url(#phoneL)" opacity={0.85 + 0.15 * Math.sin(frame / 3)} style={{ mixBlendMode: "screen" }} />}
          {Lf.lid > 0.5 && Lf.screen !== "off" && <rect x={0} y={WALL_Y} width={600} height={1320} fill="url(#screenL)" style={{ mixBlendMode: "screen" }} />}
          {R.dawn > 0 && <rect x={480} y={WALL_Y} width={600} height={1320} fill="url(#sunR)" style={{ mixBlendMode: "screen" }} />}
          <StatusChip cx={LX} screen={Lf.screen} pct={ramp(t, 16.9, 18)} t={t} at={Lf.screen === "late" ? 18.0 : 16.9} />
          <StatusChip cx={RX} screen={R.screen} pct={1} t={t} at={R.screen === "done" ? 10.0 : b === 5 ? 17.0 : -9} />
          {/* efeitos */}
          {Lf.cloud > 0.01 && <Cloud x={lh[0] + 6} y={lh[1] - 150 - Lf.cloud * 20} s={Lf.cloud} rain={Lf.rain} t={t} flash={Lf.flash} />}
          {b === 4 && !fin && <FlyPaper t={t} n={5} cx={LX} cy={DESK_TOP - 100} />}
          {b === 1 && [3.6, 4.4, 5.2].map((s, i) => t > s ? (
            <g key={i} transform={`translate(${LX + 70 + i * 40},${SH_Y - 230 - (t - s) * 100}) scale(2)`} opacity={1 - ramp(t, s + 0.6, s + 1)}>
              <circle r={12} fill={i === 1 ? "#ff7aa8" : RED} stroke={INK} strokeWidth={2} />
              <text y={5} fontSize={13} fill="#fff" textAnchor="middle" fontFamily={MONO} fontWeight={800}>{i === 1 ? "♥" : "1"}</text>
            </g>
          ) : null)}
          {b === 1 && Math.sin(((t - 3) / 3) * Math.PI * 3) > 0 && <text x={LX - 190} y={SH_Y - 190} fontFamily={BARLOW} fontWeight={700} fontSize={50} fill="#f4ede0" stroke={INK} strokeWidth={2} transform={`rotate(-8 ${LX - 150} ${SH_Y - 200})`}>KKK</text>}
          {b === 3 && t > 9.45 && <text x={lh[0] + 92} y={lh[1] - 50} fontFamily={BARLOW} fontWeight={700} fontSize={110} fill={RED} stroke={INK} strokeWidth={4} transform={`scale(1)`}>!</text>}
          {b === 2 && [6.8, 7.7, 8.5].map((s, i) => t > s ? <text key={i} x={RX + 130} y={DESK_TOP - 150 - (t - s) * 90} fontFamily={BARLOW} fontWeight={700} fontSize={56} fill={GREEN} stroke={INK} strokeWidth={2.5} textAnchor="middle" opacity={1 - ramp(t, s + 0.5, s + 0.9)}>✓</text> : null)}
          {b === 4 && t > 14.8 && [0, 1, 2].map((i) => {
            const q = (((t - 14.8 + i * 0.45) % 1.35) + 1.35) % 1.35 / 1.35;
            return <text key={i} x={RX + 60 + q * 70 + i * 12} y={SH_Y - 260 - q * 150} fontFamily={BARLOW} fontWeight={700} fontSize={50 + i * 12} fill={GOLD} stroke={INK} strokeWidth={2} opacity={interpolate(q, [0, 0.2, 0.8, 1], [0, 1, 1, 0])}>z</text>;
          })}
          {fin && [0, 1, 2].map((i) => {
            const q = (((t + i * 0.6) % 1.8) + 1.8) % 1.8 / 1.8;
            return <text key={i} x={lh[0] + 70 + q * 50} y={lh[1] - 30 - q * 100} fontFamily={BARLOW} fontWeight={700} fontSize={40 + i * 10} fill="#cfc7d8" stroke={INK} strokeWidth={2} opacity={interpolate(q, [0, 0.2, 0.8, 1], [0, 0.9, 0.9, 0])}>z</text>;
          })}
          <Plant t={t} />
          <rect x={0} y={WALL_Y} width={1080} height={230} fill="url(#topFade)" opacity={0.92} />
          <rect x={0} y={0} width={1080} height={1920} fill="url(#vig)" />
          <rect x={0} y={FLOOR_Y + 90} width={1080} height={400} fill="#0a0605" />
        </svg>
      </div>
      <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

const Texts: React.FC = () => {
  const { t, fps } = useT();
  const fin = t >= FINAL;
  const b = fin ? 6 : blockOf(t);
  const hide = ramp(t, FINAL - 0.3, FINAL);
  const k = t - FINAL;
  const p1 = spring({ frame: Math.round((k - 0.3) * fps), fps, config: { damping: 14, stiffness: 160 } });
  const p2 = spring({ frame: Math.round((k - 1.1) * fps), fps, config: { damping: 14, stiffness: 160 } });
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 232, left: 120, right: 120, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 56, lineHeight: 1.0, letterSpacing: 2, opacity: 1 - hide, textShadow: "0 3px 0 rgba(0,0,0,.6)" }}>
        <div style={{ color: WHITE }}>{TXT.hook[0]}</div>
        <div style={{ color: GOLD }}>{TXT.hook[1]}</div>
      </div>
      <SideLabel cx={LX} title={TXT.titleL} sub={L_LABELS[b]} subAt={b === 0 ? -1 : B[b]} right={false} hide={hide} />
      <SideLabel cx={RX} title={TXT.titleR} sub={R_LABELS[b]} subAt={b === 0 ? -1 : B[b]} right hide={hide} />
      {b === 6 && !fin && <ResultCard cx={LX} right={false} />}
      {b === 6 && !fin && <ResultCard cx={RX} right />}
      {fin && (
        <div style={{ position: "absolute", top: 300, left: 110, right: 110, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 86, lineHeight: 1.05, letterSpacing: 2, textShadow: "0 5px 0 rgba(0,0,0,.65), 0 6px 18px rgba(0,0,0,.8)" }}>
          <div style={{ color: WHITE, opacity: Math.min(1, p1 * 1.5), transform: `translateY(${(1 - p1) * 20}px)` }}>{TXT.final[0]}</div>
          <div style={{ color: GOLD, opacity: Math.min(1, p2 * 1.5), transform: `translateY(${(1 - p2) * 20}px)` }}>{TXT.final[1]}</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export const PrazoMarcos: React.FC = () => {
  useFonts();
  const { t } = useT();
  const loopFlash = interpolate(t, [LOOP, LOOP + 0.05, LOOP + 0.3], [0, 0.6, 0], clamp);
  const body = (<><Scene /><Texts /></>);
  return (
    <AbsoluteFill style={{ background: "#0a0605" }}>
      <Audio src={staticFile(AUDIO)} />
      {t < LOOP ? body : <Shift.Provider value={LOOP}>{body}</Shift.Provider>}
      <AbsoluteFill style={{ background: "#fff", opacity: loopFlash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
