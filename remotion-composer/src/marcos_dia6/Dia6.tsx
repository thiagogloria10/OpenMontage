import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// ==================================================================
// SÉRIE MARCOS — DIA 6. Base: Dia5.tsx v3. Recap do Dia 5 → 3 dias sem emprego, consertando a casa → desanimado →
// celular toca: aprovado, 5× mais → comemora → no dia seguinte, prédio enorme → Carlos, o chefe novo (oposto do Roberto) →
// dia ótimo, sai tarde → casa escura e vazia → procura nos cômodos → gancho do Dia 7.
// SÉRIE MARCOS — DIA 5. Base: Dia4.tsx v7 (mesmos bonecos, roupas e cenários).
// Recap do Dia 4 → decide ir à entrevista → melhor roupa, sai confiante → sala cheia de candidatos → horas de espera →
// último entrevistado, conversa curta → vai embora sem resposta → coisas numa caixa → demitido → gancho do Dia 6.
// (Comentários abaixo, até "Narração", são do Dia 4.)
// SÉRIE MARCOS — DIA 4. Base: Dia3.tsx v4 (mesmos bonecos, roupas e cenários).
// Recap do Dia 3 → acorda ainda mais cedo → café junto com a família → chefe pega no pé → anúncio de emprego
// na rua, anota o número → liga e consegue entrevista amanhã 10:00 → sem experiência e risco de demissão → gancho.
// (Comentários das linhas seguintes, até "Narração", são do Dia 3.)
// Recap do Dia 2 → acorda cedo e faz o café → se atrasa e não come com a família → lugar vazio →
// chefe pega no pé, ele não se abala e trabalha com excelência → joalheria, anel → conta ZERADA →
// sai mais motivado → gancho do Dia 4. (Comentários abaixo, até "Narração", são do Dia 2.)
// Recap do Dia 1 → acorda atrasado, mas disposto → ônibus sorrindo → pilha de tarefas →
// chefe grita e ele não se abala → faz tudo → chefe estranha → olhar da Juliana → promessa.
// Narração PROVISÓRIA (Piper) frase a frase em public/marcos_dia4/fala/nN.wav.
// ==================================================================
const FONT_DIR = "marcos_dia6";
const HOOK = ["DIA 6", "A VIDA DE MARCOS"];

const INK = "#1b100a", GOLD = "#E8B84A", RED = "#e0554a", WHITE = "#f4f1ea", GREEN = "#5fd08a";
const BARLOW = "'Barlow Condensed', 'DejaVu Sans Condensed', sans-serif";
const MONO = "'JetBrains Mono', 'DejaVu Sans Mono', monospace";
const SKIN = "#f3efe7", SKIN2 = "#d9d2c5";

// ------------------------------------------------------------------ cenas (duração em s) e falas
const DUR = [5.3, 5.4, 2.4, 3.4, 3.4, 3.4, 3.7, 2.6, 3.0, 3.6, 2.6, 3.0, 5.4]; // narração PROVISÓRIA (Piper)
const ST: number[] = DUR.reduce<number[]>((a, d, i) => [...a, i === 0 ? 0 : a[i - 1] + DUR[i - 1]], []);
export const TOTAL = ST[ST.length - 1] + DUR[DUR.length - 1];
// [texto, arquivo, início relativo à cena, duração da fala]
type LineT = [string, number, number, number] | null;
const LINES: LineT[] = [
  ["Ontem, o Marcos foi à entrevista e voltou sem resposta. E ainda foi demitido.", 0, 0.15, 4.69],
  ["Já faz três dias. Sem emprego, o Marcos tenta se ocupar consertando as coisas da casa.", 1, 0.15, 4.92],
  ["Mas a esperança... está acabando.", 2, 0.15, 1.67],
  ["Até que o celular toca. É da empresa da entrevista.", 3, 0.15, 2.86],
  ["Ele foi aprovado! Vai ganhar cinco vezes mais.", 4, 0.15, 2.83],
  ["E, pela primeira vez em muito tempo, ele sorri de verdade.", 5, 0.15, 2.88],
  ["No dia seguinte, ele chega no emprego novo. Um prédio enorme.", 6, 0.15, 3.08],
  ["E esse é o Carlos. O chefe novo.", 7, 0.15, 2.04],
  ["Educado, paciente... o oposto do seu Roberto.", 8, 0.15, 2.41],
  ["O dia é ótimo. Tão bom que ele sai mais tarde que o normal.", 9, 0.15, 3.07],
  ["Quando chega em casa, está tudo escuro.", 10, 0.15, 2.09],
  ["Ele procura na sala, nos quartos... ninguém.", 11, 0.15, 2.23],
  ["O que aconteceu com a família do Marcos? Segue pra ver a última parte.", 12, 0.15, 3.55],
];
// tempos reais de cada palavra (preencher com a voz da ElevenLabs via sincronizar_voz.py)
const WORDT: Record<number, number[]> = {}; // preencher com a voz da ElevenLabs (sincronizar_voz.py)
const VOICE_DIR = "marcos_dia6/fala";
const KEY = ["demitido", "resposta", "três", "emprego", "consertando", "esperança", "celular", "entrevista", "aprovado", "cinco", "sorri", "verdade", "novo", "enorme", "carlos", "chefe", "oposto", "roberto", "ótimo", "tarde", "escuro", "ninguém", "família", "marcos", "última"];

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
type Look = { id: string; shirt: string; shirt2: string; pants: string; shoes: string; hair: string; style: "marcos" | "lucas" | "juliana" | "chefe"; sleeve: number; width: number; tie?: string; suit?: boolean; loose?: boolean; pj?: boolean; beard?: boolean };
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
  holdR?: React.ReactNode; holdL?: React.ReactNode; rot?: number; elbowL?: number; kneeDir?: number; socks?: boolean; sit?: number; noArms?: boolean;
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
  const elL = ik(shL, c.hands[0], 106, 100, c.elbowL ?? -1), elR = ik(shR, c.hands[1], 106, 100, 1);
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
      {look.style === "marcos" && !look.suit && !look.loose && !look.pj && <path d={`M${c.lean - 26},${S2 - 6} L${c.lean},${S2 + 26} L${c.lean + 26},${S2 - 6}`} stroke={INK} strokeWidth={5} fill="#e9e6de" strokeLinejoin="round" />}
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
      {look.style === "lucas" && [0, 1, 2].map((i) => <path key={i} d={`M${-64 * W},${S2 + 60 + i * 50} L${64 * W},${S2 + 60 + i * 50}`} stroke="#f4d27a" strokeWidth={14} />)}
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
        {look.beard && <path d={`M${hd[0] - 66},${hd[1] + 6} Q${hd[0] - 60},${hd[1] + 70} ${hd[0]},${hd[1] + 76} Q${hd[0] + 60},${hd[1] + 70} ${hd[0] + 66},${hd[1] + 6} Q${hd[0] + 50},${hd[1] + 52} ${hd[0]},${hd[1] + 54} Q${hd[0] - 50},${hd[1] + 52} ${hd[0] - 66},${hd[1] + 6} Z`} fill={look.hair} opacity={0.85} />}
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
      <Person c={m} look={MARCOS_PJ} t={t0} />
      <path d={pathOf(bl)} fill="#5a6aa8" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      <path d={`M${pt(mixV([520, 760], [640, 790], up))} Q${pt(mixV([600, 770], [700, 784], up))} ${pt(mixV([700, 762], [780, 790], up))}`} stroke="#3e4a80" strokeWidth={4} fill="none" />
      {/* braço de fora por cima do cobertor quando deitado */}
      {up < 0.3 && (
        <g opacity={1 - up / 0.3}>
          {/* braço saindo do ombro, dobrado, com a mão descansando na barriga por cima do cobertor */}
          <path d="M418,716 Q470,684 530,700 Q560,708 584,718" stroke={INK} strokeWidth={37} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M418,716 Q470,684 530,700 Q560,708 584,718" stroke={SKIN} strokeWidth={28} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M418,716 Q446,698 478,694" stroke={INK} strokeWidth={43} strokeLinecap="butt" fill="none" />
          <path d="M418,716 Q446,698 478,694" stroke={MARCOS_PJ.shirt} strokeWidth={34} strokeLinecap="butt" fill="none" />
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
      holdR: hold > 0.5 ? <Note /> : undefined, holdL: <Briefcase />,
      face: F({ lx: x < 5.5 ? 0.6 : 0.2, ly: 0.2 + bend * 0.4, py: 0.5 + bend * 0.4, open: 1 - bl, curve: lerp(0.1, -0.35, er(x, 5.6, 6.0)), worry: er(x, 5.6, 6.0) * 0.6 }),
    });
  };
  const m = follow(mk, t);
  return (
    <g>
      <House t={t} door={0} night={0} />
      <ChairF x={650} seat={780} floor={942} s={0.9} />
      <ChairF x={830} seat={780} floor={942} s={0.9} />
      <Person c={m} look={MARCOS_SUIT} t={t} />
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
    hands: [[-86, -14], toLocal(ringPos(STRAPS[1], x, 1), 540 + sw(x) * 8, 690, 1)], holdL: <Briefcase />,
    face: F({ worry: -0.1, curve: 0.5, open: 1 - blinkAt(x, 2.4, 0.1) * 0.8, lx: -0.25 + er(x, 0.9, 1.3) * 0.25, ly: -0.05, px: -0.4 + er(x, 0.9, 1.3) * 0.4, raise: 0.15 }),
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
      <Person c={m} look={MARCOS_SUIT} t={t} />
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
const Office: React.FC<{ t: number; spin?: number; hm?: [number, number] }> = ({ t, spin = 0, hm }) => (
  <g>
    <Wall a="#4a5260" b="#5e6676" floor={940} fa="#3a3e46" fb="#1e2026" />
    {[0, 1, 2, 3].map((i) => <rect key={i} x={-200 + i * 380} y={120} width={200} height={40} rx={6} fill="#f4f6ff" opacity={0.6} />)}
    <rect x={720} y={260} width={240} height={160} rx={6} fill="#2a2f3a" stroke={INK} strokeWidth={5} />
    <path d="M740,400 L790,350 L830,370 L880,300 L940,330" stroke={RED} strokeWidth={6} fill="none" />
    <circle cx={260} cy={300} r={56} fill="#f4f1ea" stroke={INK} strokeWidth={6} />
    {hm ? (
      <g>
        <line x1={260} y1={300} x2={260} y2={270} stroke={INK} strokeWidth={8} strokeLinecap="round" transform={`rotate(${((hm[0] % 12) + hm[1] / 60) * 30} 260 300)`} />
        <line x1={260} y1={300} x2={260} y2={256} stroke={INK} strokeWidth={5} strokeLinecap="round" transform={`rotate(${hm[1] * 6} 260 300)`} />
        <circle cx={260} cy={300} r={5} fill={INK} />
      </g>
    ) : (
      <g>
        <line x1={260} y1={300} x2={260} y2={262} stroke={INK} strokeWidth={6} strokeLinecap="round" transform={`rotate(${spin * 12} 260 300)`} />
        <line x1={260} y1={300} x2={292} y2={312} stroke={INK} strokeWidth={6} strokeLinecap="round" transform={`rotate(${spin} 260 300)`} />
      </g>
    )}
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
  return (<g><Office t={t} /><Person c={m} look={MARCOS_SUIT} t={t} /><DeskOffice papers={10} envelope={0} phoneBuzz={-1} t={t} /></g>);
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
      <Person c={m} look={MARCOS_SUIT} t={x} />
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
      <Person c={m} look={MARCOS_SUIT} t={x} />
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
      <Person c={m} look={MARCOS_SUIT} t={t} />
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
const BILLS: [string, string, string, number][] = [["ÁGUA", "R$ 120", "💧", 1.65], ["LUZ", "R$ 190", "⚡", 2.09], ["INTERNET", "R$ 100", "📶", 2.69], ["ALUGUEL", "R$ 900", "🏠", 3.41], ["MERCADO", "R$ 650", "🛒", 4.19], ["REMÉDIOS", "R$ 340", "💊", 4.85]];
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
      <Person c={m} look={MARCOS_HOME} t={t} />
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
  return (<g><HouseNight t={t} door={door} /><NightChair /><Person c={m} look={MARCOS_HOME} t={t} /><NightTable papers={6} /><Person c={l} look={LUCAS} t={t} />{lightRoom(0.5)}</g>);
};
const CAM8 = (t: number): Cam => ({ z: 1.1, fx: kf(t, [[0, 700], [1.8, 680]]), fy: 660 });
const S9 = (t: number) => {
  const m = follow((x) => { const c = marcosLooks(x, 1); c.face = F({ lx: 0.7, px: 1, curve: lerp(0.3, 0.05, er(x, 2.2, 3.2)), worry: lerp(0.2, 0.55, er(x, 2.2, 3.2)), open: 1 - blinkAt(x, 2.4, 0.9), raise: 0.2 }); return c; }, t);
  const l = follow((x) => lucasAt(x, "ask"), t);
  return (<g><HouseNight t={t} door={1} /><NightChair /><Person c={m} look={MARCOS_HOME} t={t} /><NightTable papers={6} /><Person c={l} look={LUCAS} t={t} />{lightRoom(0.5)}</g>);
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
  return (<g><HouseNight t={t} door={1} /><NightChair /><Person c={m} look={MARCOS_HOME} t={t} /><NightTable papers={6} /><Person c={l} look={LUCAS} t={t} />{lightRoom(0.4)}</g>);
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
  return (<g><HouseNight t={t} door={1} /><NightChair /><Person c={m} look={MARCOS_HOME} t={t} /><NightTable papers={6} /><Person c={j} look={JULIANA} t={t} />{lightRoom(0.4)}</g>);
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
      <Person c={m} look={MARCOS_HOME} t={t} />
      <NightTable papers={6} />
    </g>
  );
};
const CAM14 = (t: number): Cam => ({ z: kf(t, [[0, 1.25], [2.2, 1.35], [3.3, 1.6], [4.6, 1.8]]), fx: SEAT_X, fy: kf(t, [[0, 600], [2.2, 590], [3.3, 470], [4.6, 450]]) });
const CAM15 = (t: number): Cam => ({ z: 1.8 + t * 0.02, fx: SEAT_X, fy: 450 });
// ==================================================================
// DIA 2 — cenas novas
// ==================================================================

// --- R0 recapitulação do Dia 1 (cortes rápidos, levemente dessaturados, plaquinha ANTERIORMENTE)
const RECAP: [(t: number) => React.ReactNode, (t: number) => Cam, number, number][] = [
  [(t) => S4d4(t), (t) => CAM4d4(t), 2.4, 2.6],
  [(t) => S6d4(t), (t) => CAM6d4(t), 2.6, 2.0],
  [(t) => S8d4(t), (t) => CAM8d4(t), 0.0, 2.71],
];
const RECAP_ST = RECAP.reduce<number[]>((a, r, i) => [...a, i === 0 ? 0 : a[i - 1] + RECAP[i - 1][3]], []);
const R0 = (t: number) => {
  let k = 0;
  RECAP_ST.forEach((s, i) => { if (t >= s) k = i; });
  const [draw, cam, lt0, ] = RECAP[k];
  const lt = lt0 + (t - RECAP_ST[k]);
  const c = cam(lt);
  const cut = Math.max(0, 1 - (t - RECAP_ST[k]) / 0.12);
  return (
    <g>
      <defs><filter id="recapF"><feColorMatrix type="saturate" values="0.45" /></filter></defs>
      <rect x={-400} y={-400} width={1880} height={2400} fill="#000" />
      <g filter="url(#recapF)" transform={`translate(540,630) scale(${c.z}) translate(${-c.fx},${-c.fy})`}>{draw(lt)}</g>
      <rect x={-400} y={-400} width={1880} height={2400} fill="#c89a5a" opacity={0.12} style={{ mixBlendMode: "screen" }} />
      <rect x={-400} y={-400} width={1880} height={2400} fill="#fff" opacity={cut * 0.35} />
    </g>
  );
};
const CAMR0 = (_t: number): Cam => ({ z: 1, fx: 540, fy: 630 });

// --- S1 quarto: acorda atrasado de novo (07:52), mas dessa vez sorri, se espreguiça e fecha os punhos
// tempo contínuo nas duas cenas (cena 1 = 0..3,6; cena 2 = 3,6..7,0)
const S1d2 = (t0: number, calm = false, alarm = "06:40") => {
  const t = t0 - T1;
  const up = er(t, 0.55, 1.05);
  const mk = (x0: number): Ch => {
    const x = x0 - T1;
    const u = er(x, 0.55, 1.05);
    const bl = blinkAt(x, 2.6, 0.5);
    const look = er(x, 1.15, 1.45) * (1 - er(x, 2.1, 2.4)) * (calm ? 0.6 : 1); // olha o despertador
    const happy = er(x, 2.2, 2.7);
    const stretch = er(x, 2.5, 3.1) * (1 - er(x, 3.5, 3.9));
    const fist = er(x, 3.7, 4.1);
    const rest: V = mixV([-90, 6], [-50, -150], fist), restR: V = mixV([96, 4], [50, -150], fist);
    return base({
      x: 655, y: 774, k: 0.92, rot: lerp(-86, 0, u), legs: false, noArms: u < 0.4,
      hands: u < 0.5 ? [[-34, -90], [34, -90]] : [mixV(rest, [-118, -430], stretch), mixV(restR, [118, -430], stretch)],
      face: F({
        open: u < 0.3 ? 0.06 : stretch > 0.4 ? 0.08 : 1 - bl * 0.6,
        eyeS: lerp(1, 1.3, u) - happy * 0.25, pupil: lerp(1, 0.7, u),
        raise: (calm ? 0.2 : u * 0.9) * (1 - happy) + happy * 0.15, mo: (calm ? 0 : u * 0.6 * (1 - er(x, 1.8, 2.2))) + stretch * 0.5,
        lx: look * -0.85, px: look * -1, curve: lerp(0.0, 0.7, happy), worry: lerp(0, -0.35, fist),
      }),
      sweat: calm ? 0 : ramp(x, 1.3, 2.4) * (1 - er(x, 2.3, 2.6)), tremble: !calm && u > 0.9 && x < 1.4 ? 0.6 : 0,
      sy: u * -6 - stretch * 10, hy: Math.sin(clamp01((x - 4.1) / 0.5) * Math.PI) * 8,
    });
  };
  const m = follow(mk, t0);
  const breathe = up < 0.05 ? Math.sin(t0 * 2) * 3 : 0;
  const bl = mixPts(BL_LIE, BL_SIT, up).map(([x, y], i) => [x, y + (i > 0 && i < 6 ? breathe : 0)] as V);
  const sun = er(t, 2.2, 3.2);
  return (
    <g>
      <Wall a="#2e4058" b="#4a5a70" floor={900} fa="#5a3a24" fb="#2a1a10" />
      <Window x={700} y={170} w={260} h={250} day={1} t={t0} />
      <rect x={-400} y={-400} width={1880} height={2000} fill="#ffe2a8" opacity={0.12 + sun * 0.1} />
      {/* raio de sol entrando pela janela */}
      <path d="M700,170 L960,170 L760,900 L380,900 Z" fill="#fff0c0" opacity={0.08 + sun * 0.14} style={{ mixBlendMode: "screen" }} />
      <rect x={110} y={690} width={130} height={210} fill="#7a5236" stroke={INK} strokeWidth={5} />
      <rect x={122} y={720} width={106} height={70} rx={6} fill="#8a6449" stroke={INK} strokeWidth={4} />
      <AlarmClock x={180} y={650} ring={t > -1.1 && t < (calm ? 0.6 : 1.5) ? 1 : 0} t={t0} txt={calm ? alarm : "07:52"} />
      <rect x={250} y={540} width={40} height={360} rx={10} fill="#6b4a36" stroke={INK} strokeWidth={5} />
      <rect x={270} y={762} width={690} height={62} rx={10} fill="#e4e2f0" stroke={INK} strokeWidth={5} />
      <rect x={270} y={824} width={690} height={46} fill="#6b4a36" stroke={INK} strokeWidth={5} />
      <rect x={936} y={700} width={30} height={200} rx={8} fill="#6b4a36" stroke={INK} strokeWidth={5} />
      <ellipse cx={350} cy={738} rx={78} ry={30} fill="#f4f2fa" stroke={INK} strokeWidth={5} />
      <Person c={m} look={MARCOS_PJ} t={t0} />
      <path d={pathOf(bl)} fill="#5a6aa8" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      <path d={`M${pt(mixV([520, 760], [640, 790], up))} Q${pt(mixV([600, 770], [700, 784], up))} ${pt(mixV([700, 762], [780, 790], up))}`} stroke="#3e4a80" strokeWidth={4} fill="none" />
      {up < 0.3 && (
        <g opacity={1 - up / 0.3}>
          <path d="M418,716 Q470,684 530,700 Q560,708 584,718" stroke={INK} strokeWidth={37} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M418,716 Q470,684 530,700 Q560,708 584,718" stroke={SKIN} strokeWidth={28} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M418,716 Q446,698 478,694" stroke={INK} strokeWidth={43} strokeLinecap="butt" fill="none" />
          <path d="M418,716 Q446,698 478,694" stroke={MARCOS_PJ.shirt} strokeWidth={34} strokeLinecap="butt" fill="none" />
          <g transform="translate(590,720) rotate(20)"><ellipse cx={0} cy={-13} rx={9} ry={7} fill={SKIN} stroke={INK} strokeWidth={4} transform="rotate(-30)" /><ellipse cx={6} cy={0} rx={21} ry={16} fill={SKIN} stroke={INK} strokeWidth={4.5} /></g>
        </g>
      )}
      {!calm && t > 1.2 && t < 2.3 && <text x={520} y={360} fontFamily={BARLOW} fontWeight={700} fontSize={130} fill={RED} stroke={INK} strokeWidth={5} opacity={1 - ramp(t, 2.0, 2.3)}>!</text>}
      {/* brilho de disposição quando fecha os punhos */}
      {t > 3.8 && [0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * Math.PI * 2 + 0.3; const p = er(t, 3.8, 4.3); return <path key={i} d={`M${655 + Math.cos(a) * 190},${450 + Math.sin(a) * 190} l${Math.cos(a) * 40 * p},${Math.sin(a) * 40 * p}`} stroke={GOLD} strokeWidth={9} strokeLinecap="round" opacity={p * (1 - er(t, 4.8, 5.3))} />; })}
    </g>
  );
};
const CAM1d2 = (t0: number): Cam => {
  const t = t0 - T1;
  return { z: kf(t, [[-T1, 1.25], [1.0, 1.2], [1.5, 1.08], [2.1, 1.08], [2.9, 1.18], [4.4, 1.32]]), fx: kf(t, [[-T1, 480], [1.0, 480], [1.5, 590], [2.9, 630]]), fy: kf(t, [[-T1, 690], [1.5, 620], [2.9, 560], [4.4, 520]]) };
};

