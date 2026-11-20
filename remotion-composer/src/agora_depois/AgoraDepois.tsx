import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// ==================================================================
// AGORA OU DEPOIS — estilo da série Marcos (mesmo rig), sem nomes, sem narração, sem roupas
// (corpo liso), cenário leve, falas em balões. Os amigos chamam para beber/festa/balada,
// ele recusa e estuda; 2 semanas depois ele está tranquilo e eles se matando de estudar.
// ==================================================================
const FONT_DIR = "agora_depois";
const INK = "#1b100a", GOLD = "#E8B84A", RED = "#e0554a", WHITE = "#f4f1ea", GREEN = "#5fd08a";
const BARLOW = "'Barlow Condensed', 'DejaVu Sans Condensed', sans-serif";
const MONO = "'JetBrains Mono', 'DejaVu Sans Mono', monospace";
const SKIN = "#f3efe7", SKIN2 = "#d9d2c5";
const DUR = [4.6, 4.0, 4.4, 3.4, 1.7, 4.4, 5.6, 4.6];
const ST: number[] = DUR.reduce<number[]>((a, d, i) => [...a, i === 0 ? 0 : a[i - 1] + DUR[i - 1]], []);
export const TOTAL = ST[ST.length - 1] + DUR[DUR.length - 1];
// ------------------------------------------------------------------ utilidades
type V = [number, number];
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
const backPop = (x: number) => { if (x <= 0) return 0; if (x >= 0.3) return 1; const k = x / 0.3; return 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); };
const sceneOf = (t: number) => { let s = 0; for (let i = 0; i < ST.length; i++) if (t >= ST[i]) s = i; return s; };
const blinkAt = (t: number, period: number, off: number) => { const q = ((t + off) % period + period) % period; return q < 0.14 ? 1 - Math.abs(q - 0.07) / 0.07 : 0; };
const ik = (a: V, c: V, l1: number, l2: number, side: number): V => {
  const dx = c[0] - a[0], dy = c[1] - a[1];
  const d = Math.max(1, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.5));
  const th = Math.atan2(dy, dx);
  const al = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const p1: V = [a[0] + l1 * Math.cos(th + al), a[1] + l1 * Math.sin(th + al)];
  const p2: V = [a[0] + l1 * Math.cos(th - al), a[1] + l1 * Math.sin(th - al)];
  return (p1[0] - p2[0]) * side > 0 ? p1 : p2;
};
const useFonts = () => {
  const [h] = useState(() => delayRender("fontes"));
  useEffect(() => {
    const faces = [700, 600].map((w) => new FontFace("Barlow Condensed", `url(${staticFile(`${FONT_DIR}/barlow-condensed-latin-${w}-normal.woff2`)})`, { weight: String(w) }));
    Promise.all(faces.map((f) => f.load().then((ff) => document.fonts.add(ff)))).then(() => continueRender(h)).catch(() => continueRender(h));
  }, [h]);
};

// ------------------------------------------------------------------ personagem (corpo inteiro, de frente/3-4)
type Face = { lx: number; ly: number; open: number; eyeS: number; pupil: number; px: number; py: number; raise: number; worry: number; curve: number; mo: number; wide?: number };
const F = (o: Partial<Face> = {}): Face => ({ lx: 0, ly: 0, open: 1, eyeS: 1, pupil: 1, px: 0, py: 0, raise: 0, worry: 0, curve: 0.15, mo: 0, wide: 0, ...o });
type Look = { id: string; shirt: string; shirt2: string; pants: string; shoes: string; hair: string; style: "marcos" | "lucas" | "juliana" | "chefe"; sleeve: number; width: number; tie?: string; suit?: boolean; loose?: boolean; pj?: boolean; plain?: boolean };
const MARCOS: Look = { id: "m", shirt: "#4c6b92", shirt2: "#3a5576", pants: "#3a3d47", shoes: "#2a1b12", hair: "#3b2a1e", style: "marcos", sleeve: 0.44, width: 0.8 };
// pijama (acorda), terno (vai trabalhar) e camisa com gravata frouxa (de volta em casa)
const MARCOS_PJ: Look = { ...MARCOS, shirt: "#8ab0d8", shirt2: "#6f96c0", pants: "#8ab0d8", sleeve: 0.86, pj: true };
const MARCOS_SUIT: Look = { ...MARCOS, shirt: "#3a4458", shirt2: "#2c3446", pants: "#3a4458", sleeve: 0.86, suit: true, tie: "#2f6aa8" };
const MARCOS_HOME: Look = { ...MARCOS, shirt: "#ecebe4", shirt2: "#d4d2c8", pants: "#3a4458", sleeve: 0.62, loose: true, tie: "#2f6aa8" };
const LUCAS: Look = { id: "l", shirt: "#e0a33a", shirt2: "#c4862a", pants: "#3f5a8a", shoes: "#c43d30", hair: "#5a3a22", style: "lucas", sleeve: 0.4, width: 0.76 };
const JULIANA: Look = { id: "j", shirt: "#a8485e", shirt2: "#8a3a4c", pants: "#2e3040", shoes: "#2a1b12", hair: "#4a2a1a", style: "juliana", sleeve: 0.86, width: 0.72 };
const CHEFE: Look = { id: "c", shirt: "#e9e6de", shirt2: "#cfcabd", pants: "#2b2d36", shoes: "#151012", hair: "#6a6a6a", style: "chefe", sleeve: 0.86, width: 1.0, tie: "#9a2a2a" };

type Ch = {
  x: number; y: number; k: number; // quadril na cena + escala
  lean: number; sy: number; hx: number; hy: number; tilt: number; face: Face;
  hands: [V, V]; feet: [V, V]; back?: boolean; legs?: boolean; tremble?: number; sweat?: number; red?: number;
  holdR?: React.ReactNode; holdL?: React.ReactNode; rot?: number; kneeDir?: number; socks?: boolean; sit?: number; noArms?: boolean;
};
const HEAD_R = 74, TORSO = 230;
const STAND_FEET: [V, V] = [[-40, 296], [40, 296]];
const HANG: [V, V] = [[-86, -14], [86, -14]];
const headLocal = (c: Ch): V => [c.lean * 0.7 + c.hx, -TORSO - 122 + c.sy + c.hy];

