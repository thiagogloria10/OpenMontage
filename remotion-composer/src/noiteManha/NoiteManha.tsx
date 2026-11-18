import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// ------------------------------------------------------------------ base
const GOLD = "#E8B84A";
const RED = "#e0554a";
const WHITE = "#f4f1ea";
const BARLOW = "'Barlow Condensed', 'DejaVu Sans Condensed', sans-serif";
const MONO = "'JetBrains Mono', 'DejaVu Sans Mono', monospace";

export const TOTAL = 26.25; // LOOP + 0,95 s: termina ainda no 1º bloco (22:00), igual ao quadro 0
const LOOP = 25.3; // depois da frase final volta para as duas metades às 22:00 (emenda com o começo)
const Shift = React.createContext(0);
const B = [0, 1, 4, 7, 10, 12, 15, 18, 21]; // começo de cada bloco
const STREET = 21;

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
      new FontFace("Barlow Condensed", `url(${staticFile("noite_manha/barlow-condensed-latin-700-normal.woff2")})`, { weight: "700" }),
      new FontFace("Barlow Condensed", `url(${staticFile("noite_manha/barlow-condensed-latin-600-normal.woff2")})`, { weight: "600" }),
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
const TOP_LABELS = ["FIM DO DIA", "CELULAR NA GAVETA", "ROUPA DO TREINO SEPARADA", "LIVRO", "LUZ APAGADA", "ACORDOU NA HORA", "BANHO", "CAFÉ DA MANHÃ"];
const BOT_LABELS = ["FIM DO DIA", "SÓ MAIS UM VÍDEO", "SÓ MAIS UM ×2", "SÓ MAIS UM ×3", "APAGOU", "SONECA", "SONECA ×2", "ATRASADO!"];
// manhã de baixo: aperta a soneca enquanto o de cima se arruma
const SNZ = [12.55, 15.75, 17.35]; // tapas na soneca
const WAKE = 18.0, OUTBED = 18.9, GRAB = 19.75;
const botLabel = (t: number, b: number): [string, number] => {
  if (b === 6 && t >= 17.0) return ["SONECA ×3", 17.0];
  if (b === 7 && t >= OUTBED) return ["SÓ PEGOU O CAFÉ", OUTBED];
  return [BOT_LABELS[Math.min(b, 7)], B[b]];
};

const minutesAt = (t: number, top: boolean) => {
  const keys = top
    ? [[0, 1320], [1, 1320], [4, 1330], [7, 1340], [10, 1360], [12, 1365], [12.01, 1800], [15, 1803], [18, 1815], [21, 1830]]
    : [[0, 1320], [1, 1320], [4, 1410], [7, 1512], [10, 1600], [12, 1605], [12.01, 1800], [14.99, 1801], [15, 1809], [16.99, 1810], [17, 1818], [17.99, 1819], [18, 1838], [21, 1846]];
  return Math.floor(interpolate(t, keys.map((k) => k[0]), keys.map((k) => k[1]), clamp));
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
      <div style={{ fontFamily: BARLOW, fontWeight: 700, fontSize: 60, color: WHITE, letterSpacing: 3, lineHeight: 1, textShadow: "0 3px 10px rgba(0,0,0,.6)" }}>{title}</div>
      <div style={{ fontFamily: BARLOW, fontWeight: 600, fontSize: 46, color: GOLD, letterSpacing: 2, marginTop: 4, opacity: Math.min(1, p * 1.5), transform: `translateX(${(1 - p) * -20}px)`, textShadow: "0 2px 8px rgba(0,0,0,.7)" }}>{sub}</div>
    </div>
  );
};