// --- escritório do dia 2: a pilha de tarefas acumuladas (e a bandeja do que já foi feito)
const PILE = 24;
const Tray: React.FC<{ n: number }> = ({ n }) => (
  <g>
    <path d="M858,846 L940,846 L934,862 L864,862 Z" fill="#4a4f5a" stroke={INK} strokeWidth={4} />
    {Array.from({ length: n }).map((_, i) => <rect key={i} x={862 + ((i * 5) % 7) - 3} y={838 - i * 9} width={74} height={10} fill={i % 2 ? "#ece7da" : "#f6f2e8"} stroke={INK} strokeWidth={2} />)}
    <rect x={870} y={866} width={60} height={22} rx={4} fill={GREEN} stroke={INK} strokeWidth={3} />
    <text x={900} y={883} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={17} fill="#fff">FEITO</text>
  </g>
);
const PileLabel: React.FC<{ n: number }> = ({ n }) => n <= 0 ? null : (
  <g transform={`translate(285,${846 - n * 12 - 30}) rotate(-6)`}>
    <rect x={-58} y={-20} width={116} height={36} rx={6} fill="#f5d36a" stroke={INK} strokeWidth={3.5} />
    <text x={0} y={7} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={22} fill="#b83a2a">URGENTE</text>
  </g>
);
const S4d2 = (t: number) => {
  const m = follow((x) => {
    const c = marcosDesk(x, 0);
    const look = er(x, 0.5, 0.9) * (1 - er(x, 2.0, 2.3));
    const breath = Math.sin(clamp01((x - 1.6) / 0.8) * Math.PI);
    c.hands = [[-70, -112], [70, -112]];
    c.sy = -breath * 10; c.hy = -breath * 4;
    c.face = F({ lx: -0.75 * look, px: -1 * look, ly: 0.1 - breath * 0.1, raise: look * 0.6, eyeS: 1 + look * 0.15, open: breath > 0.6 ? 0.1 : 1 - blinkAt(x, 2.6, 1.2), worry: lerp(0.2, -0.35, er(x, 2.1, 2.5)), curve: lerp(-0.1, 0.2, er(x, 2.1, 2.5)), mo: breath * 0.2 });
    return c;
  }, t);
  return (<g><Office t={t} /><Person c={m} look={MARCOS_SUIT} t={t} /><DeskOffice papers={PILE} envelope={0} phoneBuzz={-1} t={t} /><PileLabel n={PILE} /><Tray n={0} /></g>);
};
const CAM4d2 = (t: number): Cam => ({ z: kf(t, [[0, 1.45], [1.0, 1.45], [2.0, 1.08]]), fx: kf(t, [[0, 330], [1.0, 360], [2.0, 540]]), fy: kf(t, [[0, 660], [1.0, 660], [2.0, 650]]) });

// --- S5d2 o chefe grita de novo, e o Marcos não se abala: olha, acena com calma e volta a trabalhar
const BOSS_OFF = 0.55;
const S5d2 = (t: number) => {
  const x = t + BOSS_OFF;
  const ch = follow(bossAt, x);
  const m = follow((y) => {
    const s = y - BOSS_OFF;
    const typing = 1 - er(s, 0.4, 0.7) + er(s, 2.6, 2.9);
    const c = marcosDesk(s, clamp01(typing) * 0.8);
    const look = er(s, 0.5, 0.9) * (1 - er(s, 2.5, 2.8));
    const nod = Math.sin(clamp01((s - 1.9) / 0.6) * Math.PI * 2) * er(s, 1.9, 2.0);
    c.hy = nod * 7;
    c.face = F({ lx: look * 0.6, px: look, ly: lerp(0.35, 0.05, look), py: lerp(0.6, 0, look), worry: -0.15, curve: 0.08, open: 0.88 - blinkAt(s, 2.4, 0.3) * 0.8, raise: -0.05 });
    return c;
  }, x);
  return (
    <g>
      <Office t={x} />
      <Person c={m} look={MARCOS_SUIT} t={x} />
      <Person c={ch} look={CHEFE} t={x} />
      <DeskOffice papers={PILE} envelope={0} phoneBuzz={-1} t={x} />
      <PileLabel n={PILE} /><Tray n={0} />
      {x > 1.65 && [0, 1, 2].map((i) => <path key={i} d={`M${700 - i * 10},${300 + i * 40} l-${40 + i * 10},-${20 - i * 10}`} stroke={RED} strokeWidth={8} strokeLinecap="round" opacity={0.5 + 0.5 * Math.sin(x * 20 + i)} />)}
      {x > 1.7 && <text x={300} y={290} fontFamily={BARLOW} fontWeight={700} fontSize={90} fill={RED} stroke={INK} strokeWidth={4} transform={`rotate(-8 300 290) scale(${1 + Math.sin(x * 18) * 0.03})`}>!!!</text>}
    </g>
  );
};
const CAM5d2 = (t: number): Cam => ({ z: kf(t, [[0, 1.0], [1.8, 1.0], [2.6, 1.3]]) + (t > 1.1 && t < 1.8 ? Math.sin(t * 40) * 0.004 : 0), fx: kf(t, [[0, 600], [1.8, 600], [2.6, 540]]), fy: kf(t, [[0, 640], [1.8, 640], [2.6, 560]]) });

// --- S6d2 faz tudo: a pilha desce, cada folha voa para a bandeja FEITO, relógio da parede girando
const DONE_T = (i: number) => 0.35 + (i / PILE) * 3.7;
const S6d2 = (t: number) => {
  const done = Array.from({ length: PILE }).filter((_, i) => t > DONE_T(i) + 0.25).length;
  const flying = Array.from({ length: PILE }).map((_, i) => i).filter((i) => t > DONE_T(i) && t <= DONE_T(i) + 0.25);
  const m = follow((x) => {
    const c = marcosDesk(x, 1);
    c.hands = [[-60 + Math.sin(x * 15) * 8, -112 - (0.5 - 0.5 * Math.cos(x * 19)) * 16], [60 + Math.sin(x * 13 + 2) * 8, -112 - (0.5 - 0.5 * Math.cos(x * 19 + 2.4)) * 16]];
    c.face = F({ ly: 0.3, py: 0.5, lx: Math.sin(x * 3) * 0.15, worry: -0.4, curve: 0.15, open: 0.92 - blinkAt(x, 2.2, 0.5) * 0.8, raise: -0.1 });
    c.sy = Math.sin(x * 8) * 2;
    c.sweat = er(x, 2.0, 2.6) * (1 - er(x, 3.8, 4.2));
    return c;
  }, t);
  return (
    <g>
      <Office t={t} spin={t * 160} />
      <Person c={m} look={MARCOS_SUIT} t={t} />
      <DeskOffice papers={PILE - done - flying.length} envelope={0} phoneBuzz={-1} t={t} />
      <PileLabel n={PILE - done - flying.length} />
      <Tray n={done} />
      {flying.map((i) => {
        const k = (t - DONE_T(i)) / 0.25;
        const from: V = [285, 846 - (PILE - i - 1) * 12], to: V = [900, 838 - i * 9];
        const p = mixV(from, to, smooth(k));
        return <rect key={i} x={p[0] - 55} y={p[1] - 6 - Math.sin(k * Math.PI) * 200} width={110} height={12} fill="#f6f2e8" stroke={INK} strokeWidth={2.5} transform={`rotate(${Math.sin(k * Math.PI) * 25} ${p[0]} ${p[1] - Math.sin(k * Math.PI) * 200})`} />;
      })}
      {/* ✓ verde a cada tarefa feita */}
      {Array.from({ length: PILE }).map((_, i) => {
        const q = t - DONE_T(i) - 0.25;
        if (q < 0 || q > 0.5) return null;
        return <g key={i} transform={`translate(${900 + ((i * 37) % 60) - 30},${700 - q * 120}) scale(${backPop(q * 2)})`} opacity={1 - ramp(q, 0.3, 0.5)}><circle r={26} fill={GREEN} stroke={INK} strokeWidth={4} /><path d="M-11,1 L-3,10 L13,-9" stroke="#fff" strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>;
      })}
      {/* contador de tarefas */}
      <g transform="translate(540,190)">
        <rect x={-190} y={-44} width={380} height={88} rx={18} fill="#14100c" stroke={done === PILE ? GREEN : GOLD} strokeWidth={6} />
        <text x={0} y={20} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={58} fill={done === PILE ? GREEN : WHITE} letterSpacing={2}>TAREFAS {done}/{PILE}</text>
      </g>
    </g>
  );
};
const CAM6d2 = (t: number): Cam => ({ z: kf(t, [[0, 1.0], [4.6, 1.06]]), fx: 560, fy: kf(t, [[0, 600], [4.6, 590]]) });

// --- S7d2 mesa limpa; o chefe passa, para e estranha (olhos arregalados, boca aberta)
const S7d2 = (t: number) => {
  const ch = follow((x) => {
    const wx = kf(x, [[0, 1240], [0.8, 870]]);
    const v = x < 0.8 ? 1 - er(x, 0.65, 0.8) : 0;
    const w = walkPose((1240 - wx) / 1.04, v, -1);
    const surp = er(x, 0.75, 1.0);
    return base({ x: wx, y: 690, k: 1.04, feet: w.feet, kneeDir: -1, sy: w.sy - surp * 8, lean: w.lean, hands: x < 0.8 ? w.hands : [mixV([-86, -14], [-60, -60], surp), mixV([86, -14], [70, -150], er(x, 1.2, 1.5))], face: F({ lx: -0.7 * surp + 0.5 * (1 - surp), px: -1 * surp, eyeS: 1 + surp * 0.4, pupil: 1 - surp * 0.4, raise: surp * 1.3, worry: lerp(-0.6, 0.1, surp), mo: surp * 0.5, curve: 0 }), tilt: surp * 6 });
  }, t);
  const m = follow((x) => {
    const c = marcosDesk(x, 0);
    c.hands = [[-80, -116], [80, -116]];
    c.face = F({ lx: er(x, 0.9, 1.2) * 0.6, px: er(x, 0.9, 1.2), ly: 0.05, curve: 0.45, worry: -0.2, raise: 0.25, open: 1 - blinkAt(x, 2.0, 0.4) });
    c.sy = -4;
    return c;
  }, t);
  return (
    <g>
      <Office t={t} spin={-60} />
      <Person c={m} look={MARCOS_SUIT} t={t} />
      <Person c={ch} look={CHEFE} t={t} />
      <DeskOffice papers={0} envelope={0} phoneBuzz={-1} t={t} />
      <Tray n={PILE} />
      {t > 1.0 && <text x={790} y={240} fontFamily={BARLOW} fontWeight={700} fontSize={110} fill={GOLD} stroke={INK} strokeWidth={5} transform={`scale(${backPop(t - 1.0)})`} style={{ transformOrigin: "830px 200px" }}>?!</text>}
    </g>
  );
};
const CAM7d2 = (t: number): Cam => ({ z: kf(t, [[0, 1.0], [1.2, 1.0], [2.4, 1.12]]), fx: 640, fy: 620 });

// --- casa à noite: Juliana sentada à mesa olhando uma conta; Marcos chega pela porta
const JS_K = 0.95;
// aviso de corte de luz (papel vermelho, legível no close)
const CutNotice: React.FC = () => (
  <g transform="translate(-40,-4) rotate(-3)">
    <rect x={-66} y={-48} width={132} height={96} rx={4} fill="#fdf3ee" stroke={INK} strokeWidth={3.5} />
    <rect x={-66} y={-48} width={132} height={30} rx={4} fill="#c8322a" stroke={INK} strokeWidth={3} />
    <text x={0} y={-27} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={19} fill="#fff" letterSpacing={0.5}>AVISO DE CORTE</text>
    <text x={-14} y={22} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={40} fill="#c8322a">LUZ</text>
    <path d="M30,-8 L18,14 L28,14 L22,36 L40,8 L30,8 L36,-8 Z" fill={GOLD} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
    <rect x={-52} y={34} width={104} height={5} fill="#e0a8a0" />
  </g>
);
const julSit = (x: number, o: { up?: number; hope?: number } = {}): Ch => {
  const up = o.up ?? 0, hope = o.hope ?? 0;
  const bl = blinkAt(x, 3.1, 0.7);
  return base({
    x: SEAT_X, y: SEAT_Y - 12, k: JS_K, sit: 1,
    hands: [mixV([-40, -112], [-60, -40], up), mixV([40, -112], [60, -40], up)],
    holdR: up < 0.5 ? <CutNotice /> : undefined,
    face: F({ lx: up * 0.7, px: up, ly: lerp(0.45, -0.15, up), py: lerp(0.9, -0.4, up), worry: lerp(1.0, 0.15, hope), curve: lerp(-0.4, 0.4, hope), open: lerp(0.8, 1, up) - bl * 0.7, wide: lerp(0.5 * up, 0.9, hope) * (1 - hope * 0.3), raise: 0.2 + hope * 0.1, eyeS: 1.05 }),
    tilt: lerp(-4, 4, up), sy: lerp(6, 0, up),
  });
};
const MH_Y = FLOOR_N - 296;
const S8d2 = (t: number) => {
  const door = 1 - er(t, 1.6, 2.0);
  const j = follow((x) => julSit(x, { up: er(x, 3.5, 4.0) }), t);
  const m = follow((x) => {
    const wx = kf(x, [[0.0, 940], [1.3, 830]]);
    const v = x < 1.3 ? 1 - er(x, 1.1, 1.3) : 0;
    const w = walkPose((940 - wx), v, -1);
    const see = er(x, 1.0, 1.5);
    return base({ x: wx, y: MH_Y, k: 1, feet: w.feet, kneeDir: -1, sy: w.sy, lean: w.lean, hands: v > 0.05 ? w.hands : HANG, holdR: <Briefcase />, face: F({ lx: -0.7, px: -1, curve: lerp(0.35, -0.3, see), worry: lerp(0, 0.7, see), open: 1 - blinkAt(x, 2.5, 0.6) }) });
  }, t);
  return (<g><HouseNight t={t} door={door} /><NightChair /><Person c={j} look={JULIANA} t={t} /><NightTable papers={5} /><Person c={m} look={MARCOS_HOME} t={t} />{lightRoom(0.4)}</g>);
};
const CAM8d2 = (t: number): Cam => ({ z: kf(t, [[0, 1.1], [1.5, 1.1], [1.95, 2.5], [3.3, 2.6], [3.85, 1.75]]), fx: kf(t, [[0, 700], [1.5, 700], [1.95, 545], [3.3, 545], [3.85, 590]]), fy: kf(t, [[0, 640], [1.5, 640], [1.95, 730], [3.3, 730], [3.85, 520]]) });

// --- S9/S10/S11: ele se aproxima, põe a mão no ombro dela e promete; o rosto dela muda para esperança
const MP_X = 812;
const marcosNear = (x: number, o: { walk?: boolean; promise?: number; end?: boolean } = {}): Ch => {
  const wx = o.walk ? kf(x, [[0, 830], [0.6, MP_X]]) : MP_X;
  const v = o.walk && x < 0.6 ? 1 - er(x, 0.45, 0.6) : 0;
  const w = walkPose((830 - wx), v, -1);
  const reach = o.walk ? er(x, 0.7, 1.3) : 1;
  const pr = o.promise ?? 0;
  // ombro direito da Juliana (mundo) convertido para o sistema dele
  const shJ: V = [SEAT_X + 70 * JULIANA.width * JS_K, SEAT_Y - 12 + (-TORSO + 12) * JS_K + 6];
  const hand = toLocal(shJ, wx, MH_Y, 1);
  return base({
    x: wx, y: MH_Y, k: 1, feet: v > 0.05 ? w.feet : STAND_FEET, kneeDir: -1, sy: v > 0.05 ? w.sy : 0, lean: lerp(0, -22, reach),
    hands: [mixV(HANG[0], hand, reach), mixV(HANG[1], [94, -22], pr)], elbowL: reach > 0.3 ? 1 : -1,
    face: F({ lx: lerp(-0.7, -0.5, reach), px: -1, ly: 0.25, py: 0.5, curve: lerp(-0.3, 0.4, pr), worry: lerp(0.7, -0.3, pr), open: 0.95 - blinkAt(x + (o.end ? 7 : 0), 2.8, 0.3) * 0.8, raise: lerp(0.1, -0.1, pr) }),
    tilt: -4 * reach,
  });
};
const Briefcase0: React.FC = () => <g transform="translate(905,935) rotate(4)"><Briefcase /></g>;
const S9d2 = (t: number) => {
  const j = follow((x) => julSit(x + 1, { up: 1 }), t);
  const m = follow((x) => marcosNear(x, { walk: true }), t);
  return (<g><HouseNight t={t} door={0} /><NightChair /><Person c={j} look={JULIANA} t={t} /><NightTable papers={5} /><Briefcase0 /><Person c={m} look={MARCOS_HOME} t={t} />{lightRoom(0.45)}</g>);
};
const CAM9d2 = (t: number): Cam => ({ z: kf(t, [[0, 1.3], [3.0, 1.4]]), fx: 690, fy: kf(t, [[0, 560], [3.0, 540]]) });
const S10d2 = (t: number, end: boolean) => {
  const j = follow((x) => julSit(x + 4, { up: 1, hope: end ? 1 : er(x, 1.0, 3.2) }), t);
  const m = follow((x) => marcosNear(x, { promise: end ? 1 : er(x, 0.2, 0.8), end }), t);
  const glow = end ? 1 : er(t, 0.6, 3.0);
  return (
    <g>
      <HouseNight t={t} door={0} />
      <defs><radialGradient id="prom" cx="680" cy="460" r="560" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ffcf6a" stopOpacity={0.55} /><stop offset="1" stopColor="#ffcf6a" stopOpacity={0} /></radialGradient></defs>
      <rect x={-400} y={-400} width={1880} height={2400} fill="url(#prom)" opacity={glow} style={{ mixBlendMode: "screen" }} />
      {/* a foto da família na parede ganha brilho */}
      <rect x={392} y={224} width={236} height={196} rx={12} fill="none" stroke={GOLD} strokeWidth={6} opacity={glow * 0.8} style={{ filter: "blur(3px)" }} />
      <NightChair />
      <Person c={j} look={JULIANA} t={t} />
      <NightTable papers={5} />
      <Briefcase0 />
      <Person c={m} look={MARCOS_HOME} t={t} />
    </g>
  );
};
const CAM10d2 = (t: number): Cam => ({ z: kf(t, [[0, 1.4], [3.8, 1.58]]), fx: 690, fy: kf(t, [[0, 540], [3.8, 480]]) });
const CAM11d2 = (t: number): Cam => ({ z: 1.6 + t * 0.02, fx: 690, fy: 470 });

// ==================================================================
// DIA 3 — cenas novas
// ==================================================================

