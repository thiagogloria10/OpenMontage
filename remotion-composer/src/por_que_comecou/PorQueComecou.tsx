import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// ==================================================================
// MODELO "TELA DIVIDIDA" (Foco no essencial) — feito a partir de "A noite decide a manhã" v11.
// Troque primeiro os TEXTOS abaixo; depois os blocos (B, rótulos, relógios) e as ações em Half.
// Guia completo: .claude/skills/om-tela-dividida/SKILL.md
// ==================================================================
const FONT_DIR = "por_que_comecou";
const GOLD = "#E8B84A";
const RED = "#e0554a";
const WHITE = "#f4f1ea";
const BARLOW = "'Barlow Condensed', 'DejaVu Sans Condensed', sans-serif";
const MONO = "'JetBrains Mono', 'DejaVu Sans Mono', monospace";
const Shift = React.createContext(0);
const B = [0];
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
const NO_CLOTHES = true; // v2: personagem sem roupa (pedido do Thiago)
const THIN = 0.62; // v2: corpo mais fino (espessura do tronco e dos membros)

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
    if (!outfit || NO_CLOTHES) return null;
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
          <polyline points={pts(armF)} stroke={farColor} strokeWidth={13 * THIN + extra} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={pts(legF)} stroke={farColor} strokeWidth={15 * THIN + extra} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <line x1={hip[0]} y1={hip[1]} x2={neck[0]} y2={neck[1]} stroke={color} strokeWidth={30 * THIN + extra} strokeLinecap="round" />
          <polyline points={pts(legN)} stroke={color} strokeWidth={15 * THIN + extra} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {showNear && <polyline points={pts(armN)} stroke={color} strokeWidth={13 * THIN + extra} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
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
const PJ_GOLD: Outfit = { shirt: "#3a4a86", pants: "#3a4a86", shoes: "none" };
const PJ_GRAY: Outfit = { shirt: "#5d586e", pants: "#4d495c", shoes: "none" };
export const DAY_GOLD: Outfit = { shirt: "#1f2a48", pants: "#16161c", shoes: "#f2f2f2", shortSleeve: true, shorts: true };
export const DAY_GRAY: Outfit = { shirt: "#77728a", pants: "#3e3b4a", shoes: "#2a2a33" };

const reachClock = (base: Pose, k: number, a0: [number, number]): Pose => ({
  ...base,
  x: lerp(base.x, base.x - 32, k),
  aN: [lerp(a0[0], 248, k), lerp(a0[1], 272, k)],
  rk: lerp(1, 1.35, k),
});
const LIE_BODY: Pose = { ...P(506, 356, 270, [80, 90], [80, 90], [90, 90], [90, 90]), nb: -62 };
const BlanketLie: React.FC<{ color: string; edge: string }> = ({ color, edge }) => (
  <path d="M472 342 Q 490 330 530 332 Q 595 336 635 331 Q 682 330 700 340 L 700 404 L 466 404 Z" fill={color} stroke={edge} strokeWidth={3} />
);
const SHOWER = P(505, 342, 180, [-120, 162], [120, -162], [-4, 0], [4, 0]);
const SNIFF = P(700, 342, 174, [10, 10], [150, 235], [-4, 0], [4, 0]);
const SHRUG = P(700, 342, 180, [-30, -120], [30, 120], [-4, 0], [4, 0]);
const COOK = P(500, 342, 172, [40, 80], [24, 24], [-4, 0], [4, 0]);
const DRINK = P(380, 342, 180, [20, 60], [60, -153], [-4, 0], [4, 0]);
// ==================================================================
// "POR QUE VOCÊ COMEÇOU?" — narração + boneco branco/dourado em tela cheia
// ==================================================================
const HOOK = ["VOCÊ LEMBRA", "POR QUE COMEÇOU?"];
const DUR = [2.9, 5.6, 4.6, 3.2, 5.2, 4.4, 5.7, 7.2]; // narração PROVISÓRIA (Piper)
const ST: number[] = DUR.reduce<number[]>((a, d, i) => [...a, i === 0 ? 0 : a[i - 1] + DUR[i - 1]], []);
export const TOTAL = ST[ST.length - 1] + DUR[DUR.length - 1];
type LineT = [string, number, number, number];
const LINES: LineT[] = [["Você lembra do dia em que decidiu mudar de vida?", 0, 0.25, 2.16], ["Hoje, no meio de notificação, cansaço e mil coisas pra fazer, essa lembrança some.", 1, 0.25, 4.94], ["Eu vejo muita gente tão ocupada em sobreviver ao dia que esquece por que começou.", 2, 0.25, 3.90], ["Aí a rotina vira só uma lista de tarefas pra riscar.", 3, 0.25, 2.53], ["Faz um teste agora. Lembra da primeira vez que você cumpriu uma promessa que fez pra você mesmo.", 4, 0.25, 4.42], ["Aquilo que você sentiu ali continua valendo. Só ficou embaixo do barulho.", 5, 0.25, 3.72], ["E quando você lembra, fica mais fácil escolher o que importa amanhã, porque você sabe pra onde está indo.", 6, 0.25, 4.98], ["Comenta aqui por que você começou. Salva esse vídeo pra rever nos dias pesados, ou manda pra alguém que anda perdido na correria.", 7, 0.25, 6.34]];
const WORDT: Record<number, number[]> = {};
const KEY = ["lembra", "mudar", "vida", "lembrança", "some", "esquece", "começou", "lista", "riscar", "promessa", "valendo", "barulho", "importa", "indo", "comenta", "salva"];
const VOICE_DIR = "por_que_comecou/fala";
const sceneOf = (t: number) => { let s = 0; for (let i = 0; i < ST.length; i++) if (t >= ST[i]) s = i; return s; };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const backPop = (x: number) => { if (x <= 0) return 0; if (x >= 0.3) return 1; const k = x / 0.3; return 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); };

