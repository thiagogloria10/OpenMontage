import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// ==================================================================
// MODELO "TELA DIVIDIDA" (Foco no essencial) — feito a partir de "A noite decide a manhã" v11.
// Troque primeiro os TEXTOS abaixo; depois os blocos (B, rótulos, relógios) e as ações em Half.
// Guia completo: .claude/skills/om-tela-dividida/SKILL.md
// ==================================================================
const TXT = {
  hook: ["MESMO TRABALHO.", "30 DIAS PRA ENTREGAR."], // gancho fixo em cima (branco / dourado)
  titleTop: "COM DISCIPLINA", // metade de cima (personagem dourado)
  titleBot: "SEM DISCIPLINA", // metade de baixo (personagem cinza)
  final: ["O PRAZO ERA O MESMO.", "O PREÇO NÃO."], // frase da cena final (branco / dourado)
};
const AUDIO = "prazo_30_dias/audio_final.wav"; // gerado pelo sfx.py
const FONT_DIR = "prazo_30_dias"; // pasta em public/ com as fontes Barlow

// ------------------------------------------------------------------ base
const GOLD = "#E8B84A";
const RED = "#e0554a";
const WHITE = "#f4f1ea";
const BARLOW = "'Barlow Condensed', 'DejaVu Sans Condensed', sans-serif";
const MONO = "'JetBrains Mono', 'DejaVu Sans Mono', monospace";

export const TOTAL = 26.25; // LOOP + 0,95 s: termina ainda no 1º bloco (22:00), igual ao quadro 0
const LOOP = 25.3; // depois da frase final volta para as duas metades às 22:00 (emenda com o começo)
const Shift = React.createContext(0);
const B = [0, 3, 6, 9, 12, 16, 19]; // começo de cada bloco
const STREET = 22; // início da cena final em tela cheia

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const useT = () => {
  const off = React.useContext(Shift);
  const f0 = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frame = f0 - Math.round(off * fps);
  return { t: frame / fps, frame, fps };
};
const ramp = (t: number, a: number, b: number) => interpolate(t, [a, b], [0, 1], clamp);
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const er = (t: number, a: number, b: number) => ease(ramp(t, a, b));
const blockOf = (t: number) => B.filter((b) => t >= b).length - 1;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

const useFonts = () => {
  const [h] = useState(() => delayRender("fontes Barlow"));
  useEffect(() => {
    const faces = [
      new FontFace("Barlow Condensed", `url(${staticFile(`${FONT_DIR}/barlow-condensed-latin-700-normal.woff2`)})`, { weight: "700" }),
      new FontFace("Barlow Condensed", `url(${staticFile(`${FONT_DIR}/barlow-condensed-latin-600-normal.woff2`)})`, { weight: "600" }),
    ];
    Promise.all(faces.map((f) => f.load().then((ff) => document.fonts.add(ff))))
      .then(() => continueRender(h))
      .catch(() => continueRender(h));
  }, [h]);
};

// ------------------------------------------------------------------ boneco (corpo branco, cabeça redonda, membros em tubo)
type V = [number, number];
const D = (a: number): V => [Math.sin((a * Math.PI) / 180), Math.cos((a * Math.PI) / 180)]; // 0 = baixo, 90 = direita, 180 = cima
const add = (p: V, a: number, len: number): V => {
  const d = D(a);
  return [p[0] + d[0] * len, p[1] + d[1] * len];
};
export type Pose = { nb?: number; rk?: number; x: number; y: number; tr: number; aF: [number, number]; aN: [number, number]; lF: [number, number]; lN: [number, number] };
const mixPose = (p: Pose, q: Pose, k: number): Pose => ({
  x: lerp(p.x, q.x, k),
  y: lerp(p.y, q.y, k),
  tr: lerp(p.tr, q.tr, k),
  aF: [lerp(p.aF[0], q.aF[0], k), lerp(p.aF[1], q.aF[1], k)],
  aN: [lerp(p.aN[0], q.aN[0], k), lerp(p.aN[1], q.aN[1], k)],
  lF: [lerp(p.lF[0], q.lF[0], k), lerp(p.lF[1], q.lF[1], k)],
  lN: [lerp(p.lN[0], q.lN[0], k), lerp(p.lN[1], q.lN[1], k)],
});
// sequência de poses no tempo: [[t, pose], ...]
const track = (t: number, keys: [number, Pose][]): Pose => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, p] = keys[i];
    const [b, q] = keys[i + 1];
    if (t <= b) return mixPose(p, q, ease((t - a) / (b - a)));
  }
  return keys[keys.length - 1][1];
};

type Eyes = "open" | "closed" | "wide" | "droopy" | "down";
type Mouth = "smile" | "flat" | "o" | "yawn" | "frown";
type BodyProps = {
  pose: Pose;
  kind: "gold" | "gray";
  dir?: 1 | -1;
  eyes?: Eyes;
  mouth?: Mouth;
  glow?: number;
  messy?: boolean;
  stink?: number;
  parts?: "full" | "headArm" | "head" | "noNearArm" | "nearArm";
  outfit?: Outfit;
  red?: boolean;
  t: number;
  holdN?: React.ReactNode; // objeto na mão da frente
  holdF?: React.ReactNode;
};
export type Outfit = { shirt: string; pants: string; shoes?: string; shortSleeve?: boolean; shorts?: boolean };
const shade = (c: string, k = 0.82) => {
  const v = [1, 3, 5].map((i) => Math.round(parseInt(c.slice(i, i + 2), 16) * k));
  return `rgb(${v.join(",")})`;
};
const LIM = { ua: 40, fa: 38, th: 50, sh: 50, torso: 74, head: 30 };

