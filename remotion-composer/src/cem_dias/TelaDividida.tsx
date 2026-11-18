import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// ==================================================================
// MODELO "TELA DIVIDIDA" (Foco no essencial) — feito a partir de "A noite decide a manhã" v11.
// Troque primeiro os TEXTOS abaixo; depois os blocos (B, rótulos, relógios) e as ações em Half.
// Guia completo: .claude/skills/om-tela-dividida/SKILL.md
// ==================================================================
const TXT = {
  hook: ["MESMO OBJETIVO.", "DIA"], // 2ª linha: "DIA n" com o contador
  titleTop: "QUEM FAZ",
  titleBot: "QUEM SÓ PLANEJA",
  final: ["VOCÊ NÃO PRECISA", "ESTAR PRONTO.", "PRECISA COMEÇAR."],
};
const AUDIO = "cem_dias/audio_final.wav"; // gerado pelo sfx.py
const FONT_DIR = "cem_dias"; // pasta em public/ com as fontes Barlow

// ------------------------------------------------------------------ base
const GOLD = "#E8B84A";
const RED = "#e0554a";
const WHITE = "#f4f1ea";
const BARLOW = "'Barlow Condensed', 'DejaVu Sans Condensed', sans-serif";
const MONO = "'JetBrains Mono', 'DejaVu Sans Mono', monospace";

export const TOTAL = 23.25; // LOOP + 0,95 s: termina ainda no 1º bloco (dia 1), igual ao quadro 0
const LOOP = 22.3; // depois da frase final volta ao dia 1 (emenda com o começo)
const Shift = React.createContext(0);
const B = [0, 1, 3, 5, 7, 9, 11, 13, 15, 18]; // começo de cada bloco (dias 1,1,7,15,30,45,60,80,100)
const STREET = 18;

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
  fit?: number; // 0 = magro (dia 1) … 1 = corpo estético (dia 100)
  red?: boolean;
  t: number;
  holdN?: React.ReactNode; // objeto na mão da frente
  holdF?: React.ReactNode;
};
export type Outfit = { shirt: string; pants: string; shoes?: string; shortSleeve?: boolean; shorts?: boolean; tank?: boolean };
const shade = (c: string, k = 0.82) => {
  const v = [1, 3, 5].map((i) => Math.round(parseInt(c.slice(i, i + 2), 16) * k));
  return `rgb(${v.join(",")})`;
};
const LIM = { ua: 40, fa: 38, th: 50, sh: 50, torso: 74, head: 30 };

const Body: React.FC<BodyProps> = ({ pose, kind, dir = 1, eyes = "open", mouth = "flat", glow = 0, messy, stink = 0, parts = "full", red, t, holdN, holdF, outfit, fit = 0 }) => {
  const AW = 13 + fit * 7, LW = 15 + fit * 5, CW = 30 + fit * 36; // braço, perna, peito/ombros
  const hip: V = [pose.x, pose.y];
  const sh = add(hip, pose.tr, 60);
  const neck = add(hip, pose.tr, LIM.torso);
  const mid = add(hip, pose.tr, 32);
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
            {!outfit.tank && <polyline points={pts(sl(armF))} stroke={shade(outfit.shirt)} strokeWidth={AW + 3} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            <polyline points={pts(pl(legF))} stroke={shade(outfit.pants)} strokeWidth={LW + 3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {shoe(legF)}
            <line x1={hip[0]} y1={hip[1]} x2={mid[0]} y2={mid[1]} stroke={outfit.shirt} strokeWidth={32} strokeLinecap="round" />
            <line x1={mid[0]} y1={mid[1]} x2={sh2[0]} y2={sh2[1]} stroke={outfit.shirt} strokeWidth={outfit.tank ? CW - 20 : CW + 2} strokeLinecap="round" />
            <circle cx={hip[0]} cy={hip[1]} r={14} fill={outfit.pants} />
            <polyline points={pts(pl(legN))} stroke={outfit.pants} strokeWidth={LW + 3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {shoe(legN)}
          </>
        )}
        {showNear && !outfit.tank && <polyline points={pts(sl(armN))} stroke={outfit.shirt} strokeWidth={AW + 3} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      </>
    );
  };
  const layer = (extra: number, color: string, farColor: string) => (
    <>
      {showFar && (
        <>
          <polyline points={pts(armF)} stroke={farColor} strokeWidth={AW + extra} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={pts(legF)} stroke={farColor} strokeWidth={LW + extra} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <line x1={hip[0]} y1={hip[1]} x2={mid[0]} y2={mid[1]} stroke={color} strokeWidth={30 + extra} strokeLinecap="round" />
          <line x1={mid[0]} y1={mid[1]} x2={neck[0]} y2={neck[1]} stroke={color} strokeWidth={CW + extra} strokeLinecap="round" />
          <polyline points={pts(legN)} stroke={color} strokeWidth={LW + extra} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {showNear && <polyline points={pts(armN)} stroke={color} strokeWidth={AW + extra} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      {fit > 0.3 && showFar && <circle cx={(armF[0][0] + armF[1][0]) / 2} cy={(armF[0][1] + armF[1][1]) / 2} r={(AW + extra) / 2 + fit * 5} fill={farColor} />}
      {fit > 0.3 && showNear && <circle cx={(armN[0][0] + armN[1][0]) / 2} cy={(armN[0][1] + armN[1][1]) / 2} r={(AW + extra) / 2 + fit * 5} fill={color} />}
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

// ------------------------------------------------------------------ quarto (desenhado em vetor)
const W = 1080, H = 520, FLOOR = 440;
const skyColors = (dawn: number) => {
  const c = (a: string, b: string) => {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], dawn))).join(",")})`;
  };
  return [c("#141a3c", "#ffb36b"), c("#3b2d63", "#8a9ae0")];
};

const Room: React.FC<{ id: string; dawn: number; lamp: number; drawer: number; shirtFold: number; sneakers: boolean; alarm: number; t: number; clock: string; clockColor: string }> = ({ id, dawn, lamp, drawer, shirtFold, sneakers, alarm, t, clock, clockColor }) => {
  const [skyB, skyT] = skyColors(dawn);
  const shake = alarm > 0 ? Math.sin(t * 70) * 3 * alarm : 0;
  return (
    <g>
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={skyB} />
          <stop offset="1" stopColor={skyT} />
        </linearGradient>
      </defs>
      {/* parede e chão */}
      <rect x={0} y={0} width={W} height={FLOOR} fill="#4a4e6e" />
      <rect x={0} y={FLOOR - 10} width={W} height={10} fill="#3b3f5c" />
      <rect x={0} y={FLOOR} width={W} height={H - FLOOR} fill="#33364f" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <line key={i} x1={i * 170 - 40} y1={FLOOR} x2={i * 170 - 120} y2={H} stroke="#2c2f45" strokeWidth={3} />
      ))}
      {/* janela */}
      <rect x={120} y={110} width={200} height={190} fill={`url(#sky${id})`} />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const hgt = [70, 110, 85, 130, 60, 95][i];
        return (
          <g key={i}>
            <rect x={120 + i * 34} y={300 - hgt} width={30} height={hgt} fill={dawn > 0.5 ? "#3a3550" : "#1a1d33"} />
            {[0, 1, 2].map((j) => (
              <rect key={j} x={126 + i * 34 + (j % 2) * 10} y={300 - hgt + 12 + j * 20} width={5} height={7} fill="#ffcf6a" opacity={(1 - dawn) * ((i + j) % 3 === 0 ? 0.2 : 0.85)} />
            ))}
          </g>
        );
      })}
      <rect x={114} y={104} width={212} height={202} fill="none" stroke="#2b2e45" strokeWidth={12} />
      <line x1={220} y1={110} x2={220} y2={300} stroke="#2b2e45" strokeWidth={8} />
      <line x1={120} y1={205} x2={320} y2={205} stroke="#2b2e45" strokeWidth={8} />
      <rect x={104} y={300} width={232} height={12} fill="#2b2e45" />
      {/* quadro */}
      <rect x={400} y={130} width={74} height={88} fill="#2b2e45" />
      <rect x={408} y={138} width={58} height={72} fill="#6a6f99" />
      <path d="M408 210 L430 175 L446 195 L456 182 L466 210 Z" fill="#3b3f5c" />
      {/* porta */}
      <rect x={960} y={140} width={120} height={300} fill="#3b3f5c" />
      <circle cx={975} cy={300} r={6} fill="#c9a24a" />
      {/* cama: cabeceira à esquerda */}
      <rect x={340} y={280} width={20} height={160} rx={4} fill="#6b4a36" />
      <rect x={360} y={400} width={340} height={30} fill="#6b4a36" />
      <rect x={360} y={364} width={340} height={38} rx={6} fill="#cfcde3" />
      <rect x={688} y={330} width={16} height={110} rx={4} fill="#6b4a36" />
      <ellipse cx={404} cy={356} rx={46} ry={17} fill="#eceaf6" />
      <ellipse cx={398} cy={348} rx={28} ry={6} fill="#ffffff" opacity={0.5} />
      {/* criado-mudo + gaveta + abajur + despertador */}
      <rect x={720} y={362} width={84} height={78} fill="#7a563f" />
      <rect x={720 + drawer * 34} y={376} width={84} height={30} fill="#8a6449" stroke="#5a3e2c" strokeWidth={3} />
      <circle cx={762 + drawer * 34} cy={391} r={4} fill="#c9a24a" />
      <rect x={744} y={354} width={16} height={8} fill="#c9a24a" />
      <line x1={752} y1={354} x2={752} y2={318} stroke="#c9a24a" strokeWidth={4} />
      <path d="M730 320 L774 320 L766 296 L738 296 Z" fill={lamp > 0.5 ? "#ffe2a0" : "#8a8070"} />
      {/* criado-mudo da cabeceira + despertador ao alcance do braço */}
      <rect x={262} y={368} width={76} height={72} fill="#7a563f" />
      <rect x={268} y={380} width={64} height={24} fill="#8a6449" stroke="#5a3e2c" strokeWidth={3} />
      <circle cx={300} cy={392} r={3.5} fill="#c9a24a" />
      <g transform={`translate(${300 + shake},${347}) scale(1.3)`}>
        <rect x={-26} y={-17} width={52} height={32} rx={6} fill="#1d1d24" stroke="#3a3a44" strokeWidth={2} />
        <rect x={-21} y={-12} width={42} height={22} rx={3} fill="#0b0b10" />
        <text x={0} y={5} fontFamily={MONO} fontSize={15} fill={clockColor} textAnchor="middle" fontWeight={800} style={{ filter: `drop-shadow(0 0 3px ${clockColor})` }}>
          {clock}
        </text>
        <rect x={-20} y={15} width={6} height={4} fill="#3a3a44" />
        <rect x={14} y={15} width={6} height={4} fill="#3a3a44" />
        {alarm > 0 &&
          [-1, 1].map((sg) => <path key={sg} d={`M${sg * 30} -14 q${sg * 6} 10 0 20 M${sg * 37} -19 q${sg * 9} 15 0 30`} stroke={RED} strokeWidth={2.5} fill="none" opacity={0.5 + 0.5 * Math.sin(t * 30)} />)}
      </g>
      {/* cadeira */}
      <rect x={850} y={300} width={10} height={140} fill="#6b4a36" />
      <rect x={850} y={380} width={70} height={10} fill="#6b4a36" />
      <rect x={912} y={390} width={8} height={50} fill="#6b4a36" />
      <rect x={852} y={390} width={8} height={50} fill="#6b4a36" />
      {/* camiseta dobrando na cadeira */}
      {shirtFold >= 0 && (
        <g transform={`translate(885,${376 - 14 * (1 - shirtFold)})`}>
          <rect x={-30 * (1 - 0.5 * shirtFold)} y={-14 + 10 * shirtFold} width={60 * (1 - 0.5 * shirtFold)} height={28 - 18 * shirtFold + 8} rx={3} fill={GOLD} />
          {shirtFold > 0.9 && <rect x={-15} y={-14} width={30} height={10} rx={3} fill="#2c2c3a" />}
        </g>
      )}
      {sneakers && (
        <g>
          <path d="M858 440 l0 -10 q10 -6 22 0 l6 10 z" fill="#f2f2f2" />
          <path d="M884 440 l0 -10 q10 -6 22 0 l6 10 z" fill="#f2f2f2" />
        </g>
      )}
    </g>
  );
};