// --- cozinha de manhã: mesa larga com três lugares (Marcos à esquerda, Juliana no meio, Lucas à direita)
const K_TABLE_Y = 706, K_FLOOR = 948, K_SEAT = 780;
const K_PLACES = [460, 700, 930];
const Steam: React.FC<{ x: number; y: number; t: number; a?: number }> = ({ x, y, t, a = 1 }) => (
  <g opacity={a}>
    {[0, 1, 2].map((i) => {
      const q = ((t * 0.7 + i / 3) % 1);
      return <path key={i} d={`M${x - 10 + i * 10},${y - q * 60} q${8 * Math.sin(t * 3 + i)},-12 0,-24 q${-8 * Math.sin(t * 3 + i)},-12 0,-24`} stroke="#fff" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.55 * Math.sin(q * Math.PI)} />;
    })}
  </g>
);
const PlateEgg: React.FC<{ x: number; pop: number }> = ({ x, pop }) => pop <= 0 ? null : (
  <g transform={`translate(${x},${K_TABLE_Y + 16}) scale(${pop})`}>
    <ellipse cx={0} cy={0} rx={50} ry={14} fill="#f6f4ee" stroke={INK} strokeWidth={4} />
    <ellipse cx={-6} cy={-3} rx={22} ry={7} fill="#fff" stroke={INK} strokeWidth={2.5} />
    <ellipse cx={-6} cy={-5} rx={8} ry={4} fill="#f2b42a" />
    <rect x={14} y={-10} width={24} height={10} rx={4} fill="#d89a5a" stroke={INK} strokeWidth={2.5} />
  </g>
);
const Cup: React.FC<{ x: number; pop: number; t: number; steam?: number }> = ({ x, pop, t, steam = 1 }) => pop <= 0 ? null : (
  <g>
    <g transform={`translate(${x},${K_TABLE_Y + 4}) scale(${pop})`}>
      <path d="M-16,-30 L16,-30 L13,0 L-13,0 Z" fill="#f4f1ea" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      <path d="M16,-24 q14,2 0,16" stroke={INK} strokeWidth={4} fill="none" />
      <ellipse cx={0} cy={-29} rx={14} ry={4} fill="#5a3418" />
    </g>
    {pop > 0.9 && <Steam x={x} y={K_TABLE_Y - 32} t={t} a={steam} />}
  </g>
);
const CoffeePot: React.FC<{ x: number; pop: number; t: number }> = ({ x, pop, t }) => pop <= 0 ? null : (
  <g>
    <g transform={`translate(${x},${K_TABLE_Y + 6}) scale(${pop})`}>
      <path d="M-26,-70 L26,-70 L32,0 L-32,0 Z" fill="#c43d30" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      <path d="M26,-60 q22,10 6,40" stroke={INK} strokeWidth={6} fill="none" />
      <path d="M-26,-62 L-44,-74" stroke={INK} strokeWidth={8} strokeLinecap="round" />
      <rect x={-20} y={-84} width={40} height={16} rx={5} fill="#2a2a33" stroke={INK} strokeWidth={4} />
    </g>
    {pop > 0.9 && <Steam x={x - 46} y={K_TABLE_Y - 74} t={t + 0.4} />}
  </g>
);
const Bread: React.FC<{ x: number; pop: number }> = ({ x, pop }) => pop <= 0 ? null : (
  <g transform={`translate(${x},${K_TABLE_Y + 8}) scale(${pop})`}>
    <path d="M-44,-4 Q-48,10 -30,12 L30,12 Q48,10 44,-4 Z" fill="#a8734a" stroke={INK} strokeWidth={4} />
    {[-22, 0, 22].map((dx, i) => <ellipse key={i} cx={dx} cy={-10} rx={18} ry={12} fill="#e2a860" stroke={INK} strokeWidth={3.5} />)}
  </g>
);
// frigideira com dois ovos (segurada pelo cabo)
const Pan: React.FC<{ t: number }> = ({ t }) => (
  <g transform={`rotate(${Math.sin(t * 6) * 4})`}>
    <rect x={-6} y={-6} width={70} height={12} rx={5} fill="#2a1b12" stroke={INK} strokeWidth={3} transform="rotate(180) translate(-6,0)" />
    <ellipse cx={-110} cy={0} rx={56} ry={18} fill="#3a3a44" stroke={INK} strokeWidth={5} />
    <ellipse cx={-110} cy={-4} rx={46} ry={12} fill="#24242c" />
    {[-128, -94].map((x) => <g key={x}><ellipse cx={x} cy={-6} rx={16} ry={6} fill="#fff" /><circle cx={x} cy={-7} r={5} fill="#f2b42a" /></g>)}
  </g>
);
const KitchenBack: React.FC<{ t: number; door?: number }> = ({ t, door = 0 }) => (
  <g>
    <House t={t} door={door} night={0} />
    <rect x={-400} y={-400} width={1880} height={2000} fill="#ffe8b8" opacity={0.1} />
    {K_PLACES.map((x) => <ChairF key={x} x={x} seat={K_SEAT} floor={K_FLOOR - 6} s={0.82} />)}
  </g>
);
// mesa organizada: fundo da mesa com o bule (entre o Marcos e a Juliana) e o pão (entre a Juliana e o Lucas);
// na frente, um jogo americano por lugar com prato no centro, garfo à esquerda, faca à direita e xícara ao lado
const PlaceSet: React.FC<{ x: number; pop: number; cup: number; t: number; steam?: number }> = ({ x, pop, cup, t, steam = 1 }) => (
  <g>
    {pop > 0 && (
      <g transform={`translate(${x},${K_TABLE_Y + 22}) scale(${pop})`}>
        <rect x={-74} y={-13} width={148} height={26} rx={10} fill="#e8d6b0" stroke={INK} strokeWidth={3} />
        <rect x={-68} y={-8} width={136} height={16} rx={7} fill="none" stroke="#c4a878" strokeWidth={2} />
        <path d="M-62,-6 L-62,8 M-66,-6 L-66,0 M-58,-6 L-58,0" stroke="#9aa0a8" strokeWidth={3} strokeLinecap="round" />
        <path d="M58,-6 L58,8" stroke="#9aa0a8" strokeWidth={4} strokeLinecap="round" />
      </g>
    )}
    <g transform={`translate(${x - 8},${K_TABLE_Y + 14})`}><PlateEgg0 pop={pop} /></g>
    <Cup0 x={x + 46} y={K_TABLE_Y + 16} pop={cup} t={t} steam={steam} />
  </g>
);
const PlateEgg0: React.FC<{ pop: number }> = ({ pop }) => pop <= 0 ? null : (
  <g transform={`scale(${pop})`}>
    <ellipse cx={0} cy={0} rx={40} ry={11} fill="#f6f4ee" stroke={INK} strokeWidth={3.5} />
    <ellipse cx={-6} cy={-3} rx={18} ry={6} fill="#fff" stroke={INK} strokeWidth={2.2} />
    <ellipse cx={-6} cy={-4.5} rx={6.5} ry={3.5} fill="#f2b42a" />
    <rect x={12} y={-8} width={18} height={8} rx={3} fill="#d89a5a" stroke={INK} strokeWidth={2} />
  </g>
);
const Cup0: React.FC<{ x: number; y: number; pop: number; t: number; steam?: number }> = ({ x, y, pop, t, steam = 1 }) => pop <= 0 ? null : (
  <g>
    <g transform={`translate(${x},${y}) scale(${pop * 0.8})`}>
      <ellipse cx={0} cy={0} rx={20} ry={6} fill="#f6f4ee" stroke={INK} strokeWidth={3} />
      <path d="M-14,-30 L14,-30 L11,-2 L-11,-2 Z" fill="#f4f1ea" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      <path d="M14,-24 q12,2 0,14" stroke={INK} strokeWidth={4} fill="none" />
      <ellipse cx={0} cy={-29} rx={12} ry={3.5} fill="#5a3418" />
    </g>
    {pop > 0.9 && <Steam x={x} y={y - 26} t={t} a={steam * 0.8} />}
  </g>
);
const KitchenTable: React.FC<{ t: number; food: [number, number, number, number]; mSteam?: number; card?: number }> = ({ t, food, mSteam = 1, card = 1 }) => (
  <g>
    <Table x={695} y={K_TABLE_Y} w={680} floor={K_FLOOR} />
    {/* fundo da mesa: bule e cesta de pão nos vãos entre os lugares */}
    <g transform="translate(0,-8)"><CoffeePot x={580} pop={food[2]} t={t} /></g>
    <g transform="translate(818,-10)"><Bread x={0} pop={food[1]} /></g>
    <BdayCard pop={card} />
    {/* frente: um lugar por pessoa */}
    <PlaceSet x={K_PLACES[0]} pop={food[0]} cup={food[3]} t={t} steam={mSteam} />
    <PlaceSet x={K_PLACES[1]} pop={food[0]} cup={food[3]} t={t + 1} />
    <PlaceSet x={K_PLACES[2]} pop={food[0]} cup={food[3]} t={t + 2} />
  </g>
);

// cartão "FELIZ ANIVERSÁRIO, JU" em pé atrás do prato da Juliana
const CARD: V = [K_PLACES[1] + 4, 702];
const BdayCard: React.FC<{ pop: number }> = ({ pop }) => pop <= 0 ? null : (
  <g transform={`translate(${CARD[0]},${CARD[1]}) scale(${backPop(pop)})`}>
    <path d="M-48,0 L-44,-62 L44,-62 L48,0 Z" fill="#f7c4d0" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
    <path d="M-44,-62 L44,-62" stroke="#e090a4" strokeWidth={3} />
    <text x={0} y={-44} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={13} fill="#8a2a3c">FELIZ</text>
    <text x={0} y={-30} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={13} fill="#8a2a3c">ANIVERSÁRIO,</text>
    <text x={0} y={-12} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={17} fill="#c8322a">JU ♥</text>
  </g>
);
// S2d3 faz o café: atrás da mesa, frigideira na mão, a comida aparece na mesa conforme a fala
const S2d3 = (t: number) => {
  const m = follow((x) => base({
    x: K_PLACES[0], y: 646, k: 1, lean: Math.sin(x * 2) * 4,
    hands: [[-70, -120], [96 + Math.sin(x * 6) * 6, -150]], holdR: <Pan t={x} />, holdL: <path d="M0,0 L-40,-30" stroke="#6a4426" strokeWidth={7} strokeLinecap="round" />,
    face: F({ lx: lerp(0.35, 0.7, er(x, 1.9, 2.3)), px: lerp(0.5, 1, er(x, 1.9, 2.3)), ly: lerp(0.2, 0.45, er(x, 1.9, 2.3)), py: lerp(0.3, 0.8, er(x, 1.9, 2.3)), curve: 0.55 + er(x, 2.0, 2.4) * 0.25, raise: 0.2, open: 1 - blinkAt(x, 2.5, 0.4) }),
  }), t);
  const food: [number, number, number, number] = [backPop(t - 0.4), backPop(t - 1.0), backPop(t - 1.5), backPop(t - 1.9)];
  return (<g><KitchenBack t={t} /><Person c={m} look={MARCOS_HOME} t={t} /><KitchenTable t={t} food={food} card={ramp(t, 1.9, 2.25)} />{lightRoom(0.4)}</g>);
};
const CAM2d3 = (t: number): Cam => ({ z: kf(t, [[0, 1.3], [1.8, 1.25], [2.3, 2.6], [3.6, 2.7], [4.1, 1.25]]), fx: kf(t, [[0, 640], [1.8, 660], [2.3, CARD[0]], [3.6, CARD[0]], [4.1, 680]]), fy: kf(t, [[0, 600], [1.8, 600], [2.3, 660], [3.6, 660], [4.1, 600]]) });

// família sentada: Juliana no meio, Lucas à direita
const julKitchen = (x: number, o: { look?: number; sad?: number } = {}): Ch => {
  const look = o.look ?? 0, sad = o.sad ?? 0;
  return base({ x: K_PLACES[1], y: K_SEAT - 12, k: 0.95, sit: 1, hands: [[-50, -80], [60, -96]], face: F({ lx: lerp(0.1, -0.8, look), px: lerp(0.1, -1, look), ly: lerp(0.15, 0.35, sad), py: sad * 0.6, curve: lerp(0.6, -0.3, sad), worry: sad * 0.8, open: 1 - blinkAt(x, 3.0, 0.9) * 0.8, raise: 0.15 }), tilt: sad * -4 });
};
const lucasKitchen = (x: number, o: { look?: number; sad?: number; eat?: number } = {}): Ch => {
  const look = o.look ?? 0, sad = o.sad ?? 0, eat = o.eat ?? 0;
  const bite = eat * (0.5 - 0.5 * Math.cos(x * 5));
  return base({ x: K_PLACES[2], y: K_SEAT - 10, k: 0.68, sit: 1, hands: [[-60, -110], mixV([70, -110], [40, -260], bite)], face: F({ lx: lerp(0.2, -0.8, look), px: lerp(0.2, -1, look), curve: lerp(0.8, -0.2, sad), mo: bite * 0.3, open: 1 - blinkAt(x, 2.3, 0.2) * 0.8, raise: 0.3 * (1 - sad), worry: sad * 0.5 }), hy: bite * 4 });
};

// S3d3 olha a hora (07:41!), pega a pasta, acena e sai correndo pela porta da esquerda
const S3d3 = (t: number) => {
  const m = follow((x) => {
    const wx = kf(x, [[2.3, 330], [3.6, -170]]);
    const v = x < 2.3 ? 0 : 1;
    const w = walkPose((330 - wx) * 1.0, v, -1);
    const phone = 1 - er(x, 1.0, 1.3);
    const wave = er(x, 1.4, 1.6) * (1 - er(x, 2.1, 2.3));
    const shock = er(x, 0.5, 0.7);
    return base({
      x: wx, y: 646, k: 1, feet: w.feet, kneeDir: -1, sy: w.sy, lean: w.lean * 1.4,
      hands: v > 0.5 ? w.hands : [HANG[0], phone > 0.5 ? [36, -170] : mixV(HANG[1], [110, -330 + Math.sin(x * 20) * 20], wave)],
      holdR: phone > 0.5 ? <PhoneS /> : undefined, holdL: x > 1.1 ? <Briefcase /> : undefined,
      face: F({ lx: phone > 0.5 ? 0.3 : 0.6, px: phone > 0.5 ? 0.3 : 1, ly: phone > 0.5 ? 0.4 : 0, py: phone > 0.5 ? 0.9 : 0, eyeS: 1 + shock * 0.3 * phone, raise: shock * 0.8, worry: 0.4, mo: shock * 0.4 * phone, curve: wave > 0.3 ? 0.3 : -0.2 }),
      sweat: shock * phone,
    });
  }, t);
  const j = follow((x) => julKitchen(x, { look: er(x, 0.6, 1.0), sad: er(x, 2.6, 3.4) }), t);
  const l = follow((x) => lucasKitchen(x, { look: er(x, 0.7, 1.1), sad: er(x, 2.8, 3.5) }), t);
  const food: [number, number, number, number] = [1, 1, 1, 1];
  const door = er(t, 2.4, 2.8) * (1 - er(t, 3.5, 3.8));
  const chip = backPop(t - 0.45) * (1 - er(t, 1.6, 1.9));
  return (
    <g>
      <KitchenBack t={t} door={door} />
      <Person c={j} look={JULIANA} t={t} />
      <Person c={l} look={LUCAS} t={t} />
      <KitchenTable t={t} food={food} />
      <Person c={m} look={MARCOS_SUIT} t={t} />
      {chip > 0 && (
        <g transform={`translate(360,130) scale(${chip})`}>
          <rect x={-120} y={-46} width={240} height={92} rx={18} fill="#14100c" stroke={RED} strokeWidth={6} />
          <text x={0} y={22} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={60} fill={RED} style={{ filter: `drop-shadow(0 0 6px ${RED})` }}>07:41</text>
        </g>
      )}
      {lightRoom(0.4)}
    </g>
  );
};
const CAM3d3 = (t: number): Cam => ({ z: kf(t, [[0, 1.15], [3.9, 1.1]]), fx: kf(t, [[0, 580], [2.3, 580], [3.9, 600]]), fy: 600 });

// S4d3 o lugar dele vazio: prato e café esfriando, Juliana olha a cadeira vazia; Lucas come
const S4d3 = (t: number) => {
  const j = follow((x) => { const c = julKitchen(x + 4, { look: 1, sad: 1 }); c.face.ly = 0.35; c.face.py = 0.6; return c; }, t);
  const l = follow((x) => lucasKitchen(x + 4, { look: 0, sad: 0.6, eat: 1 }), t);
  return (
    <g>
      <KitchenBack t={t} />
      <Person c={j} look={JULIANA} t={t} />
      <Person c={l} look={LUCAS} t={t} />
      <KitchenTable t={t} food={[1, 1, 1, 1]} mSteam={1 - er(t, 0.4, 2.2)} />
    </g>
  );
};
const CAM4d3 = (t: number): Cam => ({ z: kf(t, [[0, 1.6], [2.6, 1.45]]), fx: kf(t, [[0, 630], [2.6, 650]]), fy: kf(t, [[0, 650], [2.6, 620]]) });

// --- joalheria à noite: vitrine iluminada com o anel no centro
const RING: V = [470, 588];
const Sparkle: React.FC<{ x: number; y: number; s: number }> = ({ x, y, s }) => s <= 0 ? null : (
  <path d={`M${x},${y - 18 * s} L${x + 4 * s},${y - 4 * s} L${x + 18 * s},${y} L${x + 4 * s},${y + 4 * s} L${x},${y + 18 * s} L${x - 4 * s},${y + 4 * s} L${x - 18 * s},${y} L${x - 4 * s},${y - 4 * s} Z`} fill="#fff" stroke="#fff6c8" strokeWidth={2} />
);
const Ring: React.FC<{ t: number; big?: number }> = ({ t, big = 1 }) => (
  <g>
    <rect x={RING[0] - 90} y={RING[1] + 26} width={180} height={64} rx={20} fill="#6a1a2a" stroke={INK} strokeWidth={5} />
    <path d={`M${RING[0] - 70},${RING[1] + 40} Q${RING[0]},${RING[1] + 20} ${RING[0] + 70},${RING[1] + 40}`} stroke="#8a2a3c" strokeWidth={6} fill="none" />
    <ellipse cx={RING[0]} cy={RING[1] + 6} rx={40} ry={34} fill="none" stroke={INK} strokeWidth={20} />
    <ellipse cx={RING[0]} cy={RING[1] + 6} rx={40} ry={34} fill="none" stroke={GOLD} strokeWidth={12} />
    <path d={`M${RING[0] - 26},${RING[1] - 34} L${RING[0] - 14},${RING[1] - 52} L${RING[0] + 14},${RING[1] - 52} L${RING[0] + 26},${RING[1] - 34} L${RING[0]},${RING[1] - 8} Z`} fill="#bfe8ff" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
    <path d={`M${RING[0] - 26},${RING[1] - 34} L${RING[0] + 26},${RING[1] - 34} M${RING[0] - 8},${RING[1] - 52} L${RING[0]},${RING[1] - 34} L${RING[0] + 8},${RING[1] - 52}`} stroke="#7ab0d8" strokeWidth={2.5} fill="none" />
    <circle cx={RING[0]} cy={RING[1] - 34} r={70 * big} fill="#fff6c8" opacity={0.18 + 0.08 * Math.sin(t * 5)} />
    {[[-50, -70], [44, -64], [-30, -10], [58, -20], [0, -96]].map(([dx, dy], i) => <Sparkle key={i} x={RING[0] + dx * big} y={RING[1] + dy * big} s={Math.max(0, Math.sin(t * 4 + i * 1.7)) * big} />)}
    {/* etiqueta de preço */}
    <g transform={`translate(${RING[0] + 96},${RING[1] + 30}) rotate(8)`}>
      <line x1={-30} y1={-26} x2={-6} y2={-6} stroke={INK} strokeWidth={2} />
      <rect x={-8} y={-16} width={86} height={38} rx={6} fill="#fdfbf4" stroke={INK} strokeWidth={3} />
      <text x={35} y={10} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={17} fill="#2a2836">R$ 1.890</text>
    </g>
  </g>
);
const Store: React.FC<{ t: number; glow?: number }> = ({ t, glow = 1 }) => (
  <g>
    <defs>
      <linearGradient id="vitrine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff0c8" /><stop offset="1" stopColor="#d8a860" /></linearGradient>
      <linearGradient id="brick" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a1a22" /><stop offset="1" stopColor="#4a2c26" /></linearGradient>
    </defs>
    <rect x={-400} y={-400} width={1880} height={1360} fill="url(#brick)" />
    {Array.from({ length: 16 }).map((_, r) => <line key={r} x1={-400} y1={-60 + r * 60} x2={1480} y2={-60 + r * 60} stroke="#1e1218" strokeWidth={3} opacity={0.5} />)}
    {/* letreiro */}
    <rect x={150} y={150} width={640} height={96} rx={12} fill="#14100c" stroke={GOLD} strokeWidth={6} />
    <text x={470} y={220} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={68} fill={GOLD} letterSpacing={6} style={{ filter: `drop-shadow(0 0 8px ${GOLD})` }}>JOALHERIA</text>
    {/* vitrine */}
    <rect x={130} y={290} width={680} height={520} fill="url(#vitrine)" stroke={INK} strokeWidth={8} />
    <rect x={130} y={720} width={680} height={90} fill="#3a2418" stroke={INK} strokeWidth={5} />
    {/* colar no busto e relógio */}
    <path d="M200,700 Q200,560 250,540 Q300,560 300,700 Z" fill="#2a2a33" stroke={INK} strokeWidth={4} />
    <path d="M222,575 Q250,630 278,575" stroke={GOLD} strokeWidth={6} fill="none" />
    <circle cx={250} cy={624} r={8} fill="#e05a7a" stroke={INK} strokeWidth={2} />
    <rect x={650} y={640} width={90} height={60} rx={10} fill="#2a2a33" stroke={INK} strokeWidth={4} />
    <circle cx={695} cy={632} r={26} fill="#f4f1ea" stroke={GOLD} strokeWidth={6} />
    <Ring t={t} />
    <rect x={130} y={290} width={680} height={520} fill="none" stroke="#6a4426" strokeWidth={14} />
    <path d="M150,310 L300,310 L150,460 Z" fill="#fff" opacity={0.18} />
    {/* calçada */}
    <rect x={-400} y={960} width={1880} height={600} fill="#4a4a52" />
    <rect x={-400} y={940} width={1880} height={24} fill="#6a6a72" stroke={INK} strokeWidth={4} />
    {/* luz da vitrine na calçada */}
    <path d="M130,964 L810,964 L980,1300 L-40,1300 Z" fill="#ffd890" opacity={0.18 * glow} />
  </g>
);
// Marcos na frente da vitrine, à direita, olhando o anel
const MS_X = 800, MS_Y = 690;
const S7d3 = (t: number) => {
  const m = follow((x) => {
    const wx = kf(x, [[0, 1220], [1.6, MS_X]]);
    const v = x < 1.6 ? 1 - er(x, 1.4, 1.6) : 0;
    const w = walkPose((1220 - wx), v, -1);
    const see = er(x, 1.4, 1.9);
    return base({ x: wx, y: MS_Y, k: 1, feet: w.feet, kneeDir: -1, sy: w.sy, lean: w.lean, hands: v > 0.05 ? w.hands : HANG, holdL: <Briefcase />, face: F({ lx: lerp(-0.4, -0.85, see), px: -1, ly: 0.1, py: 0.2, eyeS: 1 + see * 0.25, raise: see * 0.7, curve: lerp(0.1, 0.5, see), open: 1 - blinkAt(x, 2.6, 0.2) }) });
  }, t);
  return (<g><Store t={t} /><Person c={m} look={MARCOS_SUIT} t={t} /><rect x={-400} y={-400} width={1880} height={2400} fill="#0a1030" opacity={0.18} /></g>);
};
const CAM7d3 = (t: number): Cam => ({ z: kf(t, [[0, 1.05], [4.3, 1.12]]), fx: 600, fy: 590 });
// close no anel
const S8d3 = (t: number) => (<g><Store t={t} /><rect x={-400} y={-400} width={1880} height={2400} fill="#0a1030" opacity={0.1} /></g>);
const CAM8d3 = (t: number): Cam => ({ z: kf(t, [[0, 2.2], [2.8, 2.9]]), fx: RING[0] + 20, fy: RING[1] - 10 });