const Body: React.FC<BodyProps> = ({ pose, kind, dir = 1, eyes = "open", mouth = "flat", glow = 0, messy, stink = 0, parts = "full", red, t, holdN, holdF, outfit }) => {
  const hip: V = [pose.x, pose.y];
  const sh = add(hip, pose.tr, 60);
  const neck = add(hip, pose.tr, LIM.torso);
  // nb = dobra do pescoço (deitado: corpo reto no colchão, só a cabeça sobe no travesseiro)
  const head = pose.nb ? add(neck, pose.tr + pose.nb, LIM.head + 4) : add(hip, pose.tr, LIM.torso + LIM.head + 2);
  const arm = (a: [number, number], k = 1): V[] => {
    const e = add(sh, a[0], LIM.ua * k);
    return [sh, e, add(e, a[1], LIM.fa * k)];
  };
  const leg = (l: [number, number]): V[] => {
    const k = add(hip, l[0], LIM.th);
    return [hip, k, add(k, l[1], LIM.sh)];
  };
  const pts = (p: V[]) => p.map((q) => q.join(",")).join(" ");
  const armF = arm(pose.aF), armN = arm(pose.aN, pose.rk ?? 1), legF = leg(pose.lF), legN = leg(pose.lN);
  const fill = kind === "gold" ? WHITE : "#aeabbd";
  const line = kind === "gold" ? GOLD : "#55525f";
  const shadeF = kind === "gold" ? "#ddd8cc" : "#9592a4";
  const showFar = parts === "full" || parts === "noNearArm";
  const showNear = parts === "full" || parts === "nearArm" || parts === "headArm";
  const showHead = parts !== "nearArm";
  const part = (p: V[], k1: number, k2: number): V[] => {
    // recorta o membro: k1 do 1º segmento e k2 do 2º (para manga e calça)
    const a = p[0], b = p[1], c = p[2];
    if (k2 <= 0) return [a, [a[0] + (b[0] - a[0]) * k1, a[1] + (b[1] - a[1]) * k1]];
    return [a, b, [b[0] + (c[0] - b[0]) * k2, b[1] + (c[1] - b[1]) * k2]];
  };
  const clothes = () => {
    if (!outfit) return null;
    const sl = (p: V[]) => part(p, 1, outfit.shortSleeve ? 0.08 : 0.82);
    const pl = (p: V[]) => (outfit.shorts ? part(p, 0.78, 0) : part(p, 1, 0.86));
    const shoe = (p: V[]) => outfit.shoes === "none" ? null : <circle cx={p[2][0]} cy={p[2][1]} r={9} fill={outfit.shoes ?? "#2a2a33"} />;
    const sh2 = add(hip, pose.tr, 58);
    return (
      <>
        {showFar && (
          <>
            <polyline points={pts(sl(armF))} stroke={shade(outfit.shirt)} strokeWidth={16} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={pts(pl(legF))} stroke={shade(outfit.pants)} strokeWidth={18} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {shoe(legF)}
            <line x1={hip[0]} y1={hip[1]} x2={sh2[0]} y2={sh2[1]} stroke={outfit.shirt} strokeWidth={32} strokeLinecap="round" />
            <circle cx={hip[0]} cy={hip[1]} r={14} fill={outfit.pants} />
            <polyline points={pts(pl(legN))} stroke={outfit.pants} strokeWidth={18} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {shoe(legN)}
          </>
        )}
        {showNear && <polyline points={pts(sl(armN))} stroke={outfit.shirt} strokeWidth={16} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      </>
    );
  };
  const layer = (extra: number, color: string, farColor: string) => (
    <>
      {showFar && (
        <>
          <polyline points={pts(armF)} stroke={farColor} strokeWidth={13 + extra} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={pts(legF)} stroke={farColor} strokeWidth={15 + extra} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <line x1={hip[0]} y1={hip[1]} x2={neck[0]} y2={neck[1]} stroke={color} strokeWidth={30 + extra} strokeLinecap="round" />
          <polyline points={pts(legN)} stroke={color} strokeWidth={15 + extra} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {showNear && <polyline points={pts(armN)} stroke={color} strokeWidth={13 + extra} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      {showHead && <circle cx={head[0]} cy={head[1]} r={LIM.head + extra / 2} fill={color} />}
    </>
  );
  // rosto
  const ex = head[0] + dir * 9, ey = head[1] - 2;
  const eyeL: V = [ex - 7, ey], eyeR: V = [ex + 8, ey];
  const eyeEl = (p: V, i: number) => {
    if (eyes === "closed") return <path key={i} d={`M${p[0] - 5} ${p[1]} q5 4 10 0`} stroke="#2a2836" strokeWidth={2.6} fill="none" strokeLinecap="round" />;
    if (eyes === "wide")
      return (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r={6.5} fill="#fff" stroke={red ? RED : "#2a2836"} strokeWidth={1.4} />
          <circle cx={p[0] + dir * 1.5} cy={p[1]} r={2.6} fill="#1e1c28" />
        </g>
      );
    if (eyes === "droopy")
      return (
        <g key={i}>
          <ellipse cx={p[0]} cy={p[1] + 1} rx={4} ry={3.5} fill={red ? "#7a2e2e" : "#2a2836"} />
          <line x1={p[0] - 6} y1={p[1] - 1} x2={p[0] + 6} y2={p[1] - 1} stroke="#55525f" strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    if (eyes === "down") return <ellipse key={i} cx={p[0]} cy={p[1] + 2} rx={3.4} ry={3} fill="#2a2836" />;
    return <ellipse key={i} cx={p[0]} cy={p[1]} rx={3.4} ry={4.8} fill="#2a2836" />;
  };
  const mx = head[0] + dir * 11, my = head[1] + 13;
  const mouthEl =
    mouth === "smile" ? <path d={`M${mx - 7} ${my - 2} q7 6 14 0`} stroke="#2a2836" strokeWidth={2.6} fill="none" strokeLinecap="round" />
    : mouth === "o" ? <ellipse cx={mx} cy={my} rx={3.5} ry={4} fill="#2a2836" />
    : mouth === "yawn" ? <ellipse cx={mx} cy={my + 1} rx={6} ry={8} fill="#2a2836" />
    : mouth === "frown" ? <path d={`M${mx - 6} ${my + 2} q6 -5 12 0`} stroke="#2a2836" strokeWidth={2.6} fill="none" strokeLinecap="round" />
    : <line x1={mx - 5} y1={my} x2={mx + 5} y2={my} stroke="#2a2836" strokeWidth={2.6} strokeLinecap="round" />;
  const handN = armN[2], handF = armF[2];
  return (
    <g>
      {holdF && <g transform={`translate(${handF[0]},${handF[1]})`}>{holdF}</g>}
      {glow > 0 && (
        <g filter="url(#glowGold)" opacity={glow}>
          {layer(16, GOLD, GOLD)}
        </g>
      )}
      {layer(5, line, line)}
      {layer(0, fill, shadeF)}
      {clothes()}
      {showHead && <circle cx={head[0]} cy={head[1]} r={LIM.head} fill={fill} />}
      {showHead && messy &&
        [-16, -6, 4, 14].map((o, i) => (
          <path key={i} d={`M${head[0] + o} ${head[1] - 27} q${4 - i * 2} -14 ${-3 + i * 3} -22`} stroke="#55525f" strokeWidth={3} fill="none" strokeLinecap="round" />
        ))}
      {showHead && eyeEl(eyeL, 0)}
      {showHead && eyeEl(eyeR, 1)}
      {showHead && mouthEl}
      {showHead && stink > 0 &&
        [0, 1].map((i) => {
          const q = (t * 0.8 + i * 0.5) % 1;
          return <path key={i} d={`M${head[0] - 14 + i * 22} ${head[1] - 40 - q * 40} q6 -8 0 -16 q-6 -8 0 -16`} stroke="#8a8798" strokeWidth={3} fill="none" opacity={stink * (1 - q)} />;
        })}
      {holdN && <g transform={`translate(${handN[0]},${handN[1]})`}>{holdN}</g>}
    </g>
  );
};

const Phone: React.FC<{ on?: boolean; rot?: number; scroll?: number }> = ({ on = true, rot = 0, scroll = 0 }) => (
  <g transform={`rotate(${rot})`}>
    <rect x={-9} y={-15} width={18} height={30} rx={3} fill="#1b1b22" stroke="#3a3a44" strokeWidth={1.5} />
    {on && (
      <>
        <rect x={-7} y={-12} width={14} height={24} fill="#7cc4ff" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={-5} y={-11 + (((i * 9 + scroll * 30) % 24) + 24) % 24} width={10} height={4} fill={i === 1 ? "#ff7aa8" : "#e9f6ff"} opacity={0.9} />
        ))}
      </>
    )}
  </g>
);

// ------------------------------------------------------------------ quarto-escritório (vetor)
const W = 1080, H = 520, FLOOR = 440;
const skyColors = (dawn: number) => {
  const c = (a: string, b: string) => {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], dawn))).join(",")})`;
  };
  return [c("#141a3c", "#ffb36b"), c("#3b2d63", "#8a9ae0")];
};

const CalPage: React.FC<{ v: number }> = ({ v }) => {
  const hoje = v <= 0, one = v === 1;
  return (
    <g>
      <rect x={0} y={0} width={74} height={88} rx={4} fill={hoje || one ? "#d84a3c" : "#f4f1ea"} stroke="#2b2e45" strokeWidth={3} />
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
const Calendar: React.FC<{ id: string; n: number; prev: number; tear: number; note: number }> = ({ id, n, prev, tear, note }) => (
  <g transform="translate(588,206)">
    <CalPage v={n} />
    {tear > 0 && tear < 1 && (
      <g transform={`translate(${tear * 50},${tear * 150}) rotate(${tear * 60} 37 0)`} opacity={1 - tear * 0.8}>
        <CalPage v={prev} />
      </g>
    )}
    {[18, 56].map((x) => <rect key={x} x={x - 3} y={-6} width={6} height={12} rx={2} fill="#2b2e45" />)}
    {note > 0 && (
      <g transform="translate(22,40) rotate(7)">
        <defs>
          <clipPath id={`note${id}`}><rect x={0} y={0} width={60 * note} height={44} /></clipPath>
        </defs>
        <rect x={0} y={0} width={60} height={44} fill="#f5d36a" stroke="#b8952e" strokeWidth={2} />
        <g clipPath={`url(#note${id})`}>
          <text x={30} y={19} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={16} fill="#2a2836">SEG 19H</text>
          <text x={30} y={36} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={13} fill="#2a2836">PARTE 1</text>
        </g>
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
        {Math.floor(t * 3) % 2 === 0 && <rect x={5 + 40 * ((pct * 7) % 1)} y={5 + Math.min(6, Math.floor(pct * 7)) * 5.5} width={1.5} height={4} fill="#1b1b22" />}
      </g>
    );
  if (kind === "done")
    return (
      <g>
        <rect x={0} y={0} width={58} height={44} fill="#2f9a5a" />
        <path d="M17 22 l7 7 l15 -15" stroke="#fff" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <text x={29} y={41} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={9} fill="#fff">PRONTO</text>
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

const Mug: React.FC<{ tilt?: number; steam?: number; t?: number }> = ({ tilt = 0, steam = 0, t = 0 }) => (
  <g transform={`rotate(${tilt})`}>
    <rect x={-9} y={-13} width={18} height={22} rx={3} fill="#f2efe6" />
    <rect x={-9} y={-13} width={18} height={5} fill="#6b4a36" />
    <path d="M9 -8 q8 0 8 7 q0 7 -8 7" stroke="#f2efe6" strokeWidth={3} fill="none" />
    {steam > 0 &&
      [0, 1].map((i) => {
        const q = ((t * 0.8 + i * 0.5) % 1 + 1) % 1;
        return <path key={i} d={`M${-4 + i * 7} ${-16 - q * 22} q4 -5 0 -10 q-4 -5 0 -10`} stroke="#ffffff" strokeWidth={2} fill="none" opacity={steam * 0.6 * (1 - q)} />;
      })}
  </g>
);

const Room: React.FC<{
  id: string; t: number; dawn: number; lamp: number; deskLamp: number; clock: string; clockColor: string;
  days: number; prevDays: number; tear: number; note: number; lid: number; screen: Screen; pct: number; mugs: number; papers: number;
}> = (p) => {
  const [skyB, skyT] = skyColors(p.dawn);
  const { t } = p;
  return (
    <g>
      <defs>
        <linearGradient id={`sky${p.id}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={skyB} />
          <stop offset="1" stopColor={skyT} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={W} height={FLOOR} fill="#4a4e6e" />
      <rect x={0} y={FLOOR - 10} width={W} height={10} fill="#3b3f5c" />
      <rect x={0} y={FLOOR} width={W} height={H - FLOOR} fill="#33364f" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <line key={i} x1={i * 170 - 40} y1={FLOOR} x2={i * 170 - 120} y2={H} stroke="#2c2f45" strokeWidth={3} />)}
      {/* janela */}
      <rect x={120} y={110} width={200} height={190} fill={`url(#sky${p.id})`} />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const hgt = [70, 110, 85, 130, 60, 95][i];
        return (
          <g key={i}>
            <rect x={120 + i * 34} y={300 - hgt} width={30} height={hgt} fill={p.dawn > 0.5 ? "#3a3550" : "#1a1d33"} />
            {[0, 1, 2].map((j) => <rect key={j} x={126 + i * 34 + (j % 2) * 10} y={300 - hgt + 12 + j * 20} width={5} height={7} fill="#ffcf6a" opacity={(1 - p.dawn) * ((i + j) % 3 === 0 ? 0.2 : 0.85)} />)}
          </g>
        );
      })}
      <rect x={114} y={104} width={212} height={202} fill="none" stroke="#2b2e45" strokeWidth={12} />
      <line x1={220} y1={110} x2={220} y2={300} stroke="#2b2e45" strokeWidth={8} />
      <line x1={120} y1={205} x2={320} y2={205} stroke="#2b2e45" strokeWidth={8} />
      <rect x={104} y={300} width={232} height={12} fill="#2b2e45" />
      {/* quadro */}
      <rect x={430} y={130} width={74} height={88} fill="#2b2e45" />
      <rect x={438} y={138} width={58} height={72} fill="#6a6f99" />
      <path d="M438 210 L460 175 L476 195 L486 182 L496 210 Z" fill="#3b3f5c" />
      {/* cama */}
      <rect x={340} y={280} width={20} height={160} rx={4} fill="#6b4a36" />
      <rect x={360} y={400} width={340} height={30} fill="#6b4a36" />
      <rect x={360} y={364} width={340} height={38} rx={6} fill="#cfcde3" />
      <rect x={688} y={330} width={16} height={110} rx={4} fill="#6b4a36" />
      <ellipse cx={404} cy={356} rx={46} ry={17} fill="#eceaf6" />
      {/* criado-mudo da cabeceira + despertador */}
      <rect x={262} y={368} width={76} height={72} fill="#7a563f" />
      <rect x={268} y={380} width={64} height={24} fill="#8a6449" stroke="#5a3e2c" strokeWidth={3} />
      <g transform="translate(300,347) scale(1.3)">
        <rect x={-26} y={-17} width={52} height={32} rx={6} fill="#1d1d24" stroke="#3a3a44" strokeWidth={2} />
        <rect x={-21} y={-12} width={42} height={22} rx={3} fill="#0b0b10" />
        <text x={0} y={5} fontFamily={MONO} fontSize={15} fill={p.clockColor} textAnchor="middle" fontWeight={800} style={{ filter: `drop-shadow(0 0 3px ${p.clockColor})` }}>{p.clock}</text>
      </g>
      {/* criado-mudo do pé com abajur */}
      <rect x={720} y={362} width={84} height={78} fill="#7a563f" />
      <rect x={720} y={376} width={84} height={30} fill="#8a6449" stroke="#5a3e2c" strokeWidth={3} />
      <rect x={744} y={354} width={16} height={8} fill="#c9a24a" />
      <line x1={752} y1={354} x2={752} y2={318} stroke="#c9a24a" strokeWidth={4} />
      <path d="M730 320 L774 320 L766 296 L738 296 Z" fill={p.lamp > 0.5 ? "#ffe2a0" : "#8a8070"} />
      {/* calendário */}
      <Calendar id={p.id} n={p.days} prev={p.prevDays} tear={p.tear} note={p.note} />
      {/* relógio de parede digital */}
      <g transform="translate(896,222)">
        <rect x={0} y={0} width={96} height={38} rx={6} fill="#14141b" stroke="#2b2e45" strokeWidth={3} />
        <text x={48} y={28} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={26} fill={p.clockColor} style={{ filter: `drop-shadow(0 0 4px ${p.clockColor})` }}>{p.clock}</text>
      </g>
      {/* cadeira (encosto atrás de quem senta) */}
      <rect x={834} y={298} width={12} height={96} rx={4} fill="#3a3d57" />
      <rect x={834} y={390} width={78} height={9} rx={3} fill="#3a3d57" />
      <rect x={868} y={399} width={7} height={30} fill="#2b2e45" />
      <rect x={846} y={428} width={52} height={6} rx={3} fill="#2b2e45" />
      {/* mesa */}
      <rect x={826} y={340} width={254} height={12} fill="#8a6449" />
      <rect x={836} y={352} width={10} height={88} fill="#6b4a36" />
      <rect x={990} y={352} width={84} height={88} fill="#7a563f" />
      {[0, 1].map((i) => <g key={i}><rect x={996} y={360 + i * 38} width={72} height={32} fill="#8a6449" stroke="#5a3e2c" strokeWidth={2} /><circle cx={1032} cy={376 + i * 38} r={3.5} fill="#c9a24a" /></g>)}
      {/* papéis espalhados */}
      {Array.from({ length: p.papers }).map((_, i) => (
        <rect key={i} x={842 + ((i * 37) % 70)} y={334 - (i % 3) * 3} width={26} height={6} fill="#f1ede2" stroke="#b9b39f" strokeWidth={1} transform={`rotate(${((i * 23) % 30) - 15} ${855 + ((i * 37) % 70)} 337)`} />
      ))}
      {/* notebook */}
      <rect x={922} y={334} width={80} height={6} rx={2} fill="#3c3f4d" />
      <g transform={`translate(998,336) scale(1,${Math.max(0.04, p.lid)})`}>
        <polygon points="-70,0 2,0 8,-56 -64,-56" fill="#2a2a33" />
        <g transform="translate(-62,-51) skewX(-6)">
          <ScreenFace kind={p.screen} pct={p.pct} t={t} />
        </g>
      </g>
      {/* canecas */}
      {Array.from({ length: p.mugs }).map((_, i) => (
        <g key={i} transform={`translate(${1016 + i * 18},${330 - (i === 1 ? 2 : 0)}) scale(0.75)`}><Mug steam={i === p.mugs - 1 ? 1 : 0} t={t} /></g>
      ))}
      {/* luminária da mesa */}
      <ellipse cx={1062} cy={338} rx={14} ry={4} fill="#2b2b33" />
      <line x1={1062} y1={336} x2={1050} y2={286} stroke="#2b2b33" strokeWidth={4} />
      <line x1={1050} y1={286} x2={1030} y2={278} stroke="#2b2b33" strokeWidth={4} />
      <path d="M1016 270 L1040 282 L1030 298 Z" fill={p.deskLamp > 0.5 ? "#ffe2a0" : "#444"} stroke="#2b2b33" strokeWidth={3} />
    </g>
  );
};