const Blanket: React.FC<{ bump?: number; color?: string }> = ({ bump = 0, color = "#5a6aa8" }) => (
  <path d={`M420 ${362 - bump * 0.4} Q 500 ${350 - bump} 600 ${356 - bump * 0.6} L 700 362 L 700 404 L 420 404 Z`} fill={color} stroke="#3e4a80" strokeWidth={3} />
);

// ------------------------------------------------------------------ banheiro e cozinha
const Bath: React.FC = () => (
  <g>
    <rect x={0} y={0} width={W} height={FLOOR} fill="#8e9ab8" />
    {Array.from({ length: 30 }).map((_, i) => (
      <line key={`v${i}`} x1={i * 36} y1={0} x2={i * 36} y2={FLOOR} stroke="#7f8bab" strokeWidth={2} />
    ))}
    {Array.from({ length: 13 }).map((_, i) => (
      <line key={`h${i}`} x1={0} y1={i * 36} x2={W} y2={i * 36} stroke="#7f8bab" strokeWidth={2} />
    ))}
    <rect x={0} y={FLOOR} width={W} height={H - FLOOR} fill="#5d6585" />
    <rect x={400} y={100} width={220} height={340} fill="#76829f" />
    <rect x={396} y={430} width={228} height={12} rx={3} fill="#e9edf5" />
    <rect x={501} y={100} width={8} height={62} fill="#c9ccd6" />
    <ellipse cx={505} cy={168} rx={24} ry={8} fill="#d8dbe4" />
    {/* toalha */}
    <rect x={240} y={214} width={96} height={8} rx={4} fill="#c9ccd6" />
    <rect x={250} y={220} width={74} height={110} rx={6} fill={GOLD} />
    <rect x={250} y={300} width={74} height={10} fill="#c99a3e" />
    {/* pia e espelho */}
    <rect x={716} y={186} width={110} height={112} rx={8} fill="#5d6585" />
    <rect x={724} y={194} width={94} height={96} rx={6} fill="#cfe3f0" />
    <path d="M736 204 L760 204 L736 240 Z" fill="#fff" opacity={0.5} />
    <rect x={700} y={328} width={142} height={24} rx={10} fill="#f1f3f8" />
    <rect x={762} y={350} width={20} height={90} fill="#e3e6ee" />
    <rect x={766} y={312} width={8} height={18} fill="#c9ccd6" />
    <rect x={766} y={312} width={22} height={6} fill="#c9ccd6" />
  </g>
);
const BathGlass: React.FC = () => (
  <g>
    <rect x={400} y={140} width={220} height={292} fill="#ffffff" opacity={0.13} stroke="#e3ecf7" strokeWidth={4} strokeOpacity={0.6} />
    <path d="M430 160 L470 160 L430 230 Z" fill="#fff" opacity={0.18} />
  </g>
);
const Water: React.FC<{ t: number; on: number }> = ({ t, on }) => (
  <g opacity={on}>
    {Array.from({ length: 26 }).map((_, i) => {
      const x = 478 + ((i * 37) % 56);
      const q = ((t * 2.6 + i * 0.137) % 1 + 1) % 1;
      return <line key={i} x1={x} y1={176 + q * 250} x2={x - 1} y2={190 + q * 250} stroke="#cfe9ff" strokeWidth={2.5} strokeLinecap="round" opacity={0.85} />;
    })}
    {Array.from({ length: 6 }).map((_, i) => {
      const q = ((t * 0.35 + i / 6) % 1 + 1) % 1;
      return <circle key={`s${i}`} cx={440 + ((i * 53) % 150)} cy={420 - q * 280} r={20 + q * 30} fill="#ffffff" opacity={0.16 * (1 - q)} />;
    })}
  </g>
);