// celular: saldo da conta carregando → R$ 0,00 ZERADA
const ZT = 1.3;
const PhoneZ = (t: number) => {
  const hit = backPop(t - ZT);
  const shake = t > ZT && t < ZT + 0.5 ? Math.sin(t * 90) * 10 * (1 - (t - ZT) / 0.5) : 0;
  return (
    <g>
      <rect x={-400} y={-400} width={1880} height={2400} fill="#140c08" />
      <g transform={`translate(${540 + shake},610) rotate(-3)`}>
        <rect x={-300} y={-520} width={600} height={1060} rx={60} fill="#15161c" stroke={INK} strokeWidth={8} />
        <rect x={-270} y={-480} width={540} height={980} rx={30} fill="#f4f6fb" />
        <text x={-230} y={-400} fontFamily={BARLOW} fontWeight={700} fontSize={48} fill="#2a2836">MINHA CONTA</text>
        <rect x={-230} y={-350} width={460} height={4} fill="#c8ccd8" />
        <text x={-230} y={-230} fontFamily={BARLOW} fontWeight={600} fontSize={40} fill="#55525f">SALDO DISPONÍVEL</text>
        {t < ZT && <text x={0} y={-80} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={70} fill="#9aa0b2">{"R$ " + ".".repeat(1 + (Math.floor(t * 5) % 3))}</text>}
        {t >= ZT && (
          <g transform={`translate(0,-90) scale(${hit})`}>
            <text x={0} y={0} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={110} fill={RED}>R$ 0,00</text>
            <rect x={-200} y={40} width={400} height={70} rx={12} fill={RED} stroke={INK} strokeWidth={5} transform="rotate(-6)" />
            <text x={0} y={92} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={56} fill="#fff" transform="rotate(-6)">ZERADA</text>
          </g>
        )}
        <rect x={-230} y={150} width={460} height={110} rx={18} fill="#e8eaf2" />
        <text x={0} y={218} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={36} fill="#9aa0b2">PRÓXIMO SALÁRIO: 28 DIAS</text>
      </g>
      {t >= ZT && <rect x={-400} y={-400} width={1880} height={2400} fill={RED} opacity={0.25 * (1 - ramp(t, ZT, ZT + 0.6))} />}
    </g>
  );
};
const CAM9d3 = (t: number): Cam => ({ z: kf(t, [[0, 0.95], [2.9, 1.02]]), fx: 540, fy: 610 });

// S10d3 vira de costas para a vitrine: triste → decidido, punhos fechados, luz dourada; final com zoom
const S10d3 = (t: number, end: boolean) => {
  const m = follow((x) => {
    const sad = end ? 0 : 1 - er(x, 1.1, 2.0);
    const d = end ? 1 : er(x, 1.1, 2.2);
    const fist = end ? 1 : er(x, 1.6, 2.2);
    return base({
      x: MS_X, y: MS_Y, k: 1, holdL: <Briefcase />,
      hands: [mixV(HANG[0], [-92, -20], fist), mixV(HANG[1], [92, -20], fist)],
      face: F({ lx: lerp(-0.3, 0, d), ly: lerp(0.45, -0.08, d), py: lerp(0.9, -0.1, d), worry: lerp(0.9, -0.55, d) * (sad > 0 ? 1 : 1), curve: lerp(-0.5, -0.05, d), open: lerp(0.7, 0.86, d) - blinkAt(x + (end ? 7 : 0), 3.0, 0.6) * 0.7, raise: lerp(0, -0.25, d) }),
      sy: lerp(10, -8, d), tilt: lerp(-5, 0, d), tremble: !end && fist > 0.5 && fist < 0.98 ? 0.15 : 0,
    });
  }, t);
  const glow = end ? 1 : er(t, 1.2, 2.8);
  return (
    <g>
      <Store t={t} glow={0.6} />
      <rect x={-400} y={-400} width={1880} height={2400} fill="#0a1030" opacity={0.25} />
      <defs><radialGradient id="rim3" cx={MS_X} cy="420" r="520" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ffcf6a" stopOpacity={0.55} /><stop offset="1" stopColor="#ffcf6a" stopOpacity={0} /></radialGradient></defs>
      <rect x={-400} y={-400} width={1880} height={2400} fill="url(#rim3)" opacity={glow} style={{ mixBlendMode: "screen" }} />
      <Person c={m} look={MARCOS_SUIT} t={t} />
    </g>
  );
};
const CAM10d3 = (t: number): Cam => ({ z: kf(t, [[0, 1.3], [1.2, 1.35], [3.8, 1.75]]), fx: kf(t, [[0, 700], [3.8, 760]]), fy: kf(t, [[0, 540], [3.8, 430]]) });
const CAM11d3 = (t: number): Cam => ({ z: 1.75 + t * 0.02, fx: 760, fy: 430 });

// --- S5d3 escritório curto e novo: (A) seu Roberto grita, Marcos calmo, enquadramento fechado;
// (B) TAREFAS 24/24, relógio 16:30, ele olha o relógio e a foto da família na mesa, pensando no aniversário
const OFF_A = 3.1;
const DeskPhoto: React.FC = () => (
  <g transform="translate(330,846) rotate(-6) scale(0.42)">
    <path d="M60,180 L40,250" stroke={INK} strokeWidth={10} />
    <Frame x={0} y={0} />
  </g>
);
const S5d3 = (t: number) => {
  if (t < OFF_A) return S5d2(t + 0.9);
  const x = t - OFF_A;
  const m = follow((y) => {
    const c = marcosDesk(y, 0);
    const clock = er(y, 0.2, 0.5) * (1 - er(y, 1.6, 1.9));
    const photo = er(y, 1.7, 2.1);
    c.hands = [[-80, -116], [80, -116]];
    c.face = F({ lx: -0.6 * clock - 0.7 * photo, px: -0.8 * clock - 1 * photo, ly: -0.45 * clock + 0.45 * photo, py: -0.9 * clock + 0.8 * photo, curve: 0.2 + photo * 0.5, worry: -0.1, raise: clock * 0.4 + photo * 0.2, open: 1 - blinkAt(y, 2.4, 0.4) * 0.8 });
    c.tilt = photo * -5; c.hx = -photo * 6;
    return c;
  }, x);
  const bub = er(x, 2.4, 2.8);
  return (
    <g>
      <Office t={x} hm={[16, 30]} />
      <Person c={m} look={MARCOS_SUIT} t={x} />
      <DeskOffice papers={0} envelope={0} phoneBuzz={-1} t={x} />
      <Tray n={PILE} />
      <DeskPhoto />
      <g transform="translate(540,190)">
        <rect x={-190} y={-44} width={380} height={88} rx={18} fill="#14100c" stroke={GREEN} strokeWidth={6} />
        <text x={0} y={20} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={58} fill={GREEN} letterSpacing={2}>TAREFAS {PILE}/{PILE}</text>
      </g>
      {/* balão de pensamento: o aniversário dela */}
      {bub > 0 && (
        <g opacity={bub} transform={`translate(0,${(1 - bub) * 20})`}>
          <circle cx={470} cy={560} r={10} fill="#fdfbf4" stroke={INK} strokeWidth={3} />
          <circle cx={440} cy={520} r={15} fill="#fdfbf4" stroke={INK} strokeWidth={3} />
          <ellipse cx={380} cy={440} rx={92} ry={62} fill="#fdfbf4" stroke={INK} strokeWidth={4} />
          <path d="M380,474 C330,440 340,404 366,404 C376,404 380,412 380,418 C380,412 384,404 394,404 C420,404 430,440 380,474 Z" fill="#e05a7a" stroke={INK} strokeWidth={3.5} />
          <text x={380} y={442} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={22} fill="#fff">JU</text>
        </g>
      )}
    </g>
  );
};
const CAM5d3 = (t: number): Cam => t < OFF_A
  ? { z: 1.4, fx: 690, fy: 540 }
  : { z: kf(t - OFF_A, [[0, 1.05], [1.5, 1.08], [2.2, 1.3], [4.5, 1.36]]), fx: kf(t - OFF_A, [[0, 540], [1.5, 520], [2.2, 470]]), fy: kf(t - OFF_A, [[0, 600], [1.5, 600], [2.2, 600]]) };

// --- S11d3 a flor: (A) no caminho, colhe uma flor amarela num canteiro; (B) em casa, entrega para a Juliana,
// ela sorri e encosta nele (abraço de lado, o braço dele no ombro dela); o Lucas espia da porta
const FL_B = 2.2;
const Flower: React.FC<{ s?: number }> = ({ s = 1 }) => (
  <g transform={`scale(${s})`}>
    <path d="M0,0 Q4,-40 0,-80" stroke="#3f8a3a" strokeWidth={6} fill="none" strokeLinecap="round" />
    <path d="M2,-40 q16,-12 26,-4 q-12,10 -26,4" fill="#5aa84a" stroke={INK} strokeWidth={2.5} />
    {Array.from({ length: 7 }).map((_, i) => { const a = (i / 7) * Math.PI * 2; return <ellipse key={i} cx={Math.cos(a) * 15} cy={-80 + Math.sin(a) * 15} rx={11} ry={8} transform={`rotate(${(a * 180) / Math.PI} ${Math.cos(a) * 15} ${-80 + Math.sin(a) * 15})`} fill="#f5d040" stroke={INK} strokeWidth={2.5} />; })}
    <circle cx={0} cy={-80} r={9} fill="#c8862a" stroke={INK} strokeWidth={2.5} />
  </g>
);
const Street: React.FC<{ t: number; picked: boolean; planter?: boolean }> = ({ t, picked, planter = true }) => (
  <g>
    <rect x={-400} y={-400} width={1880} height={1360} fill="#24182a" />
    {Array.from({ length: 16 }).map((_, r) => <line key={r} x1={-400} y1={-60 + r * 60} x2={1480} y2={-60 + r * 60} stroke="#180e1c" strokeWidth={3} opacity={0.5} />)}
    {/* poste de luz */}
    <rect x={150} y={150} width={18} height={810} fill="#2a2a33" stroke={INK} strokeWidth={4} />
    <path d="M120,150 L200,150 L186,120 L134,120 Z" fill="#3a3a44" stroke={INK} strokeWidth={4} />
    <defs><radialGradient id="poste" cx="160" cy="170" r="520" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ffd890" stopOpacity={0.5} /><stop offset="1" stopColor="#ffd890" stopOpacity={0} /></radialGradient></defs>
    <rect x={-400} y={-400} width={1880} height={2000} fill="url(#poste)" style={{ mixBlendMode: "screen" }} />
    {/* calçada */}
    <rect x={-400} y={960} width={1880} height={600} fill="#4a4a52" />
    <rect x={-400} y={940} width={1880} height={24} fill="#6a6a72" stroke={INK} strokeWidth={4} />
    {/* canteiro com flores amarelas */}
    {planter && [440, 490, 540, 600, 650].map((x, i) => (picked && i === 4) ? null : <g key={x} transform={`translate(${x},${872}) rotate(${Math.sin(t * 2 + i) * 3})`}><Flower s={0.8} /></g>)}
    {planter && <rect x={400} y={860} width={290} height={90} rx={8} fill="#7a5236" stroke={INK} strokeWidth={5} />}
    {planter && <rect x={410} y={852} width={270} height={18} rx={6} fill="#4a3020" stroke={INK} strokeWidth={4} />}
    {void t}
  </g>
);
const JULF_Y = FLOOR_N - 296 * 0.95;
const S11d3 = (t: number) => {
  if (t < FL_B) {
    const m = follow((x) => {
      const wx = kf(x, [[0, 1180], [0.8, 760]]);
      const v = x < 0.8 ? 1 - er(x, 0.65, 0.8) : 0;
      const w = walkPose((1180 - wx), v, -1);
      const bend = er(x, 0.85, 1.25) * (1 - er(x, 1.45, 1.8));
      const got = x > 1.35;
      return base({
        x: wx, y: 690, k: 1, feet: w.feet, kneeDir: -1, sy: w.sy + bend * 64, lean: w.lean - bend * 26,
        hands: v > 0.05 ? w.hands : [HANG[0], got ? mixV([-110, 70], [-60, -190], er(x, 1.45, 1.8)) : mixV(HANG[1], [-110, 70], bend)],
        holdR: got ? <g transform="rotate(-10)"><Flower s={0.9} /></g> : undefined, holdL: <Briefcase />,
        face: F({ lx: -0.6, px: -0.8, ly: 0.2 + bend * 0.4, py: 0.5 + bend * 0.4, curve: got ? 0.6 : 0.2, raise: got ? 0.3 : 0, open: 1 - blinkAt(x, 2.4, 0.3) }),
      });
    }, t);
    return (<g><Street t={t} picked={t > 1.35} /><Person c={m} look={MARCOS_SUIT} t={t} /></g>);
  }
  const x0 = t - FL_B;
  const hug = (x: number) => er(x, 0.9, 1.4);
  const m = follow((x) => {
    const give = er(x, 0.1, 0.5) * (1 - er(x, 0.7, 0.9));
    const h = hug(x);
    // abraço de lado: o braço passa POR TRÁS dela e a mão fica no ombro de lá (escondida atrás das costas dela)
    const shJ: V = [660 + 70 * JULIANA.width * 0.95 - h * 18 - 10, JULF_Y + (-TORSO + 12) * 0.95 + 14];
    return base({
      x: 500, y: MH_Y, k: 1, lean: h * 10,
      hands: [HANG[0], h > 0.01 ? mixV([110, -150], toLocal(shJ, 500, MH_Y, 1), h) : mixV(HANG[1], [110, -150], give)],
      holdR: x < 0.8 ? <g transform="rotate(-10)"><Flower s={0.9} /></g> : undefined,
      face: F({ lx: 0.6, px: 0.9, ly: 0.15, py: 0.3, curve: 0.55 + h * 0.25, raise: 0.2, open: 1 - blinkAt(x, 2.6, 0.5) * 0.8 }),
      tilt: h * 5,
    });
  }, x0);
  const j = follow((x) => {
    const got = x > 0.8;
    const h = hug(x);
    const smile = er(x, 0.6, 1.1);
    return base({
      x: 660 - h * 18, y: JULF_Y, k: 0.95, lean: -h * 14,
      hands: got ? [mixV([-60, -150], [-26, -170], h), mixV([30, -150], [80, -30], h)] : [mixV(HANG[0], [-80, -150], er(x, 0.4, 0.8)), HANG[1]],
      holdL: got ? <g transform="rotate(10)"><Flower s={0.9} /></g> : undefined,
      face: F({ lx: lerp(-0.6, -0.2, h), px: lerp(-0.9, -0.3, h), ly: got ? 0.2 : 0, py: got ? 0.4 : 0, curve: lerp(0.1, 0.9, smile), raise: 0.3, open: h > 0.5 ? 0.12 : 1 - blinkAt(x, 3, 0.3) * 0.8, mo: smile * 0.15 * (1 - h) }),
      tilt: -h * 10, hx: -h * 10,
    });
  }, x0);
  const l = follow((x) => base({ x: 910, y: FLOOR_N - 296 * 0.68, k: 0.68, hands: [[-70, -120], HANG[1]], face: F({ lx: -0.8, px: -1, curve: 0.8, raise: 0.4, open: 1 - blinkAt(x, 2.2, 0.1) * 0.8 }), lean: -14, tilt: -6 }), x0);
  return (
    <g>
      <HouseNight t={x0} door={1} />
      {x0 > 0.6 && <Person c={l} look={LUCAS} t={x0} />}
      {hug(x0) > 0.05 ? <><Person c={m} look={MARCOS_HOME} t={x0} /><Person c={j} look={JULIANA} t={x0} /></> : <><Person c={j} look={JULIANA} t={x0} /><Person c={m} look={MARCOS_HOME} t={x0} /></>}
      {/* mão dele aparecendo no ombro de lá da Juliana (o braço passa por trás das costas dela) */}
      {hug(x0) > 0.6 && <g transform={`translate(${m.x + m.hands[1][0]},${MH_Y + m.hands[1][1]}) rotate(-70)`} opacity={clamp01((hug(x0) - 0.6) / 0.3)}><ellipse cx={6} cy={0} rx={21} ry={17} fill={SKIN} stroke={INK} strokeWidth={4.5} /><ellipse cx={0} cy={15} rx={9} ry={7} transform="rotate(30)" fill={SKIN} stroke={INK} strokeWidth={4} /></g>}
      {hug(x0) > 0.5 && [0, 1, 2].map((i) => { const q = ((x0 * 0.6 + i / 3) % 1); return <path key={i} transform={`translate(${590 + (i - 1) * 50},${340 - q * 120}) scale(${0.8 + q * 0.4})`} d="M0,14 C-16,2 -12,-10 -4,-10 C-1,-10 0,-7 0,-5 C0,-7 1,-10 4,-10 C12,-10 16,2 0,14 Z" fill="#e05a7a" stroke={INK} strokeWidth={2} opacity={Math.sin(q * Math.PI)} />; })}
      {lightRoom(0.5)}
    </g>
  );
};
const CAMFL = (t: number): Cam => t < FL_B
  ? { z: kf(t, [[0, 1.15], [1.3, 1.3], [2.2, 1.35]]), fx: kf(t, [[0, 700], [1.3, 680]]), fy: kf(t, [[0, 600], [1.3, 640]]) }
  : { z: kf(t - FL_B, [[0, 1.3], [2.8, 1.45]]), fx: 640, fy: kf(t - FL_B, [[0, 560], [2.8, 520]]) };
const CAMFL2 = (t: number): Cam => ({ z: kf(t, [[0, 1.45], [5.6, 1.7]]), fx: kf(t, [[0, 640], [5.6, 600]]), fy: kf(t, [[0, 520], [5.6, 470]]) });

// ==================================================================
// DIA 4 — cenas novas
// ==================================================================

