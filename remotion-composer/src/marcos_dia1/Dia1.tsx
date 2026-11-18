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
const DUR = [3.6, 4.4, 2.8, 3.6, 3.2, 3.4, 6.4, 2.8, 4.6, 2.0, 1.8, 2.8, 4.6, 4.0, 3.8];
const ST: number[] = DUR.reduce<number[]>((a, d, i) => [...a, i === 0 ? 0 : a[i - 1] + DUR[i - 1]], []);
export const TOTAL = ST[ST.length - 1] + DUR[DUR.length - 1];
// [texto, arquivo, início relativo à cena, duração da fala]
const LINES: [string, number, number, number][] = [
  ["Marcos acordou atrasado.", 1, 0.45, 1.38],
  ["O filho já tinha ido pra escola. A esposa, pro trabalho.", 2, 0.5, 3.04],
  ["Ônibus lotado.", 3, 0.4, 0.96],
  ["Escritório. O emprego que ele não aguentava mais.", 4, 0.3, 2.77],
  ["E a bronca do chefe... de novo.", 5, 0.5, 1.38],
  ["Pelo menos, hoje era dia de pagamento.", 6, 0.4, 2.11],
  ["Em casa, as contas. Água. Luz. Internet. Aluguel. Mercado. Remédios.", 7, 0.3, 5.22],
  ["Aí o Lucas chegou da escola, animado:", 8, 0.3, 2.28],
  ["Pai, a escola vai fazer um passeio! Custa cem reais. Posso ir?", 9, 0.25, 3.77],
  ["Marcos olhou o extrato...", 10, 0.3, 1.18],
  ["Zerado.", 11, 0.25, 0.53],
  ["E teve que dizer não.", 12, 0.4, 1.11],
  ["Depois, viu o olhar da Juliana. Preocupação. Tristeza.", 13, 0.4, 3.53],
  ["Foi ali que Marcos decidiu: alguma coisa ia mudar.", 14, 0.4, 2.79],
  ["Fim do primeiro episódio. Segue pra ver a parte dois.", 15, 0.3, 2.8],
];
const KEY = ["atrasado", "lotado", "chefe", "pagamento", "contas", "cem", "reais", "zerado", "não", "juliana", "mudar", "dois", "remédios"];

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
  holdR?: React.ReactNode; holdL?: React.ReactNode; rot?: number;
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
  const knL = ik(hipL, c.feet[0], 152, 148, -1), knR = ik(hipR, c.feet[1], 152, 148, 1);
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
      {[[hipL, knL, c.feet[0]], [hipR, knR, c.feet[1]]].map(([a, b, f], i) => {
        const q: V = [2 * b[0] - (a[0] + f[0]) / 2, 2 * b[1] - (a[1] + f[1]) / 2];
        const d = `M${pt(a)} Q${pt(q)} ${pt(f)}`;
        const sd = i === 0 ? -1 : 1;
        return (
          <g key={i}>
            <path d={d} stroke={INK} strokeWidth={52} fill="none" strokeLinecap="round" />
            <path d={d} stroke={look.pants} strokeWidth={43} fill="none" strokeLinecap="round" />
            <path d={`M${f[0] - 26 + sd * 6},${f[1] - 6} Q${f[0] - 28 + sd * 6},${f[1] + 18} ${f[0] + sd * 6},${f[1] + 18} L${f[0] + 22 + sd * 10},${f[1] + 18} Q${f[0] + 36 + sd * 10},${f[1] + 16} ${f[0] + 26 + sd * 8},${f[1] - 6} Z`} fill={look.shoes} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          </g>
        );
      })}
      <path d={`M${hipL[0] - 30},${-14} L${hipR[0] + 30},${-14} L${hipR[0] + 26},${30 + c.sy * 0.15} L${hipL[0] - 26},${30 + c.sy * 0.15} Z`} fill={look.pants} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
    </g>
  );
  const arms = <g>{arm(shL, elL, c.hands[0], 0)}{arm(shR, elR, c.hands[1], 1)}</g>;
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
        <path d={`M${inner},${by - f.worry * 10} Q${ex},${by - 5 - f.raise * 3} ${outer},${by + f.worry * 3}`} stroke={INK} strokeWidth={look.style === "chefe" ? 9 : 6} fill="none" strokeLinecap="round" />
      </g>
    );
  };
  const mx = fx, my = fy + 34;
  const mw = 36 * (1 - f.mo * 0.35);
  const mouth = f.mo > 0.08
    ? <path d={`M${mx - mw / 2},${my} Q${mx},${my - 6 + f.curve * 6} ${mx + mw / 2},${my} Q${mx + mw / 2 - 2},${my + 6 + f.mo * 22} ${mx},${my + 8 + f.mo * 24} Q${mx - mw / 2 + 2},${my + 6 + f.mo * 22} ${mx - mw / 2},${my} Z`} fill="#3a1410" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
    : <path d={`M${mx - mw / 2},${my - f.curve * 4} Q${mx},${my + f.curve * 15} ${mx + mw / 2},${my - f.curve * 4}`} stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />;
  const id = look.id;
  const hairBack = look.style === "juliana" && (
    <path d={`M${hd[0] - 82},${hd[1] - 20} Q${hd[0] - 96},${hd[1] + 70} ${hd[0] - 86},${hd[1] + 130} Q${hd[0]},${hd[1] + 150} ${hd[0] + 86},${hd[1] + 130} Q${hd[0] + 96},${hd[1] + 70} ${hd[0] + 82},${hd[1] - 20} Q${hd[0]},${hd[1] - 110} ${hd[0] - 82},${hd[1] - 20} Z`} fill={look.hair} stroke={INK} strokeWidth={5} />
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
      ? `M${hd[0] - 90},${hd[1] + 10} Q${hd[0] - 70},${hd[1] - 70} ${hd[0] + 10},${hd[1] - 64} Q${hd[0] - 10 + f.lx * 10},${hd[1] - 30} ${hd[0] + 50},${hd[1] - 20} Q${hd[0] + 80},${hd[1] - 30} ${hd[0] + 90},${hd[1] + 10} L${hd[0] + 90},${hd[1] - 100} L${hd[0] - 90},${hd[1] - 100} Z`
      : `M${hd[0] - 90},${hd[1] - 16 + f.ly * 6} Q${hd[0] - 50 + f.lx * 14},${hd[1] - 60 + f.ly * 10} ${hd[0] + 10 + f.lx * 18},${hd[1] - 50 + f.ly * 10} Q${hd[0] + 55 + f.lx * 10},${hd[1] - 54 + f.ly * 8} ${hd[0] + 90},${hd[1] - 22 + f.ly * 6} L${hd[0] + 90},${hd[1] - 100} L${hd[0] - 90},${hd[1] - 100} Z`;
    return (
      <g>
        <g clipPath={`url(#hc${id})`}><path d={cap} fill={look.hair} /></g>
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
      {look.style === "juliana" && <path d={`M${c.lean - 34},${S2 - 4} Q${c.lean},${S2 + 36} ${c.lean + 34},${S2 - 4}`} stroke={INK} strokeWidth={5} fill={SKIN} />}
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
const Table: React.FC<{ x: number; y: number; w: number }> = ({ x, y, w }) => (
  <g>
    <path d={`M${x - w / 2 + 30},${y} L${x + w / 2 - 30},${y} L${x + w / 2},${y + 44} L${x - w / 2},${y + 44} Z`} fill="#a8734a" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
    <rect x={x - w / 2} y={y + 44} width={w} height={26} fill="#6e4a30" stroke={INK} strokeWidth={5} />
    <rect x={x - w / 2 + 20} y={y + 70} width={22} height={260} fill="#5a3a24" stroke={INK} strokeWidth={4} />
    <rect x={x + w / 2 - 42} y={y + 70} width={22} height={260} fill="#5a3a24" stroke={INK} strokeWidth={4} />
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
const Frame: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x},${y}) rotate(-2)`}>
    <rect x={0} y={0} width={150} height={120} rx={6} fill="#8a5a36" stroke={INK} strokeWidth={5} />
    <rect x={12} y={12} width={126} height={96} fill="#f0e2c8" />
    {[[42, 60, 18], [75, 52, 20], [108, 70, 13]].map(([cx, cy, r], i) => <g key={i}><circle cx={cx} cy={cy} r={r} fill="#f3efe7" stroke={INK} strokeWidth={3} /><rect x={cx - r} y={cy + r - 2} width={r * 2} height={30} rx={8} fill={["#4c6b92", "#a8485e", "#e0a33a"][i]} stroke={INK} strokeWidth={3} /></g>)}
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
  const s = sceneOf(t);
  const Wt = [0.32, 0.26, 0.2, 0.13, 0.09];
  let a: number[] = [0, 0, 0, 0], sw = 0;
  Wt.forEach((w, i) => {
    const x = t - i * 0.035;
    if (sceneOf(x) !== s || x < 0) return;
    const h = fn(x).hands;
    a = [a[0] + h[0][0] * w, a[1] + h[0][1] * w, a[2] + h[1][0] * w, a[3] + h[1][1] * w];
    sw += w;
  });
  return { ...c, hands: [[a[0] / sw, a[1] / sw], [a[2] / sw, a[3] / sw]] };
};
const walkFeet = (ph: number, amp: number): [V, V] => [
  [-40 + Math.sin(ph) * 34 * amp, 296 - Math.max(0, Math.cos(ph)) * 34 * amp],
  [40 - Math.sin(ph) * 34 * amp, 296 - Math.max(0, -Math.cos(ph)) * 34 * amp],
];
const walkHands = (ph: number, amp: number): [V, V] => [[-86 - Math.sin(ph) * 24 * amp, -14 - Math.abs(Math.sin(ph)) * 6 * amp], [86 + Math.sin(ph) * 24 * amp, -14 - Math.abs(Math.sin(ph)) * 6 * amp]];
const base = (o: Partial<Ch>): Ch => ({ x: 540, y: 700, k: 1, lean: 0, sy: 0, hx: 0, hy: 0, tilt: 0, face: F(), hands: HANG, feet: STAND_FEET, ...o });

// --- S1 quarto: acorda atrasado
const S1 = (t: number) => {
  const up = er(t, 0.55, 1.05);
  const mk = (x: number): Ch => {
    const u = er(x, 0.55, 1.05);
    const bl = blinkAt(x, 2.6, 0.5);
    return base({
      x: 600, y: 770, k: 0.92, rot: lerp(-84, 0, u), legs: false,
      hands: u < 0.5 ? [[-60, -60], [60, -60]] : [mixV([-90, 10], [-120, -170], er(x, 1.4, 1.7) * (1 - er(x, 2.6, 3.0))), [90, 10]],
      face: F({ open: u < 0.3 ? 0.06 : 1 - bl * 0.6, eyeS: lerp(1, 1.4, u), pupil: lerp(1, 0.6, u), raise: u * 1.1, mo: u * 0.8 * (1 - er(x, 2.2, 2.8)), lx: er(x, 1.2, 1.5) * -0.85, px: er(x, 1.2, 1.5) * -1, worry: er(x, 2.0, 2.6) * 0.6 }),
      sweat: ramp(x, 1.3, 3.0), tremble: u > 0.9 && x < 1.5 ? 1 : 0, sy: u * -6,
    });
  };
  const m = follow(mk, t);
  return (
    <g>
      <Wall a="#2e4058" b="#4a5a70" floor={900} fa="#5a3a24" fb="#2a1a10" />
      <Window x={700} y={170} w={260} h={250} day={1} t={t} />
      <rect x={-400} y={-400} width={1880} height={2000} fill="#ffe2a8" opacity={0.12} />
      {/* criado-mudo + despertador */}
      <rect x={110} y={690} width={130} height={210} fill="#7a5236" stroke={INK} strokeWidth={5} />
      <rect x={122} y={720} width={106} height={70} rx={6} fill="#8a6449" stroke={INK} strokeWidth={4} />
      <AlarmClock x={200} y={650} ring={t < 1.6 ? 1 : 0} t={t} txt="07:48" />
      {/* cama */}
      <rect x={240} y={520} width={34} height={380} rx={8} fill="#6b4a36" stroke={INK} strokeWidth={5} />
      <rect x={260} y={760} width={680} height={60} fill="#cfcde3" stroke={INK} strokeWidth={5} />
      <rect x={260} y={820} width={680} height={50} fill="#6b4a36" stroke={INK} strokeWidth={5} />
      <ellipse cx={340} cy={735} rx={80} ry={34} fill="#eceaf6" stroke={INK} strokeWidth={5} />
      <Person c={m} look={MARCOS} t={t} />
      {/* cobertor */}
      <path d={`M${lerp(380, 400, up)},${lerp(700, 770, up)} Q${600},${lerp(670, 760, up)} 940,${lerp(720, 770, up)} L940,830 L${lerp(380, 400, up)},830 Z`} fill="#5a6aa8" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      {t > 1.25 && t < 2.6 && <text x={470} y={360} fontFamily={BARLOW} fontWeight={700} fontSize={130} fill={RED} stroke={INK} strokeWidth={5} opacity={1 - ramp(t, 2.3, 2.6)}>!</text>}
    </g>
  );
};
const CAM1 = (t: number): Cam => ({ z: kf(t, [[0, 1.25], [1.0, 1.25], [1.5, 1.1]]), fx: kf(t, [[0, 440], [1.0, 440], [1.5, 560]]), fy: kf(t, [[0, 700], [1.5, 620]]) });

// --- casa (fundo comum)
const House: React.FC<{ t: number; door: number; night: number }> = ({ t, door, night }) => (
  <g>
    <Wall a="#5a3a28" b="#7a5238" floor={930} fa="#5a3a24" fb="#2a1a10" />
    <Window x={760} y={250} w={230} h={220} day={night > 0.5 ? 0 : 1} t={t} />
    <Frame x={430} y={260} />
    <Door x={60} y={510} open={door} />
    <g transform="translate(300,600)">
      <path d="M0,0 l0,-20 m-6,6 l6,-6 l6,6" stroke={INK} strokeWidth={4} fill="none" />
      <rect x={-14} y={0} width={28} height={8} fill="#6a4426" stroke={INK} strokeWidth={3} />
    </g>
  </g>
);

// --- S2 casa vazia: anda até a mesa e lê o bilhete
const S2 = (t: number) => {
  const mk = (x: number): Ch => {
    const wx = kf(x, [[0, 200], [1.9, 560]]);
    const v = x < 1.9 ? 1 - er(x, 1.5, 1.9) : 0;
    const ph = (wx - 200) / 34;
    const grab = er(x, 2.0, 2.4);
    const bl = blinkAt(x, 2.8, 0.2);
    return base({
      x: wx, y: 630, k: 1, lean: 0, feet: walkFeet(ph, v), sy: -Math.abs(Math.cos(ph)) * 6 * v,
      hands: v > 0.05 ? walkHands(ph, v) : [HANG[0], mixV(HANG[1], [60, -150], grab)],
      holdR: grab > 0.5 ? <Note /> : undefined,
      face: F({ lx: x < 2.0 ? kf(x, [[0, 0.6], [1.0, -0.6], [1.6, 0.6]]) : 0.2, ly: grab * 0.5, py: grab * 0.9, open: 1 - bl, curve: lerp(0.1, -0.35, er(x, 2.8, 3.4)), worry: er(x, 2.8, 3.4) * 0.6 }),
    });
  };
  const m = follow(mk, t);
  const sigh = er(t, 3.2, 3.6) * (1 - er(t, 3.9, 4.3));
  m.sy += sigh * 10;
  return (
    <g>
      <House t={t} door={0} night={0} />
      <Table x={620} y={820} w={420} />
      <g transform="translate(700,826)"><ellipse cx={0} cy={0} rx={46} ry={14} fill="#f3efe7" stroke={INK} strokeWidth={4} /><ellipse cx={0} cy={-4} rx={34} ry={8} fill="#e8b84a" /></g>
      {t < 2.2 && <g transform="translate(560,830) rotate(-80) scale(0.8)"><Note /></g>}
      <Person c={m} look={MARCOS} t={t} />
    </g>
  );
};
const CAM2 = (t: number): Cam => ({ z: 1.0, fx: kf(t, [[0, 420], [2.0, 560]]), fy: 640 });

// --- S3 ônibus lotado
const S3 = (t: number) => {
  const sway = Math.sin(t * 3.1) * 8 + Math.sin(t * 7.3) * 3;
  const m = follow((x) => base({
    x: 540 + Math.sin(x * 3.1) * 8, y: 690, k: 1, lean: Math.sin(x * 3.1) * 10, tilt: Math.sin(x * 3.1) * 3,
    hands: [[-86, -14], [40 + Math.sin(x * 3.1) * 4, -440]],
    face: F({ worry: 0.6, curve: -0.45, open: 0.8 - blinkAt(x, 2.4, 0.1) * 0.7, lx: -0.2, ly: 0.1 }),
  }), t);
  return (
    <g>
      <Wall a="#3a4a56" b="#566874" floor={960} fa="#2c3238" fb="#14181c" />
      {[0, 1, 2].map((i) => <Window key={i} x={60 + i * 330} y={250} w={290} h={200} day={1} t={t} scroll={t * 520 + i * 200} />)}
      <rect x={-400} y={200} width={1880} height={22} fill="#9aa4ad" stroke={INK} strokeWidth={4} />
      {[180, 900].map((x) => <rect key={x} x={x} y={200} width={18} height={760} fill="#d8c060" stroke={INK} strokeWidth={4} />)}
      {/* passageiros (silhuetas) */}
      {[[170, 0.95, "#4a4a58"], [880, 1.0, "#3e3e4c"], [330, 0.9, "#55556a"], [740, 0.92, "#4c4c5e"]].map(([x, k, col], i) => (
        <g key={i} transform={`translate(${(x as number) + Math.sin(t * 3.1 + i) * 6},${700}) scale(${k as number})`} opacity={0.95}>
          <circle cx={0} cy={-360} r={70} fill={col as string} stroke={INK} strokeWidth={5} />
          <path d="M-100,-250 Q0,-300 100,-250 L110,300 L-110,300 Z" fill={col as string} stroke={INK} strokeWidth={5} />
        </g>
      ))}
      <Person c={m} look={MARCOS} t={t} />
      <g transform={`translate(${sway},0)`} opacity={0}>{void sway}</g>
    </g>
  );
};
const CAM3 = (t: number): Cam => ({ z: 1.12 + Math.sin(t * 6) * 0.004, fx: 540 + Math.sin(t * 9) * 3, fy: 620 + Math.sin(t * 11) * 3 });

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
const S5 = (t: number) => {
  const shrink = er(t, 0.6, 0.9);
  const m = follow((x) => { const s = er(x, 0.6, 0.9); const c = marcosDesk(x, 0, { sy: s * 26, hy: s * 10, tilt: s * -6 }); c.hands = [[-90, -120], [90, -120]]; c.face = F({ lx: 0.6, px: 1, open: s > 0.5 ? 0.25 : 0.8, worry: 0.9, curve: -0.6, raise: 0.2 }); c.tremble = s > 0.5 ? 0.4 : 0; return c; }, t);
  const ch = follow((x) => {
    const wx = kf(x, [[0, 1220], [0.6, 860]]);
    const v = x < 0.6 ? 1 : 0;
    const yell = 0.6 + 0.4 * Math.sin(x * 18);
    const slam = er(x, 0.75, 0.9) * (1 - er(x, 1.1, 1.4));
    return base({
      x: wx, y: 620, k: 1.04, feet: walkFeet((wx - 860) / 30, v), lean: -12,
      hands: [mixV([-86, -14], [-150, -170 + slam * 120], er(x, 0.6, 0.8)), [92 + Math.sin(x * 9) * 10, -200 + Math.sin(x * 9) * 20]],
      face: F({ lx: -0.7, px: -1, worry: -0.9, raise: -0.2, mo: x > 0.7 ? yell : 0.2, curve: -0.4, eyeS: 1.1 }),
      red: er(x, 0.6, 1.0), tremble: x > 0.8 ? 0.6 : 0,
    });
  }, t);
  return (
    <g>
      <Office t={t} />
      <Person c={m} look={MARCOS} t={t} />
      <DeskOffice papers={10 + (t > 0.9 ? 6 : 0)} envelope={0} phoneBuzz={-1} t={t} />
      <Person c={ch} look={CHEFE} t={t} />
      {t > 0.75 && [0, 1, 2].map((i) => <path key={i} d={`M${700 - i * 10},${300 + i * 40} l-${40 + i * 10},-${20 - i * 10}`} stroke={RED} strokeWidth={8} strokeLinecap="round" opacity={0.5 + 0.5 * Math.sin(t * 20 + i)} />)}
      {t > 0.8 && <text x={300} y={290} fontFamily={BARLOW} fontWeight={700} fontSize={90} fill={RED} stroke={INK} strokeWidth={4} transform={`rotate(-8 300 290) scale(${1 + Math.sin(t * 18) * 0.03})`}>!!!</text>}
      {void shrink}
    </g>
  );
};
const CAM5 = (t: number): Cam => ({ z: 1.0 + Math.sin(t * 40) * 0.004 * (t > 0.8 ? 1 : 0), fx: 600, fy: 640 });
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
    return base({ x: wx, y: 620, k: 1.04, feet: walkFeet((wx - 860) / 30, v), hands: x < 0.5 ? [[-86, -14], kv(x, [[0, [92, -200]], [0.35, [60, -60]]])] : walkHands((wx - 860) / 30, v), face: F({ lx: x < 0.5 ? -0.7 : 0.7, worry: -0.5, curve: -0.3 }) });
  }, t);
  const note = backPop(t - 1.2) * (1 - er(t, 3.0, 3.3));
  return (
    <g>
      <Office t={t} />
      <Person c={m} look={MARCOS} t={t} />
      <DeskOffice papers={14} envelope={0} phoneBuzz={t < 1.6 ? buzz : -1} t={t} />
      {t < 1.3 && <Person c={ch} look={CHEFE} t={t} />}
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

// --- S7 contas na mesa de casa (noite)
const BILLS: [string, string, string, number][] = [["ÁGUA", "R$ 120", "💧", 1.25], ["LUZ", "R$ 190", "⚡", 2.0], ["INTERNET", "R$ 100", "📶", 2.65], ["ALUGUEL", "R$ 900", "🏠", 3.45], ["MERCADO", "R$ 650", "🛒", 4.2], ["REMÉDIOS", "R$ 340", "💊", 4.95]];
const BILL_POS: V[] = [[210, 300], [540, 260], [870, 300], [210, 520], [540, 480], [870, 520]];
const marcosTable = (x: number, o: Partial<Ch> = {}): Ch => base({ x: 540, y: 1010, k: 1, legs: false, hands: [[-60, -132], [40, -190]], holdR: <PhoneS />, face: F({ ly: 0.45, py: 0.9, worry: 0.5, curve: -0.3, open: 1 - blinkAt(x, 2.7, 0.4) }), ...o });
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
const S7 = (t: number) => {
  const m = follow((x) => {
    const c = marcosTable(x);
    const tap = BILLS.some(([, , , s]) => x > s - 0.15 && x < s + 0.05);
    c.hands = [[-50, tap ? -190 : -150], [40, -190]];
    const n = BILLS.filter(([, , , s]) => x > s).length;
    c.face.worry = 0.4 + n * 0.08; c.face.curve = -0.2 - n * 0.07; c.sy = n * 3;
    return c;
  }, t);
  return (
    <g>
      <HouseNight t={t} door={0} />
      <Person c={m} look={MARCOS} t={t} />
      <Table x={540} y={870} w={560} />
      {BILLS.map(([l, v, ic, s], i) => {
        const pop = backPop(t - (s - 0.35));
        if (pop <= 0) return null;
        return <g key={i} transform={`translate(${BILL_POS[i][0]},${BILL_POS[i][1]}) rotate(${(i % 2 ? 1 : -1) * 4})`}><Bill label={l} val={v} icon={ic} paid={er(t, s, s + 0.18)} pop={pop} /></g>;
      })}
      {lightRoom(0.5)}
    </g>
  );
};
const CAM7 = (t: number): Cam => ({ z: kf(t, [[0, 1.08], [6.4, 1.0]]), fx: 540, fy: 600 });

// --- S8/S9/S12: Lucas chega, pede, ouve o não
const lucasAt = (x: number, mode: "run" | "ask" | "sad", s0: number): Ch => {
  const bl = blinkAt(x, 2.3, 0.6);
  if (mode === "run") {
    const wx = kf(x - s0, [[0, 120], [1.6, 820]]);
    const v = x - s0 < 1.6 ? 1 - er(x - s0, 1.3, 1.6) : 0;
    const ph = (wx - 120) / 22;
    return base({ x: wx, y: 760, k: 0.68, feet: walkFeet(ph, v * 1.2), sy: -Math.abs(Math.cos(ph)) * 10 * v, hands: walkHands(ph, v * 1.3), face: F({ lx: v > 0.1 ? 0.6 : -0.5, curve: 0.9, mo: 0.45, raise: 0.4, open: 1 - bl }) });
  }
  if (mode === "ask") {
    const bounce = Math.abs(Math.sin((x - s0) * 7)) * 10;
    const show = er(x - s0, 1.4, 1.8);
    return base({ x: 820, y: 760 - bounce, k: 0.68, hands: [mixV([-40, -130], [-60, -150], show), mixV([40, -130], [70, -230], show)], holdR: show > 0.4 ? <Bilhete /> : undefined, face: F({ lx: -0.6, px: -1, curve: 0.95, mo: 0.35 + 0.25 * Math.sin((x - s0) * 14), raise: 0.6, open: 1 - bl, eyeS: 1.1 }) });
  }
  const fall = er(x - s0, 0.6, 1.3);
  return base({ x: 820, y: 760 + fall * 6, k: 0.68, hands: [mixV([-60, -150], [-86, -14], fall), mixV([70, -230], [80, -40], fall)], holdR: fall < 0.9 ? <Bilhete /> : undefined, face: F({ lx: lerp(-0.6, -0.1, fall), ly: fall * 0.6, py: fall, curve: lerp(0.9, -0.7, fall), worry: fall, mo: 0, open: 1 - bl, wide: fall * 0.8 }), tilt: fall * 8, hy: fall * 14 });
};
const S8 = (t: number) => {
  const door = er(t, 0.1, 0.5);
  const m = follow((x) => { const c = marcosTable(x); const look = er(x, 0.4, 0.8); c.face.lx = look * 0.7; c.face.px = look; c.face.ly = lerp(0.45, 0, look); c.face.py = lerp(0.9, 0, look); c.face.curve = lerp(-0.3, 0.25, look); c.face.worry = lerp(0.6, 0.2, look); c.hands = [[-60, -132], mixV([40, -190], [60, -130], look)]; c.holdR = undefined; return c; }, t);
  const l = follow((x) => lucasAt(x, "run", 0), t);
  return (<g><HouseNight t={t} door={door} /><Person c={m} look={MARCOS} t={t} /><Table x={540} y={870} w={560} /><Person c={l} look={LUCAS} t={t} />{lightRoom(0.5)}</g>);
};
const S9 = (t: number) => {
  const m = follow((x) => { const c = marcosTable(x); c.holdR = undefined; c.hands = [[-60, -132], [60, -130]]; c.face = F({ lx: 0.7, px: 1, curve: lerp(0.3, 0.05, er(x, 2.2, 3.2)), worry: lerp(0.2, 0.55, er(x, 2.2, 3.2)), open: 1 - blinkAt(x, 2.4, 0.9), raise: 0.2 }); return c; }, t);
  const l = follow((x) => lucasAt(x, "ask", 0), t);
  return (<g><HouseNight t={t} door={0} /><Person c={m} look={MARCOS} t={t} /><Table x={540} y={870} w={560} /><Person c={l} look={LUCAS} t={t} />{lightRoom(0.5)}</g>);
};
const CAM9 = (t: number): Cam => ({ z: kf(t, [[0, 1.0], [4.6, 1.12]]), fx: kf(t, [[0, 620], [4.6, 680]]), fy: 600 });

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
    const c = marcosTable(x); c.holdR = undefined;
    const shake = Math.sin((x - 0.5) * 9) * er(x, 0.5, 0.7) * (1 - er(x, 1.6, 1.9));
    c.hx = shake * 16; c.tilt = shake * 5;
    c.hands = [[-60, -132], [60, -130]];
    c.face = F({ lx: 0.6 + shake * 0.2, px: 1, worry: 1, curve: -0.6, open: 0.75 - blinkAt(x, 2, 0.2) * 0.6, ly: 0.2, wide: 0.4 });
    c.sy = 10;
    return c;
  }, t);
  const l = follow((x) => lucasAt(x, "sad", 0), t);
  return (<g><HouseNight t={t} door={0} /><Person c={m} look={MARCOS} t={t} /><Table x={540} y={870} w={560} /><Person c={l} look={LUCAS} t={t} />{lightRoom(0.4)}</g>);
};
const CAM12 = (t: number): Cam => ({ z: kf(t, [[0, 1.05], [2.8, 1.15]]), fx: 680, fy: 640 });

// --- S13 o olhar da Juliana
const S13 = (t: number) => {
  const door = 1;
  const j = follow((x) => {
    const bl = blinkAt(x, 3.0, 1.1);
    return base({ x: 160, y: 640, k: 0.95, hands: [[-90, -14], [40, -170]], holdR: <rect x={-20} y={-10} width={40} height={90} rx={8} fill="#6a4a3a" stroke={INK} strokeWidth={4} />, face: F({ lx: 0.55, px: 0.9, worry: kf(x, [[0, 0.3], [1.4, 1.0]]), curve: kf(x, [[0, 0], [1.4, -0.5]]), open: kf(x, [[0, 1], [2.4, 0.7]]) - bl * 0.6, wide: er(x, 2.2, 3.0) * 0.9, raise: 0.2 }), tilt: kf(x, [[0, 0], [2.4, -6]]), sy: er(x, 2.4, 3.4) * 6 });
  }, t);
  const m = follow((x) => { const c = marcosTable(x); c.holdR = undefined; c.hands = [[-60, -132], [60, -130]]; c.face = F({ lx: -0.7, px: -1, worry: 0.9, curve: -0.5, open: 0.8 - blinkAt(x, 2.2, 0.5) * 0.7 }); c.sy = 10; return c; }, t);
  return (<g><HouseNight t={t} door={door} /><Person c={j} look={JULIANA} t={t} /><Person c={m} look={MARCOS} t={t} /><Table x={540} y={870} w={560} />{lightRoom(0.4)}</g>);
};
const CAM13 = (t: number): Cam => ({ z: kf(t, [[0, 1.0], [0.8, 1.0], [2.0, 1.75]]), fx: kf(t, [[0, 420], [0.8, 420], [2.0, 190]]), fy: kf(t, [[0, 620], [2.0, 400]]) });

// --- S14/S15 decisão + fim
const S14 = (t: number, end: boolean) => {
  const m = follow((x) => {
    const d = end ? 1 : er(x, 1.2, 2.4);
    const c = marcosTable(x); c.holdR = undefined;
    const fist = end ? 1 : er(x, 2.4, 2.9);
    c.hands = [[-60, -132], mixV([60, -130], [70, -300], fist)];
    c.holdR = undefined;
    c.face = F({ lx: lerp(0.1, 0, d), ly: lerp(0.35, -0.05, d), py: lerp(0.6, 0, d), worry: lerp(0.9, -0.55, d), curve: lerp(-0.5, -0.05, d), open: lerp(0.75, 0.82, d) - blinkAt(x + (end ? 9 : 0), 3.2, 0.7) * 0.7, raise: lerp(0, -0.25, d) });
    c.sy = lerp(10, -10, d); c.tilt = 0;
    return c;
  }, t);
  const glow = end ? 1 : er(t, 1.4, 3.0);
  return (
    <g>
      <HouseNight t={t} door={0} />
      <defs><radialGradient id="rim" cx="540" cy="420" r="520" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ffcf6a" stopOpacity={0.5} /><stop offset="1" stopColor="#ffcf6a" stopOpacity={0} /></radialGradient></defs>
      <rect x={-400} y={-400} width={1880} height={2400} fill="url(#rim)" opacity={glow} style={{ mixBlendMode: "screen" }} />
      <Person c={m} look={MARCOS} t={t} />
      <Table x={540} y={870} w={560} />
    </g>
  );
};
const CAM14 = (t: number): Cam => ({ z: kf(t, [[0, 1.3], [4.0, 1.85]]), fx: 540, fy: kf(t, [[0, 720], [4.0, 745]]) });
const CAM15 = (t: number): Cam => ({ z: 1.85 + t * 0.02, fx: 540, fy: 745 });

const SCENES: [(t: number) => React.ReactNode, (t: number) => Cam][] = [
  [S1, CAM1], [S2, CAM2], [S3, CAM3], [S4, CAM4], [S5, CAM5], [S6, CAM6], [S7, CAM7], [S8, (t) => ({ z: 1.0, fx: kf(t, [[0, 460], [1.8, 620]]), fy: 620 })],
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
  const endP = s === 14 ? er(lt, 0.3, 0.8) : 0;
  const endP2 = s === 14 ? er(lt, 1.4, 1.9) : 0;
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
      {s < 14 && <Caption t={t} />}
      {s === 14 && (
        <div style={{ position: "absolute", left: 120, right: 120, top: 1270, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, letterSpacing: 2 }}>
          <div style={{ fontSize: 76, color: WHITE, opacity: endP, transform: `translateY(${(1 - endP) * 16}px)`, WebkitTextStroke: "10px #0a0605", paintOrder: "stroke fill" }}>FIM DO EPISÓDIO 1</div>
          <div style={{ fontSize: 60, color: GOLD, marginTop: 6, opacity: endP2, transform: `translateY(${(1 - endP2) * 16}px)`, WebkitTextStroke: "9px #0a0605", paintOrder: "stroke fill" }}>SEGUE PRA VER A PARTE 2 →</div>
        </div>
      )}
    </AbsoluteFill>
  );
};