const Person: React.FC<{ c: Ch; look: Look; t: number }> = ({ c, look, t }) => {
  const tr = (c.tremble ?? 0) * Math.sin(t * 90) * 3;
  const W = look.width;
  const S = -TORSO + c.sy;
  const shL: V = [-70 * W + c.lean + tr, S + 12], shR: V = [70 * W + c.lean + tr, S + 12];
  const elL = ik(shL, c.hands[0], 106, 100, -1), elR = ik(shR, c.hands[1], 106, 100, 1);
  const hipL: V = [-34 * W, c.sy * 0.15], hipR: V = [34 * W, c.sy * 0.15];
  const knL0 = ik(hipL, c.feet[0], 152, 148, c.kneeDir ?? -1), knR0 = ik(hipR, c.feet[1], 152, 148, c.kneeDir ?? 1);
  // sentado de frente: coxa encurtada vindo para a frente, canela descendo até o chão
  const sit = c.sit ?? 0;
  const knL = mixV(knL0, [-52 * W, 34], sit), knR = mixV(knR0, [52 * W, 34], sit);
  const ftL = mixV(c.feet[0], [-56 * W, 172], sit), ftR = mixV(c.feet[1], [56 * W, 172], sit);
  const arm = (sh: V, el: V, h: V, i: number) => {
    const q: V = [2 * el[0] - (sh[0] + h[0]) / 2, 2 * el[1] - (sh[1] + h[1]) / 2];
    const at = (u: number): V => [(1 - u) * (1 - u) * sh[0] + 2 * (1 - u) * u * q[0] + u * u * h[0], (1 - u) * (1 - u) * sh[1] + 2 * (1 - u) * u * q[1] + u * u * h[1]];
    const sub = (u: number) => { const c1: V = [lerp(sh[0], q[0], u), lerp(sh[1], q[1], u)]; return `M${pt(sh)} Q${pt(c1)} ${pt(at(u))}`; };
    const full = `M${pt(sh)} Q${pt(q)} ${pt(h)}`;
    const ang = (Math.atan2(h[1] - q[1], h[0] - q[0]) * 180) / Math.PI;
    const side = i === 0 ? -1 : 1;
    const su = look.sleeve;
    const cuff = at(su);
    const cuffAng = (Math.atan2(at(su + 0.02)[1] - at(su - 0.02)[1], at(su + 0.02)[0] - at(su - 0.02)[0]) * 180) / Math.PI;
    return (
      <g key={i}>
        <path d={full} stroke={INK} strokeWidth={37} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d={full} stroke={SKIN} strokeWidth={28} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d={sub(su)} stroke={INK} strokeWidth={43} fill="none" strokeLinecap="butt" />
        <path d={sub(su)} stroke={look.shirt} strokeWidth={34} fill="none" strokeLinecap="butt" />
        <circle cx={sh[0]} cy={sh[1]} r={17} fill={look.shirt} />
        {su > 0.6 && <rect x={-6} y={-21} width={12} height={42} rx={5} fill={look.shirt2} stroke={INK} strokeWidth={4} transform={`translate(${cuff[0]},${cuff[1]}) rotate(${cuffAng})`} />}
        <g transform={`translate(${h[0]},${h[1]}) rotate(${ang})`}>
          <ellipse cx={0} cy={-15 * side} rx={9} ry={7} transform={`rotate(${-30 * side})`} fill={SKIN} stroke={INK} strokeWidth={4} />
          <ellipse cx={6} cy={0} rx={21} ry={17} fill={SKIN} stroke={INK} strokeWidth={4.5} />
          <path d="M14,-8 q6,8 0,16" stroke={INK} strokeWidth={2.5} fill="none" opacity={0.5} />
        </g>
        {i === 1 && c.holdR && <g transform={`translate(${h[0]},${h[1]})`}>{c.holdR}</g>}
        {i === 0 && c.holdL && <g transform={`translate(${h[0]},${h[1]})`}>{c.holdL}</g>}
      </g>
    );
  };
  const legs = c.legs !== false && (
    <g>
      {[[hipL, knL, ftL], [hipR, knR, ftR]].map(([a, b, f], i) => {
        const q: V = [2 * b[0] - (a[0] + f[0]) / 2, 2 * b[1] - (a[1] + f[1]) / 2];
        const d = sit > 0.5 ? `M${pt(b)} L${pt(f)}` : `M${pt(a)} Q${pt(q)} ${pt(f)}`;
        const sd = i === 0 ? -1 : 1;
        return (
          <g key={i}>
            <path d={d} stroke={INK} strokeWidth={52} fill="none" strokeLinecap="round" />
            <path d={d} stroke={look.pants} strokeWidth={43} fill="none" strokeLinecap="round" />
            <path d={`M${f[0] - 26 + sd * 6},${f[1] - 6} Q${f[0] - 28 + sd * 6},${f[1] + 18} ${f[0] + sd * 6},${f[1] + 18} L${f[0] + 22 + sd * 10},${f[1] + 18} Q${f[0] + 36 + sd * 10},${f[1] + 16} ${f[0] + 26 + sd * 8},${f[1] - 6} Z`} fill={c.socks ? "#e8e4dc" : look.shoes} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          </g>
        );
      })}
      <path d={`M${hipL[0] - 30},${-14} L${hipR[0] + 30},${-14} L${hipR[0] + 26},${30 + c.sy * 0.15} L${hipL[0] - 26},${30 + c.sy * 0.15} Z`} fill={look.pants} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      {sit > 0.5 && (
        <g>
          {/* colo: coxas vindo para a frente, joelhos */}
          <path d={`M${-72 * W},${-6} Q${-84 * W},${30} ${-60 * W},${58} L${60 * W},${58} Q${84 * W},${30} ${72 * W},${-6} Z`} fill={look.pants} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          {[-1, 1].map((sd) => <ellipse key={sd} cx={sd * 52 * W} cy={36} rx={30} ry={26} fill={look.pants} stroke={INK} strokeWidth={4} />)}
          <path d={`M${-20 * W},${10} Q0,${24} ${20 * W},${10}`} stroke={INK} strokeWidth={3} fill="none" opacity={0.5} />
        </g>
      )}
    </g>
  );
  const arms = c.noArms ? null : <g>{arm(shL, elL, c.hands[0], 0)}{arm(shR, elR, c.hands[1], 1)}</g>;
  // cabeça e rosto
  const hd0 = headLocal(c);
  const hd: V = [hd0[0] + tr, hd0[1]];
  const f = c.face;
  const kid = look.style === "lucas";
  const fx = hd[0] + f.lx * 24, fy = hd[1] + f.ly * 18 + (kid ? 8 : 0);
  const eye = (side: number) => {
    const away = (side < 0 && f.lx > 0.2) || (side > 0 && f.lx < -0.2);
    const far = away ? 0.86 : 1;
    const ex = fx + side * 25 * far, ey = fy - 6;
    const sc = f.eyeS * (kid ? 1.15 : 1);
    const ry = 14 * sc * Math.max(0.06, f.open);
    const rx = 11 * sc * far;
    const by = ey - 28 - f.raise * 13;
    const inner = ex - side * 14, outer = ex + side * 14;
    return (
      <g key={side}>
        <ellipse cx={ex} cy={ey} rx={rx} ry={ry} fill="#fff" stroke={INK} strokeWidth={3.5} />
        {f.open > 0.2 && <circle cx={ex + f.px * 4.5} cy={ey + f.py * 4.5} r={Math.min(ry, 6.8 * f.pupil * (kid ? 1.1 : 1))} fill={INK} />}
        {f.open > 0.2 && <circle cx={ex + f.px * 4.5 - 2} cy={ey + f.py * 4.5 - 2.5} r={1.8} fill="#fff" />}
        {(f.wide ?? 0) > 0 && f.open > 0.2 && <path d={`M${ex - rx + 2},${ey + ry * 0.55} Q${ex},${ey + ry * 0.95} ${ex + rx - 2},${ey + ry * 0.55}`} stroke="#9ad0ff" strokeWidth={3} fill="none" opacity={f.wide} />}
        {f.open < 0.78 && f.open > 0.08 && <path d={`M${ex - rx - 1},${ey - ry * 0.15} Q${ex},${ey - ry * 1.55} ${ex + rx + 1},${ey - ry * 0.15}`} fill={SKIN} stroke={INK} strokeWidth={3} />}
        {f.open <= 0.08 && <path d={`M${ex - rx},${ey} Q${ex},${ey + 6} ${ex + rx},${ey}`} stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />}
        {look.style === "juliana" && f.open > 0.2 && [0, 1, 2].map((k) => <line key={k} x1={ex + side * (rx * 0.35 + k * 4)} y1={ey - ry * 0.85 + k * 3} x2={ex + side * (rx * 0.35 + k * 4 + 7)} y2={ey - ry * 0.85 + k * 3 - 8} stroke={INK} strokeWidth={3} strokeLinecap="round" />)}
        <path d={`M${inner},${by - f.worry * 10} Q${ex},${by - 5 - f.raise * 3} ${outer},${by + f.worry * 3}`} stroke={INK} strokeWidth={look.style === "chefe" ? 9 : look.style === "juliana" ? 4 : 6} fill="none" strokeLinecap="round" />
      </g>
    );
  };
  const mx = fx, my = fy + 34;
  const mw = 36 * (1 - f.mo * 0.35);
  const mouth = f.mo > 0.08
    ? <path d={`M${mx - mw / 2},${my} Q${mx},${my - 6 + f.curve * 6} ${mx + mw / 2},${my} Q${mx + mw / 2 - 2},${my + 6 + f.mo * 22} ${mx},${my + 8 + f.mo * 24} Q${mx - mw / 2 + 2},${my + 6 + f.mo * 22} ${mx - mw / 2},${my} Z`} fill="#3a1410" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
    : look.style === "juliana"
      ? <path d={`M${mx - 15},${my - f.curve * 3} Q${mx},${my - 4 + f.curve * 6} ${mx + 15},${my - f.curve * 3} Q${mx},${my + 8 + f.curve * 10} ${mx - 15},${my - f.curve * 3} Z`} fill="#c84a62" stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
      : <path d={`M${mx - mw / 2},${my - f.curve * 4} Q${mx},${my + f.curve * 15} ${mx + mw / 2},${my - f.curve * 4}`} stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />;
  const id = look.id;
  // Juliana: cabelo comprido ondulado até o peito (atrás da cabeça e dos ombros)
  const hairBack = look.style === "juliana" && (
    <path d={`M${hd[0] - 80},${hd[1] - 30} Q${hd[0] - 102},${hd[1] + 40} ${hd[0] - 92},${hd[1] + 100} Q${hd[0] - 108},${hd[1] + 140} ${hd[0] - 88},${hd[1] + 190} Q${hd[0] - 60},${hd[1] + 212} ${hd[0] - 40},${hd[1] + 178} L${hd[0] + 40},${hd[1] + 178} Q${hd[0] + 60},${hd[1] + 212} ${hd[0] + 88},${hd[1] + 190} Q${hd[0] + 108},${hd[1] + 140} ${hd[0] + 92},${hd[1] + 100} Q${hd[0] + 102},${hd[1] + 40} ${hd[0] + 80},${hd[1] - 30} Q${hd[0]},${hd[1] - 120} ${hd[0] - 80},${hd[1] - 30} Z`} fill={look.hair} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
  );
  const hairTop = () => {
    if (look.style === "chefe")
      return (
        <g>
          {[-1, 1].map((sd) => <path key={sd} d={`M${hd[0] + sd * 72},${hd[1] - 4} Q${hd[0] + sd * 80},${hd[1] - 40} ${hd[0] + sd * 52},${hd[1] - 46} L${hd[0] + sd * 60},${hd[1] + 6} Z`} fill={look.hair} stroke={INK} strokeWidth={3} />)}
          <path d={`M${hd[0] - 30},${hd[1] - 52} q8,-6 16,0`} stroke="#cfc7b8" strokeWidth={4} fill="none" />
        </g>
      );
    const cap = look.style === "juliana"
      ? `M${hd[0] - 92},${hd[1] + 60} L${hd[0] - 92},${hd[1] - 100} L${hd[0] + 92},${hd[1] - 100} L${hd[0] + 92},${hd[1] + 60} Q${hd[0] + 70},${hd[1] - 4} ${hd[0] + 8},${hd[1] - 48} L${hd[0]},${hd[1] - 42} L${hd[0] - 8},${hd[1] - 48} Q${hd[0] - 70},${hd[1] - 4} ${hd[0] - 92},${hd[1] + 60} Z`
      : `M${hd[0] - 90},${hd[1] - 16 + f.ly * 6} Q${hd[0] - 50 + f.lx * 14},${hd[1] - 60 + f.ly * 10} ${hd[0] + 10 + f.lx * 18},${hd[1] - 50 + f.ly * 10} Q${hd[0] + 55 + f.lx * 10},${hd[1] - 54 + f.ly * 8} ${hd[0] + 90},${hd[1] - 22 + f.ly * 6} L${hd[0] + 90},${hd[1] - 100} L${hd[0] - 90},${hd[1] - 100} Z`;
    return (
      <g>
        <g clipPath={`url(#hc${id})`}><path d={cap} fill={look.hair} />{look.style === "juliana" && <path d={`M${hd[0] + 40},${hd[1] - 56} Q${hd[0] + 66},${hd[1] - 20} ${hd[0] + 74},${hd[1] + 20} M${hd[0] - 40},${hd[1] - 56} Q${hd[0] - 66},${hd[1] - 20} ${hd[0] - 74},${hd[1] + 20}`} stroke="#6a3e26" strokeWidth={4} fill="none" />}</g>
        {look.style === "lucas" && [-40, -18, 6, 28].map((o, i) => (
          <path key={i} d={`M${hd[0] + o - 12},${hd[1] - 62} L${hd[0] + o + 4},${hd[1] - 92 - (i % 2) * 8} L${hd[0] + o + 12},${hd[1] - 60} Z`} fill={look.hair} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        ))}
      </g>
    );
  };
  const S2 = S + 12;
  const torso = (
    <g>
      <path d={`M${shL[0] - 8},${S2 + 8} Q${-78 * W + c.lean * 0.4},${S2 + 120} ${-64 * W},${4} L${64 * W},${4} Q${78 * W + c.lean * 0.4},${S2 + 120} ${shR[0] + 8},${S2 + 8} Q${c.lean},${S2 - 26} ${shL[0] - 8},${S2 + 8} Z`} fill={look.shirt} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      <path d={`M${shL[0]},${S2 + 16} Q${-66 * W},${S2 + 120} ${-54 * W},${0} L${-30 * W},${0} Q${-40 * W},${S2 + 120} ${shL[0] + 24},${S2 + 18} Z`} fill={look.shirt2} opacity={0.75} />
      {look.style === "marcos" && !look.suit && !look.loose && !look.pj && !look.plain && <path d={`M${c.lean - 26},${S2 - 6} L${c.lean},${S2 + 26} L${c.lean + 26},${S2 - 6}`} stroke={INK} strokeWidth={5} fill="#e9e6de" strokeLinejoin="round" />}
      {look.pj && (
        <g>
          {[0, 1, 2, 3].map((i) => <path key={i} d={`M${-62 * W},${S2 + 50 + i * 46} L${62 * W},${S2 + 50 + i * 46}`} stroke="#b8d0ec" strokeWidth={9} />)}
          <path d={`M${c.lean - 30},${S2 - 6} L${c.lean},${S2 + 30} L${c.lean + 30},${S2 - 6}`} stroke={INK} strokeWidth={5} fill="#6f96c0" strokeLinejoin="round" />
          {[0, 1, 2].map((i) => <circle key={i} cx={c.lean} cy={S2 + 60 + i * 50} r={5} fill="#fff" stroke={INK} strokeWidth={2} />)}
        </g>
      )}
      {look.suit && (
        <g>
          {/* camisa branca e gravata aparecendo no V do paletó, lapelas */}
          <path d={`M${c.lean - 36},${S2 - 6} L${c.lean},${S2 + 120} L${c.lean + 36},${S2 - 6} Z`} fill="#f4f2ec" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
          <path d={`M${c.lean - 9},${S2 + 8} L${c.lean + 9},${S2 + 8} L${c.lean + 13},${S2 + 104} L${c.lean},${S2 + 118} L${c.lean - 13},${S2 + 104} Z`} fill={look.tie} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
          <path d={`M${c.lean - 9},${S2 + 8} L${c.lean + 9},${S2 + 8} L${c.lean + 6},${S2 - 4} L${c.lean - 6},${S2 - 4} Z`} fill={look.tie} stroke={INK} strokeWidth={3} />
          <path d={`M${c.lean - 50},${S2 - 2} L${c.lean - 22},${S2 + 70} L${c.lean - 4},${S2 + 128}`} stroke={INK} strokeWidth={4} fill="none" />
          <path d={`M${c.lean + 50},${S2 - 2} L${c.lean + 22},${S2 + 70} L${c.lean + 4},${S2 + 128}`} stroke={INK} strokeWidth={4} fill="none" />
          {[0, 1].map((i) => <circle key={i} cx={c.lean + 2} cy={S2 + 150 + i * 36} r={5} fill="#1e2430" stroke={INK} strokeWidth={2} />)}
          <path d={`M${c.lean + 28},${S2 + 90} l18,-4`} stroke="#f4f2ec" strokeWidth={5} />
        </g>
      )}
      {look.loose && (
        <g>
          {/* gola aberta e gravata frouxa, mangas dobradas */}
          <path d={`M${c.lean - 28},${S2 - 6} L${c.lean - 6},${S2 + 34} M${c.lean + 28},${S2 - 6} L${c.lean + 6},${S2 + 34}`} stroke={INK} strokeWidth={4} />
          <g transform={`rotate(8 ${c.lean} ${S2 + 30})`}>
            <path d={`M${c.lean - 8},${S2 + 30} L${c.lean + 8},${S2 + 30} L${c.lean + 12},${S2 + 120} L${c.lean},${S2 + 132} L${c.lean - 12},${S2 + 120} Z`} fill={look.tie} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
            <path d={`M${c.lean - 8},${S2 + 30} L${c.lean + 8},${S2 + 30} L${c.lean + 5},${S2 + 18} L${c.lean - 5},${S2 + 18} Z`} fill={look.tie} stroke={INK} strokeWidth={3} />
          </g>
          {[0, 1, 2].map((i) => <circle key={i} cx={c.lean - 2} cy={S2 + 70 + i * 48} r={4} fill="#fff" stroke={INK} strokeWidth={2} />)}
        </g>
      )}
      {look.style === "lucas" && !look.plain && [0, 1, 2].map((i) => <path key={i} d={`M${-64 * W},${S2 + 60 + i * 50} L${64 * W},${S2 + 60 + i * 50}`} stroke="#f4d27a" strokeWidth={14} />)}
      {look.style === "juliana" && <path d={`M${c.lean - 38},${S2 - 4} Q${c.lean},${S2 + 46} ${c.lean + 38},${S2 - 4}`} stroke={INK} strokeWidth={5} fill={SKIN} />}
      {look.style === "juliana" && <path d={`M${c.lean - 26},${S2 + 4} Q${c.lean},${S2 + 30} ${c.lean + 26},${S2 + 4}`} stroke={GOLD} strokeWidth={3} fill="none" />}
      {look.style === "juliana" && <circle cx={c.lean} cy={S2 + 22} r={5} fill={GOLD} stroke={INK} strokeWidth={2} />}
      {look.tie && look.style === "chefe" && (
        <g>
          <path d={`M${c.lean - 28},${S2 - 6} L${c.lean},${S2 + 22} L${c.lean + 28},${S2 - 6}`} stroke={INK} strokeWidth={5} fill="#fff" strokeLinejoin="round" />
          <path d={`M${c.lean - 10},${S2 + 18} L${c.lean + 10},${S2 + 18} L${c.lean + 16},${S2 + 150} L${c.lean},${S2 + 172} L${c.lean - 16},${S2 + 150} Z`} fill={look.tie} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        </g>
      )}
    </g>
  );
  return (
    <g transform={`translate(${c.x},${c.y}) rotate(${c.rot ?? 0}) scale(${c.k})`}>
      {hairBack}
      {legs}
      {torso}
      {c.back && arms}
      <path d={`M${c.lean},${S2} L${hd[0]},${hd[1] + HEAD_R * 0.7}`} stroke={INK} strokeWidth={39} strokeLinecap="round" />
      <path d={`M${c.lean},${S2} L${hd[0]},${hd[1] + HEAD_R * 0.7}`} stroke={SKIN} strokeWidth={30} strokeLinecap="round" />
      <g transform={`rotate(${c.tilt} ${hd[0]} ${hd[1] + 60})`}>
        <defs>
          <radialGradient id={`hg${id}`} cx="0.38" cy="0.3" r="0.8"><stop offset="0" stopColor="#ffffff" /><stop offset="0.7" stopColor={SKIN} /><stop offset="1" stopColor="#cfc7b8" /></radialGradient>
          <clipPath id={`hc${id}`}><circle cx={hd[0]} cy={hd[1]} r={HEAD_R} /></clipPath>
        </defs>
        {[-1, 1].map((sd) => <ellipse key={sd} cx={hd[0] + sd * (HEAD_R - 2) - f.lx * 10} cy={hd[1] + 8} rx={12} ry={18} fill={SKIN2} stroke={INK} strokeWidth={4} />)}
        <circle cx={hd[0]} cy={hd[1]} r={HEAD_R} fill={`url(#hg${id})`} stroke={INK} strokeWidth={6} />
        {(c.red ?? 0) > 0 && <circle cx={hd[0]} cy={hd[1]} r={HEAD_R - 3} fill="#e0554a" opacity={(c.red ?? 0) * 0.35} />}
        {hairTop()}
        <circle cx={hd[0]} cy={hd[1]} r={HEAD_R} fill="none" stroke={INK} strokeWidth={6} />
        {eye(-1)}
        {eye(1)}
        {look.style === "chefe" && <path d={`M${mx - 30},${my - 6} Q${mx},${my - 22} ${mx + 30},${my - 6} Q${mx + 14},${my - 2} ${mx},${my - 8} Q${mx - 14},${my - 2} ${mx - 30},${my - 6} Z`} fill="#5a5a5a" stroke={INK} strokeWidth={3} />}
        {mouth}
        <ellipse cx={fx + 36} cy={fy + 18} rx={11} ry={6} fill="#e7a28a" opacity={look.style === "juliana" || kid ? 0.5 : 0.3} />
        <ellipse cx={fx - 36} cy={fy + 18} rx={11} ry={6} fill="#e7a28a" opacity={look.style === "juliana" || kid ? 0.5 : 0.3} />
        {look.style === "juliana" && [-1, 1].map((sd) => <circle key={sd} cx={hd[0] + sd * (HEAD_R - 2) - f.lx * 10} cy={hd[1] + 30} r={6} fill={GOLD} stroke={INK} strokeWidth={2} />)}
        {(c.sweat ?? 0) > 0 && <path d={`M${hd[0] + 62} ${hd[1] - 30 + (c.sweat ?? 0) * 40} q-10 18 0 24 q10 -6 0 -24`} fill="#8fd0ff" stroke={INK} strokeWidth={2.5} />}
      </g>
      {!c.back && arms}
    </g>
  );
};