// --- S2d4 café da manhã juntos: Marcos sentado no lugar dele, todos comendo e rindo; relógio 07:05 em verde
const S2d4 = (t: number) => {
  const m = follow((x) => {
    const laugh = er(x, 2.4, 2.7) * (1 - er(x, 3.8, 4.2));
    return base({
      x: K_PLACES[0], y: K_SEAT - 12, k: 1, sit: 1,
      hands: [[-54, -84], [64, -100]],
      face: F({ lx: lerp(0.3, 0.7, laugh), px: lerp(0.4, 1, laugh), curve: 0.7, mo: laugh * (0.4 + 0.2 * Math.sin(x * 20)), raise: 0.2 + laugh * 0.2, open: laugh > 0.5 ? 0.15 : 1 - blinkAt(x, 2.6, 0.3) * 0.8 }),
      hy: laugh * Math.sin(x * 20) * 3,
    });
  }, t);
  const j = follow((x) => {
    const laugh = er(x, 2.4, 2.7) * (1 - er(x, 3.8, 4.2));
    const c = julKitchen(x, { look: 0.9 });
    c.face = F({ lx: -0.7, px: -1, curve: 0.8, mo: laugh * (0.35 + 0.2 * Math.sin(x * 18)), raise: 0.25, open: laugh > 0.5 ? 0.15 : 1 - blinkAt(x, 3.0, 0.9) * 0.8 });
    c.hy = laugh * Math.sin(x * 18) * 3;
    return c;
  }, t);
  const l = follow((x) => {
    const c = lucasKitchen(x, { look: 0.8, eat: 1 - er(x, 2.2, 2.4) });
    const laugh = er(x, 2.4, 2.7) * (1 - er(x, 3.8, 4.2));
    c.face.mo = Math.max(c.face.mo, laugh * 0.5); c.face.curve = 0.9; c.hy = (c.hy ?? 0) + laugh * Math.sin(x * 22) * 4;
    return c;
  }, t);
  const chip = backPop(t - 0.4);
  return (
    <g>
      <KitchenBack t={t} />
      <Person c={m} look={MARCOS_SUIT} t={t} />
      <Person c={j} look={JULIANA} t={t} />
      <Person c={l} look={LUCAS} t={t} />
      <KitchenTable t={t} food={[1, 1, 1, 1]} card={0} />
      {chip > 0 && (
        <g transform={`translate(700,140) scale(${chip})`}>
          <rect x={-150} y={-46} width={300} height={92} rx={18} fill="#14100c" stroke={GREEN} strokeWidth={6} />
          <text x={-20} y={22} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={60} fill={GREEN} style={{ filter: `drop-shadow(0 0 6px ${GREEN})` }}>07:05</text>
          <circle cx={100} cy={0} r={24} fill={GREEN} stroke={INK} strokeWidth={3} />
          <path d="M89,1 L97,10 L112,-8" stroke="#fff" strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {lightRoom(0.5)}
    </g>
  );
};
const CAM2d4 = (t: number): Cam => ({ z: kf(t, [[0, 1.12], [4.6, 1.22]]), fx: 695, fy: kf(t, [[0, 600], [4.6, 585]]) });

// --- S3d4 escritório: o grito do seu Roberto em plano fechado (mesmo desenho do Dia 3)
const S3d4 = (t: number) => S5d2(t + 0.9);
const CAM3d4 = (t: number): Cam => ({ z: kf(t, [[0, 1.4], [3.4, 1.48]]), fx: 690, fy: 540 });

// --- anúncio de emprego colado no muro da rua
const PHONE_NUM = "(11) 99999-9999";
const JobAd: React.FC<{ glow: number; t: number }> = ({ glow, t }) => (
  <g transform="translate(330,330) rotate(-2)">
    <rect x={-20} y={-20} width={420} height={500} fill="#ffd890" opacity={glow * (0.25 + 0.08 * Math.sin(t * 4))} rx={20} style={{ filter: "blur(10px)" }} />
    <rect x={0} y={0} width={380} height={460} fill="#fdfbf4" stroke={INK} strokeWidth={5} />
    <rect x={0} y={0} width={380} height={90} fill="#2f6aa8" stroke={INK} strokeWidth={5} />
    <text x={190} y={62} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={50} fill="#fff" letterSpacing={2}>VAGA DE EMPREGO</text>
    <text x={190} y={150} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={44} fill="#2a2836">ANALISTA</text>
    <text x={190} y={196} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={44} fill="#2a2836">DE VENDAS</text>
    <text x={190} y={258} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={36} fill="#2f9a5a">R$ 6.500</text>
    <rect x={30} y={290} width={320} height={4} fill="#c8ccd8" />
    <text x={190} y={340} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={30} fill="#55525f">LIGUE AGORA:</text>
    <text x={190} y={392} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={34} fill={RED}>{PHONE_NUM}</text>
    {[30, 340].map((x) => <circle key={x} cx={x + 6} cy={18} r={7} fill="#c8c8c0" stroke={INK} strokeWidth={2} />)}
  </g>
);
const AD_X = 880;
// etiqueta pequena e cinza ao lado do salário do anúncio: o que ele ganha hoje
const NowPay: React.FC<{ p: number }> = ({ p }) => p <= 0 ? null : (
  <g transform={`translate(526,613) rotate(-2) scale(${backPop(p)})`}>
    <rect x={-76} y={-16} width={152} height={33} rx={9} fill="#2a2a33" stroke={INK} strokeWidth={3} opacity={0.92} />
    <text x={0} y={8} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={22} fill="#a8adb8" letterSpacing={1}>HOJE: R$ 2.300</text>
  </g>
);
const S4d4 = (t: number) => {
  const m = follow((x) => {
    const wx = kf(x, [[0, 1220], [1.5, AD_X]]);
    const v = x < 1.5 ? 1 - er(x, 1.3, 1.5) : 0;
    const w = walkPose((1220 - wx), v, -1);
    const see = er(x, 1.2, 1.7);
    return base({ x: wx, y: 690, k: 1, feet: w.feet, kneeDir: -1, sy: w.sy, lean: w.lean, hands: v > 0.05 ? w.hands : HANG, holdL: <Briefcase />, face: F({ lx: lerp(-0.3, -0.85, see), px: -1, ly: -0.1, py: -0.2, eyeS: 1 + see * 0.3 + er(x, 2.4, 2.8) * 0.15, pupil: 1 + see * 0.25, raise: see * 0.9 + er(x, 2.4, 2.8) * 0.3, curve: lerp(0, 0.6, er(x, 3.4, 3.9)), mo: see * 0.25 * (1 - er(x, 3.4, 3.8)) + er(x, 2.4, 2.7) * 0.2 * (1 - er(x, 3.4, 3.8)), open: 1 - blinkAt(x, 3.0, 0.2) }) });
  }, t);
  const shine = er(t, 4.25, 4.6);
  const hd = headLocal(m);
  return (
    <g>
      <Street t={t} picked={false} planter={false} />
      <JobAd glow={er(t, 1.4, 2.2)} t={t} />
      <NowPay p={t - 2.55} />
      <Person c={m} look={MARCOS_SUIT} t={t} />
      {/* brilho nos olhos */}
      {shine > 0 && [-1, 1].map((sd) => <Sparkle key={sd} x={m.x + hd[0] - 20 + sd * 22} y={m.y + hd[1] - 30} s={shine * (0.55 + 0.25 * Math.sin(t * 9 + sd))} />)}
      {shine > 0 && <circle cx={m.x + hd[0]} cy={m.y + hd[1]} r={120} fill="#ffd890" opacity={shine * 0.15} />}
    </g>
  );
};
const CAM4d4 = (t: number): Cam => ({ z: kf(t, [[0, 1.05], [2.0, 1.08], [5.6, 1.22]]), fx: kf(t, [[0, 640], [5.6, 650]]), fy: kf(t, [[0, 580], [5.6, 520]]) });

// --- S5d4 close no telefone do anúncio e ele anotando o número num bloquinho
const Notepad: React.FC<{ n: number }> = ({ n }) => (
  <g transform="rotate(-8)">
    <rect x={-70} y={-48} width={140} height={96} fill="#f5d36a" stroke={INK} strokeWidth={4} />
    {[-20, 0, 20].map((y) => <line key={y} x1={-60} y1={y + 6} x2={60} y2={y + 6} stroke="#d8b450" strokeWidth={2} />)}
    <text x={-60} y={-22} fontFamily={BARLOW} fontWeight={700} fontSize={16} fill="#2f6aa8">VAGA:</text>
    <text x={-60} y={6} fontFamily={MONO} fontWeight={800} fontSize={14} fill="#2a2836">{PHONE_NUM.slice(0, n)}</text>
  </g>
);
const S5d4 = (t: number) => {
  const n = Math.floor(clamp01((t - 0.5) / 0.85) * PHONE_NUM.length);
  const m = follow((x) => {
    const w = x > 0.45 ? 1 : 0;
    return base({ x: AD_X, y: 690, k: 1, hands: w ? [[-40, -150], [26 + Math.sin(x * 22) * 6, -146 + Math.cos(x * 17) * 4]] : HANG, holdL: w ? <Notepad n={n} /> : <Briefcase />, holdR: w ? <path d="M0,0 L18,-34" stroke="#2a2836" strokeWidth={6} strokeLinecap="round" /> : undefined, face: F({ lx: -0.5, px: -0.6, ly: 0.45, py: 0.9, curve: 0.5, raise: 0.2, open: 1 - blinkAt(x, 2.5, 0.2) * 0.8 }) });
  }, t);
  return (
    <g>
      <Street t={t} picked={false} planter={false} />
      <JobAd glow={1} t={t} />
      <NowPay p={1} />
      {t > 0.45 && <g transform="translate(905,935) rotate(4)"><Briefcase /></g>}
      <Person c={m} look={MARCOS_SUIT} t={t} />
    </g>
  );
};
const CAM5d4 = (t: number): Cam => t < 0.45
  ? { z: kf(t, [[0, 2.4], [1.2, 2.6]]), fx: 520, fy: 720 }
  : { z: 2.6, fx: AD_X - 40, fy: 690 - 150 };

// --- casa à noite: ele liga (celular no ouvido), consegue a entrevista; depois a dúvida
const callPose = (x: number, o: { phone?: number; worry?: number; chin?: number } = {}): Ch => {
  const ph = o.phone ?? 0, wo = o.worry ?? 0, chin = o.chin ?? 0;
  const c = marcosChair(x);
  c.holdR = ph > 0.5 ? <g transform="rotate(70)"><PhoneS /></g> : undefined;
  c.hands = [[-70, -26], chin > 0 ? mixV([70, -26], [14, -262], chin) : mixV([70, -26], [62, -330], ph)];
  c.face = F({ lx: ph > 0.5 ? 0.3 : 0, px: ph > 0.5 ? 0.4 : 0, ly: lerp(0, 0.3, wo), py: lerp(0, 0.5, wo), curve: lerp(0.5, -0.45, wo), worry: lerp(-0.1, 0.9, wo), raise: lerp(0.3, 0.1, wo), open: 1 - blinkAt(x, 2.6, 0.4) * 0.8, mo: ph > 0.5 && wo < 0.3 ? 0.25 * Math.max(0, Math.sin(x * 11)) : 0 });
  c.tilt = ph > 0.5 ? 6 : chin * -4;
  c.sweat = wo > 0.6 ? wo : 0;
  return c;
};
const InterviewCard: React.FC<{ p: number }> = ({ p }) => p <= 0 ? null : (
  <g transform={`translate(545,250) scale(${backPop(p)})`}>
    <rect x={-250} y={-70} width={500} height={140} rx={22} fill="#fdfbf4" stroke={INK} strokeWidth={6} />
    <circle cx={-180} cy={0} r={40} fill={GREEN} stroke={INK} strokeWidth={4} />
    <path d="M-196,2 L-184,15 L-162,-12" stroke="#fff" strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <text x={-120} y={-12} fontFamily={BARLOW} fontWeight={700} fontSize={40} fill="#2a2836">ENTREVISTA</text>
    <text x={-120} y={38} fontFamily={MONO} fontWeight={800} fontSize={34} fill="#2f9a5a">AMANHÃ, 10:00</text>
  </g>
);
const S6d4 = (t: number) => {
  const m = follow((x) => callPose(x, { phone: er(x, 0.2, 0.5) }), t);
  return (<g><HouseNight t={t} door={0} /><NightChair /><Person c={m} look={MARCOS_HOME} t={t} /><NightTable papers={0} /><InterviewCard p={t - 2.9} />{lightRoom(0.5)}</g>);
};
const CAM6d4 = (t: number): Cam => ({ z: kf(t, [[0, 1.25], [5.0, 1.35]]), fx: 545, fy: kf(t, [[0, 580], [5.0, 540]]) });
// balões de pensamento
const Bubble: React.FC<{ x: number; y: number; p: number; w?: number; h?: number; tail: V; children?: React.ReactNode }> = ({ x, y, p, w = 300, h = 170, tail, children }) => p <= 0 ? null : (
  <g opacity={clamp01(p * 2)} transform={`translate(${x},${y}) scale(${backPop(p)}) translate(${-x},${-y})`}>
    <circle cx={tail[0]} cy={tail[1]} r={10} fill="#fdfbf4" stroke={INK} strokeWidth={3} />
    <circle cx={lerp(tail[0], x, 0.45)} cy={lerp(tail[1], y + h / 2, 0.45)} r={16} fill="#fdfbf4" stroke={INK} strokeWidth={3} />
    <ellipse cx={x} cy={y} rx={w / 2} ry={h / 2} fill="#fdfbf4" stroke={INK} strokeWidth={5} />
    {children}
  </g>
);
const S7d4 = (t: number) => {
  const m = follow((x) => callPose(x + 6, { phone: 0, worry: er(x, 0.3, 1.2) }), t);
  const b1 = t - 0.9, b2 = t - 2.4;
  return (
    <g>
      <HouseNight t={t} door={0} /><NightChair /><Person c={m} look={MARCOS_HOME} t={t} /><NightTable papers={0} />
      <Bubble x={380} y={250} p={b1} w={270} h={160} tail={[480, 420]}>
        <text x={380} y={242} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={34} fill="#2a2836">SEM EXPERIÊNCIA</text>
        <text x={380} y={282} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={30} fill={RED}>NA ÁREA</text>
      </Bubble>
      <Bubble x={712} y={250} p={b2} w={260} h={160} tail={[610, 420]}>
        <circle cx={660} cy={250} r={42} fill="#f4f1ea" stroke={INK} strokeWidth={5} />
        <line x1={660} y1={250} x2={660} y2={218} stroke={INK} strokeWidth={6} strokeLinecap="round" />
        <line x1={660} y1={250} x2={636} y2={250} stroke={INK} strokeWidth={7} strokeLinecap="round" />
        <text x={755} y={242} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={32} fill={RED}>10:00</text>
        <text x={755} y={278} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={24} fill="#2a2836">TRABALHO</text>
      </Bubble>
      {lightRoom(0.4)}
    </g>
  );
};
const CAM7d4 = (t: number): Cam => ({ z: kf(t, [[0, 1.2], [4.8, 1.28]]), fx: 545, fy: kf(t, [[0, 560], [4.8, 540]]) });
// risco: o seu Roberto bravo dentro do balão + carimbo DEMITIDO?
const S8d4 = (t: number) => {
  const m = follow((x) => { const c = callPose(x + 9, { phone: 0, worry: 1 }); c.tremble = 0.3; return c; }, t);
  const boss = base({ x: 545, y: 622, k: 1.0, hands: [[-150, -200], [150, -200]], face: F({ lx: 0, worry: -0.9, raise: -0.2, mo: 0.6 + 0.3 * Math.sin(t * 18), curve: -0.4 }), red: 1, tremble: 0.6 });
  const stamp = t - 1.55;
  return (
    <g>
      <HouseNight t={t} door={0} /><NightChair /><Person c={m} look={MARCOS_HOME} t={t} /><NightTable papers={0} />
      <Bubble x={545} y={262} p={t - 0.1} w={420} h={290} tail={[545, 455]}>
        <defs><clipPath id="bossBub"><ellipse cx={545} cy={262} rx={205} ry={140} /></clipPath></defs>
        <g clipPath="url(#bossBub)"><Person c={boss} look={CHEFE} t={t} /></g>
      </Bubble>
      {stamp > 0 && (
        <g transform={`translate(545,380) rotate(-6) scale(${lerp(1.8, 1, clamp01(stamp / 0.18))})`} opacity={clamp01(stamp / 0.18)}>
          <rect x={-180} y={-40} width={360} height={80} rx={10} fill="none" stroke={RED} strokeWidth={8} />
          <text x={0} y={22} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={62} fill={RED}>DEMITIDO?</text>
        </g>
      )}
      {lightRoom(0.35)}
    </g>
  );
};
const CAM8d4 = (t: number): Cam => ({ z: kf(t, [[0, 1.28], [3.0, 1.36]]), fx: 545, fy: 520 });
// final: mão no queixo, pensando
const S9d4 = (t: number) => {
  const m = follow((x) => callPose(x + 12, { phone: 0, worry: 0.7, chin: er(x, 0.1, 0.6) }), t);
  return (<g><HouseNight t={t} door={0} /><NightChair /><Person c={m} look={MARCOS_HOME} t={t} /><NightTable papers={0} /><rect x={-400} y={-400} width={1880} height={2400} fill="#0a0604" opacity={0.15} /></g>);
};
const CAM9d4 = (t: number): Cam => ({ z: 1.75 + t * 0.03, fx: SEAT_X, fy: 470 });

// ==================================================================
// DIA 5 — cenas novas
// ==================================================================

// --- personagens novos: entrevistadora e candidatos (cada pessoa com id próprio por causa do clipPath da cabeça)
const INTERV: Look = { id: "iv", shirt: "#2f4a6a", shirt2: "#263c56", pants: "#2a2c36", shoes: "#151012", hair: "#1c1414", style: "juliana", sleeve: 0.86, width: 0.74 };
const CAND: Look[] = [
  { id: "k0", shirt: "#3a7a6a", shirt2: "#2e6458", pants: "#2e3040", shoes: "#222", hair: "#8a5a2a", style: "juliana", sleeve: 0.86, width: 0.72 },
  { id: "k1", shirt: "#5a5f6a", shirt2: "#4a4f5a", pants: "#5a5f6a", shoes: "#222", hair: "#2a1a10", style: "marcos", sleeve: 0.86, width: 0.8, suit: true, tie: "#8a2a3a" },
  { id: "k2", shirt: "#7a5aa0", shirt2: "#64488a", pants: "#2e3040", shoes: "#222", hair: "#1a1a1a", style: "juliana", sleeve: 0.86, width: 0.72 },
  { id: "k3", shirt: "#e9e6de", shirt2: "#cfcabd", pants: "#2b2d36", shoes: "#151012", hair: "#9a9a9a", style: "chefe", sleeve: 0.86, width: 0.95, tie: "#2a5a9a" },
  { id: "k4", shirt: "#4a3a30", shirt2: "#3a2c24", pants: "#4a3a30", shoes: "#222", hair: "#c8a050", style: "marcos", sleeve: 0.86, width: 0.8, suit: true, tie: "#3a8a5a" },
];
const STANDERS: [number, Look][] = [
  [240, { id: "s0", shirt: "#d07a3a", shirt2: "#b0642c", pants: "#3f4a6a", shoes: "#222", hair: "#2a1a10", style: "marcos", sleeve: 0.86, width: 0.82 }],
  [520, { id: "s1", shirt: "#3a4458", shirt2: "#2c3446", pants: "#3a4458", shoes: "#222", hair: "#5a3a22", style: "juliana", sleeve: 0.86, width: 0.72 }],
  [790, { id: "s2", shirt: "#5a8a5a", shirt2: "#4a744a", pants: "#3a3a44", shoes: "#222", hair: "#6a6a6a", style: "chefe", sleeve: 0.86, width: 0.9, tie: "#7a2a2a" }],
];

// --- relógio de parede (min = minutos desde 00:00)
const WallClock: React.FC<{ x: number; y: number; min: number; r?: number }> = ({ x, y, min, r = 52 }) => (
  <g transform={`translate(${x},${y})`}>
    <circle r={r} fill="#f4f1ea" stroke={INK} strokeWidth={6} />
    {Array.from({ length: 12 }).map((_, i) => { const a = (i * Math.PI) / 6; return <line key={i} x1={Math.sin(a) * (r - 12)} y1={-Math.cos(a) * (r - 12)} x2={Math.sin(a) * (r - 5)} y2={-Math.cos(a) * (r - 5)} stroke={INK} strokeWidth={3} />; })}
    <line x1={0} y1={0} x2={0} y2={-r * 0.5} stroke={INK} strokeWidth={8} strokeLinecap="round" transform={`rotate(${((min / 60) % 12) * 30})`} />
    <line x1={0} y1={0} x2={0} y2={-r * 0.78} stroke={INK} strokeWidth={5} strokeLinecap="round" transform={`rotate(${(min % 60) * 6})`} />
    <circle r={5} fill={INK} />
  </g>
);
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.floor(min % 60)).padStart(2, "0")}`;

// --- balão de fala (retângulo com rabinho)
const Speech: React.FC<{ x: number; y: number; p: number; w: number; h: number; tail: V; children?: React.ReactNode }> = ({ x, y, p, w, h, tail, children }) => {
  const k = backPop(p);
  if (k <= 0) return null;
  return (
    <g transform={`translate(${x},${y}) scale(${k}) translate(${-x},${-y})`}>
      <path d={`M${x - 26},${y + h / 2 - 4} L${tail[0]},${tail[1]} L${x + 26},${y + h / 2 - 4} Z`} fill="#fdfbf4" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={26} fill="#fdfbf4" stroke={INK} strokeWidth={5} />
      <rect x={x - 30} y={y + h / 2 - 9} width={60} height={12} fill="#fdfbf4" />
      {children}
    </g>
  );
};

// --- caixa de papelão com as coisas dele (origem no fundo, centro)
const BoxC: React.FC<{ s?: number }> = ({ s = 1 }) => (
  <g transform={`scale(${s})`}>
    {/* porta-retrato da família e plantinha saindo da caixa */}
    <g transform="translate(-34,-112) rotate(-10)">
      <rect x={-36} y={-34} width={72} height={60} rx={4} fill="#8a5a36" stroke={INK} strokeWidth={4} />
      <rect x={-28} y={-26} width={56} height={44} fill="#9ed0f0" stroke={INK} strokeWidth={2.5} />
      <rect x={-28} y={2} width={56} height={16} fill="#8cc070" />
      {[-14, 0, 14].map((dx, i) => <circle key={i} cx={dx} cy={-2} r={i === 2 ? 5 : 6.5} fill={SKIN} stroke={INK} strokeWidth={1.8} />)}
    </g>
    <g transform="translate(44,-104)">
      {[-30, 0, 30].map((a) => <path key={a} d="M0,0 Q-12,-26 0,-46 Q12,-26 0,0" fill="#5aa84a" stroke={INK} strokeWidth={3} transform={`rotate(${a})`} />)}
    </g>
    <path d="M-20,-104 L-8,-132 L8,-130 L4,-104" fill="#f4f1ea" stroke={INK} strokeWidth={3.5} />
    <rect x={-92} y={-104} width={184} height={104} fill="#c8955a" stroke={INK} strokeWidth={5} />
    <path d="M-92,-104 L-122,-130 L-64,-130 L-48,-104 Z" fill="#b5844c" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
    <path d="M92,-104 L122,-130 L64,-130 L48,-104 Z" fill="#b5844c" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
    <rect x={-92} y={-104} width={184} height={14} fill="#a87a44" opacity={0.6} />
    <text x={0} y={-36} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={32} fill="#3a2a1a" letterSpacing={2} transform="rotate(-3)">MARCOS</text>
  </g>
);

// ------------------------------------------------------------------ S2d5 casa de dia: ajusta a gravata, Juliana e Lucas desejam boa sorte, ele sai
const H_FEET = 942;
const S2d5 = (t: number) => {
  const m = follow((x) => {
    const tie = er(x, 0.1, 0.3) * (1 - er(x, 1.0, 1.2));
    const wx = kf(x, [[1.5, 560], [3.4, 170]]);
    const v = x < 1.5 ? 0 : x < 3.4 ? 1 - er(x, 3.15, 3.4) : 0;
    const w = walkPose(560 - wx, v, -1);
    const proud = er(x, 1.0, 1.3);
    return base({
      x: wx, y: H_FEET - 296, k: 1, feet: w.feet, kneeDir: v > 0 ? -1 : undefined, sy: w.sy - proud * 6 * (1 - v), lean: w.lean,
      hands: v > 0.05 ? w.hands : [HANG[0], mixV(HANG[1], [14 + Math.sin(x * 16) * 5, -206 + Math.cos(x * 13) * 3], tie)],
      holdL: <Briefcase />,
      face: F({ lx: v > 0.05 ? -0.5 : lerp(0.0, 0.55, er(x, 0.6, 1.0)), px: v > 0.05 ? -0.6 : lerp(0, 0.7, er(x, 0.6, 1.0)), ly: lerp(0.2, 0, er(x, 0.4, 0.8)), curve: lerp(0.35, 0.8, proud), raise: 0.2 + proud * 0.2, open: 1 - blinkAt(x, 2.6, 0.4) * 0.8, worry: -0.25 * proud }),
      hy: Math.sin(clamp01((x - 1.0) / 0.45) * Math.PI) * 6,
    });
  }, t);
  const j = follow((x) => {
    const wave = er(x, 0.5, 0.8) * (1 - er(x, 3.2, 3.6));
    return base({
      x: 770, y: H_FEET - 296 * 0.95, k: 0.95,
      hands: [[-70, -40], mixV(HANG[1], [118 + Math.sin(x * 12) * 22, -330], wave)],
      face: F({ lx: lerp(-0.4, -0.75, er(x, 1.5, 2.6)), px: -0.8, curve: 0.8, raise: 0.25, open: 1 - blinkAt(x, 3.0, 0.8) * 0.8, mo: wave * 0.25 * (1 - er(x, 1.3, 1.6)) }),
    });
  }, t);
  const l = follow((x) => {
    const wave = er(x, 0.6, 0.9) * (1 - er(x, 3.2, 3.6));
    const hop = Math.max(0, Math.sin(x * 9)) * wave;
    return base({
      x: 905, y: H_FEET - 296 * 0.68 - hop * 14, k: 0.68,
      hands: [mixV(HANG[0], [-112 - Math.sin(x * 14) * 20, -320], wave), HANG[1]],
      face: F({ lx: -0.7, px: -1, curve: 0.9, raise: 0.3, mo: 0.35 * wave, open: 1 - blinkAt(x, 2.4, 1.1) * 0.8 }),
    });
  }, t);
  const door = er(t, 2.4, 2.8);
  const spark = er(t, 1.0, 1.3) * (1 - er(t, 2.0, 2.4));
  return (
    <g>
      <House t={t} door={door} night={0} />
      <Person c={j} look={JULIANA} t={t} />
      <Person c={l} look={LUCAS} t={t} />
      <Person c={m} look={MARCOS_SUIT} t={t} />
      {spark > 0 && [0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * Math.PI * 2 + 0.4; return <path key={i} d={`M${560 + Math.cos(a) * 170},${470 + Math.sin(a) * 200} l${Math.cos(a) * 36 * spark},${Math.sin(a) * 36 * spark}`} stroke={GOLD} strokeWidth={9} strokeLinecap="round" opacity={spark} />; })}
      <Speech x={790} y={240} p={t - 0.5} w={280} h={96} tail={[770, 330]}>
        <text x={790} y={256} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={50} fill="#2a2836">BOA SORTE!</text>
      </Speech>
      {lightRoom(0.6)}
    </g>
  );
};
const CAM2d5 = (t: number): Cam => ({ z: kf(t, [[0, 1.08], [1.3, 1.14], [3.63, 1.04]]), fx: kf(t, [[0, 640], [1.3, 640], [3.63, 520]]), fy: kf(t, [[0, 600], [3.63, 610]]) });

// ------------------------------------------------------------------ sala de espera da empresa
const W_FLOOR = 950, SEAT_K = 0.8, W_SEAT = 1010 - 160 * SEAT_K;
const SEATS = [150, 290, 430, 570, 710, 850];
const WaitRoom: React.FC<{ t: number; min: number; next?: number }> = ({ t, min, next = 0 }) => (
  <g>
    <Wall a="#4c5868" b="#66717f" floor={W_FLOOR} fa="#4a4e56" fb="#24262c" />
    {[0, 1, 2].map((i) => <rect key={i} x={-120 + i * 460} y={60} width={240} height={34} rx={6} fill="#f4f6ff" opacity={0.55} />)}
    {/* placa do processo seletivo */}
    <rect x={330} y={150} width={420} height={128} rx={14} fill="#1e2a3a" stroke={INK} strokeWidth={5} />
    <text x={540} y={202} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={40} fill={GOLD} letterSpacing={2}>PROCESSO SELETIVO</text>
    <text x={540} y={252} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={38} fill={WHITE} letterSpacing={1}>ANALISTA DE VENDAS</text>
    {/* porta das entrevistas */}
    <Door x={-110} y={W_FLOOR - 420} open={0} />
    <rect x={-100} y={W_FLOOR - 478} width={170} height={44} rx={8} fill="#2a3442" stroke={INK} strokeWidth={4} />
    <text x={-15} y={W_FLOOR - 447} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={26} fill={WHITE}>ENTREVISTAS</text>
    {next > 0 && (
      <g opacity={next}>
        <rect x={-100} y={W_FLOOR - 540} width={170} height={50} rx={8} fill={GREEN} stroke={INK} strokeWidth={4} />
        <text x={-15} y={W_FLOOR - 506} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={30} fill="#0e2a18">PRÓXIMO</text>
      </g>
    )}
    <WallClock x={880} y={250} min={min} r={60} />
    <rect x={810} y={326} width={140} height={46} rx={8} fill="#14100c" stroke={INK} strokeWidth={4} />
    <text x={880} y={360} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={30} fill={RED}>{hhmm(min)}</text>
    {/* vaso de planta */}
    <g transform="translate(985,940)">
      {[-40, -15, 15, 40].map((a) => <path key={a} d="M0,-60 Q-18,-120 0,-170 Q18,-120 0,-60" fill="#4a8a40" stroke={INK} strokeWidth={3} transform={`rotate(${a} 0 -60)`} />)}
      <path d="M-40,-60 L40,-60 L30,0 L-30,0 Z" fill="#9a5a3a" stroke={INK} strokeWidth={4} />
    </g>
    {void t}
  </g>
);
const seated = (x: number, i: number, tt: number, o: Partial<Face> = {}): Ch => base({
  x, y: W_SEAT - 12 * SEAT_K, k: SEAT_K, sit: 1,
  hands: [[-56, -30], [56, -30]],
  face: F({ lx: Math.sin(i * 1.7) * 0.4, px: Math.sin(i * 1.7) * 0.5, ly: 0.15, curve: 0.05, open: 1 - blinkAt(tt, 2.4 + i * 0.37, i * 0.6) * 0.8, ...o }),
});
const stander = (x: number, i: number, tt: number): Ch => base({
  x, y: 938 - 296 * 0.72, k: 0.72,
  hands: i === 1 ? [[-40, -170], [86, -14]] : HANG,
  holdL: i === 1 ? <PhoneS /> : undefined,
  face: F({ lx: Math.sin(i * 2.3) * 0.5, px: Math.sin(i * 2.3) * 0.6, ly: i === 1 ? 0.5 : 0, py: i === 1 ? 1 : 0, curve: 0, open: 1 - blinkAt(tt, 2.8 + i * 0.3, i) * 0.8 }),
});
const Crowd: React.FC<{ t: number; gone?: (k: string) => number }> = ({ t, gone = () => 0 }) => (
  <g>
    {STANDERS.map(([x, lk], i) => { const g = gone(lk.id); return g >= 1 ? null : <g key={lk.id} opacity={1 - g}><Person c={stander(x, i, t)} look={lk} t={t} /></g>; })}
    {SEATS.map((x) => <ChairF key={x} x={x} seat={W_SEAT} floor={1010} s={SEAT_K} />)}
    {CAND.map((lk, i) => { const g = gone(lk.id); return g >= 1 ? null : <g key={lk.id} opacity={1 - g}><Person c={seated(SEATS[i], i, t)} look={lk} t={t} /></g>; })}
  </g>
);

// --- S3d5 chega à empresa: a sala está cheia de candidatos
const S3d5 = (t: number) => {
  const m = follow((x) => {
    const wx = kf(x, [[0, 1180], [1.9, 850]]);
    const v = x < 1.9 ? 1 - er(x, 1.65, 1.9) : 0;
    const w = walkPose((1180 - wx) / 0.9, v, -1);
    const shock = er(x, 2.1, 2.4);
    const gulp = er(x, 3.5, 3.7) * (1 - er(x, 3.9, 4.1));
    return base({
      x: wx, y: 1010 - 296 * 0.9, k: 0.9, feet: w.feet, kneeDir: -1, sy: w.sy + gulp * 6, lean: w.lean, hands: v > 0.05 ? w.hands : HANG, holdL: <Briefcase />,
      face: F({ lx: lerp(-0.2, -0.85, shock), px: -1, eyeS: 1 + shock * 0.35, pupil: 1 - shock * 0.2, raise: shock * 0.9, worry: shock * 0.5, curve: lerp(0.5, -0.3, shock), mo: shock * 0.3 * (1 - er(x, 3.2, 3.4)), open: 1 - blinkAt(x, 3.0, 0.2) }),
      sweat: er(x, 3.0, 3.4), hy: -gulp * 4,
    });
  }, t);
  return (
    <g>
      <WaitRoom t={t} min={10 * 60 - 12 + t * 2} />
      <Crowd t={t} />
      <Person c={m} look={MARCOS_SUIT} t={t} />
      {t > 2.2 && t < 3.2 && <text x={940} y={340} fontFamily={BARLOW} fontWeight={700} fontSize={120} fill={RED} stroke={INK} strokeWidth={5} opacity={1 - ramp(t, 2.9, 3.2)}>!</text>}
      {lightRoom(0.35)}
    </g>
  );
};
const CAM3d5 = (t: number): Cam => ({ z: kf(t, [[0, 1.0], [2.2, 1.0], [3.0, 1.12], [5.26, 1.16]]), fx: kf(t, [[0, 540], [2.2, 540], [3.0, 560]]), fy: kf(t, [[0, 600], [5.26, 620]]) });

// --- S4d5 as horas passam: o relógio gira, um por um os candidatos são chamados; ele sobra por último
const GONE_AT: Record<string, number> = { k0: 0.35, s0: 0.6, k1: 0.85, s1: 1.1, k2: 1.35, s2: 1.6, k3: 1.85, k4: 2.1 };
const S4d5 = (t: number) => {
  const min = kf(t, [[0.1, 10 * 60 + 5], [2.5, 16 * 60 + 40]]);
  const m = follow((x) => {
    const tired = er(x, 0.7, 2.1);
    const yawn = er(x, 1.6, 1.75) * (1 - er(x, 2.0, 2.15));
    const callUp = er(x, 2.6, 2.85);
    const c = seated(SEATS[5], 9, x, {});
    c.hands = [mixV([-56, -30], [-30, -60], yawn), mixV([56, -30], [10, -250], yawn)];
    c.sy = tired * 14 * (1 - callUp) - callUp * 6;
    c.tilt = tired * -5 * (1 - callUp);
    c.face = F({ lx: lerp(-0.6, -0.2, tired) * (1 - callUp) - callUp * 0.8, px: -0.7 - callUp * 0.3, ly: tired * 0.25 * (1 - callUp), open: yawn > 0.4 ? 0.08 : lerp(1, 0.6, tired) * (1 - callUp) + callUp * 1.0 - blinkAt(x, 2.2, 0.4) * 0.5, mo: yawn * 0.85, worry: tired * 0.5 * (1 - callUp), curve: lerp(0.05, -0.3, tired) * (1 - callUp) + callUp * 0.3, raise: callUp * 0.6, eyeS: 1 + callUp * 0.15 });
    return c;
  }, t);
  const gone = (k: string) => { const a = GONE_AT[k]; return a === undefined ? 0 : clamp01((t - a) / 0.25); };
  const sp = (min - (10 * 60 + 5)) / (6 * 60 + 35);
  return (
    <g>
      <WaitRoom t={t} min={min} next={er(t, 2.55, 2.75)} />
      <Crowd t={t} gone={gone} />
      {Object.entries(GONE_AT).map(([k, a]) => { const p = (t - a) / 0.35; if (p <= 0 || p >= 1) return null; const isSeat = k.startsWith("k"); const x = isSeat ? SEATS[Number(k[1])] : STANDERS[Number(k[1])][0]; const y = isSeat ? 650 : 560; return <circle key={k} cx={x} cy={y} r={40 + p * 70} fill="none" stroke="#fdfbf4" strokeWidth={8 * (1 - p)} opacity={1 - p} />; })}
      <ChairF x={SEATS[5]} seat={W_SEAT} floor={1010} s={SEAT_K} />
      <Person c={m} look={MARCOS_SUIT} t={t} />
      <g transform={`translate(${SEATS[5] - 92},${W_SEAT + 60}) rotate(4) scale(0.8)`}><Briefcase /></g>
      {/* linhas de tempo girando em volta do relógio */}
      {t < 2.6 && [0, 1, 2].map((i) => { const a = t * 6 + (i * Math.PI * 2) / 3; return <path key={i} d={`M${880 + Math.cos(a) * 80},${250 + Math.sin(a) * 80} A80,80 0 0,1 ${880 + Math.cos(a + 0.7) * 80},${250 + Math.sin(a + 0.7) * 80}`} stroke={GOLD} strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.7} />; })}
      {void sp}
      {lightRoom(lerp(0.35, 0.15, er(t, 0.4, 2.5)))}
      <rect x={-400} y={-400} width={1880} height={2400} fill="#3a2a10" opacity={er(t, 1.0, 2.5) * 0.12} />
    </g>
  );
};
const CAM4d5 = (t: number): Cam => ({ z: kf(t, [[0, 1.0], [2.5, 1.04], [3.25, 1.3]]), fx: kf(t, [[0, 560], [2.5, 600], [3.25, 760]]), fy: 600 });

// --- S5d5 a entrevista: ele é o último, conversa curta com a entrevistadora
const IV_X = 720, IV_TOP = 812, IV_SEAT = 852, IV_FLOOR = 1012;  // igual à mesa da casa (Dias 3–4): sentada, pernas sob a mesa
const S5d5 = (t: number) => {
  const iv = follow((x) => {
    const write = er(x, 0.1, 0.25) * (1 - er(x, 1.0, 1.15));
    return base({
      x: IV_X, y: IV_SEAT - 12, k: 1, sit: 1,
      hands: [[-70, -30], [40 + Math.sin(x * 20) * 8 * write, -34 + Math.cos(x * 17) * 4 * write]],
      holdR: <path d="M0,0 L-12,-30" stroke="#2a2836" strokeWidth={6} strokeLinecap="round" />,
      face: F({ lx: lerp(-0.6, -0.2, write), px: lerp(-0.9, -0.2, write), ly: write * 0.45, py: write * 0.9, curve: lerp(0.2, 0.45, er(x, 1.2, 1.4)), raise: 0.1, open: 1 - blinkAt(x, 2.9, 0.6) * 0.8, mo: x > 1.45 && x < 2.05 ? 0.22 * Math.max(0, Math.sin(x * 12)) : 0 }),
      hy: Math.sin(clamp01((x - 1.2) / 0.45) * Math.PI * 2) * 4,
    });
  }, t);
  const m = follow((x) => {
    const talk = x > 0.05 && x < 1.2 ? 1 : 0;
    const hope = er(x, 1.5, 1.8);
    return base({
      x: 300, y: 860 - 12, k: 1, sit: 1,
      hands: [[-56, -30], [60 + talk * Math.sin(x * 5) * 18, -30 - talk * (50 + Math.sin(x * 7) * 20)]],
      face: F({ lx: 0.7, px: 1, curve: lerp(0.3, 0.75, hope), raise: 0.2 + hope * 0.2, worry: -0.1, open: 1 - blinkAt(x, 2.5, 0.3) * 0.8, mo: talk * 0.3 * Math.max(0, Math.sin(x * 13)) }),
      hy: Math.sin(clamp01((x - 1.5) / 0.5) * Math.PI * 2) * 5,
    });
  }, t);
  const hd = headLocal(iv);
  const ex = iv.x + (hd[0] + iv.face.lx * 24), ey = iv.y + hd[1] + iv.face.ly * 18 - 6;
  const chip = backPop(t - 0.05);
  return (
    <g>
      <Wall a="#3e4a5c" b="#556073" floor={950} fa="#5a4a3a" fb="#2a2018" />
      <Window x={560} y={180} w={300} h={230} day={1} t={t} />
      <rect x={160} y={240} width={170} height={120} rx={6} fill="#e8e2d0" stroke={INK} strokeWidth={5} />
      <path d="M180,330 L220,290 L250,310 L300,260" stroke={GREEN} strokeWidth={6} fill="none" />
      <ChairF x={300} seat={860} floor={IV_FLOOR} />
      <Person c={m} look={MARCOS_SUIT} t={t} />
      <ChairF x={IV_X} seat={IV_SEAT} floor={IV_FLOOR} />
      <Person c={iv} look={INTERV} t={t} />
      {/* óculos da entrevistadora */}
      <g>
        {[-1, 1].map((sd) => <circle key={sd} cx={ex + sd * 25} cy={ey} r={17} fill="none" stroke={INK} strokeWidth={4} />)}
        <line x1={ex - 8} y1={ey} x2={ex + 8} y2={ey} stroke={INK} strokeWidth={4} />
      </g>
      <Table x={IV_X} y={IV_TOP} w={420} floor={IV_FLOOR} />
      {/* currículo e prancheta na mesa */}
      <g transform={`translate(${IV_X - 20},${IV_TOP + 22}) rotate(-6)`}><rect x={-50} y={-14} width={100} height={26} fill="#fdfbf4" stroke={INK} strokeWidth={3} /><line x1={-38} y1={-4} x2={30} y2={-4} stroke="#b8b4aa" strokeWidth={3} /></g>
      {chip > 0 && (
        <g transform={`translate(540,120) scale(${chip})`}>
          <rect x={-120} y={-40} width={240} height={80} rx={16} fill="#14100c" stroke={GOLD} strokeWidth={5} />
          <circle cx={-66} cy={0} r={22} fill="none" stroke={GOLD} strokeWidth={5} />
          <line x1={-66} y1={0} x2={-66} y2={-14} stroke={GOLD} strokeWidth={4} strokeLinecap="round" transform={`rotate(${t * 140} -66 0)`} />
          <text x={22} y={16} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={46} fill={WHITE}>5 MIN</text>
        </g>
      )}
      <Speech x={760} y={300} p={t - 1.4} w={360} h={130} tail={[730, 420]}>
        <text x={760} y={290} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={42} fill="#2a2836">OBRIGADA.</text>
        <text x={760} y={336} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={42} fill="#2a2836">A GENTE LIGA.</text>
      </Speech>
      {lightRoom(0.4)}
    </g>
  );
};
const CAM5d5 = (t: number): Cam => ({ z: kf(t, [[0, 1.08], [2.1, 1.14]]), fx: kf(t, [[0, 540], [2.1, 530]]), fy: kf(t, [[0, 600], [2.1, 590]]) });

// --- S6d5 vai embora pela rua, sem saber o resultado
const S6d5 = (t: number) => {
  const m = follow((x) => {
    const wx = kf(x, [[0, 980], [2.4, 470]]);
    const v = x < 2.4 ? 0.85 - er(x, 2.1, 2.4) * 0.85 : 0;
    const w = walkPose(980 - wx, v, -1);
    const back = er(x, 1.0, 1.4) * (1 - er(x, 2.1, 2.5));
    return base({
      x: wx, y: 690, k: 1, feet: w.feet, kneeDir: -1, sy: w.sy, lean: w.lean, hands: v > 0.05 ? w.hands : HANG, holdL: <Briefcase />,
      face: F({ lx: lerp(-0.4, 0.75, back), px: lerp(-0.5, 1, back), ly: 0.15, curve: lerp(0.1, -0.15, er(x, 1.5, 2.3)), worry: 0.35, raise: 0.25, open: 1 - blinkAt(x, 2.6, 0.5) * 0.8 }),
      tilt: back * 6,
    });
  }, t);
  const hd = headLocal(m);
  const q = er(t, 1.5, 1.8);
  return (
    <g>
      <Street t={t} picked={false} planter={false} />
      {/* prédio da empresa à direita */}
      <rect x={800} y={200} width={500} height={760} fill="#2e3448" stroke={INK} strokeWidth={5} />
      {Array.from({ length: 12 }).map((_, i) => <rect key={i} x={830 + (i % 3) * 90} y={240 + Math.floor(i / 3) * 120} width={64} height={80} fill={(i * 7) % 5 < 2 ? "#ffd890" : "#1a1e2c"} stroke={INK} strokeWidth={3} opacity={0.9} />)}
      <rect x={820} y={720} width={260} height={56} rx={8} fill="#1e2a3a" stroke={INK} strokeWidth={4} />
      <text x={950} y={758} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={30} fill={GOLD} letterSpacing={2}>VENDAS S.A.</text>
      <Person c={m} look={MARCOS_SUIT} t={t} />
      {q > 0 && <text x={m.x + hd[0] + 60} y={m.y + hd[1] - 110} fontFamily={BARLOW} fontWeight={700} fontSize={120} fill={GOLD} stroke={INK} strokeWidth={5} opacity={q} transform={`rotate(10 ${m.x + hd[0] + 60} ${m.y + hd[1] - 110})`}>?</text>}
    </g>
  );
};
const CAM6d5 = (t: number): Cam => ({ z: kf(t, [[0, 1.06], [2.6, 1.14]]), fx: kf(t, [[0, 700], [2.6, 560]]), fy: kf(t, [[0, 580], [2.6, 560]]) });

// --- S7d5 chega ao trabalho: as coisas dele estão numa caixa em cima da mesa
const BOX_X = 430, MW_X = 250;
const marcosWalkIn = (x: number): Ch => {
  const wx = kf(x, [[0, -150], [1.4, MW_X]]);
  const v = x < 1.4 ? 1 - er(x, 1.15, 1.4) : 0;
  const w = walkPose(wx + 150, v, 1);
  const shock = er(x, 1.5, 1.85);
  return base({
    x: wx, y: 690, k: 1, feet: w.feet, kneeDir: 1, sy: w.sy, lean: w.lean, hands: v > 0.05 ? w.hands : HANG, holdL: <Briefcase />,
    face: F({ lx: lerp(0.3, 0.8, shock), px: lerp(0.3, 1, shock), ly: shock * 0.35, py: shock * 0.7, eyeS: 1 + shock * 0.35, raise: shock * 0.9, worry: shock * 0.6, curve: lerp(0.3, -0.45, shock), mo: shock * 0.35, open: 1 - blinkAt(x, 2.8, 0.3) }),
    sweat: er(x, 2.4, 2.9),
  });
};
const S7d5 = (t: number) => {
  const m = follow(marcosWalkIn, t);
  return (
    <g>
      <Office t={t} hm={[17, 20]} />
      <Person c={m} look={MARCOS_SUIT} t={t} />
      <DeskOffice papers={0} envelope={0} phoneBuzz={-1} t={t} />
      <g transform={`translate(${BOX_X},850)`}><BoxC /></g>
      {t > 1.6 && t < 2.8 && <text x={300} y={330} fontFamily={BARLOW} fontWeight={700} fontSize={120} fill={RED} stroke={INK} strokeWidth={5} opacity={1 - ramp(t, 2.5, 2.8)}>!</text>}
    </g>
  );
};
const CAM7d5 = (t: number): Cam => ({ z: kf(t, [[0, 1.0], [1.5, 1.0], [2.3, 1.35], [3.8, 1.42]]), fx: kf(t, [[0, 540], [1.5, 520], [2.3, 360]]), fy: kf(t, [[0, 640], [2.3, 640], [3.8, 630]]) });

// --- S8d5 o seu Roberto chega gritando e aponta a saída: DEMITIDO
const S8d5 = (t: number) => {
  const ch = follow((x) => {
    const c = bossAt(x);
    const point = er(x, 1.25, 1.5);
    if (x > 1.0) { c.hands = [mixV(c.hands[0], [-266, -196], point), mixV(c.hands[1], [70, -30], point)]; c.elbowL = 1; }
    return c;
  }, t);
  const m = follow((x) => {
    const c = marcosWalkIn(x + 3);
    const hit = er(x, 2.3, 2.5);
    const look = er(x, 0.3, 0.7);
    c.face = F({ lx: lerp(0.8, 0.9, look), px: 1, ly: lerp(0.35, -0.05, look) + hit * 0.3, py: lerp(0.7, 0, look) + hit * 0.7, eyeS: 1.2 - hit * 0.1, raise: 0.6 - hit * 0.2, worry: 0.7 + hit * 0.3, curve: -0.55, mo: 0.15 + hit * 0.15, open: 1 - blinkAt(x, 2.8, 0.3) });
    c.tremble = hit * 0.4; c.sweat = 1; c.sy = hit * 12; c.tilt = hit * -6;
    return c;
  }, t);
  const stamp = t - 2.3;
  return (
    <g>
      <Office t={t} hm={[17, 21]} />
      <Person c={m} look={MARCOS_SUIT} t={t} />
      <Person c={ch} look={CHEFE} t={t} />
      <DeskOffice papers={0} envelope={0} phoneBuzz={-1} t={t} />
      <g transform={`translate(${BOX_X},850)`}><BoxC /></g>
      {t > 1.3 && [0, 1, 2].map((i) => <path key={i} d={`M${760 - i * 10},${300 + i * 40} l-${40 + i * 10},-${20 - i * 10}`} stroke={RED} strokeWidth={8} strokeLinecap="round" opacity={0.5 + 0.5 * Math.sin(t * 20 + i)} />)}
      {stamp > 0 && (
        <g transform={`translate(540,250) rotate(-6) scale(${lerp(1.8, 1, clamp01(stamp / 0.18))})`} opacity={clamp01(stamp / 0.18)}>
          <rect x={-200} y={-46} width={400} height={92} rx={10} fill="#14100c" opacity={0.35} />
          <rect x={-200} y={-46} width={400} height={92} rx={10} fill="none" stroke={RED} strokeWidth={9} />
          <text x={0} y={26} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={74} fill={RED} letterSpacing={3}>DEMITIDO</text>
        </g>
      )}
    </g>
  );
};
const CAM8d5 = (t: number): Cam => ({ z: kf(t, [[0, 1.0], [3.4, 1.06]]) + (t > 2.3 && t < 2.6 ? Math.sin(t * 60) * 0.006 : 0), fx: kf(t, [[0, 560], [3.4, 560]]), fy: kf(t, [[0, 620], [3.4, 610]]) });

// --- S9d5 final: na rua à noite, segurando a caixa
const S9d5 = (t: number) => {
  const m = follow((x) => {
    const up = er(x, 3.9, 4.6);
    return base({
      x: 540, y: 690, k: 1,
      hands: [[-86, -64], [86, -64]],
      face: F({ ly: lerp(0.45, 0.05, up), py: lerp(0.9, 0, up), lx: 0, worry: lerp(0.85, 0.5, up), curve: lerp(-0.5, -0.15, up), raise: 0.15, open: lerp(0.75, 1, up) - blinkAt(x, 3.2, 0.9) * 0.6 }),
      sy: lerp(10, 0, up) + Math.sin(x * 1.8) * 2, tilt: lerp(-5, 0, up),
    });
  }, t);
  return (
    <g>
      <Street t={t} picked={false} planter={false} />
      <rect x={-400} y={-400} width={1880} height={2400} fill="#0a0820" opacity={0.25} />
      <Person c={m} look={MARCOS_SUIT} t={t} />
      <g transform="translate(540,692) scale(0.86)"><BoxC /></g>
      {/* chuva fina */}
      {Array.from({ length: 40 }).map((_, i) => { const x0 = ((i * 97) % 1300) - 100; const y0 = (((i * 211) % 1100) + t * 900) % 1100 - 100; return <line key={i} x1={x0} y1={y0} x2={x0 - 10} y2={y0 + 40} stroke="#9ab0d8" strokeWidth={3} opacity={0.35} />; })}
    </g>
  );
};
const CAM9d5 = (t: number): Cam => ({ z: 1.5 + t * 0.025, fx: 540, fy: kf(t, [[0, 585], [6.6, 570]]) });


// ==================================================================
// DIA 6 — cenas novas
// ==================================================================
// chefe novo: o oposto do seu Roberto (jovem, barba, blazer sem gravata, sempre sorrindo)
const CARLOS: Look = { id: "cn", shirt: "#3a3f4c", shirt2: "#2e323e", pants: "#3a3f4c", shoes: "#1a1210", hair: "#1e1610", style: "marcos", sleeve: 0.86, width: 0.84, suit: true, beard: true };
// Marcos em casa, sem trabalho: camisa azul simples (sem gravata)
const MARCOS_CASUAL: Look = { ...MARCOS, id: "mc" };

// --- recap do Dia 5: caixa + DEMITIDO → na rua com a caixa
const RECAP6: [(t: number) => React.ReactNode, (t: number) => Cam, number, number][] = [
  [(t) => S8d5(t), (t) => CAM8d5(t), 1.6, 2.6],
  [(t) => S9d5(t), (t) => CAM9d5(t), 0.4, 2.7],
];
const RECAP6_ST = RECAP6.reduce<number[]>((a, r, i) => [...a, i === 0 ? 0 : a[i - 1] + RECAP6[i - 1][3]], []);
const R6 = (t: number) => {
  let k = 0;
  RECAP6_ST.forEach((s, i) => { if (t >= s) k = i; });
  const [draw, cam, lt0] = RECAP6[k];
  const lt = lt0 + (t - RECAP6_ST[k]);
  const c = cam(lt);
  const cut = Math.max(0, 1 - (t - RECAP6_ST[k]) / 0.12);
  return (
    <g>
      <defs><filter id="recapF6"><feColorMatrix type="saturate" values="0.45" /></filter></defs>
      <rect x={-400} y={-400} width={1880} height={2400} fill="#000" />
      <g filter="url(#recapF6)" transform={`translate(540,630) scale(${c.z}) translate(${-c.fx},${-c.fy})`}>{draw(lt)}</g>
      <rect x={-400} y={-400} width={1880} height={2400} fill="#c89a5a" opacity={0.12} style={{ mixBlendMode: "screen" }} />
      <rect x={-400} y={-400} width={1880} height={2400} fill="#fff" opacity={cut * 0.35} />
    </g>
  );
};

// --- objetos
const Hammer: React.FC<{ rot: number }> = ({ rot }) => (
  <g transform={`rotate(${rot})`}>
    <rect x={-5} y={-62} width={10} height={76} rx={4} fill="#a8783e" stroke={INK} strokeWidth={3.5} />
    <path d="M-26,-74 L18,-74 L26,-66 L18,-56 L-26,-56 Z" fill="#7a808c" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
  </g>
);
const Toolbox: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x},${y})`}>
    <path d="M-40,-62 L-40,-80 L40,-80 L40,-62" stroke={INK} strokeWidth={7} fill="none" />
    <rect x={-80} y={-64} width={160} height={64} rx={8} fill="#c8453a" stroke={INK} strokeWidth={5} />
    <rect x={-80} y={-64} width={160} height={16} rx={6} fill="#a83a30" stroke={INK} strokeWidth={4} />
    <rect x={-10} y={-40} width={20} height={10} rx={2} fill="#d8d8d8" stroke={INK} strokeWidth={2.5} />
    <path d="M30,-64 L52,-104" stroke="#8a8f9a" strokeWidth={9} strokeLinecap="round" /><path d="M30,-64 L52,-104" stroke={INK} strokeWidth={2} />
  </g>
);
// prateleira na parede (fica torta → reta)
const Shelf: React.FC<{ fix: number }> = ({ fix }) => (
  <g transform={`rotate(${lerp(9, 0, fix)} 640 430)`}>
    <rect x={560} y={420} width={250} height={20} rx={4} fill="#9a6a3e" stroke={INK} strokeWidth={5} />
    <path d="M590,440 L590,470 L612,440" fill="#7a5030" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
    <path d="M780,440 L780,470 L758,440" fill="#7a5030" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
    <rect x={600} y={378} width={26} height={42} fill="#5a8ac8" stroke={INK} strokeWidth={3.5} />
    <rect x={628} y={372} width={22} height={48} fill="#d8a040" stroke={INK} strokeWidth={3.5} />
    <rect x={652} y={384} width={28} height={36} fill="#7aa85a" stroke={INK} strokeWidth={3.5} />
    <path d="M730,420 Q722,396 740,384 Q758,396 750,420 Z" fill="#c86a4a" stroke={INK} strokeWidth={3.5} />
  </g>
);
// nuvenzinha cinza de desânimo
const Gloom: React.FC<{ x: number; y: number; p: number; t: number }> = ({ x, y, p, t }) => p <= 0 ? null : (
  <g opacity={p * 0.9} transform={`translate(${x},${y + Math.sin(t * 2) * 5})`}>
    <path d="M-70,10 Q-80,-30 -40,-34 Q-30,-66 6,-58 Q34,-76 54,-44 Q88,-40 80,-6 Q86,22 50,20 L-50,20 Q-78,22 -70,10 Z" fill="#6a6e7a" stroke={INK} strokeWidth={4} />
    {[-36, 0, 36].map((dx, i) => { const yy = ((t * 160 + i * 40) % 80); return <line key={i} x1={dx} y1={30 + yy} x2={dx - 6} y2={46 + yy} stroke="#8ab0e0" strokeWidth={4} strokeLinecap="round" opacity={1 - yy / 80} />; })}
  </g>
);
const DAY_SEAT_X = SEAT_X; // a mesa/cadeira da casa (mesmo lugar da noite), com luz do dia