const Kitchen: React.FC<{ id: string; t: number; toast: number; bread: boolean; flame: boolean; mug?: boolean }> = ({ id, t, toast, bread, flame, mug = true }) => (
  <g>
    <defs>
      <linearGradient id={`ksky${id}`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#ffb36b" />
        <stop offset="1" stopColor="#8a9ae0" />
      </linearGradient>
    </defs>
    <rect x={0} y={0} width={W} height={FLOOR} fill="#5a6080" />
    <rect x={0} y={FLOOR} width={W} height={H - FLOOR} fill="#3a3e58" />
    <rect x={300} y={118} width={150} height={124} fill={`url(#ksky${id})`} />
    <rect x={296} y={114} width={158} height={132} fill="none" stroke="#2b2e45" strokeWidth={8} />
    <line x1={375} y1={118} x2={375} y2={242} stroke="#2b2e45" strokeWidth={6} />
    <rect x={590} y={104} width={320} height={96} fill="#343852" />
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <rect x={596 + i * 104} y={110} width={98} height={84} fill="#3d4260" />
        <rect x={640 + i * 104} y={180} width={12} height={4} fill="#c9a24a" />
      </g>
    ))}
    <rect x={240} y={262} width={680} height={98} fill="#6e76a0" />
    {Array.from({ length: 17 }).map((_, i) => (
      <line key={i} x1={240 + i * 40} y1={262} x2={240 + i * 40} y2={360} stroke="#626a94" strokeWidth={2} />
    ))}
    {[0, 1].map((i) => (
      <line key={`h${i}`} x1={240} y1={295 + i * 33} x2={920} y2={295 + i * 33} stroke="#626a94" strokeWidth={2} />
    ))}
    {/* geladeira */}
    <rect x={160} y={150} width={84} height={290} rx={8} fill="#d6dae6" />
    <line x1={160} y1={250} x2={244} y2={250} stroke="#b9bdca" strokeWidth={3} />
    <rect x={230} y={180} width={6} height={50} fill="#9aa0b2" />
    {/* bancada */}
    <rect x={240} y={372} width={680} height={68} fill="#44486a" />
    {[0, 1, 2, 3].map((i) => (
      <rect key={i} x={250 + i * 168} y={380} width={158} height={54} fill="none" stroke="#373a58" strokeWidth={3} />
    ))}
    <rect x={236} y={358} width={688} height={16} rx={3} fill="#e3ded0" />
    {/* fogão: boca acesa */}
    <ellipse cx={585} cy={358} rx={36} ry={6} fill="#2b2b33" />
    {flame && <ellipse cx={585} cy={356} rx={26} ry={5} fill="#ff9a2e" opacity={0.7 + 0.3 * Math.sin(t * 30)} />}
    {/* torradeira */}
    <rect x={700} y={326} width={64} height={34} rx={8} fill="#c9ccd6" />
    <rect x={712} y={322 - toast * 22} width={16} height={22} rx={3} fill="#d9a35a" />
    <rect x={736} y={322 - toast * 22} width={16} height={22} rx={3} fill="#d9a35a" />
    <rect x={700} y={326} width={64} height={10} rx={4} fill="#b5b9c6" />
    {mug && (
      <>
    <rect x={826} y={330} width={26} height={30} rx={4} fill="#f2efe6" />
    <path d="M852 336 q10 0 10 10 q0 10 -10 10" stroke="#f2efe6" strokeWidth={4} fill="none" />
    {[0, 1].map((i) => {
      const q = ((t * 0.7 + i * 0.5) % 1 + 1) % 1;
      return <path key={i} d={`M${834 + i * 10} ${322 - q * 40} q5 -7 0 -14 q-5 -7 0 -14`} stroke="#ffffff" strokeWidth={2.5} fill="none" opacity={0.5 * (1 - q)} />;
    })}
      </>
    )}
    {bread && <ellipse cx={300} cy={350} rx={30} ry={11} fill="#d9a35a" stroke="#a87436" strokeWidth={2} />}
  </g>
);

const Pan: React.FC<{ egg: number }> = ({ egg }) => (
  <g>
    <rect x={0} y={-3} width={40} height={6} rx={3} fill="#2b2b33" />
    <ellipse cx={70} cy={0} rx={34} ry={9} fill="#2b2b33" />
    <g transform={`translate(70,${-4 - egg})`}>
      <ellipse rx={18} ry={5} fill="#fbfaf4" />
      <circle cx={2} cy={-2} r={5} fill="#ffb21f" />
    </g>
  </g>
);
const Mug: React.FC<{ tilt?: number }> = ({ tilt = 0 }) => (
  <g transform={`rotate(${tilt})`}>
    <rect x={-10} y={-14} width={20} height={24} rx={3} fill="#f2efe6" />
    <rect x={-10} y={-14} width={20} height={5} fill="#6b4a36" />
  </g>
);
const Bread: React.FC = () => <ellipse cx={0} cy={0} rx={18} ry={8} fill="#d9a35a" stroke="#a87436" strokeWidth={2} />;

// ------------------------------------------------------------------ poses
const P = (x: number, y: number, tr: number, aF: [number, number], aN: [number, number], lF: [number, number], lN: [number, number]): Pose => ({ x, y, tr, aF, aN, lF, lN });
const LIE = P(504, 346, 270, [0, 0], [0, 0], [90, 90], [90, 90]);
const SIT_PHONE = P(560, 372, 180, [30, 120], [20, 105], [95, 5], [85, 0]);
const STAND = P(640, 342, 180, [-10, -5], [10, 5], [-4, 0], [4, 0]);
const LEAN_DRAWER = P(700, 342, 140, [25, 20], [15, 10], [-6, 0], [6, 0]);
const FOLD_A = P(800, 342, 165, [70, 110], [60, 95], [-4, 0], [4, 0]);
const FOLD_B = P(800, 342, 160, [55, 80], [45, 70], [-4, 0], [4, 0]);
const READ = P(420, 372, 195, [40, 110], [30, 120], [90, 90], [92, 92]);
const STRETCH = P(560, 372, 180, [145, 160], [215, 200], [95, 5], [85, 0]);
const SIT_UP = P(560, 372, 180, [10, 20], [-10, 10], [95, 5], [85, 0]);
const SLUMP = P(560, 372, 158, [15, 40], [5, 30], [95, 5], [85, 0]);