const Blanket: React.FC<{ bump?: number; color?: string }> = ({ bump = 0, color = "#5a6aa8" }) => (
  <path d={`M420 ${362 - bump * 0.4} Q 500 ${350 - bump} 600 ${356 - bump * 0.6} L 700 362 L 700 404 L 420 404 Z`} fill={color} stroke="#9a7428" strokeWidth={3} />
);
const BlanketLie: React.FC<{ color: string; edge: string }> = ({ color, edge }) => (
  <path d="M472 342 Q 490 330 530 332 Q 595 336 635 331 Q 682 330 700 340 L 700 404 L 466 404 Z" fill={color} stroke={edge} strokeWidth={3} />
);

// nuvem de chuva (cresce em quem deixa pra depois)
const Cloud: React.FC<{ x: number; y: number; s: number; rain: number; t: number; flash?: boolean }> = ({ x, y, s, rain, t, flash }) => (
  <g transform={`translate(${x},${y + Math.sin(t * 2.2) * 3}) scale(${s})`}>
    {rain > 0 &&
      Array.from({ length: 14 }).map((_, i) => {
        const q = ((t * 2.4 + i * 0.173) % 1 + 1) % 1;
        const xx = -44 + ((i * 29) % 88);
        return <line key={i} x1={xx} y1={14 + q * 90} x2={xx - 3} y2={24 + q * 90} stroke="#8fb4e8" strokeWidth={2.5} strokeLinecap="round" opacity={rain * (1 - q * 0.6)} />;
      })}
    <g fill={flash ? "#8a8aa0" : "#4b4b5c"} stroke="#2e2e3a" strokeWidth={3}>
      <circle cx={-30} cy={2} r={20} />
      <circle cx={30} cy={2} r={20} />
      <circle cx={0} cy={-10} r={28} />
      <rect x={-48} y={0} width={96} height={20} rx={10} />
    </g>
    <g fill={flash ? "#8a8aa0" : "#4b4b5c"}>
      <circle cx={-30} cy={2} r={18.5} />
      <circle cx={30} cy={2} r={18.5} />
      <circle cx={0} cy={-10} r={26.5} />
      <rect x={-46.5} y={1.5} width={93} height={17} rx={8.5} />
    </g>
  </g>
);