// --- S1d6 três dias depois: em casa, consertando a prateleira (desanimado)
const SH_X = 400;
const S1d6 = (t: number) => {
  const m = follow((x) => {
    const sw = Math.max(0, Math.sin(x * 7)) * (1 - er(x, 3.6, 4.0));
    const reach = er(x, 0.0, 0.3);
    return base({
      x: SH_X, y: H_FEET - 296, k: 1,
      hands: [mixV(HANG[0], [-60, -40], reach), mixV(HANG[1], [230, -210 - sw * 40], reach)],
      holdR: <Hammer rot={-30 + sw * 40} />,
      face: F({ lx: 0.55, px: 0.6, ly: -0.35, py: -0.5, worry: lerp(0.3, 0.55, er(x, 3.6, 4.6)), curve: -0.2, raise: 0.1, open: 0.8 - blinkAt(x, 2.6, 0.3) * 0.7 }),
      lean: 6, sy: Math.sin(x * 1.6) * 2,
    });
  }, t);
  return (
    <g>
      <House t={t} door={0} night={0} />
      <Shelf fix={er(t, 1.0, 3.4)} />
      <Toolbox x={300} y={H_FEET} />
      <Person c={m} look={MARCOS_CASUAL} t={t} />
      <Gloom x={SH_X} y={150} p={er(t, 3.8, 4.4)} t={t} />
      {lightRoom(0.5)}
    </g>
  );
};
const CAM1d6 = (t: number): Cam => ({ z: kf(t, [[0, 1.05], [5.4, 1.15]]), fx: kf(t, [[0, 560], [5.4, 540]]), fy: kf(t, [[0, 500], [5.4, 490]]) });