// --- câmera: centro (cx, cy) no mundo do quarto e zoom (px por unidade)
type Cam = { cx: number; cy: number; z: number };
const VIEW_W = 1080, VIEW_H = 1260;

// --- poses próprias
const SIT_BOOK = P(560, 372, 182, [40, 125], [30, 112], [95, 5], [85, 0]);
const SIT_STILL = P(560, 372, 180, [12, 30], [-6, 22], [95, 5], [85, 0]);
const STAND_C = P(560, 342, 180, [-8, -4], [8, 4], [-4, 0], [4, 0]);
const ARMS_UP = P(560, 342, 180, [160, 175], [200, 185], [-6, 0], [6, 0]);
const walkP = (x: number, y: number, ph: number, amp = 1): Pose => {
  const s = Math.sin(ph), c = Math.cos(ph);
  return P(x, y - Math.abs(c) * 3 * amp, 172, [(-22 * s - 4) * amp, (-22 * s + 30) * amp], [(22 * s - 4) * amp, (22 * s + 30) * amp], [26 * s * amp, (26 * s - 10 - 14 * Math.max(0, s)) * amp], [-26 * s * amp, (-26 * s - 10 - 14 * Math.max(0, -s)) * amp]);
};
const runP = (x: number, y: number, ph: number): Pose => {
  const s = Math.sin(ph), c = Math.cos(ph);
  return P(x, y - Math.abs(c) * 8, 168, [-40 * s - 10, -40 * s + 80], [40 * s - 10, 40 * s + 80], [35 * s, 35 * s - 30 - 20 * Math.max(0, s)], [-35 * s, -35 * s - 30 - 20 * Math.max(0, -s)]);
};

// --- boneco que passa de cinza para dourado (k = 0 cinza, 1 dourado)
const Duo: React.FC<{ k: number; pose: Pose; t: number; outfit: [Outfit, Outfit]; eyes: [Eyes, Eyes]; mouth: [Mouth, Mouth]; glow?: number; holdN?: React.ReactNode; dir?: 1 | -1; messy?: boolean }> = ({ k, pose, t, outfit, eyes, mouth, glow = 0, holdN, dir = 1, messy }) => (
  <g>
    {k < 1 && <g opacity={1 - k}><Body t={t} pose={pose} kind="gray" outfit={outfit[0]} eyes={eyes[0]} mouth={mouth[0]} holdN={holdN} dir={dir} messy={messy} /></g>}
    {k > 0 && <g opacity={k}><Body t={t} pose={pose} kind="gold" outfit={outfit[1]} eyes={eyes[1]} mouth={mouth[1]} glow={glow * k} holdN={holdN} dir={dir} /></g>}
  </g>
);
const HOME_GOLD: Outfit = { shirt: "#1f2a48", pants: "#2a2a36", shoes: "#f2f2f2" };
const HOME_GRAY: Outfit = { shirt: "#5d586e", pants: "#3e3b4a", shoes: "#2a2a33" };