const FlyPaper: React.FC<{ t: number; n: number; cx: number; cy: number }> = ({ t, n, cx, cy }) => (
  <g>
    {Array.from({ length: n }).map((_, i) => {
      const q = ((t * 0.55 + i / n) % 1 + 1) % 1;
      const x = cx + Math.sin(i * 2.1 + q * 6) * (40 + i * 6) + (i % 2 ? 1 : -1) * q * 70;
      const y = cy - 40 - Math.sin(q * Math.PI) * 90;
      return <rect key={i} x={-11} y={-7} width={22} height={14} fill="#f1ede2" stroke="#b9b39f" strokeWidth={1} transform={`translate(${x},${y}) rotate(${q * 360 * (i % 2 ? 1 : -1)})`} opacity={Math.sin(q * Math.PI)} />;
    })}
  </g>
);

// ------------------------------------------------------------------ poses
const P = (x: number, y: number, tr: number, aF: [number, number], aN: [number, number], lF: [number, number], lN: [number, number]): Pose => ({ x, y, tr, aF, aN, lF, lN });
const SIT = P(872, 386, 180, [62, 100], [70, 108], [95, 5], [85, 0]);
const SIT_BACK = P(866, 386, 190, [205, 95], [195, 85], [95, 5], [85, 0]);
const SIT_STRETCH = P(872, 386, 180, [160, 175], [200, 185], [95, 5], [85, 0]);
const SIT_LOOK = P(872, 386, 172, [50, 110], [60, 120], [95, 5], [85, 0]);
const SIT_SLUMP = P(878, 386, 128, [105, 80], [112, 72], [95, 5], [85, 0]);
const STAND_CAL = P(702, 342, 180, [-10, -5], [240, 225], [-4, 0], [4, 0]);
const STAND = P(702, 342, 180, [-10, -5], [10, 5], [-4, 0], [4, 0]);
const STAND_SHOCK = P(712, 342, 186, [-140, -170], [140, 170], [-6, 0], [6, 0]);
const STAND_MUG = P(900, 342, 180, [10, 5], [40, 150], [-4, 0], [4, 0]);
const READ = P(420, 372, 195, [40, 110], [30, 120], [90, 90], [92, 92]);
const LIE_BODY: Pose = { ...P(506, 356, 270, [80, 90], [80, 90], [90, 90], [90, 90]), nb: -62 };
const headOf = (p: Pose): V => add([p.x, p.y], p.tr, LIM.torso + LIM.head + 2);