// --- S2d6 senta na mesa, olha o celular parado (a esperança acabando)
const S2d6 = (t: number) => {
  const m = follow((x) => marcosChair(x, {
    hands: [[-70, -26], [70, -26]], holdR: undefined,
    face: F({ lx: 0.35, px: 0.5, ly: 0.5, py: 0.95, worry: 0.75, curve: -0.45, open: lerp(0.8, 0.55, er(x, 0.8, 1.6)) - blinkAt(x, 2.9, 0.4) * 0.5 }),
    sy: lerp(0, 10, er(x, 0.6, 1.6)) + Math.sin(x * 1.5) * 2, tilt: lerp(0, -5, er(x, 0.6, 1.6)),
  }), t);
  return (
    <g>
      <House t={t} door={0} night={0} />
      <NightChair /><Person c={m} look={MARCOS_CASUAL} t={t} /><NightTable papers={0} />
      <g transform={`translate(${DAY_SEAT_X + 150},806) rotate(84)`}><PhoneS glow={0.15} /></g>
      <rect x={-400} y={-400} width={1880} height={2400} fill="#1a2030" opacity={0.18 * er(t, 0.4, 1.8)} />
      {lightRoom(0.35)}
    </g>
  );
};
const CAM2d6 = (t: number): Cam => ({ z: kf(t, [[0, 1.3], [2.6, 1.42]]), fx: 600, fy: kf(t, [[0, 590], [2.6, 570]]) });

// --- S3d6 o celular vibra, ele atende: é da empresa da entrevista
const CallerCard: React.FC<{ p: number }> = ({ p }) => p <= 0 ? null : (
  <g transform={`translate(545,250) scale(${backPop(p)})`}>
    <rect x={-250} y={-70} width={500} height={140} rx={22} fill="#fdfbf4" stroke={INK} strokeWidth={6} />
    <circle cx={-180} cy={0} r={40} fill="#1e2a3a" stroke={INK} strokeWidth={4} />
    <text x={-180} y={14} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={38} fill={GOLD}>V</text>
    <text x={-120} y={-12} fontFamily={BARLOW} fontWeight={700} fontSize={42} fill="#2a2836">VENDAS S.A.</text>
    <text x={-120} y={38} fontFamily={MONO} fontWeight={800} fontSize={30} fill="#2f9a5a">LIGANDO…</text>
  </g>
);
const S3d6 = (t: number) => {
  const PICK = 1.25;
  const m = follow((x) => {
    if (x < PICK) {
      const look = er(x, 0.3, 0.6);
      return marcosChair(x, {
        hands: [[-70, -26], mixV([70, -26], [150, -60], er(x, 0.75, PICK))], holdR: undefined,
        face: F({ lx: 0.4, px: 0.6, ly: lerp(0.5, 0.3, look), py: lerp(0.95, 0.6, look), eyeS: 1 + look * 0.25, raise: look * 0.7, worry: lerp(0.7, 0.1, look), curve: lerp(-0.4, 0, look), open: 1 }),
        sy: lerp(10, 0, look),
      });
    }
    return callPose(x, { phone: er(x, PICK, PICK + 0.3) });
  }, t);
  const buzz = t < PICK ? Math.sin(t * 80) * 4 : 0;
  return (
    <g>
      <House t={t} door={0} night={0} />
      <NightChair /><Person c={m} look={MARCOS_CASUAL} t={t} /><NightTable papers={0} />
      {t < PICK + 0.1 && (
        <g transform={`translate(${DAY_SEAT_X + 150 + buzz},806) rotate(84)`}>
          <PhoneS glow={0.5 + 0.5 * Math.sin(t * 20)} />
        </g>
      )}
      {t < PICK && [0, 1].map((i) => <path key={i} d={`M${DAY_SEAT_X + 110 - i * 16},${776 - i * 14} q-10,10 0,20 M${DAY_SEAT_X + 190 + i * 16},${776 - i * 14} q10,10 0,20`} stroke={GOLD} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.5 + 0.5 * Math.sin(t * 30)} />)}
      <CallerCard p={t - 1.6} />
      {lightRoom(0.5)}
    </g>
  );
};
const CAM3d6 = (t: number): Cam => ({ z: kf(t, [[0, 1.35], [3.4, 1.3]]), fx: 590, fy: kf(t, [[0, 590], [3.4, 560]]) });

// --- S4d6 o celular em tela cheia: APROVADO, R$ 11.500, 5× MAIS
const S4d6 = (t: number) => {
  const a = backPop(t - 0.3), b = backPop(t - 1.1), c5 = t - 1.75;
  return (
    <g>
      <rect x={-400} y={-400} width={1880} height={2400} fill="#0e1410" />
      <g transform="translate(540,610) rotate(-2)">
        <rect x={-300} y={-520} width={600} height={1060} rx={60} fill="#15161c" stroke={INK} strokeWidth={8} />
        <rect x={-270} y={-480} width={540} height={980} rx={30} fill="#f4f6fb" />
        <circle cx={0} cy={-370} r={56} fill="#1e2a3a" stroke={INK} strokeWidth={4} />
        <text x={0} y={-352} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={54} fill={GOLD}>V</text>
        <text x={0} y={-270} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={46} fill="#2a2836">VENDAS S.A.</text>
        <text x={0} y={-226} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={28} fill="#2f9a5a">EM CHAMADA · 00:{String(38 + Math.floor(t)).padStart(2, "0")}</text>
        {a > 0 && (
          <g transform={`translate(0,-90) scale(${a})`}>
            <rect x={-230} y={-64} width={460} height={128} rx={20} fill={GREEN} stroke={INK} strokeWidth={5} />
            <path d="M-170,0 L-146,26 L-104,-26" stroke="#fff" strokeWidth={12} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <text x={30} y={20} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={64} fill="#fff" letterSpacing={2}>APROVADO!</text>
          </g>
        )}
        {b > 0 && (
          <g transform={`translate(0,110) scale(${b})`}>
            <text x={0} y={-30} textAnchor="middle" fontFamily={BARLOW} fontWeight={600} fontSize={38} fill="#55525f">SALÁRIO</text>
            <text x={0} y={50} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={84} fill="#2f9a5a">R$ 11.500</text>
            <text x={0} y={100} textAnchor="middle" fontFamily={BARLOW} fontWeight={600} fontSize={32} fill="#9aa0b2">ANTES: R$ 2.300</text>
          </g>
        )}
        {c5 > 0 && (
          <g transform={`translate(150,300) rotate(-8) scale(${lerp(1.8, 1, clamp01(c5 / 0.18))})`} opacity={clamp01(c5 / 0.18)}>
            <rect x={-130} y={-50} width={260} height={100} rx={14} fill={GOLD} stroke={INK} strokeWidth={6} />
            <text x={0} y={24} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={66} fill="#2a1a08" letterSpacing={2}>5× MAIS</text>
          </g>
        )}
      </g>
      {t > 0.3 && t < 1.0 && <rect x={-400} y={-400} width={1880} height={2400} fill={GREEN} opacity={0.22 * (1 - ramp(t, 0.3, 1.0))} />}
    </g>
  );
};
const CAM4d6 = (t: number): Cam => ({ z: kf(t, [[0, 0.95], [3.4, 1.0]]), fx: 540, fy: 610 });

// --- S5d6 comemora: pula de alegria com os punhos para cima
const S5d6 = (t: number) => {
  const m = follow((x) => {
    const up = er(x, 0.1, 0.35);
    const hop = Math.max(0, Math.sin((x - 0.3) * 7.5)) * er(x, 0.3, 0.5) * (1 - er(x, 2.2, 2.6));
    return base({
      x: 540, y: H_FEET - 296 - hop * 50, k: 1,
      feet: hop > 0.05 ? [[-46, 286], [46, 286]] : STAND_FEET,
      hands: [mixV(HANG[0], [-130, -300 - hop * 20], up), mixV(HANG[1], [130, -300 - hop * 20], up)],
      face: F({ curve: lerp(0.3, 1, up), raise: 0.5, open: lerp(1, 0.25, up) , mo: up * 0.55, ly: -0.2, py: -0.3 }),
      sy: -hop * 8,
    });
  }, t);
  const spark = er(t, 0.25, 0.6);
  return (
    <g>
      <House t={t} door={0} night={0} />
      <Toolbox x={260} y={H_FEET} />
      {spark > 0 && [0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = (i / 8) * Math.PI * 2 + t * 0.6; const r = 230 + Math.sin(t * 4 + i) * 20; return <path key={i} d={`M${540 + Math.cos(a) * r},${430 + Math.sin(a) * r * 1.1} l${Math.cos(a) * 40 * spark},${Math.sin(a) * 44 * spark}`} stroke={GOLD} strokeWidth={10} strokeLinecap="round" opacity={spark} />; })}
      <Person c={m} look={MARCOS_CASUAL} t={t} />
      {[0, 1, 2, 3, 4].map((i) => <Sparkle key={i} x={540 + Math.cos(i * 1.3) * 300} y={300 + Math.sin(i * 2.1) * 140} s={spark * (0.8 + 0.4 * Math.sin(t * 8 + i))} />)}
      {lightRoom(0.9)}
    </g>
  );
};
const CAM5d6 = (t: number): Cam => ({ z: kf(t, [[0, 1.2], [3.4, 1.3]]), fx: 540, fy: kf(t, [[0, 560], [3.4, 540]]) });

// --- S6d6 manhã seguinte: o prédio enorme da empresa
const Tower: React.FC<{ t: number }> = ({ t }) => (
  <g>
    <defs>
      <linearGradient id="skyM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7ab0e8" /><stop offset="1" stopColor="#f4d8a8" /></linearGradient>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#3a6a9a" /><stop offset="0.5" stopColor="#6aa0d0" /><stop offset="1" stopColor="#3a5a88" /></linearGradient>
    </defs>
    <rect x={-400} y={-1400} width={1880} height={2400} fill="url(#skyM)" />
    {/* prédios do fundo */}
    {[[-120, -300, 220], [880, -200, 260], [1080, 100, 200]].map(([x, y, w], i) => <rect key={i} x={x} y={y} width={w} height={1300} fill="#8a9ab0" stroke={INK} strokeWidth={4} opacity={0.8} />)}
    {/* torre de vidro */}
    <rect x={220} y={-1300} width={640} height={2250} fill="url(#glass)" stroke={INK} strokeWidth={6} />
    {Array.from({ length: 30 }).map((_, i) => <line key={i} x1={220} y1={-1250 + i * 74} x2={860} y2={-1250 + i * 74} stroke="#24456a" strokeWidth={4} />)}
    {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={220 + (i + 1) * 107} y1={-1300} x2={220 + (i + 1) * 107} y2={700} stroke="#24456a" strokeWidth={3} />)}
    <path d={`M300,-1300 L420,-1300 L260,${-200 + Math.sin(t) * 2} L220,-200 Z`} fill="#fff" opacity={0.18} />
    {/* entrada e letreiro */}
    <rect x={330} y={560} width={420} height={80} rx={10} fill="#1e2a3a" stroke={INK} strokeWidth={5} />
    <text x={540} y={616} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={50} fill={GOLD} letterSpacing={4}>VENDAS S.A.</text>
    <rect x={400} y={680} width={280} height={270} fill="#2a4a6a" stroke={INK} strokeWidth={6} />
    <line x1={540} y1={680} x2={540} y2={950} stroke={INK} strokeWidth={5} />
    <rect x={-400} y={950} width={1880} height={400} fill="#9a9488" stroke={INK} strokeWidth={5} />
    <rect x={-400} y={950} width={1880} height={16} fill="#b8b2a4" />
  </g>
);
const S6d6 = (t: number) => {
  const m = follow((x) => {
    const wx = kf(x, [[0, 20], [2.0, 215]]);
    const v = x < 2.0 ? 1 - er(x, 1.75, 2.0) : 0;
    const w = walkPose(wx - 20, v, 1);
    const up = er(x, 2.0, 2.4);
    return base({
      x: wx, y: 950 - 296, k: 1, feet: w.feet, kneeDir: 1, sy: w.sy, lean: w.lean, hands: v > 0.05 ? w.hands : HANG, holdL: <Briefcase />,
      face: F({ lx: lerp(0.5, 0.3, up), px: lerp(0.6, 0.4, up), ly: lerp(0, -0.6, up), py: lerp(0, -0.9, up), eyeS: 1 + up * 0.2, raise: up * 0.8, curve: lerp(0.4, 0.75, up), mo: up * 0.2, open: 1 - blinkAt(x, 2.8, 0.3) * 0.8 }),
      hy: -up * 6, tilt: up * -4,
    });
  }, t);
  return (
    <g>
      <Tower t={t} />
      <Person c={m} look={MARCOS_SUIT} t={t} />
    </g>
  );
};
const CAM6d6 = (t: number): Cam => ({ z: kf(t, [[0, 0.62], [1.2, 0.62], [3.7, 1.0]]), fx: kf(t, [[0, 540], [3.7, 470]]), fy: kf(t, [[0, -150], [1.2, -50], [3.7, 540]]) });