// --- caderno aberto (nas mãos)
const Notebook: React.FC = () => (
  <g transform="translate(-6,-4) rotate(-8)">
    <rect x={-26} y={-16} width={26} height={30} fill="#f6efdc" stroke="#b9ae92" strokeWidth={1.6} />
    <rect x={0} y={-16} width={26} height={30} fill="#f6efdc" stroke="#b9ae92" strokeWidth={1.6} />
    <rect x={-2} y={-17} width={4} height={32} fill={GOLD} />
    {[0, 1, 2].map((i) => <line key={i} x1={-22} y1={-8 + i * 8} x2={-5} y2={-8 + i * 8} stroke="#c9b98a" strokeWidth={1.4} />)}
    {[0, 1, 2].map((i) => <line key={i} x1={5} y1={-8 + i * 8} x2={22} y2={-8 + i * 8} stroke="#c9b98a" strokeWidth={1.4} />)}
  </g>
);

// --- bolha da lembrança (DIA 1: o boneco dourado de braços para cima no nascer do sol)
const Memory: React.FC<{ x: number; y: number; p: number; t: number; r?: number }> = ({ x, y, p, t, r = 74 }) => {
  const k = backPop(p);
  if (k <= 0) return null;
  return (
    <g transform={`translate(${x},${y}) scale(${k})`}>
      <defs>
        <clipPath id="memClip"><circle r={r} /></clipPath>
        <linearGradient id="memSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6a5fa0" /><stop offset="0.7" stopColor="#ffb36b" /><stop offset="1" stopColor="#ffd28a" /></linearGradient>
      </defs>
      <circle r={r + 14} fill={GOLD} opacity={0.25 + 0.08 * Math.sin(t * 4)} filter="url(#glowGold)" />
      <g clipPath="url(#memClip)">
        <rect x={-r} y={-r} width={r * 2} height={r * 2} fill="url(#memSky)" />
        <circle cx={0} cy={r * 0.42} r={r * 0.42} fill="#fff1c0" opacity={0.9} />
        <rect x={-r} y={r * 0.45} width={r * 2} height={r} fill="#3a3550" />
        <g transform={`translate(0,${r * 0.62}) scale(0.34) translate(-560,-442)`}><Body t={t} pose={ARMS_UP} kind="gold" outfit={HOME_GOLD} eyes="closed" mouth="smile" glow={0.8} /></g>
      </g>
      <circle r={r} fill="none" stroke={GOLD} strokeWidth={5} />
      <text x={0} y={-r * 0.5} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={r * 0.36} fill={WHITE} stroke="#2a1a08" strokeWidth={3} paintOrder="stroke">DIA 1</text>
      <circle cx={-r * 0.55} cy={r + 22} r={9} fill={GOLD} opacity={0.8} />
      <circle cx={-r * 0.8} cy={r + 44} r={5} fill={GOLD} opacity={0.6} />
    </g>
  );
};

// --- notificação
const NOTIF = ["MENSAGEM", "E-MAIL", "BOLETO", "LEMBRETE", "REUNIÃO", "GRUPO (99+)", "COBRANÇA", "PROMOÇÃO", "CHAMADA PERDIDA", "PRAZO HOJE"];
const NOTIF_C = ["#3ac06a", "#4a8ae8", "#e0554a", "#e8b04b", "#8a6ae0", "#3ac06a", "#e0554a", "#ff7aa8", "#e0554a", "#e8b04b"];
const Notif: React.FC<{ i: number; x: number; y: number; p: number; rot?: number; s?: number }> = ({ i, x, y, p, rot = 0, s = 1 }) => {
  const k = backPop(p);
  if (k <= 0) return null;
  return (
    <g transform={`translate(${x},${y}) rotate(${rot}) scale(${k * s})`}>
      <rect x={-56} y={-15} width={112} height={30} rx={8} fill="#f4f4f8" stroke="#2a2836" strokeWidth={1.6} />
      <rect x={-50} y={-9} width={18} height={18} rx={5} fill={NOTIF_C[i % NOTIF_C.length]} />
      <text x={-27} y={5} fontFamily={BARLOW} fontWeight={700} fontSize={13} fill="#2a2836">{NOTIF[i % NOTIF.length]}</text>
      <circle cx={52} cy={-13} r={7} fill={RED} stroke="#2a2836" strokeWidth={1.2} />
    </g>
  );
};

// --- cartão de tarefa (cena da correria)
const Task: React.FC<{ txt: string; x: number; y: number; p: number; c: string }> = ({ txt, x, y, p, c }) => {
  const k = backPop(p);
  if (k <= 0) return null;
  return (
    <g transform={`translate(${x},${y}) scale(${k}) rotate(${Math.sin(x) * 6})`}>
      <rect x={-52} y={-16} width={104} height={32} rx={6} fill={c} stroke="#2a2836" strokeWidth={2} />
      <text x={0} y={6} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={16} fill="#1e1c28">{txt}</text>
    </g>
  );
};