// ------------------------------------------------------------------ objetos e cenários
const Wall: React.FC<{ a: string; b: string; floor: number; fa: string; fb: string }> = ({ a, b, floor, fa, fb }) => (
  <g>
    <defs>
      <linearGradient id={`w${a}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>
      <linearGradient id={`f${fa}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={fa} /><stop offset="1" stopColor={fb} /></linearGradient>
    </defs>
    <rect x={-400} y={-400} width={1880} height={floor + 400} fill={`url(#w${a})`} />
    <rect x={-400} y={floor} width={1880} height={800} fill={`url(#f${fa})`} />
    <rect x={-400} y={floor - 22} width={1880} height={22} fill="#2b170d" stroke={INK} strokeWidth={5} />
  </g>
);
const Window: React.FC<{ x: number; y: number; w: number; h: number; day: number; t: number; scroll?: number }> = ({ x, y, w, h, day, t, scroll = 0 }) => (
  <g transform={`translate(${x},${y})`}>
    <defs>
      <linearGradient id={`sky${x}`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor={day > 0.5 ? "#ffd59a" : "#1a1f3a"} /><stop offset="1" stopColor={day > 0.5 ? "#8fc0f0" : "#0a0f22"} /></linearGradient>
      <clipPath id={`wc${x}`}><rect x={0} y={0} width={w} height={h} /></clipPath>
    </defs>
    <rect x={0} y={0} width={w} height={h} fill={`url(#sky${x})`} />
    <g clipPath={`url(#wc${x})`}>
      {Array.from({ length: 12 }).map((_, i) => {
        const bh = [60, 100, 80, 120, 70, 95, 110, 65, 90, 75, 105, 85][i];
        const bx = ((i * 52 - scroll) % 624 + 624) % 624 - 40;
        return <rect key={i} x={bx} y={h - bh} width={46} height={bh} fill={day > 0.5 ? "#7a8aa8" : "#141022"} stroke={INK} strokeWidth={2} />;
      })}
      {day > 0.5 && <circle cx={w * 0.78} cy={h * 0.25} r={26} fill="#fff1c0" />}
    </g>
    <rect x={0} y={0} width={w} height={h} fill="none" stroke="#6a4426" strokeWidth={16} />
    <line x1={w / 2} y1={0} x2={w / 2} y2={h} stroke="#6a4426" strokeWidth={10} />
    <rect x={-8} y={-8} width={w + 16} height={h + 16} fill="none" stroke={INK} strokeWidth={5} />
    {void t}
  </g>
);
const AlarmClock: React.FC<{ x: number; y: number; ring: number; t: number; txt: string }> = ({ x, y, ring, t, txt }) => (
  <g transform={`translate(${x + (ring ? Math.sin(t * 70) * 4 : 0)},${y}) rotate(${ring ? Math.sin(t * 50) * 4 : 0})`}>
    <rect x={-60} y={-40} width={120} height={70} rx={14} fill="#2a2a33" stroke={INK} strokeWidth={5} />
    <rect x={-48} y={-28} width={96} height={46} rx={6} fill="#0b0b10" />
    <text x={0} y={6} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={30} fill={RED} style={{ filter: `drop-shadow(0 0 5px ${RED})` }}>{txt}</text>
    {ring > 0 && [-1, 1].map((sd) => <path key={sd} d={`M${sd * 72},-30 q${sd * 12},20 0,40 M${sd * 88},-40 q${sd * 18},30 0,60`} stroke={RED} strokeWidth={5} fill="none" opacity={0.5 + 0.5 * Math.sin(t * 30)} />)}
  </g>
);
const Table: React.FC<{ x: number; y: number; w: number; floor?: number }> = ({ x, y, w, floor }) => {
  const legH = (floor ?? y + 330) - (y + 70);
  return (
    <g>
      <rect x={x - w / 2 + 20} y={y + 70} width={22} height={legH} fill="#5a3a24" stroke={INK} strokeWidth={4} />
      <rect x={x + w / 2 - 42} y={y + 70} width={22} height={legH} fill="#5a3a24" stroke={INK} strokeWidth={4} />
      <path d={`M${x - w / 2 + 30},${y} L${x + w / 2 - 30},${y} L${x + w / 2},${y + 44} L${x - w / 2},${y + 44} Z`} fill="#a8734a" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      <rect x={x - w / 2} y={y + 44} width={w} height={26} fill="#6e4a30" stroke={INK} strokeWidth={5} />
    </g>
  );
};
// cadeira de frente: encosto atrás, assento e pernas até o chão
const ChairF: React.FC<{ x: number; seat: number; floor: number; s?: number }> = ({ x, seat, floor, s = 1 }) => (
  <g>
    <rect x={x - 22 * s - 60 * s} y={seat - 240 * s} width={22 * s} height={240 * s + (floor - seat)} fill="#6b4a30" stroke={INK} strokeWidth={4} />
    <rect x={x + 60 * s} y={seat - 240 * s} width={22 * s} height={240 * s + (floor - seat)} fill="#6b4a30" stroke={INK} strokeWidth={4} />
    <rect x={x - 82 * s} y={seat - 240 * s} width={164 * s} height={70 * s} rx={10} fill="#8a5a36" stroke={INK} strokeWidth={5} />
    <rect x={x - 70 * s} y={seat - 150 * s} width={140 * s} height={22 * s} rx={6} fill="#8a5a36" stroke={INK} strokeWidth={4} />
    <path d={`M${x - 92 * s},${seat} L${x + 92 * s},${seat} L${x + 84 * s},${seat + 26 * s} L${x - 84 * s},${seat + 26 * s} Z`} fill="#a06a40" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
    <rect x={x - 80 * s} y={seat + 26 * s} width={16 * s} height={floor - seat - 26 * s} fill="#5a3a24" stroke={INK} strokeWidth={4} />
    <rect x={x + 64 * s} y={seat + 26 * s} width={16 * s} height={floor - seat - 26 * s} fill="#5a3a24" stroke={INK} strokeWidth={4} />
  </g>
);
const PhoneS: React.FC<{ glow?: number }> = ({ glow = 1 }) => (
  <g transform="rotate(-8)">
    <rect x={-20} y={-34} width={40} height={66} rx={8} fill="#15161c" stroke={INK} strokeWidth={4} />
    <rect x={-15} y={-28} width={30} height={52} rx={4} fill="#7cc4ff" opacity={0.4 + 0.6 * glow} />
  </g>
);
const Briefcase: React.FC = () => (
  <g>
    <path d="M-16,4 Q-16,-12 0,-12 Q16,-12 16,4" stroke={INK} strokeWidth={8} fill="none" />
    <path d="M-16,4 Q-16,-12 0,-12 Q16,-12 16,4" stroke="#5a3418" strokeWidth={4} fill="none" />
    <rect x={-52} y={4} width={104} height={74} rx={10} fill="#7a4a24" stroke={INK} strokeWidth={5} />
    <rect x={-52} y={4} width={104} height={20} rx={8} fill="#8a5a30" stroke={INK} strokeWidth={4} />
    {[-30, 30].map((x) => <rect key={x} x={x - 6} y={18} width={12} height={12} rx={2} fill={GOLD} stroke={INK} strokeWidth={2.5} />)}
  </g>
);
const Note: React.FC = () => (
  <g transform="rotate(-6)">
    <rect x={-46} y={-34} width={92} height={68} fill="#f5d36a" stroke={INK} strokeWidth={4} />
    <text x={0} y={-6} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={18} fill="#2a2836">FUI TRABALHAR</text>
    <text x={0} y={18} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={18} fill="#b83a4a">BJ, JU ♥</text>
  </g>
);
const Bilhete: React.FC = () => (
  <g transform="rotate(8)">
    <rect x={-58} y={-44} width={116} height={88} fill="#fdfbf4" stroke={INK} strokeWidth={4} />
    <text x={0} y={-14} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={18} fill="#2a2836">PASSEIO</text>
    <text x={0} y={6} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={18} fill="#2a2836">ESCOLAR</text>
    <text x={0} y={34} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={26} fill={RED}>R$ 100</text>
  </g>
);
const Door: React.FC<{ x: number; y: number; open: number }> = ({ x, y, open }) => (
  <g>
    <rect x={x} y={y} width={190} height={420} fill="#120a06" stroke={INK} strokeWidth={6} />
    <g transform={`translate(${x},${y}) scale(${1 - open * 0.75},1)`}>
      <rect x={0} y={0} width={190} height={420} fill="#7a5030" stroke={INK} strokeWidth={6} />
      <rect x={24} y={30} width={142} height={160} rx={6} fill="#6a4426" stroke={INK} strokeWidth={4} />
      <rect x={24} y={220} width={142} height={170} rx={6} fill="#6a4426" stroke={INK} strokeWidth={4} />
      <circle cx={160} cy={220} r={10} fill={GOLD} stroke={INK} strokeWidth={3} />
    </g>
  </g>
);
// foto da família: Marcos (cabelo curto, camisa azul), Juliana (cabelo comprido, blusa vinho, brincos) e Lucas (cabelo espetado, listrado amarelo)
const MiniFace: React.FC<{ x: number; y: number; r: number; kid?: boolean }> = ({ x, y, r, kid }) => (
  <g>
    {[-1, 1].map((sd) => <circle key={sd} cx={x + sd * r * 0.38} cy={y - r * 0.05} r={r * (kid ? 0.13 : 0.11)} fill={INK} />)}
    <path d={`M${x - r * 0.36},${y + r * 0.3} Q${x},${y + r * 0.62} ${x + r * 0.36},${y + r * 0.3}`} stroke={INK} strokeWidth={r * 0.1} fill="none" strokeLinecap="round" />
    {[-1, 1].map((sd) => <ellipse key={sd} cx={x + sd * r * 0.58} cy={y + r * 0.25} rx={r * 0.16} ry={r * 0.1} fill="#e7a28a" opacity={0.7} />)}
  </g>
);
const Frame: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x},${y}) rotate(-1.5)`}>
    <defs>
      <linearGradient id="photoBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9ed0f0" /><stop offset="0.62" stopColor="#d8eef8" /><stop offset="0.63" stopColor="#8cc070" /><stop offset="1" stopColor="#6aa050" /></linearGradient>
      <clipPath id="photoClip"><rect x={14} y={14} width={192} height={152} /></clipPath>
    </defs>
    <rect x={0} y={0} width={220} height={180} rx={8} fill="#8a5a36" stroke={INK} strokeWidth={5} />
    <rect x={14} y={14} width={192} height={152} fill="url(#photoBg)" stroke={INK} strokeWidth={3} />
    <g clipPath="url(#photoClip)">
      <circle cx={180} cy={40} r={14} fill="#fff1c0" />
      {/* Marcos */}
      <rect x={34} y={104} width={60} height={70} rx={18} fill="#4c6b92" stroke={INK} strokeWidth={3} />
      <path d="M54,104 L64,118 L74,104" fill="#e9e6de" stroke={INK} strokeWidth={2.5} />
      <circle cx={64} cy={78} r={24} fill={SKIN} stroke={INK} strokeWidth={3} />
      <path d="M40,74 Q44,50 66,52 Q86,52 88,72 Q76,62 64,64 Q50,62 40,74 Z" fill="#3b2a1e" stroke={INK} strokeWidth={2} />
      <MiniFace x={64} y={82} r={22} />
      {/* braço do Marcos passando por trás da Juliana */}
      <path d="M88,114 Q116,100 138,108" stroke="#4c6b92" strokeWidth={10} fill="none" strokeLinecap="round" />
      {/* Juliana */}
      <path d="M92,74 Q88,120 96,128 L140,128 Q146,118 142,74 Q118,46 92,74 Z" fill="#4a2a1a" stroke={INK} strokeWidth={2.5} />
      <rect x={92} y={110} width={52} height={64} rx={16} fill="#a8485e" stroke={INK} strokeWidth={3} />
      <path d="M106,110 Q118,122 130,110" fill={SKIN} stroke={INK} strokeWidth={2.5} />
      <circle cx={118} cy={86} r={22} fill={SKIN} stroke={INK} strokeWidth={3} />
      <path d="M96,84 Q98,62 118,62 Q140,62 140,82 Q128,70 112,74 Q102,76 96,84 Z" fill="#4a2a1a" />
      <circle cx={97} cy={94} r={3} fill={GOLD} stroke={INK} strokeWidth={1.2} />
      <circle cx={139} cy={94} r={3} fill={GOLD} stroke={INK} strokeWidth={1.2} />
      <MiniFace x={118} y={90} r={20} />
      {/* Lucas */}
      <rect x={148} y={126} width={46} height={50} rx={14} fill="#e0a33a" stroke={INK} strokeWidth={3} />
      {[138, 150, 162].map((yy) => <line key={yy} x1={150} y1={yy} x2={192} y2={yy} stroke="#f4d27a" strokeWidth={5} />)}
      <circle cx={171} cy={106} r={19} fill={SKIN} stroke={INK} strokeWidth={3} />
      {[156, 165, 174, 183].map((xx, i) => <path key={xx} d={`M${xx - 5},${92} L${xx + 1},${80 - (i % 2) * 4} L${xx + 6},${92} Z`} fill="#5a3a22" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />)}
      <path d="M153,100 Q156,86 171,86 Q186,86 189,100 Q178,94 171,95 Q162,94 153,100 Z" fill="#5a3a22" />
      <MiniFace x={171} y={110} r={17} kid />
      {/* mão dele no ombro dela */}
      <ellipse cx={140} cy={112} rx={6} ry={5} fill={SKIN} stroke={INK} strokeWidth={2} />
    </g>
    <rect x={14} y={14} width={192} height={152} fill="none" stroke={INK} strokeWidth={3} />
    <path d="M24,22 L60,22 L24,52 Z" fill="#fff" opacity={0.25} />
  </g>
);
const Bill: React.FC<{ label: string; val: string; icon: string; paid: number; pop: number }> = ({ label, val, icon, paid, pop }) => (
  <g transform={`scale(${pop})`}>
    <rect x={-90} y={-56} width={180} height={112} rx={12} fill="#fdfbf4" stroke={INK} strokeWidth={5} />
    <text x={-70} y={-16} fontFamily={BARLOW} fontWeight={700} fontSize={34} fill="#2a2836">{icon} {label}</text>
    <text x={-70} y={28} fontFamily={MONO} fontWeight={800} fontSize={26} fill="#55525f">{val}</text>
    {paid > 0 && (
      <g transform={`rotate(-14) scale(${lerp(1.8, 1, paid)})`} opacity={paid}>
        <rect x={-62} y={-24} width={124} height={48} rx={6} fill="none" stroke={RED} strokeWidth={6} />
        <text x={0} y={14} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={38} fill={RED}>PAGO</text>
      </g>
    )}
  </g>
);

// plaquinha de nome ("ESSE É...")
const Tag: React.FC<{ x: number; y: number; txt: string; p: number; s?: number; up?: boolean; side?: boolean }> = ({ x, y, txt, p, s = 1, up, side }) => {
  const k = backPop(p);
  if (k <= 0) return null;
  const w = txt.length * 27 + 44;
  return (
    <g transform={`translate(${x},${y}) scale(${s * k})`}>
      <path d={side ? `M${w / 2 - 4},-16 L${w / 2 + 22},0 L${w / 2 - 4},16 Z` : up ? "M-16,-40 L0,-62 L16,-40 Z" : "M-16,30 L0,54 L16,30 Z"} fill={GOLD} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      <rect x={-w / 2} y={-36} width={w} height={70} rx={14} fill="#14100c" stroke={GOLD} strokeWidth={5} />
      <text x={0} y={17} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={50} fill={WHITE} letterSpacing={2}>{txt}</text>
    </g>
  );
};

// ------------------------------------------------------------------ cenas
type Cam = { z: number; fx: number; fy: number };
const lightRoom = (warm: number) => (
  <g>
    <defs>
      <radialGradient id="warmL" cx="0.5" cy="0.4" r="0.7"><stop offset="0" stopColor="#ffcf8a" stopOpacity={0.35 * warm} /><stop offset="1" stopColor="#ffcf8a" stopOpacity={0} /></radialGradient>
    </defs>
    <rect x={-400} y={-400} width={1880} height={2000} fill="url(#warmL)" style={{ mixBlendMode: "screen" }} />
  </g>
);

// mãos seguem o alvo com atraso (somente dentro da mesma cena)
const follow = (fn: (x: number) => Ch, t: number): Ch => {
  const c = fn(t);
  const Wt = [0.32, 0.26, 0.2, 0.13, 0.09];
  let a: number[] = [0, 0, 0, 0], sw = 0;
  Wt.forEach((w, i) => {
    const x = t - i * 0.035;
    if (x < 0) return;
    const h = fn(x).hands;
    a = [a[0] + h[0][0] * w, a[1] + h[0][1] * w, a[2] + h[1][0] * w, a[3] + h[1][1] * w];
    sw += w;
  });
  return { ...c, hands: [[a[0] / sw, a[1] / sw], [a[2] / sw, a[3] / sw]] };
};
// caminhada com pé apoiado parado no chão (sem patinar), joelho dobrando para o lado em que anda
// d = distância andada (px locais), amp 0..1 (para parar suave), dir = +1 direita / -1 esquerda
const walkPose = (d: number, amp: number, dir: number) => {
  const L = 130;
  const foot = (i: number) => {
    const u = (((d / L + i * 0.5) % 1) + 1) % 1;
    let rel: number, lift = 0;
    if (u < 0.6) rel = 0.3 * L - (u / 0.6) * 0.6 * L;
    else { const q = (u - 0.6) / 0.4; rel = -0.3 * L + smooth(q) * 0.6 * L; lift = Math.sin(q * Math.PI) * 42; }
    return { rel: rel * amp, lift: lift * amp };
  };
  const f0 = foot(0), f1 = foot(1);
  const bx = lerp(40, 20, amp);
  const feet: [V, V] = [[-bx + dir * f0.rel, 296 - f0.lift], [bx + dir * f1.rel, 296 - f1.lift]];
  const hands: [V, V] = [[-84 + dir * f1.rel * 0.55, -14 - Math.abs(f1.rel) * 0.08], [84 + dir * f0.rel * 0.55, -14 - Math.abs(f0.rel) * 0.08]];
  const sy = -Math.cos((d / L) * Math.PI * 4) * 5 * amp;
  return { feet, hands, sy, lean: dir * 7 * amp, kneeDir: dir };
};
const walkFeet = (ph: number, amp: number): [V, V] => [
  [-40 + Math.sin(ph) * 34 * amp, 296 - Math.max(0, Math.cos(ph)) * 34 * amp],
  [40 - Math.sin(ph) * 34 * amp, 296 - Math.max(0, -Math.cos(ph)) * 34 * amp],
];
const walkHands = (ph: number, amp: number): [V, V] => [[-86 - Math.sin(ph) * 24 * amp, -14 - Math.abs(Math.sin(ph)) * 6 * amp], [86 + Math.sin(ph) * 24 * amp, -14 - Math.abs(Math.sin(ph)) * 6 * amp]];
const base = (o: Partial<Ch>): Ch => ({ x: 540, y: 700, k: 1, lean: 0, sy: 0, hx: 0, hy: 0, tilt: 0, face: F(), hands: HANG, feet: STAND_FEET, ...o });

// ==================================================================
// cenas
// ==================================================================
// corpos lisos (sem roupa): ele branco (com brilho dourado), os amigos em tons de cinza
const HIM: Look = { id: "h", shirt: "#f6f3ec", shirt2: "#e2ddd2", pants: "#f6f3ec", shoes: "#e9e4da", hair: "#3b2a1e", style: "marcos", sleeve: 0.02, width: 0.8, plain: true };
const F1: Look = { id: "f1", shirt: "#c9cbd0", shirt2: "#b3b6bc", pants: "#c9cbd0", shoes: "#b3b6bc", hair: "#2a2a2e", style: "marcos", sleeve: 0.02, width: 0.86, plain: true };
const F2: Look = { id: "f2", shirt: "#d5cfd2", shirt2: "#c0b9bd", pants: "#d5cfd2", shoes: "#c0b9bd", hair: "#5a3a26", style: "juliana", sleeve: 0.02, width: 0.72, plain: true };
const F3: Look = { id: "f3", shirt: "#bfc4bf", shirt2: "#aab0aa", pants: "#bfc4bf", shoes: "#aab0aa", hair: "#6a4a2a", style: "lucas", sleeve: 0.02, width: 0.82, plain: true };
const FLOOR = 1290, K = 1.05;
const STAND_Y = FLOOR - 296 * K;
const SEAT_X = 700, SEAT_Y = FLOOR - 170, TABLE_Y = SEAT_Y - 44;

// balão de fala acima da cabeça (sem cobrir o rosto); a ponta aponta para a cabeça
const headW = (c: Ch): V => { const h = headLocal(c); return [c.x + h[0] * c.k, c.y + h[1] * c.k]; };
const Balloon: React.FC<{ c: Ch; txt: string[]; p: number; dx?: number; dy?: number; color?: string; tc?: string; size?: number }> = ({ c, txt, p, dx = 0, dy = 0, color = "#ffffff", tc = "#1b100a", size = 46 }) => {
  if (p <= 0) return null;
  const k = backPop(p);
  const [hx, hy] = headW(c);
  const lw = Math.max(...txt.map((t) => t.length)) * size * 0.5 + 56, lh = txt.length * size * 1.08 + 34;
  let bx = hx + dx, by = hy - 92 * c.k - lh / 2 - 40 + dy;
  bx = Math.max(120 + lw / 2, Math.min(960 - lw / 2, bx));
  const tipX = Math.max(bx - lw / 2 + 30, Math.min(bx + lw / 2 - 30, hx));
  return (
    <g transform={`translate(${bx},${by + lh / 2}) scale(${k}) translate(${-bx},${-(by + lh / 2)})`}>
      <path d={`M${tipX - 18},${by + lh / 2 - 4} L${hx + (hx - tipX) * 0.2},${hy - 88 * c.k} L${tipX + 18},${by + lh / 2 - 4} Z`} fill={color} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      <rect x={bx - lw / 2} y={by - lh / 2} width={lw} height={lh} rx={30} fill={color} stroke={INK} strokeWidth={5} />
      <rect x={tipX - 16} y={by + lh / 2 - 9} width={32} height={10} fill={color} />
      {txt.map((t, i) => <text key={i} x={bx} y={by - lh / 2 + 17 + size * 0.86 + i * size * 1.08} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={size} fill={tc} letterSpacing={0.5}>{t}</text>)}
    </g>
  );
};
const Glow: React.FC<{ x: number; y: number; r?: number; o?: number }> = ({ x, y, r = 300, o = 0.45 }) => (
  <g>
    <defs><radialGradient id={`gl${Math.round(x)}${Math.round(y)}`}><stop offset="0" stopColor={GOLD} stopOpacity={o} /><stop offset="1" stopColor={GOLD} stopOpacity={0} /></radialGradient></defs>
    <circle cx={x} cy={y} r={r} fill={`url(#gl${Math.round(x)}${Math.round(y)})`} />
  </g>
);
// cenário leve: parede clara, rodapé, chão, um quadro e uma janela
const Room: React.FC<{ night?: number; t: number }> = ({ night = 0, t }) => (
  <g>
    <rect x={-400} y={-400} width={1880} height={FLOOR + 400} fill={night ? "#2c3346" : "#f3ead9"} />
    <rect x={-400} y={FLOOR} width={1880} height={900} fill={night ? "#1d2230" : "#e2d2b6"} />
    <rect x={-400} y={FLOOR - 16} width={1880} height={16} fill={night ? "#151a26" : "#cdb995"} />
    <g transform="translate(760,520)">
      <rect x={0} y={0} width={220} height={260} rx={10} fill={night ? "#0e1424" : "#bfe2f5"} stroke={INK} strokeWidth={6} />
      <line x1={110} y1={0} x2={110} y2={260} stroke={INK} strokeWidth={5} />
      <line x1={0} y1={130} x2={220} y2={130} stroke={INK} strokeWidth={5} />
      {night ? <circle cx={160} cy={60} r={22} fill="#fff6cf" /> : <circle cx={165} cy={60} r={24} fill="#ffe08a" />}
    </g>
    {void t}
  </g>
);
const Desk: React.FC<{ books?: number; lamp?: number }> = ({ books = 3, lamp = 0 }) => (
  <g>
    <Table x={SEAT_X} y={TABLE_Y} w={430} floor={FLOOR} />
    {Array.from({ length: books }).map((_, i) => <rect key={i} x={SEAT_X - 190 + (i % 2) * 6} y={TABLE_Y - 20 - i * 18} width={110} height={18} rx={3} fill={["#e0554a", "#4a8fd0", "#E8B84A", "#5fae6a", "#8a64c0", "#e08a4a"][i % 6]} stroke={INK} strokeWidth={3} />)}
    {/* luminária */}
    <g transform={`translate(${SEAT_X + 160},${TABLE_Y})`}>
      <rect x={-30} y={-10} width={60} height={12} rx={5} fill="#3a3a44" stroke={INK} strokeWidth={3} />
      <path d="M0,-10 L-18,-120 L30,-150" stroke={INK} strokeWidth={8} fill="none" strokeLinecap="round" />
      <path d="M12,-170 L62,-140 L40,-110 Z" fill={lamp ? "#ffe9a8" : "#e8e1d0"} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      {lamp > 0 && <path d="M40,-120 L-130,10 L120,10 Z" fill="#ffe9a8" opacity={0.18 * lamp} />}
    </g>
  </g>
);
// ele sentado estudando, atrás da mesa; look = 0 olha o caderno, 1 olha para a porta (esquerda)
const himDesk = (x: number, look: number, o: Partial<Ch> = {}): Ch => {
  const write = (1 - look) * (0.5 + 0.5 * Math.sin(x * 9));
  return base({
    x: SEAT_X, y: SEAT_Y - 12, k: 1, sit: 1,
    hands: [[-70 + look * -10, -40], [40 + write * 14, -38 - write * 6 - look * 60]],
    face: F({ lx: lerp(0.0, -0.7, look), px: lerp(0, -1, look), ly: lerp(0.45, 0, look), py: lerp(0.9, 0, look), curve: 0.25, open: 1 - blinkAt(x, 2.8, 0.4) * 0.85 }),
    ...o,
  });
};
const friendWalk = (x: number, xs: number, xe: number, t0: number, t1: number, look: Look): Ch => {
  const wx = kf(x, [[t0, xs], [t1, xe]]);
  const v = x < t0 ? 0 : x < t1 ? 1 - er(x, t1 - 0.2, t1) : 0;
  const w = walkPose((wx - xs), v, 1);
  void look;
  return base({ x: wx, y: STAND_Y, k: K, feet: w.feet, kneeDir: 1, sy: w.sy, lean: w.lean, hands: w.hands });
};
// cena de convite: amigo(s) entram pela esquerda e chamam; ele recusa e volta a estudar
const Invite = (t: number, who: { look: Look; x: number; t0: number }[], ask: string[], ans: string[], tAsk: number, tAns: number, prop?: (c: Ch) => React.ReactNode) => {
  const look = er(t, tAsk - 0.3, tAsk) * (1 - er(t, tAns + 1.4, tAns + 1.8));
  const nod = Math.sin(clamp01((t - tAns) / 0.7) * Math.PI * 2) * er(t, tAns, tAns + 0.1) * (1 - er(t, tAns + 0.6, tAns + 0.7));
  const me = follow((x) => { const c = himDesk(x, er(x, tAsk - 0.3, tAsk) * (1 - er(x, tAns + 1.4, tAns + 1.8))); c.hx = nod * 14; c.tilt = nod * 4; c.face.curve = 0.3; return c; }, t);
  const fr = who.map((f, i) => follow((x) => {
    const c = friendWalk(x, -260 - i * 120, f.x, f.t0, f.t0 + 1.1, f.look);
    const hype = er(x, tAsk, tAsk + 0.2);
    const sad = er(x, tAns + 0.3, tAns + 0.7);
    if (x > f.t0 + 1.1) {
      c.hands = [mixV([-86, -14], [-60, -260 + Math.sin(x * 12 + i) * 16], hype * (1 - sad)), mixV([86, -14], [120, -150], hype * (1 - sad))];
      c.sy = -Math.abs(Math.sin(x * 9 + i)) * 10 * hype * (1 - sad);
    }
    c.face = F({ lx: 0.7, px: 1, curve: lerp(0.8, -0.2, sad), mo: hype * (1 - sad) * 0.4, raise: 0.4 * (1 - sad), worry: sad * 0.3, open: 1 - blinkAt(x, 2.5, i) * 0.8 });
    c.tilt = sad * -6;
    return c;
  }, t));
  return (
    <g>
      <Room t={t} />
      <ChairF x={SEAT_X} seat={SEAT_Y} floor={FLOOR} />
      <Glow x={SEAT_X} y={SEAT_Y - 260} />
      <Person c={me} look={HIM} t={t} />
      <Desk />
      {fr.map((c, i) => <g key={i}><Person c={c} look={who[i].look} t={t} />{prop && prop(c)}</g>)}
      <Balloon c={fr[Math.floor(fr.length / 2)]} txt={ask} p={(t - tAsk) * 1.0} dx={fr.length > 1 ? 40 : 60} />
      <Balloon c={me} txt={ans} p={(t - tAns) * 1.0} dx={40} color="#fff4d6" />
    </g>
  );
};
const Can: React.FC = () => <g transform="rotate(-8)"><rect x={-14} y={-26} width={28} height={46} rx={6} fill="#e0554a" stroke={INK} strokeWidth={3.5} /><rect x={-14} y={-12} width={28} height={10} fill="#f4f1ea" /></g>;
const S1 = (t: number) => Invite(t, [{ look: F1, x: 300, t0: 0.0 }], ["BORA BEBER", "HOJE?"], ["HOJE NÃO.", "VOU ESTUDAR."], 1.2, 2.5, (c) => <g transform={`translate(${c.x + c.hands[1][0] * c.k},${c.y + c.hands[1][1] * c.k})`}><Can /></g>);
const S2 = (t: number) => Invite(t, [{ look: F2, x: 300, t0: -0.4 }], ["FESTA", "SEXTA!!"], ["NÃO DÁ.", "TÔ ESTUDANDO."], 0.8, 2.0);
const S3 = (t: number) => Invite(t, [{ look: F1, x: 215, t0: -0.5 }, { look: F2, x: 335, t0: -0.4 }, { look: F3, x: 455, t0: -0.3 }], ["VEM PRA BALADA", "COM A GENTE!"], ["PRÓXIMA."], 0.9, 2.3);
const CAMI = (t: number): Cam => ({ z: 1.42 + t * 0.012, fx: 530, fy: 905 });
// estudando à noite: calendário com dias riscados, relógio passando
const S4 = (t: number) => {
  const me = follow((x) => { const c = himDesk(x + 3, 0); c.sy = Math.sin(x * 2) * 3; return c; }, t);
  const days = Math.min(14, Math.floor(t / 3.4 * 15));
  return (
    <g>
      <Room night={1} t={t} />
      {/* calendário */}
      <g transform="translate(205,560)">
        <rect x={0} y={0} width={300} height={290} rx={12} fill="#fdfbf4" stroke={INK} strokeWidth={6} />
        <rect x={0} y={0} width={300} height={56} rx={12} fill={RED} stroke={INK} strokeWidth={6} />
        {Array.from({ length: 14 }).map((_, i) => { const cx = 30 + (i % 5) * 60, cy = 90 + Math.floor(i / 5) * 62; return <g key={i}><text x={cx} y={cy + 12} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={30} fill="#55525f">{i + 1}</text>{i < days && <path d={`M${cx - 18},${cy - 14} L${cx + 18},${cy + 20} M${cx + 18},${cy - 14} L${cx - 18},${cy + 20}`} stroke={RED} strokeWidth={6} strokeLinecap="round" />}</g>; })}
      </g>
      <ChairF x={SEAT_X} seat={SEAT_Y} floor={FLOOR} />
      <Glow x={SEAT_X} y={SEAT_Y - 260} />
      <Person c={me} look={HIM} t={t} />
      <Desk books={5} lamp={1} />
    </g>
  );
};
const CAM4 = (t: number): Cam => ({ z: 1.38 + t * 0.01, fx: 520, fy: 900 });
// "2 semanas depois…": folhas do calendário voando
const S5 = (t: number) => (
  <g>
    <rect x={-400} y={-400} width={1880} height={2800} fill="#14100c" />
    {Array.from({ length: 10 }).map((_, i) => { const q = clamp01(t * 1.4 - i * 0.08); const x = 540 + (i % 2 ? 1 : -1) * q * (200 + i * 40), y = 900 - q * (300 + i * 30) + q * q * 500; return q > 0 && q < 1 ? <rect key={i} x={x - 60} y={y - 50} width={120} height={100} rx={8} fill="#fdfbf4" stroke={INK} strokeWidth={4} opacity={1 - q} transform={`rotate(${q * (i % 2 ? 200 : -200)} ${x} ${y})`} /> : null; })}
  </g>
);
// ele tranquilo: sentado de boa num banco, mãos atrás da cabeça, óculos escuros, prova com 10
const Sunglasses: React.FC<{ c: Ch }> = ({ c }) => { const [hx, hy] = headW(c); const fy = hy - 6 * c.k; return (
  <g>
    {[-1, 1].map((sd) => <rect key={sd} x={hx + sd * 25 * c.k - 22 * c.k} y={fy - 14 * c.k} width={44 * c.k} height={28 * c.k} rx={12 * c.k} fill="#1b1b22" stroke={INK} strokeWidth={4} />)}
    <line x1={hx - 4 * c.k} y1={fy - 4 * c.k} x2={hx + 4 * c.k} y2={fy - 4 * c.k} stroke={INK} strokeWidth={5} />
  </g>); };