const Clock: React.FC<{ top: boolean }> = ({ top }) => {
  const { t } = useT();
  const m = minutesAt(t, top);
  const late = !top && ((m >= 1440 && m < 1800) || m >= 1830);
  const ring = t >= 12 && t < 12.8;
  const col = late ? RED : GOLD;
  return (
    <div style={{ position: "absolute", right: 210, top: 26, padding: "4px 14px", background: "rgba(12,12,18,.75)", border: `3px solid ${col}`, borderRadius: 8, fontFamily: MONO, fontWeight: 800, fontSize: 46, color: col, textShadow: `0 0 12px ${col}`, transform: ring ? `rotate(${Math.sin(t * 60) * 4}deg)` : undefined }}>
      {fmt(m)}
    </div>
  );
};

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

// câmera: centro horizontal do enquadramento em cada bloco (zoom ~1,3x em relação à v10)
const PH = 600;
const camX = (top: boolean, b: number, t: number) => {
  if (top) return [560, 640, 700, 470, 470, 470, 560, 560][Math.min(b, 7)];
  if (b === 7) return t < OUTBED ? 520 : 560;
  return [560, 470, 470, 470, 470, 470, 470, 560][Math.min(b, 7)];
};
const Half: React.FC<{ top: boolean; y: number }> = ({ top, y }) => {
  const { t, frame } = useT();
  const b = blockOf(t);
  const bs = B[b];
  const since = t - bs;
  const cutPulse = b > 0 ? interpolate(since, [0, 0.25], [1.05, 1], clamp) : 1;
  const flash = b > 0 ? interpolate(since, [0, 0.18], [0.35, 0], clamp) : 0;
  const scene: "bed" | "bath" | "kitchen" = top ? (b === 6 ? "bath" : b === 7 ? "kitchen" : "bed") : b === 7 && t >= OUTBED ? "kitchen" : "bed";

  // ------- estado do quarto
  let dawn = 0, lamp = 1, drawer = 0, shirt = -1, sneakers = false, alarm = 0;
  let dark = 0.3;
  let phoneGlow = 0;
  if (top) {
    if (b >= 2) shirt = 0;
    if (b === 1) drawer = er(t, 1.5, 1.9) * (1 - er(t, 2.9, 3.3));
    if (b === 2) shirt = er(t, 4.6, 6.0);
    if (b >= 3) shirt = 1;
    if (b >= 2) sneakers = b > 2 || t > 6.2;
    if (b === 4) { lamp = t < 10.2 ? 1 : 0; dark = t < 10.2 ? 0.3 : 0.68; }
    if (b === 5) { lamp = 0; dawn = er(t, 12, 13.5); dark = lerp(0.6, 0.12, er(t, 12, 13.5)); alarm = t < 12.42 ? 1 : 0; }
    if (b >= 6) { lamp = 0; dawn = 1; dark = 0.05; }
  } else {
    lamp = b === 0 ? 1 : 0;
    dark = b === 0 ? 0.3 : 0.72;
    phoneGlow = b >= 1 && b <= 4 ? 1 : 0;
    if (b === 5) { dawn = er(t, 12, 13.5) * 0.8; dark = lerp(0.72, 0.35, er(t, 12, 13.5)); }
    if (b >= 5) alarm = SNZ.some((sn) => t > sn - 0.7 && t < sn - 0.05) ? 1 : 0;
    if (b >= 6) { lamp = 0; dawn = 0.8; dark = scene === "kitchen" ? 0.22 : 0.4; }
  }

  // ------- personagem: under (atrás do cobertor), blanket, over (na frente)
  let under: React.ReactNode = null;
  let blanket: React.ReactNode = null;
  let over: React.ReactNode = null;
  const kind = top ? "gold" : "gray";
  const pj = top ? PJ_GOLD : PJ_GRAY;
  const scrollT = t * 2.2;
  const blGold = <BlanketLie color="#c99a3e" edge="#9a7428" />;
  const blGray = <BlanketLie color="#4a5070" edge="#3a3f5c" />;
  const legsBlanket = (c: string, e: string) => <path d="M520 368 Q 620 356 700 364 L 700 404 L 500 404 Z" fill={c} stroke={e} strokeWidth={3} />;
  if (b === 0) {
    over = <Body t={t} pose={SIT_PHONE} kind={kind} outfit={pj} eyes="down" holdN={<Phone scroll={top ? 0 : scrollT} />} glow={top ? 0.5 : 0} />;
  } else if (top) {
    if (b === 1) {
      const pose = track(t, [[1, SIT_PHONE], [1.5, STAND], [1.8, LEAN_DRAWER], [3.2, LEAN_DRAWER], [3.6, STAND]]);
      const inHand = t < 2.2;
      const drop = er(t, 2.2, 2.5);
      over = (
        <>
          <Body t={t} pose={pose} kind="gold" outfit={PJ_GOLD} eyes={t > 3.4 ? "open" : "down"} mouth={t > 3.4 ? "smile" : "flat"} glow={0.55} holdN={inHand ? <Phone on={false} /> : undefined} />
          {!inHand && t < 2.9 && <g transform={`translate(${778},${378 + drop * 14})`} opacity={1 - drop * 0.6}><Phone on={false} rot={90} /></g>}
        </>
      );
    } else if (b === 2) {
      const k = (Math.sin((t - 4) * 7) + 1) / 2;
      over = <Body t={t} pose={mixPose(FOLD_A, FOLD_B, k)} kind="gold" outfit={PJ_GOLD} eyes="down" mouth="smile" glow={0.6} />;
    } else if (b === 3) {
      const yawn = t > 9.2 && t < 9.8;
      const flip = [8.0, 9.0].map((s) => ramp(t, s, s + 0.35)).reduce((a, v) => a + (v > 0 && v < 1 ? v : 0), 0);
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
    } else if (b === 4 || (b === 5 && t < 12.6)) {
      const tap = b === 5 ? er(t, 12.15, 12.42) : 0;
      const lp = reachClock(LIE_BODY, tap, [110, 95]);
      under = <Body t={t} pose={lp} kind="gold" outfit={PJ_GOLD} parts="noNearArm" eyes={b === 5 && t > 12.2 ? "open" : "closed"} mouth="smile" glow={0.4} />;
      blanket = blGold;
      const handOn = <Body t={t} pose={lp} kind="gold" outfit={PJ_GOLD} parts="nearArm" glow={0.4} />;
      if (b === 5) over = handOn;
      if (b === 4)
        over = [handOn, ...[0, 1, 2].map((i) => {
          const q = (((t - 10 + i * 0.6) % 1.8) + 1.8) % 1.8 / 1.8;
          return <text key={i} x={420 + q * 60 + i * 6} y={300 - q * 90} fontFamily={MONO} fontWeight={800} fontSize={22 + i * 6} fill={GOLD} opacity={interpolate(q, [0, 0.2, 0.8, 1], [0, 1, 1, 0])}>z</text>;
        })];
    } else if (b === 5) {
      const pose = track(t, [[12.6, SIT_UP], [13.1, SIT_UP], [13.6, STRETCH], [14.4, STRETCH], [14.8, SIT_UP]]);
      const g = 0.5 + 0.5 * er(t, 13.3, 13.9);
      under = <Body t={t} pose={pose} kind="gold" outfit={PJ_GOLD} eyes={t > 13.4 && t < 14.3 ? "closed" : "open"} mouth={t > 13.4 && t < 14.3 ? "o" : "smile"} glow={g} />;
      blanket = legsBlanket("#c99a3e", "#9a7428");
    } else if (b === 6) {
      const scrub = Math.sin(t * 9) * 10;
      over = (
        <>
          <Body t={t} pose={{ ...SHOWER, aF: [SHOWER.aF[0], SHOWER.aF[1] + scrub], aN: [SHOWER.aN[0], SHOWER.aN[1] - scrub] }} kind="gold" eyes="closed" mouth="smile" glow={0.7} />
          <Water t={t} on={ramp(t, 15.05, 15.3)} />
          <BathGlass />
        </>
      );
    } else if (b === 7) {
      const flip = ramp(t, 19.4, 19.95);
      const lift = Math.sin(flip * Math.PI);
      const egg = Math.sin(flip * Math.PI) * 60;
      const pose = { ...COOK, aN: [COOK.aN[0] + lift * 30, COOK.aN[1] - lift * 10] as [number, number] };
      over = (
        <>
          <Body t={t} pose={pose} kind="gold" outfit={DAY_GOLD} dir={1} eyes="down" mouth="smile" glow={0.6} holdN={<g transform="translate(-4,0)"><Pan egg={egg} /></g>} />
          {[0, 1, 2].map((i) => {
            const q = ((t * 1.5 + i / 3) % 1 + 1) % 1;
            return <circle key={i} cx={575 + i * 10} cy={340 - q * 30} r={2} fill="#fff" opacity={0.6 * (1 - q)} />;
          })}
        </>
      );
    }
  } else {
    // ------- metade de baixo: celular
    if (b >= 1 && b <= 3) {
      const thumb = Math.floor(t * 5) % 2;
      const eyes: Eyes = b === 1 ? "open" : b === 2 ? "wide" : "droopy";
      const yawn = b === 3 && t > 8 && t < 8.7;
      const pose = { ...LIE_BODY, aN: [99, -158 + thumb * 6] as [number, number] }; // celular na frente do rosto
      under = <Body t={t} pose={pose} kind="gray" outfit={PJ_GRAY} parts="noNearArm" eyes={eyes} red={b >= 2} mouth={yawn ? "yawn" : "flat"} messy={b === 3} />;
      blanket = blGray;
      over = (
        <>
          <Body t={t} pose={pose} kind="gray" outfit={PJ_GRAY} parts="nearArm" holdN={<Phone scroll={scrollT * (b === 2 ? 2 : 1)} rot={-15} />} />
          {b === 2 &&
            [4.6, 5.4, 6.2].map((s, i) =>
              t > s ? (
                <g key={i} transform={`translate(${470 + i * 26},${250 - (t - s) * 40})`} opacity={1 - ramp(t, s + 0.6, s + 1)}>
                  <circle r={12} fill={i === 1 ? "#ff7aa8" : RED} />
                  <text y={5} fontSize={13} fill="#fff" textAnchor="middle" fontFamily={MONO} fontWeight={800}>{i === 1 ? "♥" : "1"}</text>
                </g>
              ) : null
            )}
        </>
      );
    } else if (b === 4 || (b >= 5 && t < WAKE + 0.3)) {
      // deitado: dorme com o celular no rosto e dá tapas na soneca
      const ring = b >= 5 && SNZ.some((sn) => t > sn - 0.55 && t < sn); void ring;
      const s0 = SNZ.filter((sn) => t >= sn - 0.25).pop();
      const slap = b >= 5 && s0 !== undefined ? er(t, s0 - 0.25, s0) * (1 - er(t, s0 + 0.15, s0 + 0.7)) : 0;
      const shock = t >= WAKE;
      const pose = reachClock(LIE_BODY, slap, [100, 60]);
      under = <Body t={t} pose={pose} kind="gray" outfit={PJ_GRAY} parts="noNearArm" eyes={shock ? "wide" : slap > 0.3 ? "droopy" : "closed"} red={b >= 5} mouth={shock ? "o" : b === 4 ? "o" : "frown"} messy />;
      blanket = blGray;
      over = (
        <>
          {slap > 0.02 && <Body t={t} pose={pose} kind="gray" outfit={PJ_GRAY} parts="nearArm" />}
          {!shock && (
            <g transform="translate(492,328) rotate(-84)">
              <Phone scroll={t} />
            </g>
          )}
          {b >= 5 && s0 !== undefined && t > s0 && t < s0 + 0.8 && (
            <text x={470} y={262 - (t - s0) * 30} fontFamily={BARLOW} fontWeight={700} fontSize={26} fill={GOLD} opacity={1 - ramp(t, s0 + 0.4, s0 + 0.8)}>
              +9 MIN
            </text>
          )}
          {!shock && (b === 4 || t > 12.8) &&
            [0, 1].map((i) => {
              const q = (((t - 10 + i * 0.9) % 1.8) + 1.8) % 1.8 / 1.8;
              return <text key={i} x={440 + q * 50} y={280 - q * 80} fontFamily={MONO} fontWeight={800} fontSize={24} fill="#8a8798" opacity={interpolate(q, [0, 0.2, 0.8, 1], [0, 1, 1, 0])}>z</text>;
            })}
          {shock && <text x={416} y={262} fontFamily={MONO} fontWeight={800} fontSize={44} fill={RED} textAnchor="middle">!</text>}
        </>
      );
    } else if (b === 7 && t < OUTBED) {
      // pula da cama
      const pose = track(t, [[WAKE + 0.3, SIT_UP], [OUTBED - 0.3, P(600, 342, 175, [-40, -120], [40, 120], [-4, 0], [4, 0])]]);
      under = <Body t={t} pose={pose} kind="gray" outfit={PJ_GRAY} eyes="wide" red messy mouth="o" />;
      blanket = legsBlanket("#4a5070", "#3a3f5c");
      over = <text x={pose.x + 10} y={200} fontFamily={MONO} fontWeight={800} fontSize={44} fill={RED} textAnchor="middle">!</text>;
    } else if (b === 7) {
      // cozinha: só pega o café e vai
      const ph = t * 14;
      const x = t < GRAB - 0.15 ? interpolate(t, [OUTBED, GRAB - 0.15], [260, 770], clamp) : t < GRAB + 0.2 ? 770 : interpolate(t, [GRAB + 0.2, 21], [770, 1010], clamp);
      const walking = t < GRAB - 0.15 || t > GRAB + 0.2;
      const reach = er(t, GRAB - 0.25, GRAB) * (1 - er(t, GRAB, GRAB + 0.25));
      let pose = P(x, 342, 172, [20, 40], [lerp(30, 41, reach), lerp(60, 41, reach)], [-4, 0], [4, 0]);
      if (walking) pose = { ...pose, lF: [24 * Math.sin(ph), 24 * Math.sin(ph) - 10], lN: [-24 * Math.sin(ph), -24 * Math.sin(ph) - 10], aF: [-20 * Math.sin(ph), -20 * Math.sin(ph) + 20] };
      over = (
        <Body
          t={t}
          pose={pose}
          kind="gray"
          outfit={DAY_GRAY}
          dir={1}
          eyes="droopy"
          red
          messy
          stink={0.8}
          mouth="frown"
          holdN={t >= GRAB ? <Mug /> : undefined}
        />
      );
    }
  }

  const phonePos: V = [460, 318];
  return (
    <div style={{ position: "absolute", left: 0, top: y, width: W, height: PH, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${cutPulse})`, transformOrigin: "540px 320px", filter: top ? undefined : "saturate(0.75)" }}>
        <svg width={W} height={PH} viewBox={`${camX(top, b, t) - 306} 130 612 340`}>
          <defs>
            <filter id={`glowGold`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={7} />
            </filter>
            <radialGradient id={`lamp${top ? "t" : "b"}`} cx="752" cy="310" r="420" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ffd28a" stopOpacity={0.55} />
              <stop offset="1" stopColor="#ffd28a" stopOpacity={0} />
            </radialGradient>
            <radialGradient id={`ph${top ? "t" : "b"}`} cx={phonePos[0]} cy={phonePos[1]} r="230" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#7cc4ff" stopOpacity={0.6} />
              <stop offset="1" stopColor="#7cc4ff" stopOpacity={0} />
            </radialGradient>
          </defs>
          {scene === "bed" && <Room id={top ? "t" : "b"} dawn={dawn} lamp={lamp} drawer={drawer} shirtFold={shirt} sneakers={sneakers} alarm={alarm} t={t} clock={fmt(minutesAt(t, top))} clockColor={!top && ((minutesAt(t, top) >= 1440 && minutesAt(t, top) < 1800) || minutesAt(t, top) >= 1830) ? RED : "#ffb84a"} />}
          {scene === "bath" && <Bath />}
          {scene === "kitchen" && <Kitchen id={top ? "t" : "b"} t={t} toast={top ? er(t, 20.1, 20.25) * (1 - 0.3 * er(t, 20.25, 20.5)) : 0} bread={false} flame={top} mug={top || t < GRAB} />}
          <rect x={0} y={0} width={W} height={H} fill="#0b0d1e" opacity={dark} />
          {lamp > 0.5 && <rect x={0} y={0} width={W} height={H} fill={`url(#lamp${top ? "t" : "b"})`} style={{ mixBlendMode: "screen" }} />}
          {phoneGlow > 0 && <rect x={0} y={0} width={W} height={H} fill={`url(#ph${top ? "t" : "b"})`} opacity={0.85 + 0.15 * Math.sin(frame / 3)} style={{ mixBlendMode: "screen" }} />}
          {under}
          {blanket}
          {over}
        </svg>
      </div>
      <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash, pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 80px rgba(0,0,0,.6)", pointerEvents: "none" }} />
      <Label title={top ? "COM DISCIPLINA" : "SEM DISCIPLINA"} sub={top ? TOP_LABELS[Math.min(b, 7)] : botLabel(t, b)[0]} subAt={b === 0 ? -1 : top ? bs : botLabel(t, b)[1]} />
      <Clock top={top} />
    </div>
  );
};

// ------------------------------------------------------------------ cena final: a rua de manhã
const walkPose = (x: number, phase: number, run: boolean): Pose => {
  const s = Math.sin(phase), c = Math.cos(phase);
  if (run)
    return P(x, 1252 - Math.abs(c) * 8, 168, [-40 * s - 10, -40 * s + 80], [40 * s - 10, 40 * s + 80], [35 * s, 35 * s - 30 - 20 * Math.max(0, s)], [-35 * s, -35 * s - 30 - 20 * Math.max(0, -s)]);
  return P(x, 1262 - Math.abs(c) * 2, 165, [10 * s, 10 * s + 20], [-8, 95], [16 * s, 16 * s - 6], [-16 * s, -16 * s - 6]);
};

const Street: React.FC = () => {
  const { t, fps } = useT();
  const k = t - STREET;
  const fadeIn = ramp(k, 0, 0.3);
  const runX = interpolate(k, [0, 3.2], [-60, 660], clamp);
  const walkX = interpolate(k, [0, 4.5], [150, 235], clamp);
  const p1 = spring({ frame: Math.round((k - 0.7) * fps), fps, config: { damping: 14, stiffness: 160 } });
  const p2 = spring({ frame: Math.round((k - 1.5) * fps), fps, config: { damping: 14, stiffness: 160 } });
  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920">
        <defs>
          <linearGradient id="skyS" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1d2350" />
            <stop offset="0.55" stopColor="#6a5fa0" />
            <stop offset="0.8" stopColor="#ffb36b" />
          </linearGradient>
          <filter id="glowGold" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={7} />
          </filter>
          <radialGradient id="poste" cx="260" cy="900" r="420" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffd28a" stopOpacity={0.35} />
            <stop offset="1" stopColor="#ffd28a" stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect width={1080} height={1920} fill="#0c0e1c" />
        <rect y={600} width={1080} height={620} fill="url(#skyS)" />
        {Array.from({ length: 12 }).map((_, i) => {
          const h = [260, 380, 300, 440, 220, 340, 400, 280, 360, 240, 420, 300][i];
          return (
            <g key={i}>
              <rect x={i * 92 - 10} y={1220 - h} width={86} height={h} fill="#171a33" />
              {Array.from({ length: Math.floor(h / 60) }).map((_, j) => (
                <rect key={j} x={i * 92 + 8 + (j % 2) * 30} y={1220 - h + 20 + j * 52} width={12} height={16} fill="#ffcf6a" opacity={(i + j) % 3 === 0 ? 0.15 : 0.7} />
              ))}
            </g>
          );
        })}
        <rect y={1180} width={1080} height={40} fill="#262a48" />
        {Array.from({ length: 28 }).map((_, i) => (
          <rect key={i} x={i * 40} y={1160} width={4} height={40} fill="#3a3f63" />
        ))}
        <rect y={1158} width={1080} height={6} fill="#3a3f63" />
        <rect y={1320} width={1080} height={30} fill="#3c4060" />
        <rect y={1350} width={1080} height={300} fill="#1f2236" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={i * 260 - ((k * 120) % 260)} y={1480} width={120} height={8} fill="#5a5e80" opacity={0} />
        ))}
        <rect x={250} y={880} width={10} height={440} fill="#2a2d45" />
        <rect x={250} y={880} width={80} height={8} fill="#2a2d45" />
        <rect x={300} y={888} width={40} height={10} fill="#ffe2a0" />
        <rect width={1080} height={1920} fill="url(#poste)" style={{ mixBlendMode: "screen" }} />
        <g transform="translate(0,1340) scale(1.8) translate(0,-1340)">
        <Body t={t} pose={walkPose(walkX, k * 4, false)} kind="gray" outfit={DAY_GRAY} dir={1} eyes="droopy" red messy stink={1} mouth="frown" holdN={<g><rect x={-9} y={-6} width={18} height={22} rx={3} fill="#f2efe6" /><rect x={-9} y={-6} width={18} height={6} fill="#6b4a36" />{[0, 1].map((i) => { const q = ((t * 0.8 + i * 0.5) % 1 + 1) % 1; return <path key={i} d={`M${-4 + i * 7} ${-10 - q * 22} q4 -5 0 -10 q-4 -5 0 -10`} stroke="#ffffff" strokeWidth={2} fill="none" opacity={0.6 * (1 - q)} />; })}</g>} />
        <Body t={t} pose={walkPose(runX, k * 11, true)} kind="gold" outfit={DAY_GOLD} dir={1} eyes="open" mouth="smile" glow={0.9} />
        </g>
      </svg>
      <div style={{ position: "absolute", top: 380, left: 120, right: 120, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 76, lineHeight: 1.05, letterSpacing: 2, textShadow: "0 4px 14px rgba(0,0,0,.7)" }}>
        <div style={{ color: WHITE, opacity: Math.min(1, p1 * 1.5), transform: `translateY(${(1 - p1) * 20}px)` }}>A SUA MANHÃ COMEÇA</div>
        <div style={{ color: GOLD, opacity: Math.min(1, p2 * 1.5), transform: `translateY(${(1 - p2) * 20}px)` }}>NA NOITE ANTERIOR.</div>
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ raiz
const TOPY = 350, GAP = 12;
const Split: React.FC<{ fade: number }> = ({ fade }) => (
  <AbsoluteFill style={{ opacity: 1 - fade }}>
    <div style={{ position: "absolute", top: 232, left: 120, right: 120, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 54, lineHeight: 1.0, letterSpacing: 2 }}>
      <div style={{ color: WHITE }}>MESMA PESSOA.</div>
      <div style={{ color: GOLD }}>DUAS NOITES.</div>
    </div>
    <Half top y={TOPY} />
    <div style={{ position: "absolute", left: 120, right: 120, top: TOPY + PH + GAP / 2 - 2, height: 4, background: GOLD, opacity: 0.6 }} />
    <Half top={false} y={TOPY + PH + GAP} />
  </AbsoluteFill>
);
export const NoiteManha: React.FC = () => {
  useFonts();
  const { t } = useT();
  const toStreet = ramp(t, STREET - 0.3, STREET);
  const loopFlash = interpolate(t, [LOOP, LOOP + 0.05, LOOP + 0.3], [0, 0.6, 0], clamp);
  return (
    <AbsoluteFill style={{ background: "#08090f" }}>
      <Audio src={staticFile("noite_manha/audio_final.wav")} />
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