// --- lista de tarefas (papel comprido que rola)
const LIST = ["ACORDAR", "TRABALHAR", "RESPONDER", "PAGAR CONTA", "LAVAR LOUÇA", "MERCADO", "REUNIÃO", "E-MAILS", "LIMPAR", "DORMIR"];
const Checklist: React.FC<{ x: number; y: number; scroll: number; done: number; t: number; gold?: number; cross?: number; pick?: number }> = ({ x, y, scroll, done, t, gold = 0, cross = 0, pick = 0 }) => (
  <g transform={`translate(${x},${y})`}>
    <defs><clipPath id="listClip"><rect x={-70} y={-80} width={140} height={176} /></clipPath></defs>
    <rect x={-74} y={-102} width={148} height={204} rx={6} fill="#fdfbf4" stroke="#2a2836" strokeWidth={2.4} />
    <rect x={-74} y={-102} width={148} height={20} rx={6} fill={gold > 0.5 ? GOLD : "#8a8798"} />
    <text x={0} y={-87} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={13} fill="#1e1c28">TAREFAS DE HOJE</text>
    <g clipPath="url(#listClip)">
      {Array.from({ length: 24 }).map((_, i) => {
        const yy = -62 + i * 22 - scroll;
        if (yy < -90 || yy > 100) return null;
        const label = i === 3 && pick > 0 ? "O QUE IMPORTA" : LIST[i % LIST.length];
        const isPick = i === 3 && pick > 0;
        const ticked = i < done;
        return (
          <g key={i}>
            <rect x={-62} y={yy - 8} width={13} height={13} rx={2} fill="#fff" stroke="#2a2836" strokeWidth={1.6} />
            {ticked && <path d={`M${-60} ${yy - 1} l4 4 l7 -9`} stroke={gold > 0.5 ? "#3a8a5a" : "#55525f"} strokeWidth={2.4} fill="none" />}
            <text x={-42} y={yy + 4} fontFamily={BARLOW} fontWeight={700} fontSize={13} fill={isPick ? "#9a6a10" : "#2a2836"}>{label}</text>
            {cross > 0 && !isPick && <line x1={-44} y1={yy} x2={-44 + 100 * clamp01(cross * 1.4 - i * 0.05)} y2={yy} stroke={GOLD} strokeWidth={2.4} />}
            {isPick && <ellipse cx={4} cy={yy} rx={56 * backPop(pick)} ry={11 * backPop(pick)} fill="none" stroke={GOLD} strokeWidth={3} />}
          </g>
        );
      })}
    </g>
    {void t}
  </g>
);

// --- rua do amanhecer com caminho dourado (mundo do quarto: chão em 440)
const Dawn: React.FC<{ t: number; path: number; scroll?: number }> = ({ t, path, scroll = 0 }) => (
  <g>
    <defs>
      <linearGradient id="dawnSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1d2350" /><stop offset="0.55" stopColor="#6a5fa0" /><stop offset="1" stopColor="#ffb36b" /></linearGradient>
      <linearGradient id="pathG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={GOLD} stopOpacity={0.9} /><stop offset="1" stopColor={GOLD} stopOpacity={0.1} /></linearGradient>
    </defs>
    <rect x={-200} y={-200} width={1480} height={640} fill="url(#dawnSky)" />
    <circle cx={880} cy={410} r={70} fill="#ffe2a0" opacity={0.85} />
    {Array.from({ length: 16 }).map((_, i) => {
      const h = [120, 180, 140, 210, 100, 160, 190, 130, 170, 110, 200, 150, 120, 180, 140, 160][i];
      const x = ((i * 92 - scroll * 0.4) % 1472 + 1472) % 1472 - 200;
      return <rect key={i} x={x} y={440 - h} width={86} height={h} fill="#171a33" opacity={0.9} />;
    })}
    <rect x={-200} y={440} width={1480} height={400} fill="#262a48" />
    {Array.from({ length: 30 }).map((_, i) => <rect key={i} x={((i * 70 - scroll) % 2100 + 2100) % 2100 - 300} y={470} width={36} height={5} fill="#3a3f63" />)}
    {path > 0 && <path d={`M${300} 448 L${300 + 900 * path} 444 L${300 + 900 * path} 456 L300 470 Z`} fill="url(#pathG)" filter="url(#glowGold)" />}
    {path > 0 && <path d={`M${300} 450 L${300 + 900 * path} 447 L${300 + 900 * path} 452 L300 462 Z`} fill={GOLD} opacity={0.9} />}
    {void t}
  </g>
);