const relaxed = (x: number, cx: number, seat: number, k = 1): Ch => base({
  x: cx, y: seat - 12 * k, k, sit: 1, lean: -6,
  hands: [[-62, -360], [62, -360]], hy: Math.sin(x * 1.6) * 4,
  face: F({ curve: 0.75, open: 1 - blinkAt(x, 3.2, 0.5) * 0.85, raise: 0.15, lx: 0.1 }), tilt: -4 + Math.sin(x * 1.2) * 2,
});
const Park: React.FC<{ t: number }> = ({ t }) => (
  <g>
    <rect x={-400} y={-400} width={1880} height={FLOOR + 400} fill="#bfe4f7" />
    <circle cx={850} cy={520} r={70} fill="#ffe08a" opacity={0.95} />
    {[0, 1, 2].map((i) => <ellipse key={i} cx={((i * 380 + t * 30) % 1500) - 200} cy={420 + i * 90} rx={110} ry={34} fill="#ffffff" opacity={0.85} />)}
    <rect x={-400} y={FLOOR - 40} width={1880} height={900} fill="#9fd07a" />
    <path d={`M-400,${FLOOR - 40} Q540,${FLOOR - 110} 1480,${FLOOR - 40}`} fill="#9fd07a" />
    <g transform={`translate(230,${FLOOR - 40})`}><rect x={-14} y={-220} width={28} height={220} fill="#8a5a36" stroke={INK} strokeWidth={4} /><circle cx={0} cy={-260} r={110} fill="#6cae4f" stroke={INK} strokeWidth={5} /></g>
  </g>
);
const Bench: React.FC<{ x: number; seat: number }> = ({ x, seat }) => (
  <g>
    <rect x={x - 230} y={seat - 150} width={460} height={26} rx={8} fill="#c08a52" stroke={INK} strokeWidth={4} />
    <rect x={x - 230} y={seat - 100} width={460} height={26} rx={8} fill="#c08a52" stroke={INK} strokeWidth={4} />
    <rect x={x - 240} y={seat} width={480} height={26} rx={8} fill="#c08a52" stroke={INK} strokeWidth={5} />
    {[-200, 200].map((d) => <rect key={d} x={x + d - 10} y={seat + 26} width={20} height={FLOOR - 40 - seat - 26} fill="#5a3a24" stroke={INK} strokeWidth={4} />)}
  </g>
);
const BENCH_X = 560, BENCH_SEAT = FLOOR - 200;
const Relax = (t: number, k = 1, balloon = true) => {
  const me = follow((x) => relaxed(x, BENCH_X, BENCH_SEAT, k), t);
  return (
    <g>
      <Park t={t} />
      <Bench x={BENCH_X} seat={BENCH_SEAT} />
      <Glow x={BENCH_X} y={BENCH_SEAT - 240} r={340} />
      <Person c={me} look={HIM} t={t} />
      <Sunglasses c={me} />
      {/* prova com nota 10 ao lado */}
      <g transform={`translate(${BENCH_X + 150},${BENCH_SEAT - 18}) rotate(-6)`}>
        <rect x={-60} y={-80} width={120} height={150} rx={6} fill="#fdfbf4" stroke={INK} strokeWidth={4} />
        {[0, 1, 2, 3].map((i) => <line key={i} x1={-44} y1={-50 + i * 22} x2={30} y2={-50 + i * 22} stroke="#c8ccd8" strokeWidth={4} />)}
        <circle cx={22} cy={36} r={28} fill="none" stroke={RED} strokeWidth={6} />
        <text x={22} y={48} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={36} fill={RED}>10</text>
      </g>
      {balloon && <Balloon c={me} txt={["TUDO ESTUDADO."]} p={t - 1.0} dx={-60} color="#fff4d6" />}
    </g>
  );
};
const S6 = (t: number) => Relax(t);
const CAM6 = (t: number): Cam => ({ z: 1.4 + t * 0.015, fx: 560, fy: 920 });
// eles desesperados de madrugada: mesa cheia de livros, relógio 03:47, suor, um dormindo no livro
const T_X = [330, 560, 790];
const Cram = (t: number, balloons = true) => {
  const fr = [F1, F2, F3].map((lk, i) => follow((x) => {
    const asleep = i === 2 ? er(x, 2.6, 3.2) : 0;
    const c = base({ x: T_X[i], y: SEAT_Y - 12, k: 0.92, sit: 1, tremble: i === 0 ? 0.6 : 0.2 });
    c.hands = i === 0 ? [[-80, -300 + Math.sin(x * 14) * 10], [80, -300 + Math.cos(x * 13) * 10]] : i === 1 ? [[-60, -60], [50 + Math.sin(x * 20) * 10, -50]] : [mixV([-60, -60], [-90, -10], asleep), mixV([60, -60], [90, -10], asleep)];
    c.face = F({ ly: i === 0 ? -0.2 : 0.5, py: i === 0 ? -0.5 : 0.9, lx: i === 0 ? 0.0 : 0.1, worry: 1, curve: -0.6, open: i === 2 ? lerp(0.5, 0.06, asleep) : 0.95 - blinkAt(x, 2.2, i) * 0.8, eyeS: i === 0 ? 1.3 : 1, mo: i === 0 ? 0.4 + 0.2 * Math.sin(x * 10) : 0, wide: i === 1 ? 0.6 : 0 });
    c.sweat = ((x * 0.8 + i * 0.3) % 1);
    c.hy = asleep * 70; c.tilt = asleep * 20 + (i === 1 ? -6 : 0);
    return c;
  }, t));
  return (
    <g>
      <Room night={1} t={t} />
      {/* relógio 03:47 */}
      <g transform="translate(300,560)">
        <rect x={-130} y={-50} width={260} height={100} rx={18} fill="#14100c" stroke={INK} strokeWidth={6} />
        <text x={0} y={22} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={64} fill={RED} opacity={0.75 + 0.25 * Math.sin(t * 6)} style={{ filter: `drop-shadow(0 0 6px ${RED})` }}>03:47</text>
      </g>
      {T_X.map((x) => <ChairF key={x} x={x} seat={SEAT_Y} floor={FLOOR} s={0.9} />)}
      {fr.map((c, i) => <Person key={i} c={c} look={[F1, F2, F3][i]} t={t} />)}
      <Table x={560} y={TABLE_Y} w={780} floor={FLOOR} />
      {/* livros abertos, papéis, café derramado */}
      {Array.from({ length: 9 }).map((_, i) => <rect key={i} x={230 + i * 66} y={TABLE_Y - 14 - (i % 3) * 14} width={90} height={14} rx={3} fill={["#e0554a", "#4a8fd0", "#E8B84A", "#5fae6a", "#8a64c0"][i % 5]} stroke={INK} strokeWidth={3} transform={`rotate(${((i * 37) % 20) - 10} ${270 + i * 66} ${TABLE_Y - 10})`} />)}
      <g transform={`translate(860,${TABLE_Y + 4})`}><ellipse cx={30} cy={6} rx={60} ry={10} fill="#5a3418" opacity={0.85} /><path d="M-18,-30 L18,-30 L14,4 L-14,4 Z" fill="#f4f1ea" stroke={INK} strokeWidth={4} transform="rotate(80 0 -10)" /></g>
      {balloons && <Balloon c={fr[0]} txt={["SOCORRO!"]} p={t - 0.5} dy={20} color="#ffffff" />}
      {balloons && <Balloon c={fr[1]} txt={["A PROVA É", "AMANHÃ?!"]} p={t - 1.5} dx={60} dy={-150} />}
      {balloons && <Balloon c={fr[2]} txt={["NÃO SEI NADA..."]} p={t - 2.4} dx={20} dy={-40} />}
      {t > 3.4 && fr[2].hy! > 40 && <text x={T_X[2] + 70} y={SEAT_Y - 330} fontFamily={BARLOW} fontWeight={700} fontSize={54} fill="#cfd8ff" opacity={0.5 + 0.5 * Math.sin(t * 4)}>Z z z</text>}
    </g>
  );
};
const S7 = (t: number) => Cram(t);
const CAM7 = (t: number): Cam => ({ z: kf(t, [[0, 1.3], [5.6, 1.38]]), fx: 560, fy: 900 });
// final: tela dividida — em cima ele tranquilo, embaixo eles desesperados
const S8 = (t: number) => (
  <g>
    <defs>
      <clipPath id="top8"><rect x={-400} y={-400} width={1880} height={1360} /></clipPath>
      <clipPath id="bot8"><rect x={-400} y={960} width={1880} height={1600} /></clipPath>
    </defs>
    <g clipPath="url(#top8)"><g transform="translate(540,470) scale(1.05) translate(-560,-985)">{Relax(t + 5, 1, false)}</g></g>
    <g clipPath="url(#bot8)"><g transform="translate(540,1450) scale(1.05) translate(-560,-1010)">{Cram(t + 5, false)}</g></g>
    <rect x={-400} y={955} width={1880} height={10} fill={GOLD} />
  </g>
);
const CAM8 = (_t: number): Cam => ({ z: 1, fx: 540, fy: 960 });
const SCENES: [(t: number) => React.ReactNode, (t: number) => Cam][] = [
  [S1, CAMI], [S2, CAMI], [S3, CAMI], [S4, CAM4], [S5, CAM4], [S6, CAM6], [S7, CAM7], [S8, CAM8],
];

