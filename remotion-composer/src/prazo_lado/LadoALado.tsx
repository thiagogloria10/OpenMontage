import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// ==================================================================
// MODELO "TELA DIVIDIDA" (Foco no essencial) — feito a partir de "A noite decide a manhã" v11.
// Troque primeiro os TEXTOS abaixo; depois os blocos (B, rótulos, relógios) e as ações em Half.
// Guia completo: .claude/skills/om-tela-dividida/SKILL.md
// ==================================================================
const TXT = {
  hook: ["MESMO TRABALHO.", "30 DIAS PRA ENTREGAR."], // gancho fixo em cima (branco / dourado)
  titleTop: "COM DISCIPLINA", // direita (dourado)
  titleBot: "SEM DISCIPLINA", // esquerda (cinza)
  final: ["O PRAZO ERA O MESMO.", "O PREÇO NÃO."], // frase da cena final (branco / dourado)
};
const AUDIO = "prazo_lado/audio_final.wav"; // gerado pelo sfx.py
const FONT_DIR = "prazo_lado"; // pasta em public/ com as fontes Barlow

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
const STREET = 22; // início da cena final (frase)

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
// ==================================================================
// VERSÃO LADO A LADO (igual ao formato da referência): um quarto só, os dois de frente,
// SEM DISCIPLINA à esquerda (cinza) e COM DISCIPLINA à direita (dourado).
// ==================================================================
const SEAT = 1200, K = 2.4, FLOOR_Y = 1420, WALL_Y = 360;
const LX = 290, RX = 790; // centro de cada personagem
const DESK = { L: [120, 500], R: [580, 960] } as const;

// ------------------------------------------------------------------ objetos
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