// ================================================================== cenas
// S0 gancho: no quarto à noite, sentado na cama com o caderno; a lembrança dourada aparece
const S0 = (t: number) => (
  <g>
    <Room id="a" dawn={0} lamp={1} drawer={0} shirtFold={-1} sneakers={false} alarm={0} t={t} clock="22:10" clockColor="#ffb84a" />
    <rect x={-200} y={-200} width={1480} height={1000} fill="#0b0d1e" opacity={0.32} />
    <Body t={t} pose={SIT_BOOK} kind="gold" outfit={HOME_GOLD} eyes={t > 1.2 ? "open" : "down"} mouth="smile" glow={0.7} holdN={<Notebook />} />
    <Memory x={560} y={150} p={t - 0.6} t={t} />
  </g>
);
const C0 = (t: number): Cam => ({ cx: 560, cy: kfT(t, [[0, 270], [2.9, 255]]), z: kfT(t, [[0, 1.9], [2.9, 2.0]]) });

// S1 notificações: o celular vibra, as notificações cobrem a lembrança, ele perde o brilho
const N_AT = [0.5, 0.85, 1.15, 1.45, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 3.2, 3.4];
const N_POS: [number, number, number][] = [[520, 120, -6], [610, 150, 5], [540, 190, 3], [600, 95, -4], [500, 160, 8], [620, 200, -7], [560, 130, 2], [480, 110, -9], [640, 120, 6], [530, 220, -3], [590, 170, 9], [560, 80, -5]];
const S1 = (t: number) => {
  const k = 1 - er(t, 2.4, 4.0);
  const buzz = t < 3.6 ? Math.sin(t * 80) * 1.5 : 0;
  return (
    <g>
      <Room id="a" dawn={0} lamp={1} drawer={0} shirtFold={-1} sneakers={false} alarm={0} t={t} clock="22:40" clockColor="#ffb84a" />
      <rect x={-200} y={-200} width={1480} height={1000} fill="#0b0d1e" opacity={0.32 + (1 - k) * 0.15} />
      <Memory x={560} y={150} p={1} t={t} />
      <rect x={480} y={70} width={160} height={160} fill="#0b0d1e" opacity={er(t, 2.6, 4.2) * 0.5} />
      <Duo k={k} t={t} pose={SIT_PHONE} outfit={[HOME_GRAY, HOME_GOLD]} eyes={["droopy", "down"]} mouth={["frown", "flat"]} glow={0.6} holdN={<g transform={`translate(${buzz},0)`}><Phone scroll={t * 2} /></g>} />
      {N_AT.map((a, i) => <Notif key={i} i={i} x={N_POS[i][0]} y={N_POS[i][1]} rot={N_POS[i][2]} p={t - a} />)}
    </g>
  );
};
const C1 = (t: number): Cam => ({ cx: 560, cy: 255, z: kfT(t, [[0, 2.0], [5.6, 2.12]]) + (t < 3.6 ? Math.sin(t * 50) * 0.01 : 0) });

// S2 correria: ele corre de um lado para o outro e as tarefas pipocam em volta
const TASKS: [string, number, number, string][] = [["TRABALHO", 420, 190, "#7cc4ff"], ["LOUÇA", 700, 210, "#f5d36a"], ["MENSAGENS", 470, 270, "#9ad08a"], ["CONTAS", 660, 140, "#ff9a8a"], ["MERCADO", 560, 110, "#c8a8f0"], ["REUNIÃO", 740, 290, "#7cc4ff"], ["FAXINA", 390, 120, "#f5d36a"], ["PRAZO", 610, 260, "#ff9a8a"]];
const S2 = (t: number) => {
  const xs = kfT(t, [[0, 420], [0.9, 700], [1.8, 430], [2.7, 700], [3.6, 450], [4.6, 650]]);
  const dirW: 1 | -1 = Math.cos((t / 0.9) * Math.PI) > 0 ? 1 : -1;
  return (
    <g>
      <Kitchen id="k" t={t} toast={0} bread={false} flame={false} mug={false} />
      <rect x={-200} y={-200} width={1480} height={1000} fill="#20203a" opacity={0.25} />
      <Body t={t} pose={runP(xs, 342, t * 13)} kind="gray" outfit={HOME_GRAY} dir={dirW} eyes="wide" red mouth="o" messy stink={0.5} />
      {TASKS.map(([txt, x, y, c], i) => <Task key={i} txt={txt} x={x} y={y} c={c} p={t - 0.25 - i * 0.45} />)}
    </g>
  );
};
const C2 = (t: number): Cam => ({ cx: 560 + Math.sin(t * 17) * 2, cy: 290, z: 2.1 });