const STUDY_GOLD: Outfit = { shirt: "#1f2a48", pants: "#2a2f45", shoes: "#f2f2f2" };
const PJ_GOLD: Outfit = { shirt: "#3a4a86", pants: "#3a4a86", shoes: "none" };
export const DAY_GRAY: Outfit = { shirt: "#77728a", pants: "#3e3b4a", shoes: "#2a2a33" };

// ------------------------------------------------------------------ blocos
const TOP_LABELS = ["MARCOU DIA E HORA", "1 HORA POR DIA", "UM POUCO TODO DIA", "TERMINOU ANTES", "NOITE TRANQUILA", "ENTREGOU NA HORA", "E DESCANSADO"];
const BOT_LABELS = ["TEM TEMPO", "SÓ MAIS UM", "COMEÇO AMANHÃ", "AINDA DÁ TEMPO?", "VIROU A NOITE", "NO ÚLTIMO MINUTO", "E ESGOTADO"];
const DAYS = [30, 24, 15, 7, 1, 0, 0];
const pctAt = (t: number, top: boolean) =>
  top
    ? interpolate(t, [0, 3, 6, 6.01, 9, 9.01, 10, 99], [0, 0, 0.2, 0.35, 0.55, 0.8, 1, 1], clamp)
    : interpolate(t, [0, 12, 16, 16.2, 18, 99], [0, 0, 0.7, 0.7, 1, 1], clamp);