// --- escritório novo: claro, janelões com a cidade, plantas
const BrightOffice: React.FC<{ t: number; night?: number; hm?: [number, number] }> = ({ t, night = 0, hm }) => (
  <g>
    <Wall a="#e8e4da" b="#f4f1ea" floor={940} fa="#c8b898" fb="#9a8a70" />
    {/* janelões */}
    {[0, 1].map((i) => (
      <g key={i}>
        <rect x={80 + i * 520} y={150} width={400} height={420} fill={night > 0.5 ? "#1a2240" : "#9ac8f0"} stroke={INK} strokeWidth={6} />
        {[0, 1, 2, 3].map((k) => <rect key={k} x={110 + i * 520 + k * 92} y={330 - ((k * 37 + i * 50) % 120)} width={70} height={240 + ((k * 37 + i * 50) % 120)} fill={night > 0.5 ? "#2a3460" : "#c8d8e8"} stroke={INK} strokeWidth={3} />)}
        {night > 0.5 && [0, 1, 2, 3, 4, 5].map((k) => <rect key={k} x={124 + i * 520 + (k % 4) * 92} y={420 + Math.floor(k / 4) * 50} width={14} height={18} fill="#ffd890" />)}
        <line x1={280 + i * 520} y1={150} x2={280 + i * 520} y2={570} stroke={INK} strokeWidth={5} />
      </g>
    ))}
    {night > 0 && night < 1 && <rect x={-400} y={-400} width={1880} height={2400} fill="#1a2240" opacity={night * 0.25} />}
    {/* plantas */}
    {[40, 1010].map((x) => (
      <g key={x} transform={`translate(${x},940)`}>
        {[-40, -15, 15, 40].map((a) => <path key={a} d="M0,-70 Q-24,-150 0,-220 Q24,-150 0,-70" fill="#4a9a4a" stroke={INK} strokeWidth={3.5} transform={`rotate(${a} 0 -70)`} />)}
        <path d="M-40,-80 L40,-80 L30,0 L-30,0 Z" fill="#e8e4da" stroke={INK} strokeWidth={4} />
      </g>
    ))}
    {hm && <WallClock x={540} y={90} min={hm[0] * 60 + hm[1]} r={44} />}
    {void t}
  </g>
);

// --- S7d6 conhece o Carlos, o chefe novo: aperto de mão
const MK_X = 380, CK_X = 700;
const carlosAt = (x: number, shake: number, o: Partial<Ch> = {}): Ch => {
  const wx = kf(x, [[0, 1150], [1.1, CK_X]]);
  const v = x < 1.1 ? 1 - er(x, 0.9, 1.1) : 0;
  const w = walkPose(1150 - wx, v, -1);
  const sh = Math.sin(x * 16) * 10 * shake;
  return base({
    x: wx, y: 940 - 296, k: 1.02, feet: w.feet, kneeDir: v > 0 ? -1 : undefined, sy: w.sy, lean: w.lean,
    hands: v > 0.05 ? w.hands : [mixV(HANG[0], [-150, -60 + sh], shake), HANG[1]],
    face: F({ lx: -0.6, px: -0.8, curve: 0.9, raise: 0.35, mo: 0.15, open: 1 - blinkAt(x, 2.7, 0.6) * 0.8 }),
    ...o,
  });
};
const marcosOffice = (x: number, shake: number, o: Partial<Ch> = {}): Ch => {
  const sh = Math.sin(x * 16) * 10 * shake;
  return base({
    x: MK_X, y: 940 - 296, k: 1, hands: [HANG[0], mixV(HANG[1], [170, -60 + sh], shake)], holdL: <Briefcase />,
    face: F({ lx: 0.6, px: 0.8, curve: lerp(0.4, 0.85, shake), raise: 0.3, open: 1 - blinkAt(x, 2.5, 0.2) * 0.8 }),
    ...o,
  });
};
const S7d6 = (t: number) => {
  const shake = er(t, 1.2, 1.5) * (1 - er(t, 2.5, 2.8));
  const m = follow((x) => marcosOffice(x, er(x, 1.2, 1.5) * (1 - er(x, 2.5, 2.8))), t);
  const c = follow((x) => carlosAt(x, er(x, 1.2, 1.5) * (1 - er(x, 2.5, 2.8))), t);
  const hd = headLocal(c);
  return (
    <g>
      <BrightOffice t={t} />
      <Person c={m} look={MARCOS_SUIT} t={t} />
      <Person c={c} look={CARLOS} t={t} />
      <Tag x={c.x + hd[0]} y={c.y + hd[1] * c.k - 150} txt="CARLOS · O CHEFE NOVO" p={t - 0.6} s={0.72} />
      {shake > 0.5 && [0, 1, 2].map((i) => <path key={i} d={`M${540 + Math.cos(i * 2.1 - 1.6) * 60},${590 + Math.sin(i * 2.1 - 1.6) * 40} l${Math.cos(i * 2.1 - 1.6) * 22},${Math.sin(i * 2.1 - 1.6) * 22}`} stroke={GOLD} strokeWidth={6} strokeLinecap="round" />)}
      {lightRoom(0.6)}
    </g>
  );
};
const CAM7d6 = (t: number): Cam => ({ z: kf(t, [[0, 1.0], [1.2, 1.08], [3.0, 1.15]]), fx: kf(t, [[0, 620], [1.2, 545], [3.0, 545]]), fy: kf(t, [[0, 600], [3.0, 580]]) });

// --- S8d6 "educado, paciente... o oposto do seu Roberto": balão de boas-vindas + lembrança do Roberto riscada
const S8d6 = (t: number) => {
  const m = follow((x) => marcosOffice(x + 3, 0, { face: F({ lx: 0.6, px: 0.8, curve: 0.9, raise: 0.35, mo: 0.1, open: 1 - blinkAt(x, 2.5, 0.2) * 0.8 }) }), t);
  const c = follow((x) => {
    const ok = er(x, 0.2, 0.5);
    const cc = carlosAt(x + 3, 0);
    cc.hands = [mixV(HANG[0], [-130, -230 + Math.sin(x * 10) * 14 * ok], ok), HANG[1]];
    cc.holdR = undefined;
    return cc;
  }, t);
  const hl = c.hands[0];
  const ro = t - 1.25, cross = er(t, 1.7, 1.95);
  return (
    <g>
      <BrightOffice t={t} />
      <Person c={m} look={MARCOS_SUIT} t={t} />
      <Person c={c} look={CARLOS} t={t} />
      {er(t, 0.35, 0.55) > 0 && <g transform={`translate(${c.x + hl[0] * c.k},${c.y + hl[1] * c.k - 46}) scale(${er(t, 0.35, 0.55)})`}><rect x={-12} y={-40} width={24} height={46} rx={12} fill={SKIN} stroke={INK} strokeWidth={4} /></g>}
      <Speech x={735} y={120} p={t - 0.3} w={400} h={124} tail={[715, 220]}>
        <text x={735} y={112} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={44} fill="#2a2836">BEM-VINDO, MARCOS!</text>
        <text x={735} y={156} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={36} fill="#2f9a5a">CONTE COMIGO.</text>
      </Speech>
      <Bubble x={300} y={130} p={ro} w={250} h={170} tail={[350, 230]}>
        <defs><clipPath id="robClip"><ellipse cx={300} cy={130} rx={118} ry={78} /></clipPath></defs>
        <g clipPath="url(#robClip)"><g transform="translate(300,252) scale(0.4)">
          <Person c={base({ x: 0, y: 0, k: 1, legs: false, face: F({ worry: -0.9, mo: 0.7 + 0.3 * Math.sin(t * 18), curve: -0.4, eyeS: 1.1 }), red: 1, hands: [[-150, -170], [92, -200]] })} look={{ ...CHEFE, id: "cb6" }} t={t} />
        </g></g>
        {cross > 0 && <g opacity={cross}><path d={`M210,60 L${lerp(210, 390, cross)},${lerp(60, 200, cross)}`} stroke={RED} strokeWidth={14} strokeLinecap="round" /><path d={`M390,60 L${lerp(390, 210, cross)},${lerp(60, 200, cross)}`} stroke={RED} strokeWidth={14} strokeLinecap="round" /></g>}
      </Bubble>
      {lightRoom(0.6)}
    </g>
  );
};
const CAM8d6 = (t: number): Cam => ({ z: kf(t, [[0, 1.08], [3.0, 1.12]]), fx: 545, fy: kf(t, [[0, 560], [3.0, 550]]) });

// --- S9d6 o dia passa voando (09:00 → 19:40), ele trabalha sorrindo; lá fora escurece
const S9d6 = (t: number) => {
  const min = 9 * 60 + er(t, 0.3, 3.0) * (10 * 60 + 40);
  const night = er(t, 1.6, 2.6);
  const m = follow((x) => {
    const c = marcosDesk(x, 0.9);
    c.face = F({ ly: 0.3, py: 0.5, curve: 0.75, raise: 0.25, open: 0.9 - blinkAt(x, 2.6, 0.3) * 0.7 });
    c.sy = Math.sin(x * 2) * 3;
    return c;
  }, t);
  return (
    <g>
      <BrightOffice t={t} night={night} />
      <Person c={m} look={MARCOS_SUIT} t={t} />
      <DeskOffice papers={0} envelope={0} phoneBuzz={-1} t={t} />
      <g transform="translate(260,846)"><rect x={-56} y={-14} width={112} height={14} fill="#f6f2e8" stroke={INK} strokeWidth={2.5} /><path d="M-40,-14 L-34,-30 L34,-30 L40,-14" fill="#8ac070" stroke={INK} strokeWidth={3} /></g>
      <g transform="translate(540,160)">
        <rect x={-120} y={-44} width={240} height={88} rx={14} fill="#14100c" stroke={GOLD} strokeWidth={5} />
        <text x={0} y={22} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={60} fill={min > 18 * 60 ? GOLD : WHITE}>{hhmm(min)}</text>
      </g>
      {lightRoom(lerp(0.6, 0.35, night))}
    </g>
  );
};
const CAM9d6 = (t: number): Cam => ({ z: kf(t, [[0, 1.05], [3.6, 1.12]]), fx: 540, fy: kf(t, [[0, 560], [3.6, 560]]) });

// --- casa no escuro (luz apagada, só a lua pela janela)
const HouseDark: React.FC<{ t: number; door: number; peek?: number }> = ({ t, door, peek = 0 }) => (
  <g>
    <House t={t} door={door} night={1} />
    <rect x={-400} y={-400} width={1880} height={2400} fill="#06080f" opacity={0.55} />
    <defs><radialGradient id="moonL" cx="225" cy="360" r="520" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#9ab8e8" stopOpacity={0.35} /><stop offset="1" stopColor="#9ab8e8" stopOpacity={0} /></radialGradient></defs>
    <rect x={-400} y={-400} width={1880} height={2400} fill="url(#moonL)" style={{ mixBlendMode: "screen" }} />
    {/* fresta de luz quente embaixo da porta da cozinha (pista para o Dia 7) */}
    {peek > 0 && <rect x={-60} y={926} width={150} height={6} fill="#ffcf8a" opacity={peek * (0.6 + 0.4 * Math.sin(t * 3))} />}
  </g>
);

// --- S10d6 chega em casa à noite, porta abre, tudo escuro: "JU? LUCAS?"
const S10d6 = (t: number) => {
  const m = follow((x) => {
    const wx = kf(x, [[0.2, 960], [1.4, 640]]);
    const v = x > 0.2 && x < 1.4 ? 1 - er(x, 1.2, 1.4) : 0;
    const w = walkPose(960 - wx, v, -1);
    const call = er(x, 1.5, 1.8);
    return base({
      x: wx, y: 930 - 296, k: 1, feet: w.feet, kneeDir: v > 0 ? -1 : undefined, sy: w.sy, lean: w.lean, hands: v > 0.05 ? w.hands : HANG, holdL: <Briefcase />,
      face: F({ lx: lerp(-0.4, -0.7, call), px: lerp(-0.5, -0.9, call), curve: lerp(0.6, 0.0, call), raise: call * 0.6, worry: call * 0.3, mo: call * 0.4 * (Math.sin(x * 6) > 0 ? 1 : 0.3), open: 1 - blinkAt(x, 2.8, 0.4) * 0.8 }),
    });
  }, t);
  return (
    <g>
      <HouseDark t={t} door={er(t, 0, 0.3) * (1 - er(t, 1.6, 2.0))} />
      <Person c={m} look={MARCOS_SUIT} t={t} />
      <Speech x={380} y={250} p={t - 1.6} w={210} h={96} tail={[520, 330]}><text x={380} y={266} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={54} fill="#2a2836">JU?</text></Speech>
      <Speech x={810} y={210} p={t - 2.1} w={250} h={96} tail={[720, 300]}><text x={810} y={226} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={54} fill="#2a2836">LUCAS?</text></Speech>
    </g>
  );
};
const CAM10d6 = (t: number): Cam => ({ z: kf(t, [[0, 1.05], [2.8, 1.15]]), fx: kf(t, [[0, 720], [1.4, 620], [2.8, 600]]), fy: kf(t, [[0, 600], [2.8, 580]]) });

// --- S11d6 procura nos cômodos: as portas abrem uma a uma, tudo escuro e vazio
const HALL_F = 940, HALL_DOORS = [150, 740];
const HALL_NAMES = ["QUARTO DO LUCAS", "QUARTO"];
const S11d6 = (t: number) => {
  const opens = [0.4, 1.4].map((a) => er(t, a, a + 0.3));
  const m = follow((x) => {
    const look = x < 0.25 ? 0 : x < 1.25 ? -0.85 : x < 2.3 ? 0.85 : 0;
    return base({
      x: 540, y: HALL_F - 296 + 40, k: 1.05, hands: HANG,
      face: F({ lx: look, px: look * 1.1, ly: -0.1, worry: lerp(0.3, 0.8, er(x, 0.5, 2.4)), raise: 0.5, curve: lerp(-0.05, -0.4, er(x, 0.5, 2.4)), open: 1 - blinkAt(x, 2.9, 0.4) * 0.8 }),
      hx: look * 8, sweat: er(x, 2.2, 2.8),
    });
  }, t);
  return (
    <g>
      <Wall a="#3a2a20" b="#4a3628" floor={HALL_F} fa="#3a2818" fb="#1a120a" />
      {HALL_DOORS.map((x, i) => (
        <g key={i}>
          <Door x={x} y={HALL_F - 420} open={opens[i]} />
          <rect x={x - 45} y={HALL_F - 492} width={280} height={58} rx={10} fill="#2a1e14" stroke={GOLD} strokeWidth={3} />
          <text x={x + 95} y={HALL_F - 448} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={i === 0 ? 40 : 44} fill={WHITE} letterSpacing={1}>{HALL_NAMES[i]}</text>
          {opens[i] > 0.6 && <text x={x + 95} y={HALL_F - 210} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={110} fill={GOLD} stroke={INK} strokeWidth={5} opacity={er(t, [0.7, 1.7][i], [0.95, 1.95][i])}>?</text>}
        </g>
      ))}
      <rect x={-400} y={-400} width={1880} height={2400} fill="#06080f" opacity={0.45} />
      <Person c={m} look={MARCOS_SUIT} t={t} />
    </g>
  );
};
const CAM11d6 = (t: number): Cam => ({ z: kf(t, [[0, 0.95], [3.4, 1.02]]), fx: 540, fy: kf(t, [[0, 600], [3.4, 600]]) });

// --- S12d6 final: sozinho na sala escura, preocupado (fresta de luz embaixo da porta da cozinha)
const S12d6 = (t: number) => {
  const m = follow((x) => base({
    x: 560, y: 930 - 296, k: 1, hands: [[-80, -10], [80, -10]], holdL: undefined,
    face: F({ lx: lerp(0, -0.4, er(x, 2.6, 3.4)), px: lerp(0, -0.5, er(x, 2.6, 3.4)), ly: 0.05, worry: 0.85, raise: 0.6, curve: -0.35, open: 1 - blinkAt(x, 3.1, 0.6) * 0.8 }),
    sweat: 1, sy: Math.sin(x * 1.6) * 2,
  }), t);
  return (
    <g>
      <HouseDark t={t} door={0} peek={er(t, 2.4, 3.4)} />
      <Person c={m} look={MARCOS_SUIT} t={t} />
      <g transform="translate(760,936) rotate(4)"><Briefcase /></g>
    </g>
  );
};
const CAM12d6 = (t: number): Cam => ({ z: 1.45 + t * 0.03, fx: 560, fy: kf(t, [[0, 560], [5.6, 545]]) });


const SCENES: [(t: number) => React.ReactNode, (t: number) => Cam][] = [
  [R6, CAMR0], [S1d6, CAM1d6], [S2d6, CAM2d6], [S3d6, CAM3d6], [S4d6, CAM4d6], [S5d6, CAM5d6],
  [S6d6, CAM6d6], [S7d6, CAM7d6], [S8d6, CAM8d6], [S9d6, CAM9d6], [S10d6, CAM10d6], [S11d6, CAM11d6], [S12d6, CAM12d6],
];

// ------------------------------------------------------------------ legenda palavra por palavra
const Caption: React.FC<{ t: number }> = ({ t }) => {
  const s = sceneOf(t);
  const ln = LINES[s];
  if (!ln) return null;
  const [txt, , st, dur] = ln;
  const t0 = ST[s] + st;
  const words = txt.split(" ");
  const total = txt.replace(/ /g, "").length;
  let acc = 0;
  const real = WORDT[ln[1]];
  const times = real && real.length === words.length ? real.map((v) => t0 + v) : words.map((w) => { const a = t0 + (acc / total) * dur; acc += w.length; return a; });
  const chunks: number[][] = [];
  let cur: number[] = [], len = 0;
  words.forEach((w, i) => { if (len + w.length > 22 && cur.length) { chunks.push(cur); cur = []; len = 0; } cur.push(i); len += w.length + 1; if (/[.!?:”]$/.test(w) && len > 10) { chunks.push(cur); cur = []; len = 0; } });
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
export const MarcosDia6: React.FC = () => {
  useFonts();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const s = sceneOf(t);
  const lt = t - ST[s];
  const [draw, cam] = SCENES[s];
  const c = cam(lt);
  const flash = s > 0 ? Math.max(0, 1 - lt / 0.14) * 0.18 : 0;
  const LAST = SCENES.length - 1;
  const endP = s === LAST ? er(lt, 0.3, 0.8) : 0;
  const endOut = s === LAST ? er(lt, 2.2, 2.4) * 0 : 0;
  const endP2 = 0;
  const endP3 = s === LAST ? er(lt, 2.35, 2.7) : 0;
  const morning = s === 1 ? er(lt, 0.0, 0.25) * (1 - er(lt, 1.9, 2.2)) : 0;
  const nextDay = s === 6 ? er(lt, 0.0, 0.25) * (1 - er(lt, 1.6, 1.9)) : 0;
  const recap = s === 0 ? er(lt, 0, 0.2) * (1 - er(lt, DUR[0] - 0.3, DUR[0])) : 0;
  const stroke = (w: number) => ({ WebkitTextStroke: `${w}px #0a0605`, paintOrder: "stroke fill" as const });
  return (
    <AbsoluteFill style={{ background: "#0a0605" }}>
      {/* áudio do narrador inteiro, do jeito que o Thiago gravou (as cenas seguem as pausas dele) */}
      {LINES.map((ln, i) => ln && <Sequence key={i} from={Math.round((ST[i] + ln[2]) * fps)}><Audio src={staticFile(`${VOICE_DIR}/n${ln[1]}.wav`)} /></Sequence>)}
      <Audio src={staticFile("marcos_dia6/sfx.wav")} volume={0.45} />
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
      {recap > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 410, textAlign: "center", opacity: recap }}>
          <span style={{ display: "inline-block", padding: "8px 26px", background: "#14100c", border: `5px solid ${GOLD}`, borderRadius: 14, fontFamily: BARLOW, fontWeight: 700, fontSize: 50, letterSpacing: 4, color: WHITE }}>◀◀ NO EPISÓDIO 5</span>
        </div>
      )}
      {morning > 0 && (
        <div style={{ position: "absolute", left: 120, right: 120, top: 470, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, letterSpacing: 2, opacity: morning, transform: `translateY(${(1 - morning) * 12}px)` }}>
          <div style={{ fontSize: 84, color: GOLD, ...stroke(10) }}>3 DIAS DEPOIS…</div>
          <div style={{ fontSize: 66, color: WHITE, ...stroke(10) }}>AINDA SEM EMPREGO</div>
        </div>
      )}
      {nextDay > 0 && (
        <div style={{ position: "absolute", left: 120, right: 120, top: 470, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, letterSpacing: 2, opacity: nextDay, transform: `translateY(${(1 - nextDay) * 12}px)` }}>
          <div style={{ fontSize: 84, color: GOLD, ...stroke(10) }}>08:00.</div>
          <div style={{ fontSize: 66, color: WHITE, ...stroke(10) }}>PRIMEIRO DIA</div>
        </div>
      )}
      {s < LAST && <Caption t={t} />}
      {s === LAST && (
        <div style={{ position: "absolute", left: 120, right: 120, top: 1250, height: 240, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, letterSpacing: 2, lineHeight: 1.02 }}>
          {/* uma frase de cada vez: primeiro o aniversário, depois a conta zerada */}
          {endP * (1 - endOut) > 0 && <div style={{ position: "absolute", left: 0, right: 0, top: 0, fontSize: 68, color: GOLD, opacity: endP * (1 - endOut), transform: `translateY(${(1 - endP) * 16}px)`, ...stroke(10) }}>O QUE ACONTECEU COM<br />A FAMÍLIA DO MARCOS?</div>}
          {endP2 > 0 && <div style={{ position: "absolute", left: 0, right: 0, top: 0, fontSize: 68, color: GOLD, opacity: endP2, transform: `translateY(${(1 - endP2) * 16}px)`, ...stroke(10) }}>QUAL O PRÓXIMO<br />PASSO DO MARCOS?</div>}
          {endP3 > 0 && <div style={{ position: "absolute", left: 0, right: 0, top: 158, fontSize: 54, color: WHITE, opacity: endP3, transform: `translateY(${(1 - endP3) * 16}px)`, ...stroke(9) }}>SEGUE PRA VER A PARTE 7 →</div>}
        </div>
      )}
    </AbsoluteFill>
  );
};