// S3 lista: a lista não acaba e ele risca no automático
const S3 = (t: number) => {
  const done = Math.floor(t * 3.2);
  const pen = Math.sin(t * 20) * 3;
  const pose = P(430, 342, 178, [60, 100], [40 + pen, 70 + pen], [-4, 0], [4, 0]);
  return (
    <g>
      <rect x={-200} y={-200} width={1480} height={1000} fill="#2c2f45" />
      <rect x={-200} y={440} width={1480} height={400} fill="#22243a" />
      <Body t={t} pose={pose} kind="gray" outfit={HOME_GRAY} dir={1} eyes="droopy" mouth="flat" messy holdN={<line x1={0} y1={0} x2={8} y2={-14} stroke="#2a2836" strokeWidth={3} strokeLinecap="round" />} />
      <Checklist x={600} y={240} scroll={t * 30} done={done + Math.floor(t * 30 / 22)} t={t} />
    </g>
  );
};
const C3 = (t: number): Cam => ({ cx: 515, cy: 300, z: kfT(t, [[0, 2.2], [3.2, 2.32]]) });

// S4 teste: ele para, o barulho some e vem a lembrança da primeira promessa cumprida
const FB = 1.5; // começa a lembrança
const S4 = (t: number) => {
  const stop = er(t, 0.0, 0.5);
  const mem = er(t, FB, FB + 0.5);
  const runX = kfT(t, [[FB, 200], [FB + 2.4, 620]]);
  const through = runX > 560;
  return (
    <g>
      {mem < 1 && (
        <g opacity={1 - mem}>
          <rect x={-200} y={-200} width={1480} height={1000} fill="#0a0b16" />
          <defs><radialGradient id="spot" cx="560" cy="300" r="240" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ffe9b8" stopOpacity={0.35} /><stop offset="1" stopColor="#ffe9b8" stopOpacity={0} /></radialGradient></defs>
          <rect x={-200} y={-200} width={1480} height={1000} fill="url(#spot)" opacity={stop} />
          <Body t={t} pose={STAND_C} kind="gray" outfit={HOME_GRAY} eyes="closed" mouth="flat" />
        </g>
      )}
      {mem > 0 && (
        <g opacity={mem}>
          <g filter="url(#memTint)">
            <Dawn t={t} path={0} scroll={0} />
            {/* fita de chegada */}
            <rect x={560} y={300} width={6} height={144} fill="#e9e6de" />
            <rect x={760} y={300} width={6} height={144} fill="#e9e6de" />
            {!through && <line x1={566} y1={340} x2={760} y2={340} stroke={RED} strokeWidth={4} />}
            {through && [0, 1].map((i) => <path key={i} d={i ? `M760 340 q-20 ${10 + (runX - 560) * 0.1} -40 ${30}` : `M566 340 q20 ${10 + (runX - 560) * 0.1} 40 ${30}`} stroke={RED} strokeWidth={4} fill="none" />)}
            <Body t={t} pose={through ? { ...runP(runX, 342, t * 11), aF: [160, 175], aN: [200, 185] } : runP(runX, 342, t * 11)} kind="gold" outfit={DAY_GOLD} dir={1} eyes={through ? "closed" : "open"} mouth="smile" glow={0.9} />
          </g>
          <rect x={-200} y={-200} width={1480} height={1000} fill="none" stroke={GOLD} strokeWidth={0} />
          {through && (
            <g transform={`translate(560,110) scale(${backPop(t - FB - 1.9)})`}>
              <rect x={-150} y={-24} width={300} height={48} rx={10} fill="#14100c" stroke={GOLD} strokeWidth={4} />
              <text x={0} y={9} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={26} fill={GOLD} letterSpacing={1}>PROMESSA CUMPRIDA ✓</text>
            </g>
          )}
        </g>
      )}
    </g>
  );
};
const C4 = (t: number): Cam => t < FB ? { cx: 560, cy: 310, z: kfT(t, [[0, 2.2], [FB, 2.5]]) } : { cx: kfT(t, [[FB, 440], [FB + 2.6, 600]]), cy: 290, z: 2.05 };