// ------------------------------------------------------------------ cada metade
// ------------------------------------------------------------------ "100 dias — a pedra": rótulos, dias, distância
const DAYS = [1, 1, 7, 15, 30, 45, 60, 80, 100];
const TOP_LABELS = ["PRIMEIRO EMPURRÃO", "PRIMEIRO EMPURRÃO", "TREMENDO, MAS EMPURRA", "NÃO DEU. LEVANTA.", "OS CANTOS GASTANDO", "TODO DIA UM POUCO", "QUASE REDONDA", "COMEÇOU A ROLAR", "ROLANDO ATÉ A META"];
const BOT_LABELS = ["O PLANO", "O PLANO", "PESQUISANDO", "COMPROU O KIT", "PLANO V2", "ASSISTINDO TUTORIAL", "“COMEÇO SEGUNDA”", "O KIT NA CAIXA", "PLANO V7"];
const FIT = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // sem evolução do corpo (pedido do Thiago)
const ROUND = [0, 0, 0.03, 0.06, 0.25, 0.45, 0.68, 0.88, 1];
// distância da pedra (m) ao longo do tempo
const DIST: [number, number][] = [[0, 0], [3.15, 0], [4.85, 3], [5.1, 3], [5.6, 5], [5.85, 5], [6.05, 4], [7.1, 4], [8.9, 15], [9.1, 15], [10.9, 30], [11.1, 30], [12.9, 50], [13.1, 50], [14.9, 80], [15.1, 80], [16.8, 150], [30, 150]];
const distAt = (t: number) => interpolate(t, DIST.map((d) => d[0]), DIST.map((d) => d[1]), clamp);
const SPEED = (t: number) => (distAt(t + 0.05) - distAt(t - 0.05)) * 10; // m/s
const UNIT = 6; // unidades de cenário por metro
const dayAt = (t: number) => {
  const b = blockOf(Math.min(t, STREET - 0.01));
  const k = b > 0 ? ease(ramp(t, B[b], B[b] + 0.4)) : 1;
  return Math.round(lerp(DAYS[Math.max(0, b - 1)], DAYS[b], k));
};

const Label: React.FC<{ title: string; sub: string; subAt: number }> = ({ title, sub, subAt }) => {
  const { t, fps } = useT();
  const p = spring({ frame: Math.round((t - subAt) * fps), fps, config: { damping: 14, stiffness: 200 } });
  return (
    <div style={{ position: "absolute", left: 150, top: 20 }}>
      <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 60, color: WHITE, letterSpacing: 3, lineHeight: 1, textShadow: "0 3px 0 rgba(0,0,0,.85), 0 0 14px rgba(0,0,0,.8)" }}>{title}</div>
      <div style={{ fontFamily: BARLOW, fontWeight: 600, fontSize: 46, color: GOLD, letterSpacing: 2, marginTop: 4, opacity: Math.min(1, p * 1.5), transform: `translateX(${(1 - p) * -20}px)`, textShadow: "0 3px 0 rgba(0,0,0,.9), 0 0 12px rgba(0,0,0,.95), 0 0 4px rgba(0,0,0,.9)" }}>{sub}</div>
    </div>
  );
};

// placar de distância (no lugar do relógio)
const DistBox: React.FC<{ top: boolean }> = ({ top }) => {
  const { t } = useT();
  const b = blockOf(t);
  const d = top ? Math.round(distAt(t)) : 0;
  const col = top ? GOLD : b >= 4 ? RED : "#a9a6b8";
  const moving = top && SPEED(t) > 0.5;
  return (
    <div style={{ position: "absolute", right: 210, top: 26, padding: "4px 14px", background: "rgba(12,12,18,.7)", border: `3px solid ${col}`, borderRadius: 8, fontFamily: MONO, fontWeight: 800, fontSize: 44, color: col, textShadow: `0 0 12px ${col}`, transform: `scale(${moving ? 1.04 : 1})`, transformOrigin: "right center", whiteSpace: "nowrap" }}>
      {d} m
    </div>
  );
};

const TEE_GOLD: Outfit = { shirt: "#1f2a48", pants: "#16161c", shoes: "#f2f2f2", shortSleeve: true, shorts: true };
const TANK_GOLD: Outfit = { shirt: "#1f2a48", pants: "#16161c", shoes: "#f2f2f2", shorts: true, tank: true };
export const DAY_GOLD: Outfit = TEE_GOLD; void TANK_GOLD;
export const DAY_GRAY: Outfit = { shirt: "#77728a", pants: "#3e3b4a", shoes: "#2a2a33" };

// poses (chão em y=440)
const PUSH = P(500, 352, 135, [74, 64], [69, 69], [-40, -25], [25, -5]);
const FLAT = P(470, 428, 95, [-75, -100], [-70, -95], [-87, -87], [-87, -87]);
const KNEEL = P(520, 392, 165, [-10, 10], [15, 30], [80, -20], [70, -10]);
const STAND_C = P(520, 342, 180, [-8, -4], [8, 4], [-4, 0], [4, 0]);
const VICTORY = P(560, 342, 180, [150, 165], [210, 195], [-8, 0], [8, 0]); // braços erguidos
const BOARDL = P(460, 342, 184, [12, 6], [-110, -110], [-4, 0], [4, 0]);
const SIT_DESK = P(500, 372, 180, [30, 110], [20, 100], [95, 5], [85, 0]);
const RECLINE = P(498, 374, 200, [30, 110], [15, 120], [80, 10], [75, 15]);
const PROUD = P(470, 342, 180, [-35, 30], [35, -30], [-6, 0], [6, 0]);
const pushStep = (t: number, sp: number): Pose => {
  const ph = Math.sin(t * (6 + sp * 0.4));
  const k = Math.min(1, sp / 2);
  return { ...PUSH, y: PUSH.y + Math.abs(ph) * 2 * k, lF: [PUSH.lF[0] + ph * 14 * k, PUSH.lF[1] + ph * 8 * k], lN: [PUSH.lN[0] - ph * 14 * k, PUSH.lN[1] - ph * 8 * k] };
};
const runPose = (x: number, phase: number): Pose => {
  const s = Math.sin(phase), c = Math.cos(phase);
  return P(x, 345 - Math.abs(c) * 6, 160, [-40 * s - 10, -40 * s + 80], [40 * s - 10, 40 * s + 80], [35 * s, 35 * s - 30 - 20 * Math.max(0, s)], [-35 * s, -35 * s - 30 - 20 * Math.max(0, -s)]);
};