const Mug: React.FC<{ steam?: number; t?: number }> = ({ steam = 0, t = 0 }) => (
  <g>
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

const Cloud: React.FC<{ x: number; y: number; s: number; rain: number; t: number; flash?: boolean }> = ({ x, y, s, rain, t, flash }) => (
  <g transform={`translate(${x},${y + Math.sin(t * 2.2) * 4}) scale(${s})`}>
    {rain > 0 &&
      Array.from({ length: 16 }).map((_, i) => {
        const q = ((t * 2.4 + i * 0.173) % 1 + 1) % 1;
        const xx = -44 + ((i * 29) % 88);
        return <line key={i} x1={xx} y1={14 + q * 110} x2={xx - 3} y2={24 + q * 110} stroke="#8fb4e8" strokeWidth={2.5} strokeLinecap="round" opacity={rain * (1 - q * 0.6)} />;
      })}
    <g fill={flash ? "#9a9ab0" : "#4b4b5c"} stroke="#2e2e3a" strokeWidth={3}>
      <circle cx={-30} cy={2} r={20} /><circle cx={30} cy={2} r={20} /><circle cx={0} cy={-10} r={28} />
      <rect x={-48} y={0} width={96} height={20} rx={10} />
    </g>
    <g fill={flash ? "#9a9ab0" : "#4b4b5c"}>
      <circle cx={-30} cy={2} r={18.5} /><circle cx={30} cy={2} r={18.5} /><circle cx={0} cy={-10} r={26.5} />
      <rect x={-46.5} y={1.5} width={93} height={17} rx={8.5} />
    </g>
    {flash && <path d="M4 18 l-10 22 h10 l-8 22" stroke="#ffe27a" strokeWidth={4} fill="none" strokeLinejoin="round" />}
  </g>
);

const FlyPaper: React.FC<{ t: number; n: number; cx: number; cy: number }> = ({ t, n, cx, cy }) => (
  <g>
    {Array.from({ length: n }).map((_, i) => {
      const q = ((t * 0.55 + i / n) % 1 + 1) % 1;
      const x = cx + Math.sin(i * 2.1 + q * 6) * (60 + i * 10) + (i % 2 ? 1 : -1) * q * 110;
      const y = cy - 60 - Math.sin(q * Math.PI) * 200;
      return <rect key={i} x={-22} y={-14} width={44} height={28} fill="#f1ede2" stroke="#b9b39f" strokeWidth={2} transform={`translate(${x},${y}) rotate(${q * 360 * (i % 2 ? 1 : -1)})`} opacity={Math.sin(q * Math.PI)} />;
    })}
  </g>
);

// ------------------------------------------------------------------ poses de frente (quadril no assento = 0,0)
const F = (aF: [number, number], aN: [number, number], y = 0): Pose => ({ x: 0, y, tr: 180, aF, aN, lF: [-30, 20], lN: [30, -20] });
const TYPE = F([-70, 10], [70, -10]);
const PHONE = F([-22, -8], [20, 185], 4);
const BACK = F([-150, 123], [150, -123], 4);
const STRETCH = F([-165, -178], [165, 178]);
const SHOCK = F([-120, -170], [120, 170], -6);
const SLUMP = F([-80, 80], [80, -80], 45);
const READ = F([-25, 160], [25, -160], 2);
const STAND = F([-8, -4], [8, 4], -40);
const STAND_MUG = F([-8, -4], [32, 168], -40);
const HEAD_UP = LIM.torso + LIM.head + 2;

const handsOf = (p: Pose): { eF: V; hF: V; eN: V; hN: V } => {
  const sh = add([p.x, p.y], p.tr, 60);
  const eF = add(sh, p.aF[0], LIM.ua), eN = add(sh, p.aN[0], LIM.ua);
  return { eF, hF: add(eF, p.aF[1], LIM.fa), eN, hN: add(eN, p.aN[1], LIM.fa) };
};

const STUDY_GOLD: Outfit = { shirt: "#1f2a48", pants: "#2a2f45", shoes: "#f2f2f2" };
const PJ_GOLD: Outfit = { shirt: "#3a4a86", pants: "#3a4a86", shoes: "none" };
const DAY_GRAY: Outfit = { shirt: "#77728a", pants: "#3e3b4a", shoes: "#2a2a33" };

// antebraços por cima da mesa (a mesa cobre o tronco de baixo, as mãos ficam sobre ela)
const DeskArms: React.FC<{ pose: Pose; kind: "gold" | "gray"; outfit: Outfit; glow: number }> = ({ pose, kind, outfit, glow }) => {
  const { eF, hF, eN, hN } = handsOf(pose);
  const fill = kind === "gold" ? WHITE : "#aeabbd";
  const line = kind === "gold" ? GOLD : "#55525f";
  const seg = (e: V, h: V, i: number) => (
    <g key={i}>
      {glow > 0 && <line x1={e[0]} y1={e[1]} x2={h[0]} y2={h[1]} stroke={GOLD} strokeWidth={29} strokeLinecap="round" filter="url(#glowGold)" opacity={glow} />}
      <line x1={e[0]} y1={e[1]} x2={h[0]} y2={h[1]} stroke={line} strokeWidth={18} strokeLinecap="round" />
      <line x1={e[0]} y1={e[1]} x2={h[0]} y2={h[1]} stroke={fill} strokeWidth={13} strokeLinecap="round" />
      <line x1={e[0]} y1={e[1]} x2={lerp(e[0], h[0], 0.82)} y2={lerp(e[1], h[1], 0.82)} stroke={outfit.shirt} strokeWidth={16} strokeLinecap="round" />
    </g>
  );
  return <g>{seg(eF, hF, 0)}{seg(eN, hN, 1)}</g>;
};

// ------------------------------------------------------------------ quarto
const Room: React.FC<{ t: number; dawnR: number; dawnL: number }> = ({ t, dawnR }) => {
  const sky = (d: number) => [lerp(0, 1, d)];
  void sky;
  const c = (a: string, b: string, k: number) => {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], k))).join(",")})`;
  };
  return (
    <g>
      <defs>
        <linearGradient id="skyR" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={c("#141a3c", "#ffb36b", dawnR)} />
          <stop offset="1" stopColor={c("#3b2d63", "#8a9ae0", dawnR)} />
        </linearGradient>
      </defs>
      <rect x={0} y={WALL_Y} width={1080} height={FLOOR_Y - WALL_Y} fill="#4a4e6e" />
      <rect x={0} y={FLOOR_Y - 14} width={1080} height={14} fill="#3b3f5c" />
      <rect x={0} y={FLOOR_Y} width={1080} height={220} fill="#33364f" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <line key={i} x1={i * 170 - 40} y1={FLOOR_Y} x2={i * 170 - 140} y2={FLOOR_Y + 220} stroke="#2c2f45" strokeWidth={4} />)}
      {/* esquerda: mural de recados */}
      <rect x={140} y={575} width={190} height={140} rx={6} fill="#8a6449" stroke="#5a3e2c" strokeWidth={6} />
      {[[158, 590, "#e8b84a"], [212, 596, "#7cc4ff"], [268, 588, "#ff8a8a"], [170, 650, "#a8e08a"], [236, 652, "#e8b84a"]].map(([x, y, col], i) => (
        <rect key={i} x={x as number} y={y as number} width={44} height={44} fill={col as string} opacity={0.85} transform={`rotate(${(i % 2 ? 6 : -5)} ${(x as number) + 22} ${(y as number) + 22})`} />
      ))}
      {/* direita: janela */}
      <rect x={760} y={565} width={190} height={170} fill="url(#skyR)" />
      {[0, 1, 2, 3, 4].map((i) => {
        const hgt = [60, 95, 75, 110, 55][i];
        return <rect key={i} x={762 + i * 38} y={735 - hgt} width={34} height={hgt} fill={dawnR > 0.5 ? "#3a3550" : "#1a1d33"} />;
      })}
      {dawnR < 0.5 && <circle cx={905} cy={600} r={14} fill="#f4e7b5" opacity={1 - dawnR * 2} />}
      <rect x={754} y={559} width={202} height={182} fill="none" stroke="#2b2e45" strokeWidth={12} />
      <line x1={855} y1={565} x2={855} y2={735} stroke="#2b2e45" strokeWidth={8} />
      <line x1={760} y1={650} x2={950} y2={650} stroke="#2b2e45" strokeWidth={8} />
      <rect x={744} y={735} width={222} height={12} fill="#2b2e45" />
      {/* estante baixa ao fundo, entre as mesas */}
      <rect x={505} y={1020} width={70} height={400} fill="#5a3e2c" />
      {[1060, 1150, 1240, 1330].map((y, i) => (
        <g key={i}>
          <rect x={505} y={y} width={70} height={8} fill="#3e2a1e" />
          {[0, 1, 2, 3].map((j) => <rect key={j} x={510 + j * 15} y={y - 50 + (j % 2) * 8} width={12} height={50 - (j % 2) * 8} fill={["#c9564a", "#4a7ac9", "#e8b84a", "#6ab06a"][(i + j) % 4]} />)}
        </g>
      ))}
      {void t}
    </g>
  );
};

const Calendar: React.FC<{ n: number; prev: number; tear: number; note: number; noteFly: number }> = ({ n, prev, tear, note, noteFly }) => (
  <g transform="translate(481,562) scale(1.6)">
    <CalPage v={n} />
    {tear > 0 && tear < 1 && (
      <g transform={`translate(${tear * 30},${tear * 160}) rotate(${tear * 70} 37 0)`} opacity={1 - tear * 0.8}>
        <CalPage v={prev} />
      </g>
    )}
    {[18, 56].map((x) => <rect key={x} x={x - 3} y={-6} width={6} height={12} rx={2} fill="#2b2e45" />)}
    {note > 0 && (
      <g transform={`translate(${lerp(170, 40, noteFly)},${lerp(260, 48, noteFly)}) rotate(${lerp(40, 8, noteFly)}) scale(${lerp(0.7, 1, noteFly)})`}>
        <rect x={0} y={0} width={60} height={44} fill="#f5d36a" stroke="#b8952e" strokeWidth={2} />
        <text x={30} y={19} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={16} fill="#2a2836">SEG 19H</text>
        <text x={30} y={36} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={13} fill="#2a2836">PARTE 1</text>
      </g>
    )}
  </g>
);

// mesa de frente: tampo (em perspectiva) + painel; o resto (notebook, luminária...) vai por cima
const DeskFront: React.FC<{ x0: number; x1: number }> = ({ x0, x1 }) => (
  <g>
    <polygon points={`${x0 + 26},${SEAT - 70} ${x1 - 26},${SEAT - 70} ${x1},${SEAT - 24} ${x0},${SEAT - 24}`} fill="#9a7252" />
    <rect x={x0} y={SEAT - 26} width={x1 - x0} height={22} fill="#7a563f" />
    <rect x={x0 + 10} y={SEAT - 4} width={x1 - x0 - 20} height={FLOOR_Y - SEAT + 34} fill="#5d4130" />
    <rect x={x0 + 30} y={SEAT + 22} width={x1 - x0 - 60} height={70} rx={4} fill="#6b4a36" stroke="#4a3224" strokeWidth={3} />
    <circle cx={(x0 + x1) / 2} cy={SEAT + 57} r={6} fill="#c9a24a" />
    <rect x={x0 + 30} y={SEAT + 108} width={x1 - x0 - 60} height={70} rx={4} fill="#6b4a36" stroke="#4a3224" strokeWidth={3} />
    <circle cx={(x0 + x1) / 2} cy={SEAT + 143} r={6} fill="#c9a24a" />
  </g>
);
const Chair: React.FC<{ cx: number }> = ({ cx }) => (
  <g>
    <rect x={cx - 78} y={SEAT - 200} width={156} height={190} rx={22} fill="#2f3249" stroke="#23253a" strokeWidth={5} />
  </g>
);
const Laptop: React.FC<{ cx: number; lid: number; screen: Screen; pct: number; t: number; glowCol?: string }> = ({ cx, lid, screen, pct, t }) => (
  <g transform={`translate(${cx},${SEAT - 46})`}>
    <polygon points="-58,0 58,0 50,-12 -50,-12" fill="#3c3f4d" />
    <g transform={`scale(1,${Math.max(0.05, lid)})`}>
      <rect x={-52} y={-90} width={104} height={80} rx={5} fill="#2a2a33" />
      <g transform="translate(-45.5,-84) scale(1.57,1.55)">
        <ScreenFace kind={screen} pct={pct} t={t} />
      </g>
    </g>
  </g>
);
const DeskLamp: React.FC<{ x: number; dir: 1 | -1; on: boolean }> = ({ x, dir, on }) => (
  <g>
    <ellipse cx={x} cy={SEAT - 50} rx={26} ry={7} fill="#2b2b33" />
    <line x1={x} y1={SEAT - 52} x2={x - dir * 10} y2={SEAT - 160} stroke="#2b2b33" strokeWidth={7} />
    <line x1={x - dir * 10} y1={SEAT - 160} x2={x + dir * 40} y2={SEAT - 176} stroke="#2b2b33" strokeWidth={7} />
    <path d={`M${x + dir * 26} ${SEAT - 196} L${x + dir * 72} ${SEAT - 172} L${x + dir * 50} ${SEAT - 146} Z`} fill={on ? "#ffe2a0" : "#4a4a52"} stroke="#2b2b33" strokeWidth={5} />
  </g>
);
const DeskClock: React.FC<{ x: number; y: number; txt: string; col: string }> = ({ x, y, txt, col }) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={0} y={0} width={104} height={42} rx={7} fill="#14141b" stroke="#2b2e45" strokeWidth={3} />
    <text x={52} y={31} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={28} fill={col} style={{ filter: `drop-shadow(0 0 4px ${col})` }}>{txt}</text>
  </g>
);

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

const SideLabel: React.FC<{ cx: number; title: string; sub: string; subAt: number; top: boolean; hide: number }> = ({ cx, title, sub, subAt, top, hide }) => {
  const { t, fps } = useT();
  const p = spring({ frame: Math.round((t - subAt) * fps), fps, config: { damping: 14, stiffness: 200 } });
  const pct = pctAt(t, top);
  const b = blockOf(t);
  const barCol = pct >= 1 ? "#5fd08a" : top ? GOLD : b >= 4 ? RED : "#8a8798";
  return (
    <div style={{ position: "absolute", left: cx - 210, width: 420, top: 372, textAlign: "center", opacity: 1 - hide }}>
      <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 52, color: top ? WHITE : "#cfcde3", letterSpacing: 3, lineHeight: 1, textShadow: "0 3px 10px rgba(0,0,0,.8)" }}>{title}</div>
      <div style={{ fontFamily: BARLOW, fontWeight: 600, fontSize: 42, color: top ? GOLD : "#e0a39c", letterSpacing: 2, marginTop: 4, height: 46, opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 10}px)`, textShadow: "0 2px 8px rgba(0,0,0,.9)" }}>{sub}</div>
      <div style={{ margin: "8px auto 0", width: 290, padding: "5px 10px 8px", background: "rgba(12,12,18,.8)", borderRadius: 8, border: "2px solid rgba(255,255,255,.16)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: BARLOW, fontWeight: 700, fontSize: 26, color: WHITE, letterSpacing: 1 }}>
          <span>TRABALHO</span>
          <span style={{ color: barCol }}>{Math.round(pct * 100)}%</span>
        </div>
        <div style={{ height: 12, marginTop: 4, borderRadius: 6, background: "#2c2e40", overflow: "hidden" }}>
          <div style={{ width: `${pct * 100}%`, height: "100%", background: barCol }} />
        </div>
      </div>
    </div>
  );
};