const minutesAt = (t: number, top: boolean) => {
  const b = blockOf(t);
  if (top) {
    if (b === 4) return t < 14.6 ? 1330 : 1350;
    return [1140, 1140, 1170, 1200, 1330, 480, 540][b];
  }
  if (b === 4) return Math.floor(interpolate(t, [12, 16], [1420, 1630], clamp));
  if (b === 5) return Math.floor(interpolate(t, [16, 18], [1390, 1439], clamp));
  return [1140, 1430, 1200, 1260, 1420, 1390, 540][b];
};
const fmt = (m: number) => {
  const mm = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`;
};

const Label: React.FC<{ title: string; sub: string; subAt: number }> = ({ title, sub, subAt }) => {
  const { t, fps } = useT();
  const p = spring({ frame: Math.round((t - subAt) * fps), fps, config: { damping: 14, stiffness: 200 } });
  return (
    <div style={{ position: "absolute", left: 150, top: 20 }}>
      <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 60, color: WHITE, letterSpacing: 3, lineHeight: 1, textShadow: "0 3px 10px rgba(0,0,0,.8)" }}>{title}</div>
      <div style={{ fontFamily: BARLOW, fontWeight: 600, fontSize: 46, color: GOLD, letterSpacing: 2, marginTop: 4, opacity: Math.min(1, p * 1.5), transform: `translateX(${(1 - p) * -20}px)`, textShadow: "0 2px 8px rgba(0,0,0,.9)" }}>{sub}</div>
    </div>
  );
};

// canto direito: dias que faltam + barra do trabalho
const Hud: React.FC<{ top: boolean }> = ({ top }) => {
  const { t } = useT();
  const b = blockOf(t);
  const d = DAYS[b];
  const urgent = d <= 1;
  const col = urgent ? RED : GOLD;
  const pct = pctAt(t, top);
  const barCol = top ? GOLD : b >= 4 ? RED : "#8a8798";
  const pop = b > 0 ? interpolate(t - B[b], [0, 0.12, 0.3], [1, 1.15, 1], clamp) : 1;
  return (
    <div style={{ position: "absolute", right: 210, top: 24, width: 236, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
      <div style={{ padding: "4px 14px", background: "rgba(12,12,18,.8)", border: `3px solid ${col}`, borderRadius: 8, fontFamily: MONO, fontWeight: 800, fontSize: 40, color: col, textShadow: `0 0 12px ${col}`, transform: `scale(${pop})`, transformOrigin: "right center" }}>
        {d <= 0 ? "HOJE" : `${d} ${d === 1 ? "DIA" : "DIAS"}`}
      </div>
      <div style={{ width: 236, padding: "6px 10px 9px", background: "rgba(12,12,18,.8)", borderRadius: 8, border: "2px solid rgba(255,255,255,.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: BARLOW, fontWeight: 700, fontSize: 26, color: WHITE, letterSpacing: 1 }}>
          <span>TRABALHO</span>
          <span style={{ color: pct >= 1 ? "#5fd08a" : barCol }}>{Math.round(pct * 100)}%</span>
        </div>
        <div style={{ height: 12, marginTop: 4, borderRadius: 6, background: "#2c2e40", overflow: "hidden" }}>
          <div style={{ width: `${pct * 100}%`, height: "100%", background: pct >= 1 ? "#5fd08a" : barCol }} />
        </div>
      </div>
    </div>
  );
};

const ResultCard: React.FC<{ top: boolean }> = ({ top }) => {
  const { t, fps } = useT();
  const p = spring({ frame: Math.round((t - 19.25) * fps), fps, config: { damping: 13, stiffness: 170 } });
  const p2 = spring({ frame: Math.round((t - 19.75) * fps), fps, config: { damping: 13, stiffness: 170 } });
  return (
    <div style={{ position: "absolute", left: 140, top: 205, width: 440, padding: "16px 22px", background: "rgba(10,10,16,.86)", border: `3px solid ${top ? GOLD : RED}`, borderRadius: 14, transform: `scale(${p})`, transformOrigin: "left center", opacity: Math.min(1, p * 2) }}>
      <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 52, color: "#5fd08a", letterSpacing: 2, lineHeight: 1 }}>✓ ENTREGUE</div>
      <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: top ? 50 : 40, whiteSpace: "nowrap", color: top ? GOLD : RED, letterSpacing: 1, lineHeight: 1.05, marginTop: 8, opacity: Math.min(1, p2 * 1.6), transform: `translateY(${(1 - p2) * 12}px)` }}>
        {top ? "+ DORMIU 8H" : "+ 3 NOITES SEM DORMIR"}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ cada metade
const PH = 600;
const camX = (top: boolean, b: number) => (top ? [760, 774, 774, 774, 520, 774, 774] : [520, 520, 774, 760, 774, 774, 774])[b];

const Half: React.FC<{ top: boolean; y: number }> = ({ top, y }) => {
  const { t, frame } = useT();
  const b = blockOf(t);
  const bs = B[b];
  const since = t - bs;
  const cut = b > 0;
  const cutPulse = cut ? interpolate(since, [0, 0.25], [1.05, 1], clamp) : 1;
  const flash = cut ? interpolate(since, [0, 0.18], [0.35, 0], clamp) : 0;
  const id = top ? "t" : "b";
  const kind = top ? "gold" : "gray";
  const pct = pctAt(t, top);

  // ------- estado do cenário
  let dawn = 0, lamp = 1, deskLamp = 0, dark = 0.3, phoneGlow = 0, note = 0, lid = 1, mugs = 1, papers = 0;
  let screen: Screen = "doc";
  const m = minutesAt(t, top);
  let clockColor = "#ffb84a";
  if (top) {
    if (b === 0) { note = er(t, 0.15, 1.7); lid = 0; screen = "off"; }
    if (b >= 1 && b <= 3) deskLamp = 1;
    if (b === 3) { screen = t < 10 ? "doc" : "done"; lid = 1 - er(t, 11.35, 11.75); }
    if (b === 4) { lamp = t < 14.6 ? 1 : 0; dark = t < 14.6 ? 0.42 : 0.7; lid = 0; screen = "off"; }
    if (b >= 5) { lamp = 0; dawn = 1; dark = 0.06; screen = t < 17.0 && b === 5 ? "doc" : "sent"; }
    if (b === 6) lid = 1;
  } else {
    clockColor = (m >= 1440 && m < 1800) || (b === 5 && m >= 1430) ? RED : "#ffb84a";
    if (b <= 1) { phoneGlow = 1; lid = 0; screen = "off"; dark = b === 0 ? 0.32 : 0.55; lamp = b === 0 ? 1 : 0; }
    if (b === 2) { lid = er(t, 6.15, 6.5) * (1 - er(t, 7.55, 7.9)); screen = "doc"; deskLamp = 0; }
    if (b === 3) { lid = 0; screen = "off"; }
    if (b === 4) { lamp = 0; deskLamp = 1; dark = 0.74; mugs = t < 13.2 ? 1 : t < 14.4 ? 2 : 3; papers = Math.floor(interpolate(t, [12, 16], [2, 9], clamp)); }
    if (b === 5) { lamp = 0; deskLamp = 1; dark = 0.62; mugs = 3; papers = 9; screen = t < 16.9 ? "doc" : t < 18.0 ? "sending" : "late"; }
    if (b === 6) { lamp = 0; dawn = 1; dark = 0.12; mugs = 3; papers = 9; lid = 0; screen = "off"; }
  }
  const tear = cut ? ramp(since, 0, 0.55) : 0;
  const screenPct = screen === "sending" ? ramp(t, 16.9, 18.0) : pct;

  // ------- personagem
  let under: React.ReactNode = null;
  let blanket: React.ReactNode = null;
  let over: React.ReactNode = null;
  let headPos: V | null = null;
  const typing = (amp = 1, speed = 14): Pose => {
    const k = Math.sin(t * speed) * 6 * amp, k2 = Math.cos(t * speed * 1.1) * 6 * amp;
    return { ...SIT, aF: [SIT.aF[0], SIT.aF[1] + k], aN: [SIT.aN[0], SIT.aN[1] + k2] };
  };
  if (top) {
    if (b === 0) {
      const writing = t < 1.8;
      const k = Math.sin(t * 16) * 5;
      const pose = writing ? { ...STAND_CAL, aN: [STAND_CAL.aN[0] + k * 0.4, STAND_CAL.aN[1] + k] as [number, number] } : track(t, [[1.8, STAND_CAL], [2.3, STAND]]);
      over = <Body t={t} pose={pose} kind="gold" outfit={STUDY_GOLD} dir={t < 2.2 ? -1 : 1} eyes={writing ? "down" : "open"} mouth="smile" glow={0.55} holdN={writing ? <rect x={-2} y={-12} width={4} height={14} rx={1} fill="#e04a3c" transform="rotate(-30)" /> : undefined} />;
    } else if (b === 1 || b === 2) {
      over = <Body t={t} pose={typing()} kind="gold" outfit={STUDY_GOLD} eyes="down" mouth="smile" glow={0.55 + 0.1 * b} />;
      if (b === 2)
        over = (
          <>
            {over}
            {[6.8, 7.7, 8.5].map((s, i) =>
              t > s ? <text key={i} x={960} y={270 - (t - s) * 40} fontFamily={MONO} fontWeight={800} fontSize={20} fill="#5fd08a" textAnchor="middle" opacity={1 - ramp(t, s + 0.5, s + 0.9)}>✓</text> : null
            )}
          </>
        );
    } else if (b === 3) {
      const pose = t < 10.2 ? typing() : track(t, [[10.2, SIT], [10.55, SIT_STRETCH], [11.15, SIT_STRETCH], [11.4, SIT_LOOK]]);
      const str = t > 10.5 && t < 11.2;
      over = <Body t={t} pose={pose} kind="gold" outfit={STUDY_GOLD} eyes={str ? "closed" : "down"} mouth={str ? "o" : "smile"} glow={0.6 + 0.3 * er(t, 10, 10.6)} />;
    } else if (b === 4) {
      if (t < 14.6) {
        const yawn = t > 13.8 && t < 14.3;
        const flip = [12.8, 13.5].map((s) => ramp(t, s, s + 0.35)).reduce((a, v) => a + (v > 0 && v < 1 ? v : 0), 0);
        under = <Body t={t} pose={READ} kind="gold" outfit={PJ_GOLD} parts="noNearArm" eyes={yawn ? "closed" : "down"} mouth={yawn ? "yawn" : "smile"} glow={0.55} />;
        blanket = <Blanket bump={10} color="#c99a3e" />;
        over = (
          <>
            <Body t={t} pose={READ} kind="gold" outfit={PJ_GOLD} parts="nearArm" glow={0.55} />
            <g transform="translate(486,320)">
              <rect x={-30} y={-20} width={30} height={38} fill="#f1ead8" stroke="#b9ae92" strokeWidth={2} />
              <rect x={0} y={-20} width={30} height={38} fill="#f1ead8" stroke="#b9ae92" strokeWidth={2} />
              <rect x={-4} y={-22} width={8} height={42} fill={GOLD} />
              {flip > 0 && <rect x={0} y={-20} width={30 * Math.cos(flip * Math.PI)} height={38} fill="#fff7e4" stroke="#b9ae92" strokeWidth={2} />}
            </g>
          </>
        );
      } else {
        const lp = { ...LIE_BODY, aN: [110, 95] as [number, number] };
        under = <Body t={t} pose={lp} kind="gold" outfit={PJ_GOLD} parts="noNearArm" eyes="closed" mouth="smile" glow={0.4} />;
        blanket = <BlanketLie color="#c99a3e" edge="#9a7428" />;
        over = [
          <Body key="h" t={t} pose={lp} kind="gold" outfit={PJ_GOLD} parts="nearArm" glow={0.4} />,
          ...[0, 1, 2].map((i) => {
            const q = (((t - 14.6 + i * 0.5) % 1.5) + 1.5) % 1.5 / 1.5;
            return <text key={i} x={420 + q * 60 + i * 6} y={300 - q * 90} fontFamily={MONO} fontWeight={800} fontSize={22 + i * 6} fill={GOLD} opacity={interpolate(q, [0, 0.2, 0.8, 1], [0, 1, 1, 0])}>z</text>;
          }),
        ];
      }
    } else if (b === 5) {
      const click = t > 16.75 && t < 17.0;
      const pose = t < 16.7 ? typing(0.4, 8) : click ? { ...SIT, aN: [SIT.aN[0] + 8, SIT.aN[1] + 12] as [number, number] } : SIT_LOOK;
      over = <Body t={t} pose={pose} kind="gold" outfit={STUDY_GOLD} eyes={t > 17 ? "open" : "down"} mouth="smile" glow={0.75} />;
    } else {
      const pose = track(t, [[19, SIT_LOOK], [19.45, STAND_MUG]]);
      over = <Body t={t} pose={pose} kind="gold" outfit={STUDY_GOLD} eyes="open" mouth="smile" glow={0.9} holdN={t > 19.3 ? <Mug steam={1} t={t} /> : undefined} />;
    }
  } else {
    if (b <= 1) {
      const thumb = Math.floor(t * 5) % 2;
      const laugh = b === 1 && Math.floor(t * 3) % 2 === 0;
      const pose = { ...LIE_BODY, aN: [99, -158 + thumb * 6] as [number, number], y: LIE_BODY.y + (laugh ? -2 : 0) };
      under = <Body t={t} pose={pose} kind="gray" outfit={DAY_GRAY} parts="noNearArm" eyes={b === 0 ? "open" : laugh ? "closed" : "wide"} mouth={b === 1 ? (laugh ? "yawn" : "smile") : "flat"} red={b === 1} />;
      over = (
        <>
          <Body t={t} pose={pose} kind="gray" outfit={DAY_GRAY} parts="nearArm" holdN={<Phone scroll={t * (b === 1 ? 4 : 2.2)} rot={-15} />} />
          {b === 1 &&
            [3.6, 4.4, 5.2].map((s, i) =>
              t > s ? (
                <g key={i} transform={`translate(${470 + i * 26},${250 - (t - s) * 40})`} opacity={1 - ramp(t, s + 0.6, s + 1)}>
                  <circle r={12} fill={i === 1 ? "#ff7aa8" : RED} />
                  <text y={5} fontSize={13} fill="#fff" textAnchor="middle" fontFamily={MONO} fontWeight={800}>{i === 1 ? "♥" : "1"}</text>
                </g>
              ) : null
            )}
          {b === 1 && laugh && <text x={430} y={262} fontFamily={BARLOW} fontWeight={700} fontSize={22} fill="#cfcde3" opacity={0.85}>KKK</text>}
        </>
      );
    } else if (b === 2) {
      const pose = t < 7.9 ? SIT_LOOK : track(t, [[7.9, SIT_LOOK], [8.3, SIT_BACK]]);
      over = <Body t={t} pose={pose} kind="gray" outfit={DAY_GRAY} eyes={t < 7.0 ? "wide" : t < 7.9 ? "droopy" : "closed"} mouth={t < 7.9 ? "flat" : "smile"} />;
      headPos = headOf(pose);
    } else if (b === 3) {
      const pose = track(t, [[9, STAND], [9.35, STAND], [9.55, STAND_SHOCK]]);
      const jump = t > 9.35 && t < 9.75 ? -Math.sin(((t - 9.35) / 0.4) * Math.PI) * 14 : 0;
      const pz = { ...pose, y: pose.y + jump };
      over = (
        <>
          <Body t={t} pose={pz} kind="gray" outfit={DAY_GRAY} dir={-1} eyes="wide" red mouth="o" messy />
          {t > 9.4 && <text x={pz.x - 4} y={198} fontFamily={MONO} fontWeight={800} fontSize={44} fill={RED} textAnchor="middle">!</text>}
          {t > 9.6 && <path d={`M${pz.x + 26} ${242 + (t - 9.6) * 30} q-6 10 0 14 q6 -4 0 -14`} fill="#8fd0ff" opacity={1 - ramp(t, 11, 11.8)} />}
        </>
      );
      headPos = headOf(pz);
    } else if (b === 4) {
      over = <Body t={t} pose={typing(1.6, 22)} kind="gray" outfit={DAY_GRAY} eyes="droopy" red messy mouth="frown" stink={0.4} />;
      headPos = headOf(SIT);
    } else if (b === 5) {
      const pose = t < 16.9 ? typing(1.8, 26) : t < 18 ? SIT_LOOK : track(t, [[18, SIT_LOOK], [18.4, SIT_BACK]]);
      over = <Body t={t} pose={pose} kind="gray" outfit={DAY_GRAY} eyes={t < 18 ? "wide" : "droopy"} red messy mouth={t < 18 ? "o" : "frown"} stink={0.6} />;
      headPos = headOf(pose);
    } else {
      over = <Body t={t} pose={track(t, [[19, SIT_BACK], [19.4, SIT_SLUMP]])} kind="gray" outfit={DAY_GRAY} eyes="closed" red messy mouth="o" stink={0.8} />;
      headPos = headOf(track(t, [[19, SIT_BACK], [19.4, SIT_SLUMP]]));
    }
  }
  // nuvem do "sem disciplina"
  let cloud: React.ReactNode = null;
  if (!top && headPos && b >= 2) {
    const s = b === 2 ? 0.55 * er(t, 7.8, 8.4) : b === 3 ? 0.62 + 0.25 * er(t, 9.4, 9.9) : b === 4 ? 1.0 : 1.1;
    const rain = b >= 4 ? 1 : 0;
    const fl = b === 4 && [13.0, 15.1].some((s0) => t > s0 && t < s0 + 0.12);
    cloud = <Cloud x={headPos[0] + 6} y={headPos[1] - 72 - s * 20} s={s} rain={rain} t={t} flash={fl} />;
  }

  const phonePos: V = [460, 318];
  return (
    <div style={{ position: "absolute", left: 0, top: y, width: W, height: PH, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${cutPulse})`, transformOrigin: "540px 320px", filter: top ? undefined : "saturate(0.75)" }}>
        <svg width={W} height={PH} viewBox={`${camX(top, b) - 306} 130 612 340`}>
          <defs>
            <filter id="glowGold" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={7} /></filter>
            <radialGradient id={`lamp${id}`} cx="752" cy="310" r="420" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ffd28a" stopOpacity={0.55} /><stop offset="1" stopColor="#ffd28a" stopOpacity={0} />
            </radialGradient>
            <radialGradient id={`dl${id}`} cx="1025" cy="300" r="260" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ffd28a" stopOpacity={0.6} /><stop offset="1" stopColor="#ffd28a" stopOpacity={0} />
            </radialGradient>
            <radialGradient id={`ph${id}`} cx={phonePos[0]} cy={phonePos[1]} r="230" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#7cc4ff" stopOpacity={0.6} /><stop offset="1" stopColor="#7cc4ff" stopOpacity={0} />
            </radialGradient>
            <linearGradient id={`topfade${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#05060c" stopOpacity={0.88} /><stop offset="1" stopColor="#05060c" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Room id={id} t={t} dawn={dawn} lamp={lamp} deskLamp={deskLamp} clock={fmt(m)} clockColor={clockColor} days={DAYS[b]} prevDays={DAYS[Math.max(0, b - 1)]} tear={tear} note={note} lid={lid} screen={screen} pct={screenPct} mugs={mugs} papers={papers} />
          <rect x={0} y={0} width={W} height={H} fill="#0b0d1e" opacity={dark} />
          {lamp > 0.5 && <rect x={0} y={0} width={W} height={H} fill={`url(#lamp${id})`} style={{ mixBlendMode: "screen" }} />}
          {deskLamp > 0.5 && <rect x={0} y={0} width={W} height={H} fill={`url(#dl${id})`} style={{ mixBlendMode: "screen" }} />}
          {phoneGlow > 0 && <rect x={0} y={0} width={W} height={H} fill={`url(#ph${id})`} opacity={0.85 + 0.15 * Math.sin(frame / 3)} style={{ mixBlendMode: "screen" }} />}
          {under}
          {blanket}
          {over}
          {cloud}
          {!top && b === 4 && <FlyPaper t={t} n={5} cx={900} cy={330} />}
          <rect x={0} y={130} width={W} height={110} fill={`url(#topfade${id})`} />
        </svg>
      </div>
      <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash, pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 80px rgba(0,0,0,.6)", pointerEvents: "none" }} />
      <Label title={top ? TXT.titleTop : TXT.titleBot} sub={(top ? TOP_LABELS : BOT_LABELS)[b]} subAt={b === 0 ? -1 : bs} />
      <Hud top={top} />
      {b === 6 && <ResultCard top={top} />}
    </div>
  );
};