// ------------------------------------------------------------------ cenário: campo de manhã (rola com a distância)
const Field: React.FC<{ id: string; off: number; flag?: number }> = ({ id, off, flag }) => {
  const wrap = (x: number, span: number) => ((x % span) + span) % span;
  return (
    <g>
      <defs>
        <linearGradient id={`fsky${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6d9fdc" />
          <stop offset="0.7" stopColor="#bcd8f0" />
          <stop offset="1" stopColor="#f6e6c4" />
        </linearGradient>
      </defs>
      <rect x={-2000} y={-900} width={5000} height={1260} fill={`url(#fsky${id})`} />
      <circle cx={880} cy={170} r={34} fill="#fff4cf" opacity={0.95} />
      <circle cx={880} cy={170} r={60} fill="#fff4cf" opacity={0.25} />
      {[0, 1, 2].map((i) => (
        <ellipse key={`c${i}`} cx={-200 + wrap(i * 420 - off * 0.05, 1500)} cy={150 + i * 22} rx={60} ry={14} fill="#ffffff" opacity={0.8} />
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <ellipse key={`h${i}`} cx={-300 + wrap(i * 260 - off * 0.15, 2080)} cy={372} rx={190} ry={70} fill="#8db37a" />
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <ellipse key={`n${i}`} cx={-300 + wrap(i * 300 + 120 - off * 0.4, 2400)} cy={405} rx={210} ry={52} fill="#6f9e5f" />
      ))}
      <rect x={-2000} y={420} width={5000} height={200} fill="#5f8f4f" />
      <rect x={-2000} y={432} width={5000} height={18} fill="#c7b48a" />
      <rect x={-2000} y={448} width={5000} height={3} fill="#a8956c" />
      {Array.from({ length: 22 }).map((_, i) => {
        const x = -400 + wrap(i * 97 - off, 2134);
        return (
          <g key={`g${i}`}>
            <path d={`M${x} 432 l4 -12 l3 12 M${x + 6} 432 l5 -9 l2 9`} stroke="#3f6e35" strokeWidth={2.5} fill="none" />
            {i % 4 === 0 && <ellipse cx={x + 40} cy={447} rx={7} ry={4} fill="#9a9187" />}
            {i % 5 === 2 && <circle cx={x + 20} cy={426} r={3} fill="#f2d24a" />}
          </g>
        );
      })}
      {flag !== undefined && (
        <g transform={`translate(${flag},0)`}>
          <rect x={0} y={330} width={5} height={110} fill="#6b4a36" />
          <path d="M5 332 L60 344 L5 358 Z" fill={RED} />
          <text x={24} y={349} fontFamily={BARLOW} fontWeight={700} fontSize={10} fill="#fff">META</text>
        </g>
      )}
    </g>
  );
};

// pedra quadrada que vai arredondando (r de 0 a 1) e gira quando rola
const Stone: React.FC<{ x: number; r: number; rot: number; tip?: number }> = ({ x, r, rot, tip = 0 }) => {
  const s = 110, rr = 55 * r;
  const cx = x + s / 2, cy = 440 - s / 2;
  const px = tip >= 0 ? x + s : x;
  return (
    <g transform={`rotate(${tip} ${px} 440)`}>
    <g transform={`rotate(${rot} ${cx} ${cy})`}>
      <rect x={x} y={440 - s} width={s} height={s} rx={rr} fill="#8f8b86" stroke="#5d5a56" strokeWidth={4} />
      <rect x={x + 10} y={440 - s + 10} width={s - 34} height={s - 50} rx={Math.max(0, rr - 10)} fill="#a4a09a" opacity={0.6} />
      <path d={`M${x + 30} ${440 - s + 20} l14 22 l-8 18 M${x + 70} ${440 - 40} l12 -14 l10 6`} stroke="#5d5a56" strokeWidth={3} fill="none" opacity={1 - r * 0.6} />
      {r > 0.5 && <circle cx={cx - 18} cy={cy - 20} r={10 * r} fill="#ffffff" opacity={0.25} />}
    </g>
    </g>
  );
};
// efeitos de fracasso: poeira, linhas de esforço, estrelinhas de tontura
const Dust: React.FC<{ x: number; t: number; t0: number; dur?: number; n?: number }> = ({ x, t, t0, dur = 0.6, n = 4 }) => {
  const k = (t - t0) / dur;
  if (k < 0 || k > 1) return null;
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => {
        const a = (i / (n - 1) - 0.5) * 2;
        return <circle key={i} cx={x + a * 26 * k} cy={436 - 14 * k * (1 - Math.abs(a) * 0.4)} r={5 + 12 * k} fill="#d9c9a0" opacity={0.7 * (1 - k)} />;
      })}
    </g>
  );
};
const Effort: React.FC<{ hx: number; hy: number; t: number }> = ({ hx, hy, t }) => (
  <g stroke="#ffffff" strokeWidth={3} strokeLinecap="round" opacity={0.85}>
    {[-1, 0, 1].map((i) => {
      const j = Math.sin(t * 40 + i) * 2;
      return <line key={i} x1={hx - 34 + j} y1={hy - 26 + i * 16} x2={hx - 46 + j} y2={hy - 30 + i * 18} />;
    })}
  </g>
);
const Dizzy: React.FC<{ hx: number; hy: number; t: number }> = ({ hx, hy, t }) => (
  <g>
    {[0, 1, 2].map((i) => {
      const a = t * 6 + (i * Math.PI * 2) / 3;
      return <text key={i} x={hx + Math.cos(a) * 26} y={hy - 40 + Math.sin(a) * 7} fontSize={16} fill={GOLD} textAnchor="middle">★</text>;
    })}
  </g>
);
// poses do fracasso
const STRAIN = P(482, 362, 118, [80, 74], [76, 70], [-58, -48], [-30, -40]); // pés escorregando para trás
const SLIP = P(472, 388, 100, [86, 80], [82, 78], [-76, -72], [-58, -66]);
const STUMBLE = P(478, 356, 200, [160, 125], [205, 235], [-28, -12], [18, 8]); // empurrado pra trás, braços pra cima
const TIRED = P(498, 352, 150, [-2, 4], [2, 6], [10, -8], [25, -10]); // mãos nos joelhos, ofegante
const SIT_GROUND = P(452, 420, 205, [-140, -165], [-128, -150], [82, 92], [88, 96]); // caiu sentado