// S5 o que você sentiu continua valendo: ele afasta o barulho e acha o brilho embaixo
const S5 = (t: number) => {
  const sweep = er(t, 0.5, 1.4);
  const k = er(t, 1.4, 2.6);
  const pose = mixPose(STAND_C, P(560, 342, 176, [70, 110], [100, 140], [-4, 0], [4, 0]), Math.sin(clamp01((t - 0.5) / 0.9) * Math.PI));
  const heart = er(t, 1.0, 1.6);
  return (
    <g>
      <Room id="a" dawn={er(t, 1.6, 3.6) * 0.6} lamp={1} drawer={0} shirtFold={-1} sneakers={false} alarm={0} t={t} clock="07:00" clockColor="#ffb84a" />
      <rect x={-200} y={-200} width={1480} height={1000} fill="#0b0d1e" opacity={0.45 - k * 0.3} />
      <Duo k={k} t={t} pose={pose} outfit={[HOME_GRAY, HOME_GOLD]} eyes={["down", "open"]} mouth={["flat", "smile"]} glow={1} />
      {/* brilho no peito que estava embaixo das notificações */}
      {heart > 0 && <circle cx={562} cy={300} r={16 + k * 30} fill={GOLD} opacity={heart * (0.7 - k * 0.3)} filter="url(#glowGold)" />}
      {heart > 0 && <circle cx={562} cy={300} r={9} fill="#fff6d8" opacity={heart} />}
      {N_POS.slice(0, 9).map((p, i) => {
        const dx = (p[0] - 560) * 0.5, dy = (p[1] - 150) * 0.5;
        const fly = sweep * (1 + i * 0.08);
        return <Notif key={i} i={i} x={560 + dx + fly * (i % 2 ? 520 : -520)} y={300 + dy - fly * 120} rot={p[2] + fly * 40} p={1} s={0.9} />;
      })}
    </g>
  );
};
const C5 = (t: number): Cam => ({ cx: 560, cy: 310, z: kfT(t, [[0, 2.25], [4.4, 2.4]]) });

// S6 escolher o que importa: risca o resto, circula uma; o caminho dourado acende e ele anda
const WALK = 3.0;
const S6 = (t: number) => {
  if (t < WALK) {
    const pose = P(430, 342, 180, [55, 95], [40, 70], [-4, 0], [4, 0]);
    return (
      <g>
        <rect x={-200} y={-200} width={1480} height={1000} fill="#2c2f45" />
        <rect x={-200} y={440} width={1480} height={400} fill="#22243a" />
        <Body t={t} pose={pose} kind="gold" outfit={HOME_GOLD} dir={1} eyes="open" mouth="smile" glow={0.8} holdN={<line x1={0} y1={0} x2={8} y2={-14} stroke="#2a2836" strokeWidth={3} strokeLinecap="round" />} />
        <Checklist x={600} y={240} scroll={0} done={0} t={t} gold={1} cross={er(t, 0.3, 1.6)} pick={t - 1.7} />
      </g>
    );
  }
  const w = t - WALK;
  return (
    <g>
      <Dawn t={t} path={er(w, 0, 0.9)} scroll={w * 60} />
      <Body t={t} pose={walkP(560, 342, w * 7)} kind="gold" outfit={DAY_GOLD} dir={1} eyes="open" mouth="smile" glow={0.9} />
    </g>
  );
};
const C6 = (t: number): Cam => t < WALK ? { cx: 515, cy: 300, z: 2.25 } : { cx: 590, cy: 320, z: kfT(t, [[WALK, 2.0], [5.7, 2.1]]) };

// S7 fecho: de pé no amanhecer, decidido; pergunta na tela
const S7 = (t: number) => (
  <g>
    <Dawn t={t} path={1} scroll={0} />
    <Body t={t} pose={STAND_C} kind="gold" outfit={DAY_GOLD} dir={1} eyes="open" mouth="smile" glow={0.9 + 0.1 * Math.sin(t * 3)} />
  </g>
);
const C7 = (t: number): Cam => ({ cx: 600, cy: kfT(t, [[0, 300], [7.2, 305]]), z: kfT(t, [[0, 1.7], [7.2, 1.8]]) });

const SCENES: [(t: number) => React.ReactNode, (t: number) => Cam][] = [[S0, C0], [S1, C1], [S2, C2], [S3, C3], [S4, C4], [S5, C5], [S6, C6], [S7, C7]];