export const AgoraDepois: React.FC = () => {
  useFonts();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const s = sceneOf(t), lt = t - ST[s];
  const [draw, cam] = SCENES[s];
  const c = cam(lt);
  const flash = s > 0 ? Math.max(0, 1 - lt / 0.12) * 0.15 : 0;
  const card = s === 4 ? er(lt, 0.1, 0.35) * (1 - er(lt, 1.4, 1.7)) : 0;
  return (
    <AbsoluteFill style={{ background: "#0a0605" }}>
      <Audio src={staticFile("agora_depois/sfx.wav")} volume={0.6} />
      <svg width={1080} height={1920} viewBox="0 0 1080 1920">
        <g transform={`translate(540,960) scale(${c.z}) translate(${-c.fx},${-c.fy})`}>{draw(lt)}</g>
        <rect width={1080} height={1920} fill="#fff" opacity={flash} />
      </svg>
      {/* frase de impacto no meio da tela dividida (sobre a linha dourada) */}
      {s === 7 && (() => { const k = er(lt, 0.25, 0.6); return (
        <div style={{ position: "absolute", left: 0, right: 0, top: 960 - 112, height: 224, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", background: `rgba(10,6,5,${0.82 * k})`, borderTop: `5px solid rgba(232,184,74,${k})`, borderBottom: `5px solid rgba(232,184,74,${k})` }}>
          <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 76, lineHeight: 1.0, letterSpacing: 2, color: WHITE, opacity: k, transform: `scale(${0.92 + 0.08 * k})` }}>QUEM SE ESFORÇA AGORA,</div>
          <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 76, lineHeight: 1.05, letterSpacing: 2, color: GOLD, opacity: er(lt, 0.7, 1.05), transform: `scale(${0.92 + 0.08 * er(lt, 0.7, 1.05)})` }}>DESCANSA DEPOIS.</div>
        </div>); })()}
      {card > 0 && (
        <div style={{ position: "absolute", left: 120, right: 120, top: 860, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 96, letterSpacing: 3, color: GOLD, opacity: card, transform: `translateY(${(1 - card) * 14}px)` }}>2 SEMANAS<br /><span style={{ color: WHITE }}>DEPOIS…</span></div>
      )}
    </AbsoluteFill>
  );
};