// mesa, cadeira, quadro de pé, caixa
const Easel: React.FC<{ title: string; lines: number; chart: boolean; erase: number; write: number; circle: number }> = ({ title, lines, chart, erase, write, circle }) => {
  const shown = Math.floor(lines * write);
  return (
    <g>
      <line x1={300} y1={440} x2={330} y2={340} stroke="#6b4a36" strokeWidth={6} />
      <line x1={420} y1={440} x2={390} y2={340} stroke="#6b4a36" strokeWidth={6} />
      <line x1={360} y1={440} x2={360} y2={350} stroke="#6b4a36" strokeWidth={5} />
      <rect x={280} y={222} width={142} height={124} rx={4} fill="#f4f6f9" stroke="#9aa0ae" strokeWidth={4} />
      <g opacity={1 - erase}>
        {write > 0.05 && (
          <text x={292} y={243} fontFamily={BARLOW} fontWeight={700} fontSize={14} fill="#1f4fa0">
            {title.slice(0, Math.max(1, Math.floor(title.length * Math.min(1, write * 2))))}
          </text>
        )}
        {Array.from({ length: shown }).map((_, i) => (
          <g key={i}>
            <rect x={292 + (i >= 6 ? 62 : 0)} y={252 + (i % 6) * 14} width={6} height={6} fill="none" stroke="#1f4fa0" strokeWidth={1.5} />
            <line x1={302 + (i >= 6 ? 62 : 0)} y1={255 + (i % 6) * 14} x2={338 + (i >= 6 ? 62 : 0) - ((i * 7) % 12)} y2={255 + (i % 6) * 14} stroke={i % 3 === 2 ? RED : "#1f4fa0"} strokeWidth={2} />
          </g>
        ))}
        {chart && <path d="M356 330 L372 320 L388 324 L408 300" stroke={RED} strokeWidth={2.5} fill="none" />}
      </g>
      {/* calendarinho preso no canto do quadro */}
      <rect x={378} y={196} width={40} height={36} fill="#f2efe6" stroke="#cfc8b4" strokeWidth={1} />
      <rect x={378} y={196} width={40} height={8} fill={RED} />
      <text x={389} y={222} fontFamily={MONO} fontWeight={800} fontSize={7} fill="#1d1d24" textAnchor="middle">SEG</text>
      {circle > 0 && <circle cx={389} cy={219} r={8} fill="none" stroke={RED} strokeWidth={2.5} strokeDasharray={51} strokeDashoffset={51 * (1 - circle)} />}
    </g>
  );
};
const Desk: React.FC<{ chips: boolean }> = ({ chips }) => (
  <g>
    <rect x={540} y={362} width={120} height={9} fill="#7a563f" />
    <rect x={548} y={371} width={7} height={69} fill="#5a3e2c" />
    <rect x={645} y={371} width={7} height={69} fill="#5a3e2c" />
    <rect x={610} y={346} width={16} height={16} rx={2} fill="#f2efe6" />
    {chips && (
      <g>
        <path d="M570 362 l22 -3 l3 -20 l-22 3 z" fill="#e0554a" stroke="#a63a32" strokeWidth={2} />
        {[0, 1].map((i) => <circle key={i} cx={598 + i * 7} cy={360} r={2} fill="#e8b84a" />)}
      </g>
    )}
  </g>
);
const Chair: React.FC = () => (
  <g>
    <rect x={470} y={372} width={56} height={8} fill="#4a4e6e" />
    <rect x={466} y={300} width={8} height={80} fill="#4a4e6e" />
    <rect x={474} y={380} width={6} height={60} fill="#3b3f5c" />
    <rect x={518} y={380} width={6} height={60} fill="#3b3f5c" />
  </g>
);
const KitBox: React.FC<{ drop: number; web: boolean }> = ({ drop, web }) => (
  <g transform={`translate(0,${(1 - drop) * -170})`}>
    <rect x={566} y={398} width={70} height={42} fill="#b98a55" stroke="#8a6238" strokeWidth={3} />
    <line x1={601} y1={398} x2={601} y2={440} stroke="#8a6238" strokeWidth={4} />
    <text x={601} y={425} fontFamily={BARLOW} fontWeight={700} fontSize={10} fill="#3a2a1a" textAnchor="middle">KIT ALAVANCA</text>
    {web && (
      <g stroke="#ece9e0" strokeWidth={1} opacity={0.8} fill="none">
        <path d="M566 398 L588 398 M566 398 L566 418 M566 398 L584 414 M574 398 q-2 8 -8 8 M582 398 q-4 14 -16 14" />
      </g>
    )}
  </g>
);

const PH = 600;