// keyframes simples
function kfT(t: number, keys: [number, number][]) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) { const [t0, v0] = keys[i - 1]; return lerp(v0, v1, ease((t - t0) / (t1 - t0))); }
  }
  return keys[keys.length - 1][1];
}

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
  words.forEach((w, i) => { if (len + w.length > 22 && cur.length) { chunks.push(cur); cur = []; len = 0; } cur.push(i); len += w.length + 1; if (/[.!?:,]$/.test(w) && len > 12) { chunks.push(cur); cur = []; len = 0; } });
  if (cur.length) chunks.push(cur);
  const idx = Math.max(0, chunks.findIndex((c, i) => t < (chunks[i + 1] ? times[chunks[i + 1][0]] : 1e9)));
  if (t < t0 - 0.05) return null;
  return (
    <div style={{ position: "absolute", left: 120, right: 120, top: 1330, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 70, lineHeight: 1.05, letterSpacing: 1 }}>
      {chunks[idx].map((i) => {
        const p = clamp01((t - times[i]) / 0.12);
        const clean = words[i].toLowerCase().replace(/[^a-zà-ú]/g, "");
        const key = KEY.includes(clean);
        return (
          <span key={i} style={{ display: "inline-block", margin: "0 9px", color: key ? GOLD : WHITE, opacity: p, transform: `translateY(${(1 - p) * 14}px)`, WebkitTextStroke: "10px #07080f", paintOrder: "stroke fill", textShadow: "0 4px 12px rgba(0,0,0,.6)" }}>
            {words[i].toUpperCase()}
          </span>
        );
      })}
    </div>
  );
};

// ------------------------------------------------------------------ raiz
const SCENE_Y = 330;
export const PorQueComecou: React.FC = () => {
  useFonts();
  const { t, fps } = useT();
  const s = sceneOf(t);
  const lt = t - ST[s];
  const [draw, cam] = SCENES[s];
  const c = cam(lt);
  const Z = 1.25; // personagens maiores
  const vw = VIEW_W / (c.z * Z), vh = VIEW_H / (c.z * Z);
  const cy = 442 - 330 / (c.z * Z); // chão (pés) sempre acima da legenda
  const flash = s > 0 ? Math.max(0, 1 - lt / 0.14) * 0.2 : 0;
  const LAST = SCENES.length - 1;
  const q1 = s === LAST ? er(lt, 0.3, 0.7) : 0;
  const q2 = s === LAST ? er(lt, 2.4, 2.8) : 0;
  return (
    <AbsoluteFill style={{ background: "#07080f" }}>
      {LINES.map((ln, i) => (
        <Sequence key={i} from={Math.round((ST[i] + ln[2]) * fps)}><Audio src={staticFile(`${VOICE_DIR}/n${ln[1]}.wav`)} /></Sequence>
      ))}
      <Audio src={staticFile("por_que_comecou/sfx.wav")} volume={0.4} />
      <div style={{ position: "absolute", left: 0, top: SCENE_Y, width: 1080, height: VIEW_H, overflow: "hidden" }}>
        <svg width={1080} height={VIEW_H} viewBox={`${c.cx - vw / 2} ${cy - vh / 2} ${vw} ${vh}`}>
          <defs>
            <filter id="glowGold" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={7} /></filter>
            <filter id="memTint"><feColorMatrix type="matrix" values="0.9 0.25 0.05 0 0.04  0.2 0.75 0.05 0 0.02  0.1 0.15 0.45 0 0  0 0 0 1 0" /></filter>
          </defs>
          {draw(lt)}
        </svg>
        <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash }} />
        <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 140px rgba(0,0,0,.75)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 140, background: "linear-gradient(#07080f, rgba(7,8,15,0))" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 330, background: "linear-gradient(rgba(7,8,15,0), #07080f)" }} />
      </div>
      {/* gancho fixo em cima */}
      <div style={{ position: "absolute", top: 228, left: 120, right: 120, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 60, lineHeight: 1.0, letterSpacing: 2, textShadow: "0 3px 0 rgba(0,0,0,.6)" }}>
        <div style={{ color: WHITE }}>{HOOK[0]}</div>
        <div style={{ color: GOLD }}>{HOOK[1]}</div>
      </div>
      {s === LAST && (
        <div style={{ position: "absolute", left: 120, right: 120, top: 470, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, letterSpacing: 2, lineHeight: 1.0 }}>
          <div style={{ fontSize: 92, color: WHITE, opacity: q1, transform: `translateY(${(1 - q1) * 16}px)`, WebkitTextStroke: "10px #07080f", paintOrder: "stroke fill" }}>POR QUE VOCÊ</div>
          <div style={{ fontSize: 92, color: GOLD, opacity: q1, transform: `translateY(${(1 - q1) * 16}px)`, WebkitTextStroke: "10px #07080f", paintOrder: "stroke fill" }}>COMEÇOU?</div>
          <div style={{ marginTop: 22, fontSize: 54, color: WHITE, opacity: q2, transform: `translateY(${(1 - q2) * 16}px)`, WebkitTextStroke: "8px #07080f", paintOrder: "stroke fill" }}>COMENTA AQUI EMBAIXO</div>
        </div>
      )}
      <Caption t={t} />
    </AbsoluteFill>
  );
};