// ------------------------------------------------------------------ cena final em tela cheia
const Final: React.FC = () => {
  const { t, fps } = useT();
  const k = t - STREET;
  const fadeIn = ramp(k, 0, 0.3);
  const p1 = spring({ frame: Math.round((k - 0.5) * fps), fps, config: { damping: 14, stiffness: 160 } });
  const p2 = spring({ frame: Math.round((k - 1.3) * fps), fps, config: { damping: 14, stiffness: 160 } });
  const slump = P(498, 384, 124, [100, 78], [108, 70], [95, 5], [85, 0]);
  const hd = headOf(slump);
  const breathe = Math.sin(t * 2) * 1.5;
  const goldPose = { ...P(752, 342 + breathe * 0.3, 180, [12, 4], [42, 150], [-5, 0], [5, 0]) };
  const sip = k > 1.8 && k < 2.6 ? er(t, STREET + 1.8, STREET + 2.1) * (1 - er(t, STREET + 2.3, STREET + 2.6)) : 0;
  goldPose.aN = [lerp(42, 60, sip), lerp(150, 175, sip)];
  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      <svg width={1080} height={1920} viewBox="300 -304 600 1067">
        <defs>
          <filter id="glowGold" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={7} /></filter>
          <linearGradient id="skyF" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ffb36b" /><stop offset="1" stopColor="#8a9ae0" /></linearGradient>
          <radialGradient id="sunF" cx="420" cy="120" r="420" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ffd28a" stopOpacity={0.35} /><stop offset="1" stopColor="#ffd28a" stopOpacity={0} /></radialGradient>
          <linearGradient id="topF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#05060c" stopOpacity={0.92} /><stop offset="1" stopColor="#05060c" stopOpacity={0} /></linearGradient>
        </defs>
        <rect x={0} y={-500} width={1200} height={940} fill="#4a4e6e" />
        <rect x={0} y={FLOOR - 10} width={1200} height={10} fill="#3b3f5c" />
        <rect x={0} y={FLOOR} width={1200} height={400} fill="#33364f" />
        {/* janela com o dia claro */}
        <rect x={600} y={20} width={200} height={190} fill="url(#skyF)" />
        <rect x={594} y={14} width={212} height={202} fill="none" stroke="#2b2e45" strokeWidth={12} />
        <line x1={700} y1={20} x2={700} y2={210} stroke="#2b2e45" strokeWidth={8} />
        <line x1={600} y1={115} x2={800} y2={115} stroke="#2b2e45" strokeWidth={8} />
        {/* mesa do cinza com pilha de papel e canecas */}
        <rect x={452} y={298} width={12} height={96} rx={4} fill="#3a3d57" />
        <rect x={452} y={390} width={78} height={9} rx={3} fill="#3a3d57" />
        <rect x={486} y={399} width={7} height={30} fill="#2b2e45" />
        <rect x={340} y={340} width={360} height={12} fill="#8a6449" />
        <rect x={350} y={352} width={10} height={88} fill="#6b4a36" />
        <rect x={680} y={352} width={10} height={88} fill="#6b4a36" />
        {Array.from({ length: 16 }).map((_, i) => (
          <rect key={i} x={604 + ((i * 7) % 9) - 4} y={330 - i * 8} width={56} height={8} fill={i % 2 ? "#ece7da" : "#f6f2e8"} stroke="#b9b39f" strokeWidth={1} />
        ))}
        {[0, 1, 2].map((i) => <g key={i} transform={`translate(${372 + i * 22},330) scale(0.8)`}><Mug /></g>)}
        <rect width={1200} height={900} y={-500} fill="url(#sunF)" style={{ mixBlendMode: "screen" }} />
        <Body t={t} pose={slump} kind="gray" outfit={DAY_GRAY} eyes="closed" red messy mouth="o" stink={0.9} />
        <Cloud x={hd[0] - 10} y={hd[1] - 110} s={1.25} rain={1} t={t} />
        <Body t={t} pose={goldPose} kind="gold" outfit={STUDY_GOLD} eyes={sip > 0.5 ? "closed" : "open"} mouth="smile" glow={0.95} holdN={<Mug steam={1} t={t} />} />
        <rect x={0} y={-304} width={1200} height={330} fill="url(#topF)" />
      </svg>
      <div style={{ position: "absolute", top: 360, left: 120, right: 120, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 80, lineHeight: 1.05, letterSpacing: 2, textShadow: "0 4px 0 rgba(0,0,0,.6), 0 6px 18px rgba(0,0,0,.8)" }}>
        <div style={{ color: WHITE, opacity: Math.min(1, p1 * 1.5), transform: `translateY(${(1 - p1) * 20}px)` }}>{TXT.final[0]}</div>
        <div style={{ color: GOLD, opacity: Math.min(1, p2 * 1.5), transform: `translateY(${(1 - p2) * 20}px)` }}>{TXT.final[1]}</div>
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ raiz
const TOPY = 350, GAP = 12;
const Split: React.FC<{ fade: number }> = ({ fade }) => (
  <AbsoluteFill style={{ opacity: 1 - fade }}>
    <div style={{ position: "absolute", top: 232, left: 120, right: 120, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 54, lineHeight: 1.0, letterSpacing: 2 }}>
      <div style={{ color: WHITE }}>{TXT.hook[0]}</div>
      <div style={{ color: GOLD }}>{TXT.hook[1]}</div>
    </div>
    <Half top y={TOPY} />
    <div style={{ position: "absolute", left: 120, right: 120, top: TOPY + PH + GAP / 2 - 2, height: 4, background: GOLD, opacity: 0.6 }} />
    <Half top={false} y={TOPY + PH + GAP} />
  </AbsoluteFill>
);
export const TelaDividida: React.FC = () => {
  useFonts();
  const { t } = useT();
  const toFinal = ramp(t, STREET - 0.3, STREET);
  const loopFlash = interpolate(t, [LOOP, LOOP + 0.05, LOOP + 0.3], [0, 0.6, 0], clamp);
  return (
    <AbsoluteFill style={{ background: "#08090f" }}>
      <Audio src={staticFile(AUDIO)} />
      {t < STREET && <Split fade={toFinal} />}
      {t >= STREET - 0.01 && t < LOOP && <Final />}
      {t >= LOOP && (
        <Shift.Provider value={LOOP}>
          <Split fade={0} />
        </Shift.Provider>
      )}
      <AbsoluteFill style={{ background: "#fff", opacity: loopFlash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