const Half: React.FC<{ top: boolean; y: number }> = ({ top, y }) => {
  const { t, frame } = useT();
  const b = blockOf(t);
  const bs = B[b];
  const since = t - bs;
  const cut = b > 1; // o dia 1 (blocos 0 e 1) é contínuo, sem corte
  const cutPulse = cut ? interpolate(since, [0, 0.25], [1.05, 1], clamp) : 1;
  const flash = cut ? interpolate(since, [0, 0.18], [0.35, 0], clamp) : 0;
  let phoneGlow = 0;
  let scene: React.ReactNode = null;
  let content: React.ReactNode = null;
  const cam = top ? 610 : 560;

  if (top) {
    const d = distAt(t);
    const off = d * UNIT;
    const sp = SPEED(t);
    const r = ROUND[b];
    const fit = FIT[b];
    const outfit = TEE_GOLD;
    const glow = 0.45 + 0.07 * b;
    let stoneX = 600;
    let tip = 0;
    let rot = r > 0.5 ? ((off / 55) * 180) / Math.PI : sp > 0.3 ? Math.sin(t * 20) * 1.2 : 0;
    let pose: Pose = STAND_C;
    let dir: 1 | -1 = 1;
    let eyes: Eyes = "open";
    let mouth: Mouth = "flat";
    if (b <= 1) {
      // encosta, força, os pés escorregam, desaba; a pedra só treme e balança
      pose = track(t, [[0, PUSH], [1.55, PUSH], [2.05, STRAIN], [2.2, SLIP], [2.42, FLAT]]);
      if (t < 2.2) {
        const tr = Math.sin(t * 75) * 3;
        pose = { ...pose, aN: [pose.aN[0] + tr, pose.aN[1] - tr], aF: [pose.aF[0] - tr, pose.aF[1] + tr] };
      }
      eyes = "closed";
      mouth = t > 2.42 ? "o" : "frown";
      tip = t < 2.2 ? Math.abs(Math.sin(t * 30)) * 1.6 : 3 * Math.exp(-(t - 2.2) * 6) * Math.cos((t - 2.2) * 26);
    } else if (b === 2) {
      pose = pushStep(t, sp);
      const tr = Math.sin(t * 70) * 2.5;
      pose = { ...pose, aN: [pose.aN[0] + tr, pose.aN[1] - tr], aF: [pose.aF[0] - tr, pose.aF[1] + tr] };
      eyes = "closed"; mouth = "frown";
    } else if (b === 3) {
      // a pedra inclina pra frente, volta com tudo e derruba ele sentado
      if (t < 5.85) {
        pose = t < 5.6 ? pushStep(t, sp) : STRAIN;
        if (t > 5.55) {
          const tr = Math.sin(t * 75) * 3;
          pose = { ...pose, aN: [pose.aN[0] + tr, pose.aN[1] - tr], aF: [pose.aF[0] - tr, pose.aF[1] + tr] };
        }
        eyes = "closed"; mouth = "frown";
        tip = 9 * er(t, 5.2, 5.6) + (t > 5.6 ? Math.sin(t * 40) * 0.8 : 0);
      } else {
        pose = track(t, [[5.85, STRAIN], [5.95, STUMBLE], [6.1, { ...STUMBLE, x: 452 }], [6.3, TIRED], [6.72, TIRED], [6.95, STAND_C]]);
        if (t > 6.3 && t < 6.72) pose = { ...pose, y: pose.y + Math.sin(t * 18) * 2 };
        eyes = t > 6.75 ? "open" : t > 6.1 ? "closed" : "wide";
        mouth = t > 6.75 ? "flat" : "o";
        const back = er(t, 5.85, 6.05);
        stoneX = 600 - 16 * back;
        tip = t < 6.05 ? lerp(9, -6, back) : -6 * Math.exp(-(t - 6.05) * 5) * Math.cos((t - 6.05) * 20);
      }
    } else if (b >= 4 && b <= 7) {
      pose = pushStep(t, sp); eyes = b >= 6 ? "open" : "closed"; mouth = b >= 6 ? "smile" : "frown";
    } else if (b === 8) {
      if (t < 16.8) {
        // a bola rola: ele corre atrás com uma mão
        const rp = runPose(560, t * 13);
        pose = { ...rp, aN: [70, 75] };
        eyes = "open"; mouth = "smile";
        stoneX = 610;
      } else {
        const k = er(t, 16.8, 17.3);
        stoneX = 610 + 110 * k;
        rot += k * 90;
        pose = track(t, [[16.8, runPose(560, 16.8 * 13)], [17.1, STAND_C], [17.4, VICTORY]]);
        eyes = t > 17.3 ? "closed" : "open"; mouth = "smile";
      }
    }
    const g = b === 8 && t > 17.2 ? 1 : glow;
    scene = <Field id="t" off={off} flag={1700 - off} />;
    content = (
      <>
        <Stone x={stoneX} r={r} rot={rot} tip={tip} />
        {b === 1 && <Dust x={430} t={t} t0={1.7} dur={0.5} />}
        {b === 1 && <Dust x={410} t={t} t0={2.0} dur={0.5} />}
        {b === 1 && <Dust x={600} t={t} t0={2.25} dur={0.6} n={5} />}
        {b === 1 && <Dust x={560} t={t} t0={2.4} dur={0.6} n={5} />}
        {b === 3 && <Dust x={590} t={t} t0={6.0} dur={0.6} n={5} />}
        {b === 3 && <Dust x={450} t={t} t0={6.05} dur={0.6} n={5} />}
        <Body t={t} pose={pose} kind="gold" outfit={outfit} fit={fit} dir={dir} eyes={eyes} mouth={mouth} glow={g} />
        {((b <= 1 && t < 2.2) || (b === 3 && t > 5.5 && t < 5.85)) && (() => { const hp = add([pose.x, pose.y], pose.tr, 106); return <Effort hx={hp[0]} hy={hp[1]} t={t} />; })()}
        {(b === 1 && t > 2.45) && (() => { const hp = add([pose.x, pose.y], pose.tr, 106); return <Dizzy hx={hp[0]} hy={hp[1]} t={t} />; })()}
        {b <= 3 &&
          [0, 1].map((i) => {
            const q = ((t * 1.6 + i * 0.5) % 1 + 1) % 1;
            const hp = add([pose.x, pose.y], pose.tr, 106);
            return <ellipse key={i} cx={hp[0] - 20 + i * 14} cy={hp[1] - 30 + q * 40} rx={3} ry={4.5} fill="#8fc6ff" opacity={1 - q} />;
          })}
        {sp > 0.3 && r < 0.5 && [0, 1, 2].map((i) => {
          const q = ((t * 3 + i / 3) % 1 + 1) % 1;
          return <circle key={`p${i}`} cx={600 + 110 - q * 30} cy={438 - q * 10} r={4 + q * 6} fill="#d9c9a0" opacity={0.6 * (1 - q)} />;
        })}
      </>
    );
  } else {
    // ------- só planeja (pedra parada, quadrada)
    const bodyOf = (pose: Pose, extra: Partial<BodyProps> = {}) => <Body t={t} pose={pose} kind="gray" outfit={DAY_GRAY} {...extra} />;
    const boardTitle = b >= 8 ? "PLANO V7" : b >= 4 ? "PLANO V2" : "PLANO 100 DIAS";
    let write = 1, erase = 0;
    const lines = b >= 8 ? 12 : b >= 4 ? 7 : 5;
    if (b <= 1) write = ramp(t, 0.05, 2.6);
    if (b === 4) { erase = t < 7.9 ? ramp(t, 7.2, 7.8) : 0; write = t < 7.9 ? 1 : ramp(t, 7.95, 8.8); }
    const circle = b === 6 ? ramp(t, 11.6, 12.2) : b > 6 ? 1 : 0;
    scene = <Field id="b" off={0} />;
    let person: React.ReactNode = null;
    if (b <= 1 || b === 4 || b === 6) {
      const erasing = b === 4 && t < 7.9;
      const wob = Math.sin(t * (erasing ? 14 : 22)) * (erasing ? 16 : 9);
      person = bodyOf({ ...BOARDL, aN: [BOARDL.aN[0] + wob * 0.4, BOARDL.aN[1] + wob] }, { dir: -1, eyes: "open", mouth: "smile" });
    } else if (b === 2 || b === 3 || b === 7) {
      phoneGlow = 1;
      const lookBox = b === 3 && t > 5.6 && t < 6.4;
      person = (
        <>
          {bodyOf(SIT_DESK, { dir: 1, eyes: lookBox ? "open" : b === 7 ? "droopy" : "down", mouth: b === 7 ? "flat" : "smile", holdN: <Phone scroll={t * 2} /> })}
          {b === 2 && t > 3.3 && (
            <g transform={`translate(612,${326 - Math.min(1, (t - 3.3) * 4) * 6})`} opacity={Math.min(1, (t - 3.3) * 4)}>
              <path d="M-52 8 L-62 22 L-40 8 Z" fill="#ffffff" stroke="#9aa0ae" strokeWidth={2} />
              <rect x={-74} y={-16} width={148} height={26} rx={13} fill="#ffffff" stroke="#9aa0ae" strokeWidth={2} />
              <circle cx={-60} cy={-3} r={5} fill="none" stroke="#5a6070" strokeWidth={2} />
              <text x={6} y={2} fontFamily={BARLOW} fontWeight={600} fontSize={12} fill="#2a2d3a" textAnchor="middle">como mover uma pedra</text>
            </g>
          )}
        </>
      );
    } else if (b === 5) {
      phoneGlow = 1;
      const chew = Math.floor(t * 6) % 2 === 0;
      person = bodyOf(RECLINE, { dir: 1, eyes: "down", mouth: chew ? "o" : "flat", holdN: <Phone scroll={t * 2} rot={-20} /> });
    } else if (b === 8) {
      person = bodyOf(PROUD, { dir: -1, eyes: "open", mouth: "smile" });
    }
    content = (
      <>
        <Stone x={652} r={0} rot={0} />
        <Easel title={t >= 7.9 || b > 4 ? boardTitle : "PLANO 100 DIAS"} lines={b === 4 && t < 7.9 ? 5 : lines} chart={b >= 6} erase={erase} write={write} circle={circle} />
        <Chair />
        <g transform="translate(-22,0)">{b >= 3 && <KitBox drop={b === 3 ? er(t, 5.3, 5.55) : 1} web={b >= 7} />}</g>
        {person}
        <g transform="translate(-22,0)"><Desk chips={b === 5} /></g>
      </>
    );
  }

  return (
    <div style={{ position: "absolute", left: 0, top: y, width: W, height: PH, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${cutPulse})`, transformOrigin: "540px 320px", filter: top ? undefined : "saturate(0.6) brightness(0.92)" }}>
        <svg width={W} height={PH} viewBox={`${cam - 306} 130 612 340`}>
          <defs>
            <filter id={`glowGold`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={7} />
            </filter>
            <radialGradient id={`ph${top ? "t" : "b"}`} cx={540} cy={340} r="160" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#7cc4ff" stopOpacity={0.35} />
              <stop offset="1" stopColor="#7cc4ff" stopOpacity={0} />
            </radialGradient>
          </defs>
          {scene}
          {phoneGlow > 0 && <rect x={0} y={0} width={W} height={H} fill={`url(#ph${top ? "t" : "b"})`} opacity={0.8 + 0.2 * Math.sin(frame / 3)} style={{ mixBlendMode: "screen" }} />}
          {content}
        </svg>
      </div>
      <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash, pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 70px rgba(0,0,0,.45)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 190, background: "linear-gradient(rgba(8,10,24,.88), rgba(8,10,24,.6) 65%, rgba(8,10,24,0))", pointerEvents: "none" }} />
      <Label title={top ? TXT.titleTop : TXT.titleBot} sub={(top ? TOP_LABELS : BOT_LABELS)[Math.min(b, 8)]} subAt={b <= 1 ? -1 : bs} />
      <DistBox top={top} />
    </div>
  );
};

