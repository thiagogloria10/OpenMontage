import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// ==================================================================
// SÉRIE MARCOS — DIA 1. Tudo em código (SVG), estilo do teste do Marcos:
// cartoon com contorno escuro, luz quente, IK, quadros-chave suaves, expressões contínuas.
// Bonecos com os ajustes do "30 dias": braço numa curva só com manga na mesma curva,
// cotovelo redondo, mão em luva, mãos seguindo o alvo com atraso.
// Narração PROVISÓRIA (Piper) frase a frase em public/marcos_dia1/fala/nN.wav.
// Para trocar pela voz do Thiago: substituir os arquivos e ajustar LINES (início/duração).
// ==================================================================
const FONT_DIR = "marcos_dia1";
const HOOK = ["DIA 1", "A VIDA DE MARCOS"];

const INK = "#1b100a", GOLD = "#E8B84A", RED = "#e0554a", WHITE = "#f4f1ea", GREEN = "#5fd08a";
const BARLOW = "'Barlow Condensed', 'DejaVu Sans Condensed', sans-serif";
const MONO = "'JetBrains Mono', 'DejaVu Sans Mono', monospace";
const SKIN = "#f3efe7", SKIN2 = "#d9d2c5";

// ------------------------------------------------------------------ cenas (duração em s) e falas
const DUR = [4.4, 6.4, 3.4, 3.4, 3.4, 3.0, 3.2, 6.6, 3.0, 4.6, 1.9, 1.8, 2.6, 4.4, 4.6, 3.8];
const ST: number[] = DUR.reduce<number[]>((a, d, i) => [...a, i === 0 ? 0 : a[i - 1] + DUR[i - 1]], []);
export const TOTAL = ST[ST.length - 1] + DUR[DUR.length - 1];
// [texto, arquivo, início relativo à cena, duração da fala]
const LINES: [string, number, number, number][] = [
  ["Esse é o Marcos. Ele sempre acorda atrasado.", 1, 0.3, 2.53],
  ["O Lucas, o filho, já foi pra escola. A Juliana, a esposa, pro trabalho.", 2, 0.4, 4.31],
  ["Ônibus lotado. Como todo dia.", 3, 0.4, 1.9],
  ["No escritório, o emprego que ele não aguenta mais.", 4, 0.3, 2.72],
  ["E esse... é o seu Roberto. O chefe dele.", 5, 0.5, 2.14],
  ["E o Marcos leva mais uma bronca.", 6, 0.3, 1.59],
  ["Mas hoje é dia de pagamento.", 7, 0.4, 1.56],
  ["Em casa, as contas. Água. Luz. Internet. Aluguel. Mercado. Remédios.", 8, 0.3, 5.24],
  ["Aí o Lucas chega da escola, animado:", 9, 0.3, 2.33],
  ["Pai, a escola vai fazer um passeio! Custa cem reais. Posso ir?", 10, 0.25, 3.69],
  ["Marcos olha o extrato...", 11, 0.3, 1.17],
  ["Zerado.", 12, 0.25, 0.57],
  ["E tem que dizer não.", 13, 0.4, 1.04],
  ["Depois, vê o olhar da Juliana. Preocupação. Tristeza.", 14, 0.4, 3.39],
  ["É ali que Marcos decide: alguma coisa vai mudar.", 15, 0.4, 2.71],
  ["O que Marcos irá fazer? Segue pra ver a parte dois.", 16, 0.3, 2.9],
];
const KEY = ["roberto", "bronca", "marcos", "lucas", "esse", "atrasado", "dia", "lotado", "chefe", "pagamento", "contas", "cem", "reais", "zerado", "não", "juliana", "mudar", "dois", "remédios"];

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
type Look = { id: string; shirt: string; shirt2: string; pants: string; shoes: string; hair: string; style: "marcos" | "lucas" | "juliana" | "chefe"; sleeve: number; width: number; tie?: string };
const MARCOS: Look = { id: "m", shirt: "#4c6b92", shirt2: "#3a5576", pants: "#3a3d47", shoes: "#2a1b12", hair: "#3b2a1e", style: "marcos", sleeve: 0.44, width: 0.8 };
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
      {look.style === "marcos" && <path d={`M${c.lean - 26},${S2 - 6} L${c.lean},${S2 + 26} L${c.lean + 26},${S2 - 6}`} stroke={INK} strokeWidth={5} fill="#e9e6de" strokeLinejoin="round" />}
      {look.style === "lucas" && [0, 1, 2].map((i) => <path key={i} d={`M${-64 * W},${S2 + 60 + i * 50} L${64 * W},${S2 + 60 + i * 50}`} stroke="#f4d27a" strokeWidth={14} />)}
      {look.style === "juliana" && <path d={`M${c.lean - 38},${S2 - 4} Q${c.lean},${S2 + 46} ${c.lean + 38},${S2 - 4}`} stroke={INK} strokeWidth={5} fill={SKIN} />}
      {look.style === "juliana" && <path d={`M${c.lean - 26},${S2 + 4} Q${c.lean},${S2 + 30} ${c.lean + 26},${S2 + 4}`} stroke={GOLD} strokeWidth={3} fill="none" />}
      {look.style === "juliana" && <circle cx={c.lean} cy={S2 + 22} r={5} fill={GOLD} stroke={INK} strokeWidth={2} />}
      {look.tie && (
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

// --- S1 quarto: acorda atrasado (cabeça no travesseiro, corpo e pernas debaixo do cobertor)
const T1 = 1.6;
type Pts = V[];
const mixPts = (a: Pts, b: Pts, k: number): Pts => a.map((p, i) => mixV(p, b[i], k));
const pathOf = (p: Pts) => `M${pt(p[0])} Q${pt(p[1])} ${pt(p[2])} Q${pt(p[3])} ${pt(p[4])} Q${pt(p[5])} ${pt(p[6])} Q${pt(p[7])} ${pt(p[8])} L${pt(p[9])} L${pt(p[10])} Z`;
// cobertor deitado (cobre do pescoço aos pés) e sentado (cobre só as pernas); contorno com joelhos e pés
const BL_LIE: Pts = [[412, 712], [470, 684], [560, 690], [650, 684], [730, 700], [820, 712], [880, 704], [930, 668], [952, 740], [952, 828], [412, 828]];
const BL_SIT: Pts = [[560, 772], [610, 744], [680, 736], [740, 726], [790, 742], [850, 748], [890, 736], [930, 700], [952, 760], [952, 828], [560, 828]];
const S1 = (t0: number) => {
  const t = t0 - T1;
  const up = er(t, 0.55, 1.05);
  const mk = (x0: number): Ch => {
    const x = x0 - T1;
    const u = er(x, 0.55, 1.05);
    const bl = blinkAt(x, 2.6, 0.5);
    return base({
      x: 655, y: 774, k: 0.92, rot: lerp(-86, 0, u), legs: false, noArms: u < 0.4,
      hands: u < 0.5 ? [[-34, -90], [34, -90]] : [mixV([-90, 6], [-120, -170], er(x, 1.4, 1.7) * (1 - er(x, 2.6, 3.0))), [96, 4]],
      face: F({ open: u < 0.3 ? 0.06 : 1 - bl * 0.6, eyeS: lerp(1, 1.4, u), pupil: lerp(1, 0.6, u), raise: u * 1.1, mo: u * 0.8 * (1 - er(x, 2.2, 2.8)), lx: er(x, 1.2, 1.5) * -0.85, px: er(x, 1.2, 1.5) * -1, worry: er(x, 2.0, 2.6) * 0.6 }),
      sweat: ramp(x, 1.3, 3.0), tremble: u > 0.9 && x < 1.5 ? 1 : 0, sy: u * -6,
    });
  };
  const m = follow(mk, t0);
  const breathe = up < 0.05 ? Math.sin(t0 * 2) * 3 : 0;
  const bl = mixPts(BL_LIE, BL_SIT, up).map(([x, y], i) => [x, y + (i > 0 && i < 6 ? breathe : 0)] as V);
  return (
    <g>
      <Wall a="#2e4058" b="#4a5a70" floor={900} fa="#5a3a24" fb="#2a1a10" />
      <Window x={700} y={170} w={260} h={250} day={1} t={t0} />
      <rect x={-400} y={-400} width={1880} height={2000} fill="#ffe2a8" opacity={0.12} />
      <rect x={110} y={690} width={130} height={210} fill="#7a5236" stroke={INK} strokeWidth={5} />
      <rect x={122} y={720} width={106} height={70} rx={6} fill="#8a6449" stroke={INK} strokeWidth={4} />
      <AlarmClock x={180} y={650} ring={t > -0.5 && t < 1.6 ? 1 : 0} t={t0} txt="07:48" />
      {/* cama: cabeceira, colchão, travesseiro */}
      <rect x={250} y={540} width={40} height={360} rx={10} fill="#6b4a36" stroke={INK} strokeWidth={5} />
      <rect x={270} y={762} width={690} height={62} rx={10} fill="#e4e2f0" stroke={INK} strokeWidth={5} />
      <rect x={270} y={824} width={690} height={46} fill="#6b4a36" stroke={INK} strokeWidth={5} />
      <rect x={936} y={700} width={30} height={200} rx={8} fill="#6b4a36" stroke={INK} strokeWidth={5} />
      <ellipse cx={350} cy={738} rx={78} ry={30} fill="#f4f2fa" stroke={INK} strokeWidth={5} />
      <Person c={m} look={MARCOS} t={t0} />
      <path d={pathOf(bl)} fill="#5a6aa8" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      <path d={`M${pt(mixV([520, 760], [640, 790], up))} Q${pt(mixV([600, 770], [700, 784], up))} ${pt(mixV([700, 762], [780, 790], up))}`} stroke="#3e4a80" strokeWidth={4} fill="none" />
      {/* braço de fora por cima do cobertor quando deitado */}
      {up < 0.3 && (
        <g opacity={1 - up / 0.3}>
          {/* braço saindo do ombro, dobrado, com a mão descansando na barriga por cima do cobertor */}
          <path d="M418,716 Q470,684 530,700 Q560,708 584,718" stroke={INK} strokeWidth={37} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M418,716 Q470,684 530,700 Q560,708 584,718" stroke={SKIN} strokeWidth={28} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M418,716 Q446,698 478,694" stroke={INK} strokeWidth={43} strokeLinecap="butt" fill="none" />
          <path d="M418,716 Q446,698 478,694" stroke={MARCOS.shirt} strokeWidth={34} strokeLinecap="butt" fill="none" />
          <g transform="translate(590,720) rotate(20)"><ellipse cx={0} cy={-13} rx={9} ry={7} fill={SKIN} stroke={INK} strokeWidth={4} transform="rotate(-30)" /><ellipse cx={6} cy={0} rx={21} ry={16} fill={SKIN} stroke={INK} strokeWidth={4.5} /></g>
        </g>
      )}
      {t0 < 2.1 && <g opacity={1 - ramp(t0, 1.8, 2.1)}><Tag x={340} y={570} txt="MARCOS" p={t0 - 0.35} /></g>}
      {t > 1.25 && t < 2.6 && <text x={520} y={360} fontFamily={BARLOW} fontWeight={700} fontSize={130} fill={RED} stroke={INK} strokeWidth={5} opacity={1 - ramp(t, 2.3, 2.6)}>!</text>}
    </g>
  );
};
const CAM1 = (t0: number): Cam => { const t = t0 - T1; return { z: kf(t, [[-T1, 1.25], [1.0, 1.2], [1.5, 1.08]]), fx: kf(t, [[-T1, 480], [1.0, 480], [1.5, 590]]), fy: kf(t, [[-T1, 690], [1.5, 620]]) }; };

// --- casa (fundo comum). night: porta à direita, janela à esquerda
const House: React.FC<{ t: number; door: number; night: number }> = ({ t, door, night }) => (
  <g>
    <Wall a="#5a3a28" b="#7a5238" floor={930} fa="#5a3a24" fb="#2a1a10" />
    <Window x={night > 0.5 ? 110 : 760} y={250} w={230} h={220} day={night > 0.5 ? 0 : 1} t={t} />
    <Frame x={400} y={232} />
    <Door x={night > 0.5 ? 830 : 60} y={510} open={door} />
  </g>
);

// --- S2 casa vazia: foto da família, ele entra, se abaixa e pega o bilhete da mesa
const S2 = (t: number) => {
  const mk = (x: number): Ch => {
    const wx = kf(x, [[3.0, -120], [4.6, 450]]);
    const v = x < 3.0 ? 0 : x < 4.6 ? 1 - er(x, 4.25, 4.6) : 0;
    const bend = er(x, 4.7, 5.0) * (1 - er(x, 5.15, 5.45));
    const hold = er(x, 4.95, 5.05);
    const bl = blinkAt(x, 2.8, 0.2);
    const w = walkPose(wx + 120, v, 1);
    return base({
      x: wx, y: 646, k: 1, feet: w.feet, kneeDir: w.kneeDir, sy: w.sy + bend * 64, lean: w.lean + bend * 26,
      hands: v > 0.05 ? w.hands : [HANG[0], hold > 0.5 ? mixV([110, 60], [60, -150], er(x, 5.15, 5.5)) : mixV(HANG[1], [116, 60], bend)],
      holdR: hold > 0.5 ? <Note /> : undefined,
      face: F({ lx: x < 5.5 ? 0.6 : 0.2, ly: 0.2 + bend * 0.4, py: 0.5 + bend * 0.4, open: 1 - bl, curve: lerp(0.1, -0.35, er(x, 5.6, 6.0)), worry: er(x, 5.6, 6.0) * 0.6 }),
    });
  };
  const m = follow(mk, t);
  return (
    <g>
      <House t={t} door={0} night={0} />
      <ChairF x={650} seat={780} floor={942} s={0.9} />
      <ChairF x={830} seat={780} floor={942} s={0.9} />
      <Person c={m} look={MARCOS} t={t} />
      <Table x={720} y={706} w={420} floor={948} />
      <g transform="translate(830,712)"><ellipse cx={0} cy={0} rx={46} ry={14} fill="#f3efe7" stroke={INK} strokeWidth={4} /><ellipse cx={0} cy={-4} rx={34} ry={8} fill="#e8b84a" /></g>
      {t < 5.0 && <g transform="translate(590,716) rotate(-80) scale(0.8)"><Note /></g>}
      {t < 3.4 && <g opacity={1 - ramp(t, 3.1, 3.4)}><Tag x={516} y={196} txt="JULIANA" p={t - 2.3} s={0.34} /><Tag x={570} y={448} txt="LUCAS" p={t - 0.55} s={0.34} up /></g>}
    </g>
  );
};
const CAM2 = (t: number): Cam => ({ z: kf(t, [[0, 2.2], [3.0, 2.3], [3.7, 1.0]]), fx: kf(t, [[0, 510], [3.0, 510], [3.7, 470], [5.0, 560]]), fy: kf(t, [[0, 322], [3.0, 322], [3.7, 640]]) });

// --- S3 ônibus lotado: letreiro da linha, alças, barras amarelas, bancos, passageiros de verdade
const PAX1: Look = { id: "p1", shirt: "#5a8a5a", shirt2: "#4a744a", pants: "#3a3a44", shoes: "#222", hair: "#9a9a9a", style: "chefe", sleeve: 0.86, width: 0.9 };
const PAX2: Look = { id: "p2", shirt: "#7a5aa0", shirt2: "#64488a", pants: "#2e3040", shoes: "#222", hair: "#1a1a1a", style: "juliana", sleeve: 0.86, width: 0.72 };
const PAX3: Look = { id: "p3", shirt: "#d07a3a", shirt2: "#b0642c", pants: "#3f4a6a", shoes: "#222", hair: "#2a1a10", style: "marcos", sleeve: 0.86, width: 0.82 };
const strapAng = (t: number, i: number) => Math.sin(t * 3.1 + i * 0.7) * 8;
// centro da argola da alça i (pendurada em x, no teto y=196)
const ringPos = (x: number, t: number, i: number): V => { const a = (strapAng(t, i) * Math.PI) / 180; return [x - Math.sin(a) * 90, 196 + Math.cos(a) * 90]; };
const STRAPS = [250, 576, 862];
const toLocal = (w: V, cx: number, cy: number, k: number): V => [(w[0] - cx) / k, (w[1] - cy) / k];
const Strap: React.FC<{ x: number; t: number; i: number }> = ({ x, t, i }) => {
  const a = strapAng(t, i);
  return (
    <g transform={`rotate(${a} ${x} 196)`}>
      <rect x={x - 5} y={196} width={10} height={70} fill="#3a3a44" stroke={INK} strokeWidth={3} />
      <ellipse cx={x} cy={286} rx={18} ry={22} fill="none" stroke={INK} strokeWidth={13} />
      <ellipse cx={x} cy={286} rx={18} ry={22} fill="none" stroke="#e8e4d8" strokeWidth={7} />
    </g>
  );
};
const S3 = (t: number) => {
  const sw = (x: number, o = 0) => Math.sin(x * 3.1 + o);
  const m = follow((x) => base({
    x: 540 + sw(x) * 8, y: 690, k: 1, lean: sw(x) * 10, tilt: sw(x) * 3,
    hands: [[-86, -14], toLocal(ringPos(STRAPS[1], x, 1), 540 + sw(x) * 8, 690, 1)],
    face: F({ worry: 0.6, curve: -0.45, open: 0.8 - blinkAt(x, 2.4, 0.1) * 0.7, lx: -0.25, ly: 0.1, px: -0.4 }),
  }), t);
  const p3 = follow((x) => base({ x: 280 + sw(x, 0.6) * 8, y: 704, k: 0.94, lean: sw(x, 0.6) * 9, hands: [toLocal(ringPos(STRAPS[0], x, 0), 280 + sw(x, 0.6) * 8, 704, 0.94), [86, -14]], face: F({ lx: 0.4, px: 0.5, curve: -0.1, open: 0.85 - blinkAt(x, 3.1, 1) * 0.7 }) }), t);
  const p2 = follow((x) => base({ x: 820 + sw(x, 1.2) * 8, y: 716, k: 0.9, lean: sw(x, 1.2) * 9, hands: [[-60, -170], toLocal(ringPos(STRAPS[2], x, 2), 820 + sw(x, 1.2) * 8, 716, 0.9)], holdL: <PhoneS />, face: F({ ly: 0.5, py: 1, lx: -0.2, curve: 0.05 }) }), t);
  const p1 = follow((x) => base({ x: 120, y: 790, k: 0.9, sit: 1, hands: [[-40, -110], [40, -110]], holdR: <rect x={-60} y={-40} width={100} height={70} fill="#ecead8" stroke={INK} strokeWidth={4} transform="rotate(-6)" />, face: F({ ly: 0.6, py: 1, curve: -0.1, open: 0.7 }) }), t);
  return (
    <g>
      <Wall a="#5f7684" b="#7c909c" floor={980} fa="#3c4248" fb="#1c2024" />
      {/* letreiro da linha */}
      <rect x={330} y={70} width={420} height={70} rx={10} fill="#141414" stroke={INK} strokeWidth={5} />
      <text x={540} y={120} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={40} fill="#ffb02a" style={{ filter: "drop-shadow(0 0 6px #ffb02a)" }}>312 · CENTRO</text>
      {/* janelas com a cidade passando */}
      {[0, 1, 2].map((i) => <Window key={i} x={50 + i * 340} y={330} w={300} h={200} day={1} t={t} scroll={t * 520 + i * 200} />)}
      {/* faixa de anúncios e barra do teto */}
      {[0, 1, 2].map((i) => <rect key={i} x={70 + i * 340} y={240} width={260} height={56} rx={8} fill={["#e8b84a", "#7cc4ff", "#ff9a8a"][i]} stroke={INK} strokeWidth={4} opacity={0.9} />)}
      <rect x={-400} y={186} width={1880} height={18} rx={8} fill="#c8c8c0" stroke={INK} strokeWidth={4} />
      {STRAPS.map((x, i) => <Strap key={x} x={x} t={t} i={i} />)}
      {/* bancos do fundo */}
      {[0, 1].map((i) => <g key={i}><rect x={40 + i * 160} y={640} width={140} height={160} rx={18} fill="#3f6aa8" stroke={INK} strokeWidth={5} /><rect x={30 + i * 160} y={790} width={160} height={40} rx={10} fill="#355a90" stroke={INK} strokeWidth={5} /></g>)}
      <Person c={p1} look={PAX1} t={t} />
      {/* piso canelado */}
      {Array.from({ length: 9 }).map((_, i) => <line key={i} x1={-100} y1={1000 + i * 26} x2={1180} y2={1000 + i * 26} stroke="#2a2e32" strokeWidth={4} />)}
      <Person c={p3} look={PAX3} t={t} />
      <Person c={p2} look={PAX2} t={t} />
      <Person c={m} look={MARCOS} t={t} />
      {STRAPS.map((x, i) => { const r = ringPos(x, t, i); return <ellipse key={i} cx={r[0]} cy={r[1] - 4} rx={18} ry={8} fill="none" stroke="#e8e4d8" strokeWidth={6} />; })}
      {/* barras amarelas e botão de parada em primeiro plano */}
      {[110, 960].map((x) => <rect key={x} x={x} y={196} width={22} height={900} rx={8} fill="#e8c840" stroke={INK} strokeWidth={5} />)}
      <rect x={946} y={600} width={50} height={60} rx={10} fill="#c43d30" stroke={INK} strokeWidth={4} />
      <text x={971} y={638} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={18} fill="#fff">PARE</text>
    </g>
  );
};
const CAM3 = (t: number): Cam => ({ z: 1.0 + Math.sin(t * 6) * 0.004, fx: 540 + Math.sin(t * 9) * 4, fy: 600 + Math.sin(t * 11) * 4 });

// --- escritório (S4, S5, S6)
const Office: React.FC<{ t: number }> = ({ t }) => (
  <g>
    <Wall a="#4a5260" b="#5e6676" floor={940} fa="#3a3e46" fb="#1e2026" />
    {[0, 1, 2, 3].map((i) => <rect key={i} x={-200 + i * 380} y={120} width={200} height={40} rx={6} fill="#f4f6ff" opacity={0.6} />)}
    <rect x={720} y={260} width={240} height={160} rx={6} fill="#2a2f3a" stroke={INK} strokeWidth={5} />
    <path d="M740,400 L790,350 L830,370 L880,300 L940,330" stroke={RED} strokeWidth={6} fill="none" />
    <circle cx={260} cy={300} r={56} fill="#f4f1ea" stroke={INK} strokeWidth={6} />
    <line x1={260} y1={300} x2={260} y2={262} stroke={INK} strokeWidth={6} strokeLinecap="round" />
    <line x1={260} y1={300} x2={292} y2={312} stroke={INK} strokeWidth={6} strokeLinecap="round" />
    {void t}
  </g>
);
const DeskOffice: React.FC<{ papers: number; envelope: number; phoneBuzz: number; t: number }> = ({ papers, envelope, phoneBuzz, t }) => (
  <g>
    <path d="M190,850 L890,850 L930,900 L150,900 Z" fill="#8a8f9a" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
    <rect x={150} y={900} width={780} height={30} fill="#6a6f7a" stroke={INK} strokeWidth={5} />
    <rect x={170} y={930} width={740} height={300} fill="#5a5f6a" stroke={INK} strokeWidth={5} />
    {/* monitor de costas e pilha de papel */}
    <rect x={640} y={690} width={210} height={150} rx={10} fill="#3d404e" stroke={INK} strokeWidth={5} />
    <rect x={725} y={840} width={40} height={20} fill="#3d404e" stroke={INK} strokeWidth={4} />
    {Array.from({ length: papers }).map((_, i) => <rect key={i} x={230 + ((i * 7) % 11) - 5} y={846 - i * 12} width={110} height={12} fill={i % 2 ? "#ece7da" : "#f6f2e8"} stroke={INK} strokeWidth={2.5} />)}
    {envelope > 0 && <g transform={`translate(${lerp(980, 470, envelope)},${lerp(700, 860, envelope)}) rotate(${lerp(-40, -6, envelope)})`}><rect x={-60} y={-34} width={120} height={68} fill="#e9d9b0" stroke={INK} strokeWidth={4} /><path d="M-60,-34 L0,6 L60,-34" stroke={INK} strokeWidth={4} fill="none" /><text x={0} y={26} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={20} fill="#6a4426">SALÁRIO</text></g>}
    {phoneBuzz >= 0 && <g transform={`translate(${590 + (phoneBuzz > 0 ? Math.sin(t * 80) * 3 : 0)},862) rotate(80)`}><PhoneS glow={phoneBuzz > 0 ? 1 : 0.2} /></g>}
  </g>
);
const marcosDesk = (x: number, typing: number, o: Partial<Ch> = {}): Ch => base({
  x: 540, y: 980, k: 1, legs: false,
  hands: [[-60 + Math.sin(x * 7) * 6 * typing, -112 - (0.5 - 0.5 * Math.cos(x * 9)) * 12 * typing], [60 + Math.sin(x * 6 + 2) * 6 * typing, -112 - (0.5 - 0.5 * Math.cos(x * 9 + 2.4)) * 12 * typing]],
  face: F({ ly: 0.35, py: 0.6, open: 0.8 - blinkAt(x, 2.6, 0.3) * 0.7, worry: 0.45, curve: -0.35 }),
  ...o,
});
const S4 = (t: number) => {
  const m = follow((x) => { const c = marcosDesk(x, 0.6); c.sy = Math.sin(x * 2) * 3 + er(x, 2.2, 2.8) * 10; c.face.curve = lerp(-0.35, -0.55, er(x, 2.2, 2.8)); return c; }, t);
  return (<g><Office t={t} /><Person c={m} look={MARCOS} t={t} /><DeskOffice papers={10} envelope={0} phoneBuzz={-1} t={t} /></g>);
};
const CAM4 = (t: number): Cam => ({ z: kf(t, [[0, 1.0], [3.6, 1.12]]), fx: 540, fy: 680 });
// núcleo da cena do chefe (tempo próprio: entra 0,2–1,0; grita a partir de 1,55)
const bossAt = (x: number): Ch => {
  const wx = kf(x, [[0.2, 1220], [1.0, 860]]);
  const v = x < 1.0 ? 1 - er(x, 0.85, 1.0) : 0;
  const yell = 0.6 + 0.4 * Math.sin(x * 18);
  const slam = er(x, 1.6, 1.75) * (1 - er(x, 1.95, 2.25));
  const w = walkPose((1220 - wx) / 1.04, v, -1);
  return base({
    x: wx, y: 690, k: 1.04, feet: w.feet, kneeDir: -1, lean: -12, sy: w.sy,
    hands: x < 1.0 ? w.hands : [mixV([-86, -14], [-150, -170 + slam * 120], er(x, 1.4, 1.6)), mixV([86, -14], [92 + Math.sin(x * 9) * 10, -200 + Math.sin(x * 9) * 20], er(x, 1.3, 1.6))],
    face: F({ lx: -0.7, px: -1, worry: -0.9, raise: -0.2, mo: x > 1.55 ? yell : 0, curve: -0.4, eyeS: 1.1 }),
    red: er(x, 1.5, 1.9), tremble: x > 1.7 ? 0.6 : 0,
  });
};
const marcosBoss = (x: number): Ch => { const s = er(x, 1.5, 1.8); const c = marcosDesk(x, 0, { sy: s * 26, hy: s * 10, tilt: s * -6 }); c.hands = [[-90, -120], [90, -120]]; c.face = F({ lx: er(x, 0.4, 0.8) * 0.6, px: er(x, 0.4, 0.8), open: s > 0.5 ? 0.25 : 0.8, worry: lerp(0.45, 0.9, er(x, 0.6, 1.0)), curve: -0.6, raise: 0.2 }); c.tremble = s > 0.5 ? 0.4 : 0; return c; };
const BossScene = (x: number) => {
  const m = follow(marcosBoss, x);
  const ch = follow(bossAt, x);
  return { m, ch, papers: 10 + (x > 1.75 ? 6 : 0) };
};
const FREEZE = 1.05;
const S5 = (t: number) => {
  const x = Math.min(t, FREEZE);
  const { m, ch, papers } = BossScene(x);
  const fz = er(t, FREEZE, FREEZE + 0.15);
  const pop = t - FREEZE - 0.15;
  return (
    <g>
      <Office t={x} />
      <Person c={m} look={MARCOS} t={x} />
      <Person c={ch} look={CHEFE} t={x} />
      <DeskOffice papers={papers} envelope={0} phoneBuzz={-1} t={x} />
      {/* cena congelada: tudo escurece e dessatura, só o chefe fica em destaque */}
      <rect x={-400} y={-400} width={1880} height={2400} fill="#0a0e18" opacity={fz * 0.62} />
      <defs><clipPath id="aboveDesk"><rect x={-400} y={-400} width={1880} height={1252} /></clipPath></defs>
      {fz > 0 && <g clipPath="url(#aboveDesk)"><Person c={ch} look={CHEFE} t={x} /></g>}
      {fz > 0 && (
        <g opacity={fz}>
          {[0, 1].map((i) => <rect key={i} x={-400} y={i ? 1140 : -400} width={1880} height={i ? 600 : 460} fill="#000" opacity={0.7} />)}
          <g transform={`translate(${ch.x - 262},${300}) scale(${0.85 * backPop(pop)})`}>
            <rect x={-190} y={-62} width={380} height={124} rx={16} fill="#14100c" stroke={GOLD} strokeWidth={6} />
            <text x={0} y={-6} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={62} fill={WHITE} letterSpacing={2}>SEU ROBERTO</text>
            <text x={0} y={44} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={38} fill={GOLD} letterSpacing={3}>O CHEFE</text>
            <path d="M190,-14 L224,0 L190,14 Z" fill={GOLD} stroke={INK} strokeWidth={4} />
          </g>
        </g>
      )}
    </g>
  );
};
const CAM5 = (t: number): Cam => ({ z: kf(t, [[0, 1.0], [FREEZE, 1.0], [FREEZE + 0.4, 1.3]]), fx: kf(t, [[0, 600], [FREEZE, 600], [FREEZE + 0.4, 760]]), fy: kf(t, [[0, 640], [FREEZE, 640], [FREEZE + 0.4, 560]]) });
// S5b: descongela e vem a bronca (mesmo tempo da cena, a partir do congelamento)
const S5b = (t: number) => {
  const x = t + FREEZE + 0.1;
  const { m, ch, papers } = BossScene(x);
  return (
    <g>
      <Office t={x} />
      <Person c={m} look={MARCOS} t={x} />
      <Person c={ch} look={CHEFE} t={x} />
      <DeskOffice papers={papers} envelope={0} phoneBuzz={-1} t={x} />
      {x > 1.65 && [0, 1, 2].map((i) => <path key={i} d={`M${700 - i * 10},${300 + i * 40} l-${40 + i * 10},-${20 - i * 10}`} stroke={RED} strokeWidth={8} strokeLinecap="round" opacity={0.5 + 0.5 * Math.sin(x * 20 + i)} />)}
      {x > 1.7 && <text x={300} y={290} fontFamily={BARLOW} fontWeight={700} fontSize={90} fill={RED} stroke={INK} strokeWidth={4} transform={`rotate(-8 300 290) scale(${1 + Math.sin(x * 18) * 0.03})`}>!!!</text>}
    </g>
  );
};
const CAM5b = (t: number): Cam => ({ z: 1.0 + Math.sin(t * 40) * 0.004, fx: 600, fy: 640 });
const S6 = (t: number) => {
  const buzz = t > 1.1 && t < 1.8 ? 1 : 0;
  const m = follow((x) => {
    const grab = er(x, 1.6, 2.0);
    const c = marcosDesk(x, 0);
    c.hands = [[-60, -112], mixV([60, -112], [60, -200], grab)];
    c.holdR = grab > 0.5 ? <PhoneS /> : undefined;
    const happy = er(x, 2.1, 2.6);
    c.face = F({ ly: lerp(0.3, 0.45, grab), py: lerp(0.4, 0.9, grab), lx: x < 1.0 ? kf(x, [[0, 0.6], [0.9, 0.3]]) : 0.1, curve: lerp(-0.35, 0.55, happy), worry: lerp(0.4, 0, happy), raise: happy * 0.3, open: 1 - blinkAt(x, 2.5, 0.8) });
    c.sy = -happy * 6;
    return c;
  }, t);
  const ch = follow((x) => {
    const wx = kf(x, [[0, 860], [0.5, 860], [1.2, 1240]]);
    const v = x > 0.5 ? 1 : 0;
    const w = walkPose((wx - 860) / 1.04, v, 1);
    return base({ x: wx, y: 690, k: 1.04, feet: w.feet, kneeDir: 1, sy: w.sy, lean: w.lean, hands: x < 0.5 ? [[-86, -14], kv(x, [[0, [92, -200]], [0.35, [60, -60]]])] : w.hands, face: F({ lx: x < 0.5 ? -0.7 : 0.7, worry: -0.5, curve: -0.3 }) });
  }, t);
  const note = backPop(t - 1.2) * (1 - er(t, 3.0, 3.3));
  return (
    <g>
      <Office t={t} />
      <Person c={m} look={MARCOS} t={t} />
      {t < 1.3 && <Person c={ch} look={CHEFE} t={t} />}
      <DeskOffice papers={14} envelope={0} phoneBuzz={t < 1.6 ? buzz : -1} t={t} />
      {note > 0 && (
        <g transform={`translate(540,330) scale(${note})`}>
          <rect x={-250} y={-58} width={500} height={116} rx={22} fill="#fdfbf4" stroke={INK} strokeWidth={6} />
          <circle cx={-190} cy={0} r={34} fill={GREEN} stroke={INK} strokeWidth={4} />
          <text x={-190} y={14} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={40} fill="#fff">R$</text>
          <text x={-140} y={-10} fontFamily={BARLOW} fontWeight={700} fontSize={32} fill="#2a2836">SALÁRIO RECEBIDO</text>
          <text x={-140} y={34} fontFamily={MONO} fontWeight={800} fontSize={34} fill="#2f9a5a">+ R$ 2.300,00</text>
        </g>
      )}
    </g>
  );
};
const CAM6 = (t: number): Cam => ({ z: kf(t, [[0, 1.0], [1.8, 1.0], [3.4, 1.18]]), fx: 540, fy: kf(t, [[0, 640], [3.4, 600]]) });

// --- casa à noite: Marcos sentado na cadeira (pernas aparecem), mesa ao lado, porta à direita
const BILLS: [string, string, string, number][] = [["ÁGUA", "R$ 120", "💧", 1.25], ["LUZ", "R$ 190", "⚡", 2.0], ["INTERNET", "R$ 100", "📶", 2.65], ["ALUGUEL", "R$ 900", "🏠", 3.45], ["MERCADO", "R$ 650", "🛒", 4.2], ["REMÉDIOS", "R$ 340", "💊", 4.95]];
const BILL_POS: V[] = [[250, 300], [540, 225], [830, 300], [250, 520], [830, 520], [830, 740]];
const FLOOR_N = 1012, SEAT_X = 545, SEAT_Y = 852;
const marcosChair = (x: number, o: Partial<Ch> = {}): Ch => base({
  x: SEAT_X, y: SEAT_Y - 12, k: 1, sit: 1, lean: 0,
  hands: [[-70, -26], [36, -170]], holdR: <PhoneS />,
  face: F({ ly: 0.45, py: 0.9, worry: 0.5, curve: -0.3, open: 1 - blinkAt(x, 2.7, 0.4) }), ...o,
});
const HouseNight: React.FC<{ t: number; door: number }> = ({ t, door }) => (
  <g>
    <House t={t} door={door} night={1} />
    <g transform="translate(540,150)">
      <line x1={0} y1={-200} x2={0} y2={0} stroke={INK} strokeWidth={5} />
      <path d="M-70,40 L70,40 L40,0 L-40,0 Z" fill="#e8c890" stroke={INK} strokeWidth={5} />
    </g>
    <defs><radialGradient id="lampH" cx="540" cy="260" r="700" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ffcf8a" stopOpacity={0.45} /><stop offset="1" stopColor="#ffcf8a" stopOpacity={0} /></radialGradient></defs>
    <rect x={-400} y={-400} width={1880} height={2000} fill="#0a0604" opacity={0.25} />
    <rect x={-400} y={-400} width={1880} height={2000} fill="url(#lampH)" style={{ mixBlendMode: "screen" }} />
  </g>
);
// mobília da noite: cadeira atrás do Marcos, mesa à esquerda dele (desenhada depois para a mão ficar em cima)
const NightChair: React.FC = () => <ChairF x={SEAT_X} seat={SEAT_Y} floor={FLOOR_N} />;
const NightTable: React.FC<{ papers?: number }> = ({ papers = 0 }) => (
  <g>
    <Table x={SEAT_X} y={812} w={440} floor={FLOOR_N} />
    {/* toalha de mesa caindo na frente (esconde as pernas dele, que está sentado atrás) */}
    <path d={`M${SEAT_X - 232},${852} L${SEAT_X + 232},${852} L${SEAT_X + 240},${972} Q${SEAT_X + 200},${990} ${SEAT_X + 160},${972} Q${SEAT_X + 120},${990} ${SEAT_X + 80},${972} Q${SEAT_X + 40},${990} ${SEAT_X},${972} Q${SEAT_X - 40},${990} ${SEAT_X - 80},${972} Q${SEAT_X - 120},${990} ${SEAT_X - 160},${972} Q${SEAT_X - 200},${990} ${SEAT_X - 240},${972} Z`} fill="#e8dcc4" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
    {[-160, -80, 0, 80, 160].map((dx) => <line key={dx} x1={SEAT_X + dx} y1={856} x2={SEAT_X + dx} y2={970} stroke="#c8b898" strokeWidth={4} />)}
    <rect x={SEAT_X - 232} y={872} width={464} height={12} fill="#b8483c" opacity={0.8} />
    {Array.from({ length: papers }).map((_, i) => <rect key={i} x={SEAT_X - 190 + ((i * 53) % 120)} y={816 + (i % 3) * 6} width={60} height={12} fill="#fdfbf4" stroke={INK} strokeWidth={2.5} transform={`rotate(${((i * 23) % 30) - 15} ${SEAT_X - 160 + ((i * 53) % 120)} 822)`} />)}
  </g>
);
const S7 = (t: number) => {
  const m = follow((x) => {
    const c = marcosChair(x);
    const tap = BILLS.some(([, , , s0]) => x > s0 - 0.15 && x < s0 + 0.05);
    c.hands = [[-70, -26], [36, tap ? -190 : -170]];
    const n = BILLS.filter(([, , , s0]) => x > s0).length;
    c.face.worry = 0.4 + n * 0.08; c.face.curve = -0.2 - n * 0.07; c.sy = n * 3;
    return c;
  }, t);
  const n = BILLS.filter(([, , , s0]) => t > s0).length;
  return (
    <g>
      <HouseNight t={t} door={0} />
      <NightChair />
      <Person c={m} look={MARCOS} t={t} />
      <NightTable papers={n} />
      {BILLS.map(([l, v, ic, s0], i) => {
        const pop = backPop(t - (s0 - 0.35));
        if (pop <= 0) return null;
        return <g key={i} transform={`translate(${BILL_POS[i][0]},${BILL_POS[i][1]}) rotate(${(i % 2 ? 1 : -1) * 4})`}><Bill label={l} val={v} icon={ic} paid={er(t, s0, s0 + 0.18)} pop={pop} /></g>;
      })}
      {lightRoom(0.5)}
    </g>
  );
};
const CAM7 = (t: number): Cam => ({ z: kf(t, [[0, 1.1], [6.6, 1.04]]), fx: 545, fy: 620 });

// Lucas entra pela porta da direita e fica ao lado do pai
const LUCAS_X = 830, LUCAS_Y = FLOOR_N - 296 * 0.68;
const lucasAt = (x: number, mode: "run" | "ask" | "sad"): Ch => {
  const bl = blinkAt(x, 2.3, 0.6);
  if (mode === "run") {
    const wx = kf(x, [[0.2, 930], [1.7, LUCAS_X]]);
    const v = x < 0.2 ? 0 : x < 1.7 ? 1 - er(x, 1.45, 1.7) : 0;
    const w = walkPose((930 - wx) / 0.68, v, -1);
    return base({ x: wx, y: LUCAS_Y, k: 0.68, feet: w.feet, kneeDir: -1, sy: w.sy * 1.6, lean: w.lean * 1.4, hands: w.hands, face: F({ lx: -0.6, px: -0.8, curve: 0.9, mo: 0.45, raise: 0.4, open: 1 - bl }) });
  }
  if (mode === "ask") {
    const bounce = Math.abs(Math.sin(x * 7)) * 10;
    const show = er(x, 1.4, 1.8);
    return base({ x: LUCAS_X, y: LUCAS_Y - bounce, k: 0.68, hands: [mixV([-40, -130], [-90, -240], show), mixV([40, -130], [60, -150], show)], holdL: show > 0.4 ? <Bilhete /> : undefined, face: F({ lx: -0.6, px: -1, curve: 0.95, mo: 0.35 + 0.25 * Math.sin(x * 14), raise: 0.6, open: 1 - bl, eyeS: 1.1 }) });
  }
  const fall = er(x, 0.6, 1.3);
  return base({ x: LUCAS_X, y: LUCAS_Y + fall * 6, k: 0.68, hands: [mixV([-90, -240], [-80, -40], fall), mixV([60, -150], [86, -14], fall)], holdL: fall < 0.9 ? <Bilhete /> : undefined, face: F({ lx: lerp(-0.6, -0.1, fall), ly: fall * 0.6, py: fall, curve: lerp(0.9, -0.7, fall), worry: fall, mo: 0, open: 1 - bl, wide: fall * 0.8 }), tilt: fall * -8, hy: fall * 14 });
};
const marcosLooks = (x: number, look: number): Ch => {
  const c = marcosChair(x);
  c.face.lx = look * 0.7; c.face.px = look; c.face.ly = lerp(0.45, 0, look); c.face.py = lerp(0.9, 0, look);
  c.face.curve = lerp(-0.3, 0.25, look); c.face.worry = lerp(0.6, 0.2, look);
  c.hands = [[-70, -26], mixV([36, -170], [70, -26], look)]; c.holdR = look > 0.5 ? undefined : <PhoneS />;
  return c;
};
const S8 = (t: number) => {
  const door = er(t, 0.05, 0.35);
  const m = follow((x) => marcosLooks(x, er(x, 0.4, 0.8)), t);
  const l = follow((x) => lucasAt(x, "run"), t);
  return (<g><HouseNight t={t} door={door} /><NightChair /><Person c={m} look={MARCOS} t={t} /><NightTable papers={6} /><Person c={l} look={LUCAS} t={t} />{lightRoom(0.5)}</g>);
};
const CAM8 = (t: number): Cam => ({ z: 1.1, fx: kf(t, [[0, 700], [1.8, 680]]), fy: 660 });
const S9 = (t: number) => {
  const m = follow((x) => { const c = marcosLooks(x, 1); c.face = F({ lx: 0.7, px: 1, curve: lerp(0.3, 0.05, er(x, 2.2, 3.2)), worry: lerp(0.2, 0.55, er(x, 2.2, 3.2)), open: 1 - blinkAt(x, 2.4, 0.9), raise: 0.2 }); return c; }, t);
  const l = follow((x) => lucasAt(x, "ask"), t);
  return (<g><HouseNight t={t} door={1} /><NightChair /><Person c={m} look={MARCOS} t={t} /><NightTable papers={6} /><Person c={l} look={LUCAS} t={t} />{lightRoom(0.5)}</g>);
};
const CAM9 = (t: number): Cam => ({ z: kf(t, [[0, 1.2], [4.6, 1.32]]), fx: 690, fy: kf(t, [[0, 680], [4.6, 660]]) });

// --- S10/S11: o extrato no celular
const S10 = (t: number, zerado: boolean) => {
  const load = zerado ? 1 : er(t, 0.5, 1.8);
  const hit = zerado ? backPop(t) : 0;
  const shake = zerado && t < 0.5 ? Math.sin(t * 90) * 10 * (1 - t / 0.5) : 0;
  return (
    <g>
      <rect x={-400} y={-400} width={1880} height={2400} fill="#140c08" />
      <g transform={`translate(${540 + shake},590) rotate(-3)`}>
        <rect x={-300} y={-520} width={600} height={1060} rx={60} fill="#15161c" stroke={INK} strokeWidth={8} />
        <rect x={-270} y={-480} width={540} height={980} rx={30} fill="#f4f6fb" />
        <text x={-230} y={-400} fontFamily={BARLOW} fontWeight={700} fontSize={48} fill="#2a2836">EXTRATO</text>
        {BILLS.map(([l, v], i) => (
          <g key={i} opacity={clamp01(load * 7 - i)}>
            <text x={-230} y={-300 + i * 70} fontFamily={BARLOW} fontWeight={600} fontSize={36} fill="#55525f">{l}</text>
            <text x={230} y={-300 + i * 70} textAnchor="end" fontFamily={MONO} fontWeight={800} fontSize={32} fill={RED}>- {v}</text>
          </g>
        ))}
        <line x1={-230} y1={150} x2={230} y2={150} stroke="#c8ccd8" strokeWidth={3} />
        <text x={-230} y={220} fontFamily={BARLOW} fontWeight={700} fontSize={40} fill="#2a2836">SALDO</text>
        {!zerado && <text x={0} y={340} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={60} fill="#9aa0b2">{t > 1.2 ? "R$ ..." : ""}</text>}
        {zerado && (
          <g transform={`translate(0,330) scale(${hit})`}>
            <text x={0} y={0} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={110} fill={RED}>R$ 0,00</text>
            <rect x={-200} y={40} width={400} height={70} rx={12} fill={RED} stroke={INK} strokeWidth={5} transform="rotate(-6)" />
            <text x={0} y={92} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={56} fill="#fff" transform="rotate(-6)">ZERADO</text>
          </g>
        )}
      </g>
      {zerado && <rect x={-400} y={-400} width={1880} height={2400} fill={RED} opacity={0.25 * (1 - ramp(t, 0, 0.6))} />}
    </g>
  );
};
const CAM10 = (t: number): Cam => ({ z: kf(t, [[0, 0.92], [2.0, 1.0]]), fx: 540, fy: 590 });
const CAM11 = (t: number): Cam => ({ z: kf(t, [[0, 1.12], [1.8, 1.2]]), fx: 540, fy: 680 });

// --- S12 diz não
const S12 = (t: number) => {
  const m = follow((x) => {
    const c = marcosLooks(x, 1);
    const shake = Math.sin((x - 0.5) * 9) * er(x, 0.5, 0.7) * (1 - er(x, 1.6, 1.9));
    c.hx = shake * 16; c.tilt = shake * 5;
    c.face = F({ lx: 0.6 + shake * 0.2, px: 1, worry: 1, curve: -0.6, open: 0.75 - blinkAt(x, 2, 0.2) * 0.6, ly: 0.2, wide: 0.4 });
    c.sy = 10;
    return c;
  }, t);
  const l = follow((x) => lucasAt(x, "sad"), t);
  return (<g><HouseNight t={t} door={1} /><NightChair /><Person c={m} look={MARCOS} t={t} /><NightTable papers={6} /><Person c={l} look={LUCAS} t={t} />{lightRoom(0.4)}</g>);
};
const CAM12 = (t: number): Cam => ({ z: kf(t, [[0, 1.25], [2.6, 1.36]]), fx: 690, fy: 670 });

// --- S13 o olhar da Juliana (na porta da direita, chegando do trabalho)
const JUL_Y = FLOOR_N - 296 * 0.95;
const S13 = (t: number) => {
  const j = follow((x) => {
    const bl = blinkAt(x, 3.0, 1.1);
    return base({ x: 870, y: JUL_Y, k: 0.95, hands: [[-40, -170], [86, -14]], holdL: <rect x={-20} y={-10} width={40} height={90} rx={8} fill="#6a4a3a" stroke={INK} strokeWidth={4} />, face: F({ lx: -0.55, px: -0.9, worry: kf(x, [[0, 0.3], [1.4, 1.0]]), curve: kf(x, [[0, 0.1], [1.4, -0.4]]), open: kf(x, [[0, 1], [2.4, 0.75]]) - bl * 0.6, wide: er(x, 2.2, 3.0) * 0.9, raise: 0.2, eyeS: 1.08 }), tilt: kf(x, [[0, 0], [2.4, 6]]), sy: er(x, 2.4, 3.4) * 6 });
  }, t);
  const m = follow((x) => { const c = marcosLooks(x, 1); c.face = F({ lx: 0.75, px: 1, worry: 0.9, curve: -0.5, open: 0.8 - blinkAt(x, 2.2, 0.5) * 0.7 }); c.sy = 10; return c; }, t);
  return (<g><HouseNight t={t} door={1} /><NightChair /><Person c={m} look={MARCOS} t={t} /><NightTable papers={6} /><Person c={j} look={JULIANA} t={t} />{lightRoom(0.4)}</g>);
};
const CAM13 = (t: number): Cam => ({ z: kf(t, [[0, 1.0], [0.8, 1.0], [2.0, 1.8]]), fx: kf(t, [[0, 640], [0.8, 640], [2.0, 860]]), fy: kf(t, [[0, 620], [2.0, 430]]) });

// --- S14/S15: decide e se levanta da cadeira, punhos fechados ao lado do corpo, queixo erguido
const S14 = (t: number, end: boolean) => {
  const m = follow((x) => {
    const d = end ? 1 : er(x, 1.0, 2.2);
    const st = end ? 1 : er(x, 2.3, 3.1);
    const c = marcosChair(x); c.holdR = undefined;
    c.sit = 1 - st;
    c.y = lerp(SEAT_Y - 12, FLOOR_N - 296, st);
    c.lean = 0;
    c.hands = st < 0.05 ? [[-70, -26], [70, -26]] : [mixV([-70, -26], [-92, -20], st), mixV([70, -26], [92, -20], st)];
    const firm = end ? 1 : er(x, 3.1, 3.6);
    c.tremble = firm > 0.5 && firm < 0.98 ? 0.15 : 0;
    c.face = F({ lx: lerp(0.1, 0, d), ly: lerp(0.35, -0.08, d), py: lerp(0.6, -0.1, d), worry: lerp(0.9, -0.55, d), curve: lerp(-0.5, -0.05, d), open: lerp(0.75, 0.84, d) - blinkAt(x + (end ? 9 : 0), 3.2, 0.7) * 0.7, raise: lerp(0, -0.25, d) });
    c.sy = lerp(10, -8, d);
    return c;
  }, t);
  const glow = end ? 1 : er(t, 1.2, 3.0);
  return (
    <g>
      <HouseNight t={t} door={0} />
      <defs><radialGradient id="rim" cx={SEAT_X} cy="420" r="520" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ffcf6a" stopOpacity={0.5} /><stop offset="1" stopColor="#ffcf6a" stopOpacity={0} /></radialGradient></defs>
      <rect x={-400} y={-400} width={1880} height={2400} fill="url(#rim)" opacity={glow} style={{ mixBlendMode: "screen" }} />
      <NightChair />
      <Person c={m} look={MARCOS} t={t} />
      <NightTable papers={6} />
    </g>
  );
};
const CAM14 = (t: number): Cam => ({ z: kf(t, [[0, 1.25], [2.2, 1.35], [3.3, 1.6], [4.6, 1.8]]), fx: SEAT_X, fy: kf(t, [[0, 600], [2.2, 590], [3.3, 470], [4.6, 450]]) });
const CAM15 = (t: number): Cam => ({ z: 1.8 + t * 0.02, fx: SEAT_X, fy: 450 });

const SCENES: [(t: number) => React.ReactNode, (t: number) => Cam][] = [
  [S1, CAM1], [S2, CAM2], [S3, CAM3], [S4, CAM4], [S5, CAM5], [S5b, CAM5b], [S6, CAM6], [S7, CAM7], [S8, CAM8],
  [S9, CAM9], [(t) => S10(t, false), CAM10], [(t) => S10(t, true), CAM11], [S12, CAM12], [S13, CAM13], [(t) => S14(t, false), CAM14], [(t) => S14(t, true), CAM15],
];

// ------------------------------------------------------------------ legenda palavra por palavra
const Caption: React.FC<{ t: number }> = ({ t }) => {
  const s = sceneOf(t);
  const [txt, , st, dur] = LINES[s];
  const t0 = ST[s] + st;
  const words = txt.split(" ");
  const total = txt.replace(/ /g, "").length;
  let acc = 0;
  const times = words.map((w) => { const a = t0 + (acc / total) * dur; acc += w.length; return a; });
  // blocos de até ~22 caracteres
  const chunks: number[][] = [];
  let cur: number[] = [], len = 0;
  words.forEach((w, i) => { if (len + w.length > 22 && cur.length) { chunks.push(cur); cur = []; len = 0; } cur.push(i); len += w.length + 1; if (/[.!?:]$/.test(w) && len > 10) { chunks.push(cur); cur = []; len = 0; } });
  if (cur.length) chunks.push(cur);
  const idx = Math.max(0, chunks.findIndex((c, i) => t < (chunks[i + 1] ? times[chunks[i + 1][0]] : 1e9)));
  if (t < t0 - 0.05 || t > t0 + dur + 0.8) return null;
  return (
    <div style={{ position: "absolute", left: 120, right: 120, top: 1330, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 72, lineHeight: 1.05, letterSpacing: 1 }}>
      {chunks[idx].map((i) => {
        const a = times[i];
        const p = clamp01((t - a) / 0.12);
        const clean = words[i].toLowerCase().replace(/[^a-zà-ú]/g, "");
        const key = KEY.includes(clean);
        return (
          <span key={i} style={{ display: "inline-block", margin: "0 9px", color: key ? GOLD : WHITE, opacity: p, transform: `translateY(${(1 - p) * 14}px)`, WebkitTextStroke: "10px #0a0604", paintOrder: "stroke fill", textShadow: "0 4px 12px rgba(0,0,0,.6)" }}>
            {words[i].toUpperCase()}
          </span>
        );
      })}
    </div>
  );
};

// ------------------------------------------------------------------ raiz
const SCENE_Y = 330, SCENE_H = 1260;
export const MarcosDia1: React.FC = () => {
  useFonts();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const s = sceneOf(t);
  const lt = t - ST[s];
  const [draw, cam] = SCENES[s];
  const c = cam(lt);
  const flash = s > 0 ? Math.max(0, 1 - lt / 0.14) * 0.18 : 0;
  const endP = s === 15 ? er(lt, 0.3, 0.8) : 0;
  const endP2 = s === 15 ? er(lt, 1.4, 1.9) : 0;
  return (
    <AbsoluteFill style={{ background: "#0a0605" }}>
      {LINES.map(([, n, st], i) => (
        <Sequence key={n} from={Math.round((ST[i] + st) * fps)}><Audio src={staticFile(`marcos_dia1/fala/n${n}.wav`)} /></Sequence>
      ))}
      <Audio src={staticFile("marcos_dia1/sfx.wav")} volume={0.45} />
      <div style={{ position: "absolute", left: 0, top: SCENE_Y, width: 1080, height: SCENE_H, overflow: "hidden" }}>
        <svg width={1080} height={SCENE_H} viewBox={`0 0 1080 ${SCENE_H}`}>
          <defs>
            <radialGradient id="vig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stopColor="#000" stopOpacity={0} /><stop offset="1" stopColor="#000" stopOpacity={0.65} /></radialGradient>
            <linearGradient id="fadeTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0a0605" /><stop offset="1" stopColor="#0a0605" stopOpacity={0} /></linearGradient>
            <linearGradient id="fadeBot" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#0a0605" /><stop offset="1" stopColor="#0a0605" stopOpacity={0} /></linearGradient>
          </defs>
          <g transform={`translate(540,${SCENE_H / 2}) scale(${c.z}) translate(${-c.fx},${-c.fy})`}>{draw(lt)}</g>
          <rect x={0} y={0} width={1080} height={SCENE_H} fill="url(#vig)" />
          <rect x={0} y={0} width={1080} height={120} fill="url(#fadeTop)" />
          <rect x={0} y={SCENE_H - 330} width={1080} height={330} fill="url(#fadeBot)" />
        </svg>
        <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash }} />
      </div>
      {/* gancho fixo em cima */}
      <div style={{ position: "absolute", top: 228, left: 120, right: 120, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 58, lineHeight: 1.0, letterSpacing: 2, textShadow: "0 3px 0 rgba(0,0,0,.6)" }}>
        <div style={{ color: WHITE }}>{HOOK[0]}</div>
        <div style={{ color: GOLD }}>{HOOK[1]}</div>
      </div>
      {s < 15 && <Caption t={t} />}
      {s === 15 && (
        <div style={{ position: "absolute", left: 120, right: 120, top: 1270, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, letterSpacing: 2 }}>
          <div style={{ fontSize: 70, color: WHITE, opacity: endP, transform: `translateY(${(1 - endP) * 16}px)`, WebkitTextStroke: "10px #0a0605", paintOrder: "stroke fill" }}>O QUE MARCOS IRÁ FAZER?</div>
          <div style={{ fontSize: 60, color: GOLD, marginTop: 6, opacity: endP2, transform: `translateY(${(1 - endP2) * 16}px)`, WebkitTextStroke: "9px #0a0605", paintOrder: "stroke fill" }}>SEGUE PRA VER A PARTE 2 →</div>
        </div>
      )}
    </AbsoluteFill>
  );
};