const ResultCard: React.FC<{ cx: number; top: boolean }> = ({ cx, top }) => {
  const { t, fps } = useT();
  const p = spring({ frame: Math.round((t - 19.25) * fps), fps, config: { damping: 13, stiffness: 170 } });
  const p2 = spring({ frame: Math.round((t - 19.75) * fps), fps, config: { damping: 13, stiffness: 170 } });
  return (
    <div style={{ position: "absolute", left: cx - 170, top: 590, width: 340, padding: "14px 16px", textAlign: "center", background: "rgba(10,10,16,.88)", border: `3px solid ${top ? GOLD : RED}`, borderRadius: 14, transform: `scale(${p})`, opacity: Math.min(1, p * 2) }}>
      <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 50, color: "#5fd08a", letterSpacing: 2, lineHeight: 1 }}>✓ ENTREGUE</div>
      <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 38, color: top ? GOLD : RED, lineHeight: 1.05, marginTop: 8, opacity: Math.min(1, p2 * 1.6), transform: `translateY(${(1 - p2) * 12}px)` }}>
        {top ? "+ DORMIU 8H" : "+ 3 NOITES SEM DORMIR"}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ a cena
const Scene: React.FC<{ final: number }> = ({ final }) => {
  const { t, frame } = useT();
  const fin = t >= STREET;
  const b = fin ? 6 : blockOf(t);
  const bs = B[b];
  const since = t - bs;
  const cut = b > 0 && !fin;
  const tear = cut ? ramp(since, 0, 0.55) : 0;
  const pulse = cut ? interpolate(since, [0, 0.25], [1.03, 1], clamp) : 1;
  const flash = cut ? interpolate(since, [0, 0.18], [0.25, 0], clamp) : 0;

  // ---------------- direita: COM DISCIPLINA (dourado)
  let rPose: Pose = TYPE, rEyes: Eyes = "down", rMouth: Mouth = "smile", rGlow = 0.6, rArms = true, rX = RX, rOutfit = STUDY_GOLD;
  let rHold: React.ReactNode = undefined, rDir: number = 0;
  let rLid = 1, rScreen: Screen = "doc", rLamp = true, rDark = 0.28, rDawn = 0, rShow = true;
  const typ = (p: Pose, amp = 1, sp = 14): Pose => ({ ...p, aF: [p.aF[0], p.aF[1] + Math.sin(t * sp) * 7 * amp], aN: [p.aN[0], p.aN[1] + Math.cos(t * sp * 1.1) * 7 * amp] });
  if (b === 0) { rPose = typ(TYPE, 0.5, 18); rScreen = "off"; rLid = 0; rHold = <rect x={-2} y={-14} width={4} height={16} rx={1} fill="#e04a3c" transform="rotate(30)" />; }
  if (b === 1 || b === 2) rPose = typ(TYPE);
  if (b === 3) {
    if (t < 10.2) rPose = typ(TYPE);
    else { rPose = track(t, [[10.2, TYPE], [10.55, STRETCH], [11.15, STRETCH], [11.45, TYPE]]); rArms = t > 11.3; const s = t > 10.5 && t < 11.2; rEyes = s ? "closed" : "open"; rMouth = s ? "o" : "smile"; rGlow = 0.85; }
    rScreen = t < 10 ? "doc" : "done";
    rLid = 1 - er(t, 11.45, 11.8);
  }
  if (b === 4) {
    rOutfit = PJ_GOLD; rLid = 0; rScreen = "off";
    if (t < 14.6) { rPose = READ; rArms = false; const y = t > 13.8 && t < 14.3; rEyes = y ? "closed" : "down"; rMouth = y ? "yawn" : "smile"; rDark = 0.42; }
    else {
      rLamp = false; rDark = 0.72; rArms = false;
      rPose = track(t, [[14.6, READ], [14.95, STAND]]);
      rX = t < 15.1 ? RX : interpolate(t, [15.1, 15.9], [RX, 1180], clamp);
      rDir = 1; rEyes = "closed"; rMouth = "smile";
      if (t > 15.1) rPose = { ...STAND, aF: [-8 + 14 * Math.sin(t * 12), -4], aN: [8 - 14 * Math.sin(t * 12), 4], y: STAND.y - Math.abs(Math.sin(t * 12)) * 3 };
    }
  }
  if (b === 5) {
    rDawn = 1; rDark = 0.05; rLamp = false;
    const click = t > 16.75 && t < 17.0;
    rPose = t < 16.7 ? typ(TYPE, 0.4, 8) : click ? { ...TYPE, aN: [TYPE.aN[0] + 6, TYPE.aN[1] + 14] } : TYPE;
    rScreen = t < 17.0 ? "doc" : "sent"; rEyes = t > 17 ? "open" : "down"; rGlow = 0.75;
  }
  if (b === 6) {
    rDawn = 1; rDark = 0.05; rLamp = false; rScreen = "sent"; rArms = false; rEyes = "open"; rGlow = 0.95;
    rPose = fin ? STAND_MUG : track(t, [[19, TYPE], [19.45, STAND_MUG]]);
    rHold = t > 19.3 || fin ? <Mug steam={1} t={t} /> : undefined;
    if (fin) {
      const k = t - STREET;
      const sip = k > 1.6 && k < 2.5 ? er(t, STREET + 1.6, STREET + 1.9) * (1 - er(t, STREET + 2.15, STREET + 2.5)) : 0;
      rPose = { ...STAND_MUG, aN: [lerp(32, 48, sip), lerp(168, 186, sip)] };
      rEyes = sip > 0.5 ? "closed" : "open";
    }
  }
  const rNote = b === 0 ? er(t, 0.3, 0.6) : b >= 1 ? 1 : 0;
  const rNoteFly = b === 0 ? er(t, 1.0, 1.6) : 1;

  // ---------------- esquerda: SEM DISCIPLINA (cinza)
  let lPose: Pose = PHONE, lEyes: Eyes = "down", lMouth: Mouth = "flat", lArms = false, lMessy = false, lRed = false, lStink = 0;
  let lHold: React.ReactNode = undefined, lDir: number = 0;
  let lLid = 0, lScreen: Screen = "off", lLamp = true, lDark = 0.28, lPhone = 0, lMugs = 1, lPapers = 0, lStack = 0;
  const m = minutesAt(t, false);
  const lClockCol = (m >= 1440 && m < 1800) || (b === 5 && m >= 1430) ? RED : "#ffb84a";
  if (b <= 1) {
    lPhone = 1; lDark = b === 0 ? 0.3 : 0.55; lLamp = b === 0;
    const thumb = Math.floor(t * 5) % 2;
    lPose = { ...PHONE, aN: [PHONE.aN[0], PHONE.aN[1] + thumb * 4] };
    lHold = <g transform="rotate(-8)"><Phone scroll={t * (b === 1 ? 4 : 2.2)} /></g>;
    if (b === 1) { const laugh = Math.floor(t * 3) % 2 === 0; lEyes = laugh ? "closed" : "wide"; lMouth = laugh ? "yawn" : "smile"; lRed = true; }
  }
  if (b === 2) {
    lLid = er(t, 6.15, 6.5) * (1 - er(t, 7.55, 7.9)); lScreen = "doc";
    lPose = t < 7.9 ? TYPE : track(t, [[7.9, TYPE], [8.3, BACK]]); lArms = t < 8.0;
    lEyes = t < 7.0 ? "wide" : t < 7.9 ? "droopy" : "closed"; lMouth = t < 7.9 ? "flat" : "smile";
  }
  if (b === 3) {
    lPose = track(t, [[9, TYPE], [9.35, TYPE], [9.55, SHOCK]]); lArms = t < 9.4;
    lDir = 1; lEyes = "wide"; lMouth = "o"; lRed = true; lMessy = true;
  }
  if (b === 4) {
    lLamp = true; lDark = 0.72; lLid = 1; lScreen = "doc"; lArms = true; lMessy = true; lRed = true; lStink = 0.4;
    lPose = typ(TYPE, 1.7, 24); lEyes = "droopy"; lMouth = "frown";
    lMugs = t < 13.2 ? 1 : t < 14.4 ? 2 : 3; lPapers = Math.floor(interpolate(t, [12, 16], [2, 9], clamp)); lStack = interpolate(t, [12, 16], [0.2, 0.7], clamp);
  }
  if (b === 5) {
    lLamp = true; lDark = 0.6; lLid = 1; lArms = true; lMessy = true; lRed = true; lStink = 0.6; lMugs = 3; lPapers = 9; lStack = 0.8;
    lScreen = t < 16.9 ? "doc" : t < 18.0 ? "sending" : "late";
    lPose = t < 16.9 ? typ(TYPE, 1.9, 26) : TYPE; lEyes = "wide"; lMouth = t < 18 ? "o" : "frown";
  }
  if (b === 6) {
    lLamp = false; lDark = 0.1; lLid = 0; lArms = true; lMessy = true; lRed = true; lStink = 0.8; lMugs = 3; lPapers = 9; lStack = 1;
    lPose = fin ? SLUMP : track(t, [[19, TYPE], [19.4, SLUMP]]); lEyes = "closed"; lMouth = "o";
  }
  const lHead: V = [LX + lPose.x * K, SEAT + (lPose.y - HEAD_UP) * K];
  let cloud: React.ReactNode = null;
  if (b >= 2) {
    const s = b === 2 ? 0.75 * er(t, 7.8, 8.4) : b === 3 ? 0.85 + 0.35 * er(t, 9.4, 9.9) : b === 4 ? 1.35 : 1.5;
    const fl = b === 4 && [13.0, 15.1].some((s0) => t > s0 && t < s0 + 0.12);
    cloud = <Cloud x={lHead[0]} y={lHead[1] - 120 - s * 25} s={s} rain={b >= 4 ? 1 : 0} t={t} flash={fl} />;
  }

  const ch = (cx: number, pose: Pose, kind: "gold" | "gray", props: Partial<BodyProps>) => (
    <g transform={`translate(${cx},${SEAT}) scale(${K})`}>
      <Body t={t} pose={pose} kind={kind} {...(props as BodyProps)} />
    </g>
  );

  return (
    <AbsoluteFill style={{ opacity: 1 - final }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${pulse})`, transformOrigin: "540px 1000px" }}>
        <svg width={1080} height={1920} viewBox="0 0 1080 1920">
          <defs>
            <filter id="glowGold" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={7} /></filter>
            <radialGradient id="lampL" cx={DESK.L[0] + 70} cy={SEAT - 160} r="460" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ffd28a" stopOpacity={0.42} /><stop offset="1" stopColor="#ffd28a" stopOpacity={0} /></radialGradient>
            <radialGradient id="lampR" cx={DESK.R[1] - 70} cy={SEAT - 160} r="460" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ffd28a" stopOpacity={0.42} /><stop offset="1" stopColor="#ffd28a" stopOpacity={0} /></radialGradient>
            <radialGradient id="phoneL" cx={LX} cy={SEAT - 160} r="330" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#7cc4ff" stopOpacity={0.6} /><stop offset="1" stopColor="#7cc4ff" stopOpacity={0} /></radialGradient>
            <radialGradient id="sunR" cx="855" cy="650" r="620" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ffd28a" stopOpacity={0.4} /><stop offset="1" stopColor="#ffd28a" stopOpacity={0} /></radialGradient>
            <linearGradient id="shadeL" x1="0" x2="1"><stop offset="0.85" stopColor="#0b0d1e" /><stop offset="1" stopColor="#0b0d1e" stopOpacity={0} /></linearGradient>
            <linearGradient id="shadeR" x1="0" x2="1"><stop offset="0" stopColor="#0b0d1e" stopOpacity={0} /><stop offset="0.15" stopColor="#0b0d1e" /></linearGradient>
            <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#08090f" stopOpacity={1} /><stop offset="1" stopColor="#08090f" stopOpacity={0} /></linearGradient>
          </defs>
          <rect width={1080} height={1920} fill="#08090f" />
          <Room t={t} dawnR={rDawn} dawnL={0} />
          <Calendar n={DAYS[b]} prev={DAYS[Math.max(0, b - 1)]} tear={tear} note={rNote} noteFly={rNoteFly} />
          {/* cadeiras e personagens */}
          <Chair cx={LX} />
          {rShow && rX < 1100 && <Chair cx={RX} />}
          {ch(LX, lPose, "gray", { outfit: DAY_GRAY, eyes: lEyes, mouth: lMouth, messy: lMessy, red: lRed, stink: lStink, holdN: lHold, dir: lDir as 1 })}
          {rShow && ch(rX, rPose, "gold", { outfit: rOutfit, eyes: rEyes, mouth: rMouth, glow: rGlow, holdN: rHold, dir: rDir as 1 })}
          {/* livro do dourado (lendo) */}
          {b === 4 && t < 14.6 && (
            <g transform={`translate(${RX},${SEAT - 66 * K}) scale(${K})`}>
              <rect x={-24} y={-14} width={24} height={30} fill="#f1ead8" stroke="#b9ae92" strokeWidth={1.5} />
              <rect x={0} y={-14} width={24} height={30} fill="#f1ead8" stroke="#b9ae92" strokeWidth={1.5} />
              <rect x={-3} y={-16} width={6} height={34} fill={GOLD} />
            </g>
          )}
          {/* mesas */}
          <DeskFront x0={DESK.L[0]} x1={DESK.L[1]} />
          <DeskFront x0={DESK.R[0]} x1={DESK.R[1]} />
          {/* teclados */}
          <rect x={LX - 60} y={SEAT - 44} width={120} height={14} rx={3} fill="#2c2e3c" />
          <rect x={RX - 60} y={SEAT - 44} width={120} height={14} rx={3} fill="#2c2e3c" />
          {/* mesa da esquerda: luminária, relógio, pilha, papéis, canecas, notebook */}
          <DeskLamp x={DESK.L[0] + 40} dir={1} on={lLamp} />
          {lStack > 0 && Array.from({ length: Math.round(lStack * 14) }).map((_, i) => (
            <rect key={i} x={182 + ((i * 7) % 9) - 4} y={SEAT - 58 - i * 10} width={74} height={10} fill={i % 2 ? "#ece7da" : "#f6f2e8"} stroke="#b9b39f" strokeWidth={1.5} />
          ))}
          <DeskClock x={150} y={740} txt={fmt(m)} col={lClockCol} />
          {Array.from({ length: lPapers }).map((_, i) => (
            <rect key={i} x={160 + ((i * 41) % 280)} y={SEAT - 64 + (i % 3) * 10} width={48} height={12} fill="#f1ede2" stroke="#b9b39f" strokeWidth={1.5} transform={`rotate(${((i * 23) % 30) - 15} ${184 + ((i * 41) % 280)} ${SEAT - 58})`} />
          ))}
          {Array.from({ length: lMugs }).map((_, i) => <g key={i} transform={`translate(${372 + i * 34},${SEAT - 52}) scale(1.4)`}><Mug steam={i === lMugs - 1 && b >= 4 ? 1 : 0} t={t} /></g>)}
          <Laptop cx={DESK.L[1] - 62} lid={lLid} screen={lScreen} pct={lScreen === "sending" ? ramp(t, 16.9, 18) : pctAt(t, false)} t={t} />
          {lArms && <g transform={`translate(${LX},${SEAT}) scale(${K})`}><DeskArms pose={lPose} kind="gray" outfit={DAY_GRAY} glow={0} /></g>}
          {/* mesa da direita */}
          <DeskLamp x={DESK.R[1] - 40} dir={-1} on={rLamp && b !== 0 ? true : b === 0} />
          <DeskClock x={850} y={762} txt={fmt(minutesAt(t, true))} col="#ffb84a" />
          {b >= 1 && <g transform={`translate(${DESK.R[1] - 208},${SEAT - 52}) scale(1.4)`}><Mug steam={b >= 5 ? 1 : 0} t={t} /></g>}
          <Laptop cx={DESK.R[0] + 62} lid={rLid} screen={rScreen} pct={pctAt(t, true)} t={t} />
          {b === 0 && <rect x={RX - 40} y={SEAT - 66} width={70} height={22} fill="#f6f2e8" stroke="#b9b39f" strokeWidth={1.5} transform={`rotate(-4 ${RX} ${SEAT - 55})`} />}
          {rArms && rShow && rX < 1100 && <g transform={`translate(${rX},${SEAT}) scale(${K})`}><DeskArms pose={rPose} kind="gold" outfit={rOutfit} glow={rGlow * 0.6} /></g>}
          {/* luz de cada lado */}
          <rect x={0} y={WALL_Y} width={600} height={1260} fill="url(#shadeL)" opacity={lDark} />
          <rect x={480} y={WALL_Y} width={600} height={1260} fill="url(#shadeR)" opacity={rDark} />
          {lLamp && <rect x={0} y={WALL_Y} width={560} height={1260} fill="url(#lampL)" style={{ mixBlendMode: "screen" }} />}
          {rLamp && <rect x={520} y={WALL_Y} width={560} height={1260} fill="url(#lampR)" style={{ mixBlendMode: "screen" }} />}
          {lPhone > 0 && <rect x={0} y={WALL_Y} width={600} height={1260} fill="url(#phoneL)" opacity={0.85 + 0.15 * Math.sin(frame / 3)} style={{ mixBlendMode: "screen" }} />}
          {rDawn > 0 && <rect x={480} y={WALL_Y} width={600} height={1260} fill="url(#sunR)" style={{ mixBlendMode: "screen" }} />}
          {/* efeitos por cima */}
          {cloud}
          {b === 4 && <FlyPaper t={t} n={5} cx={LX} cy={SEAT - 120} />}
          {b === 1 && [3.6, 4.4, 5.2].map((s, i) => t > s ? (
            <g key={i} transform={`translate(${LX + 40 + i * 40},${SEAT - 300 - (t - s) * 90}) scale(2)`} opacity={1 - ramp(t, s + 0.6, s + 1)}>
              <circle r={12} fill={i === 1 ? "#ff7aa8" : RED} />
              <text y={5} fontSize={13} fill="#fff" textAnchor="middle" fontFamily={MONO} fontWeight={800}>{i === 1 ? "♥" : "1"}</text>
            </g>
          ) : null)}
          {b === 1 && Math.floor(t * 3) % 2 === 0 && <text x={LX - 150} y={SEAT - 330} fontFamily={BARLOW} fontWeight={700} fontSize={46} fill="#cfcde3">KKK</text>}
          {b === 3 && t > 9.4 && <text x={lHead[0] + 70} y={lHead[1] - 40} fontFamily={MONO} fontWeight={800} fontSize={90} fill={RED}>!</text>}
          {b === 3 && t > 9.6 && <path d={`M${lHead[0] - 70} ${lHead[1] - 10 + (t - 9.6) * 50} q-14 24 0 32 q14 -8 0 -32`} fill="#8fd0ff" opacity={1 - ramp(t, 11, 11.8)} />}
          {b === 2 && [6.8, 7.7, 8.5].map((s, i) => t > s ? <text key={i} x={DESK.R[0] + 62} y={SEAT - 170 - (t - s) * 80} fontFamily={MONO} fontWeight={800} fontSize={44} fill="#5fd08a" textAnchor="middle" opacity={1 - ramp(t, s + 0.5, s + 0.9)}>✓</text> : null)}
          {b === 4 && t > 14.6 && [0, 1, 2].map((i) => {
            const q = (((t - 14.6 + i * 0.5) % 1.5) + 1.5) % 1.5 / 1.5;
            return <text key={i} x={rX + 40 + q * 60 + i * 10} y={SEAT - 330 - q * 140} fontFamily={MONO} fontWeight={800} fontSize={44 + i * 10} fill={GOLD} opacity={interpolate(q, [0, 0.2, 0.8, 1], [0, 1, 1, 0])}>z</text>;
          })}
          <rect x={0} y={WALL_Y} width={1080} height={200} fill="url(#topFade)" opacity={0.9} />
          <rect x={0} y={FLOOR_Y + 120} width={1080} height={400} fill="#08090f" />
        </svg>
      </div>
      <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

// textos: gancho, títulos de cada lado, cartões e frase final
const Texts: React.FC = () => {
  const { t, fps } = useT();
  const fin = t >= STREET;
  const b = fin ? 6 : blockOf(t);
  const hide = ramp(t, STREET - 0.3, STREET);
  const k = t - STREET;
  const p1 = spring({ frame: Math.round((k - 0.3) * fps), fps, config: { damping: 14, stiffness: 160 } });
  const p2 = spring({ frame: Math.round((k - 1.1) * fps), fps, config: { damping: 14, stiffness: 160 } });
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 232, left: 120, right: 120, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 54, lineHeight: 1.0, letterSpacing: 2, opacity: 1 - hide }}>
        <div style={{ color: WHITE }}>{TXT.hook[0]}</div>
        <div style={{ color: GOLD }}>{TXT.hook[1]}</div>
      </div>
      <SideLabel cx={LX} title={TXT.titleBot} sub={BOT_LABELS[b]} subAt={b === 0 ? -1 : B[b]} top={false} hide={hide} />
      <SideLabel cx={RX} title={TXT.titleTop} sub={TOP_LABELS[b]} subAt={b === 0 ? -1 : B[b]} top hide={hide} />
      {b === 6 && !fin && <ResultCard cx={LX} top={false} />}
      {b === 6 && !fin && <ResultCard cx={RX} top />}
      {fin && (
        <div style={{ position: "absolute", top: 290, left: 110, right: 110, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 84, lineHeight: 1.05, letterSpacing: 2, textShadow: "0 4px 0 rgba(0,0,0,.6), 0 6px 18px rgba(0,0,0,.8)" }}>
          <div style={{ color: WHITE, opacity: Math.min(1, p1 * 1.5), transform: `translateY(${(1 - p1) * 20}px)` }}>{TXT.final[0]}</div>
          <div style={{ color: GOLD, opacity: Math.min(1, p2 * 1.5), transform: `translateY(${(1 - p2) * 20}px)` }}>{TXT.final[1]}</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export const LadoALado: React.FC = () => {
  useFonts();
  const { t } = useT();
  const loopFlash = interpolate(t, [LOOP, LOOP + 0.05, LOOP + 0.3], [0, 0.6, 0], clamp);
  const body = (
    <>
      <Scene final={0} />
      <Texts />
    </>
  );
  return (
    <AbsoluteFill style={{ background: "#08090f" }}>
      <Audio src={staticFile(AUDIO)} />
      {t < LOOP ? body : <Shift.Provider value={LOOP}>{body}</Shift.Provider>}
      <AbsoluteFill style={{ background: "#fff", opacity: loopFlash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