// ------------------------------------------------------------------ papéis (perdido nos planos)
const Sheet: React.FC<{ x: number; y: number; rot: number; w?: number; o?: number }> = ({ x, y, rot, w = 26, o = 1 }) => (
  <g transform={`translate(${x},${y}) rotate(${rot})`} opacity={o}>
    <rect x={-w / 2} y={-w * 0.65} width={w} height={w * 1.3} fill="#fbfaf5" stroke="#c9c4b4" strokeWidth={1.2} />
    {[0, 1, 2, 3].map((i) => (
      <line key={i} x1={-w / 2 + 4} y1={-w * 0.65 + 6 + i * (w * 0.26)} x2={w / 2 - 4 - ((i * 5) % 9)} y2={-w * 0.65 + 6 + i * (w * 0.26)} stroke={i === 2 ? RED : "#7a8fb8"} strokeWidth={1.4} />
    ))}
  </g>
);
const Crumple: React.FC<{ x: number }> = ({ x }) => (
  <g>
    <circle cx={x} cy={433} r={7} fill="#f2efe6" stroke="#c9c4b4" strokeWidth={1.2} />
    <path d={`M${x - 4} ${431} l3 3 l3 -4 M${x - 1} ${428} l2 4`} stroke="#c9c4b4" strokeWidth={1} fill="none" />
  </g>
);
const LostInPlans: React.FC<{ t: number }> = ({ t }) => {
  const ground: [number, number][] = [[380, 6], [418, -14], [452, 22], [612, -8], [650, 16], [688, -20], [432, 70]];
  return (
    <g>
      {/* folhas no chão e bolinhas amassadas */}
      {ground.map(([x, r], i) => (
        <g key={i} transform={`translate(${x},436) scale(1,0.35)`}>
          <Sheet x={0} y={0} rot={r} w={28} />
        </g>
      ))}
      {[400, 470, 630, 668].map((x, i) => <Crumple key={`c${i}`} x={x} />)}
      {/* pilha na mesa */}
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={`p${i}`} x={598 - (i % 2) * 3} y={354 - i * 3} width={34} height={6} fill="#fbfaf5" stroke="#c9c4b4" strokeWidth={1} transform={`rotate(${(i % 3) - 1} 615 ${357 - i * 3})`} />
      ))}
      {/* folhas voando em volta, caindo devagar */}
      {Array.from({ length: 9 }).map((_, i) => {
        const q = ((t * 0.28 + i / 9) % 1 + 1) % 1;
        const a = i * 1.7 + t * 0.9;
        const x = 520 + Math.cos(a) * (70 + (i % 3) * 22);
        const y = 210 + q * 220 + Math.sin(a * 1.3) * 10;
        return <Sheet key={`f${i}`} x={x} y={y} rot={Math.sin(t * 2 + i) * 35 + i * 20} w={22} o={q < 0.1 ? q * 10 : q > 0.9 ? (1 - q) * 10 : 1} />;
      })}
    </g>
  );
};

// ------------------------------------------------------------------ cena final: o campo em tela cheia
const Street: React.FC = () => {
  const { t, fps } = useT();
  const k = t - STREET;
  const fadeIn = ramp(k, 0, 0.3);
  const ballX = interpolate(k, [0, 3.4], [80, 860], clamp);
  const off = k * 140;
  const p1 = spring({ frame: Math.round((k - 0.7) * fps), fps, config: { damping: 14, stiffness: 160 } });
  const p2 = spring({ frame: Math.round((k - 1.5) * fps), fps, config: { damping: 14, stiffness: 160 } });
  const bodyRot = ((ballX + 120) / 55) * (180 / Math.PI);
  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      <svg width={1080} height={1920} viewBox="250 -235 540 960">
        <defs>
          <filter id="glowGold" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={7} />
          </filter>
        </defs>
        <Field id="f" off={off * 0} />
        {/* quem só planeja: na mesa, com a pedra quadrada */}
        <g transform="translate(-75,0)">
          <Stone x={330} r={0} rot={0} />
        </g>
        <g transform="translate(100,0)">
          <Easel title="PLANO V7" lines={12} chart erase={0} write={1} circle={1} />
        </g>
        <g transform="translate(70,0)">
        <Chair />
        <Body t={t} pose={{ ...SIT_DESK, aF: [85, 175], aN: [100, 170] }} kind="gray" outfit={DAY_GRAY} dir={1} eyes="wide" mouth="frown" messy holdN={<g transform={`rotate(${Math.sin(t * 3) * 4})`}><Sheet x={4} y={14} rot={0} w={40} /></g>} />
        <Desk chips={false} />
        <LostInPlans t={t} />
        {[0, 1].map((i) => {
          const ph = (t * 1.5 + i * 0.5) % 1;
          return <text key={`q${i}`} x={478 + i * 26} y={218 - ph * 14} fontFamily={BARLOW} fontWeight={700} fontSize={26 - i * 6} fill={GOLD} opacity={0.4 + 0.6 * Math.sin(ph * Math.PI)}>?</text>;
        })}
        </g>
        {/* quem faz: corre atrás da bola */}
        <Stone x={ballX + 70} r={1} rot={bodyRot} />
        <Body t={t} pose={{ ...runPose(ballX, k * 13), aN: [70, 75] }} kind="gold" outfit={DAY_GOLD} dir={1} eyes="open" mouth="smile" glow={0.95} />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: 220, height: 560, background: "linear-gradient(rgba(8,10,24,0), rgba(8,10,24,.78) 22%, rgba(8,10,24,.78) 78%, rgba(8,10,24,0))" }} />
      <div style={{ position: "absolute", top: 360, left: 120, right: 120, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 76, lineHeight: 1.05, letterSpacing: 2, textShadow: "0 4px 0 rgba(0,0,0,.9), 0 0 18px rgba(0,0,0,.9)" }}>
        <div style={{ color: WHITE, opacity: Math.min(1, p1 * 1.5), transform: `translateY(${(1 - p1) * 20}px)` }}>{TXT.final[0]}</div>
        <div style={{ color: WHITE, opacity: Math.min(1, p1 * 1.5), transform: `translateY(${(1 - p1) * 20}px)` }}>{TXT.final[1]}</div>
        <div style={{ color: GOLD, opacity: Math.min(1, p2 * 1.5), transform: `translateY(${(1 - p2) * 20}px)` }}>{TXT.final[2]}</div>
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ raiz
const DayText: React.FC = () => {
  const { t } = useT();
  return <>{TXT.hook[1]} {dayAt(t)}</>;
};
const TOPY = 350, GAP = 12;
const Split: React.FC<{ fade: number }> = ({ fade }) => (
  <AbsoluteFill style={{ opacity: 1 - fade }}>
    <div style={{ position: "absolute", top: 232, left: 120, right: 120, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 54, lineHeight: 1.0, letterSpacing: 2 }}>
      <div style={{ color: WHITE }}>{TXT.hook[0]}</div>
      <div style={{ color: GOLD }}><DayText /></div>
    </div>
    <Half top y={TOPY} />
    <div style={{ position: "absolute", left: 120, right: 120, top: TOPY + PH + GAP / 2 - 2, height: 4, background: GOLD, opacity: 0.6 }} />
    <Half top={false} y={TOPY + PH + GAP} />
  </AbsoluteFill>
);
export const TelaDividida: React.FC = () => {
  useFonts();
  const { t } = useT();
  const toStreet = ramp(t, STREET - 0.3, STREET);
  const loopFlash = interpolate(t, [LOOP, LOOP + 0.05, LOOP + 0.3], [0, 0.6, 0], clamp);
  return (
    <AbsoluteFill style={{ background: "#08090f" }}>
      <Audio src={staticFile(AUDIO)} />
      {t < STREET && <Split fade={toStreet} />}
      {t >= STREET - 0.01 && t < LOOP && <Street />}
      {t >= LOOP && (
        <Shift.Provider value={LOOP}>
          <Split fade={0} />
        </Shift.Provider>
      )}
      <AbsoluteFill style={{ background: "#fff", opacity: loopFlash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
