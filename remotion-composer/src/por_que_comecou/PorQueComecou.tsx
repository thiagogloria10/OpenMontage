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
const LIM = { ua: 40, fa: 38, th: 50, sh: 50, torso: 74, head: 25 }; // v4: cabeça um pouco menor (era 30)
const NO_CLOTHES = true; // v2: personagem sem roupa (pedido do Thiago)
const THIN = 0.62; // v2: corpo mais fino (espessura do tronco e dos membros)
const NECK = 14; // v3: pescoço entre o tronco e a cabeça
// v3: membro como UMA curva que passa pela articulação (cotovelo/joelho fluidos, sem quina)
const curve = (q: V[]) => { if (q.length < 3) return `M${q[0][0]},${q[0][1]} L${q[1][0]},${q[1][1]}`; const c: V = [2 * q[1][0] - (q[0][0] + q[2][0]) / 2, 2 * q[1][1] - (q[0][1] + q[2][1]) / 2]; return `M${q[0][0]},${q[0][1]} Q${c[0]},${c[1]} ${q[2][0]},${q[2][1]}`; };

const Body: React.FC<BodyProps> = ({ pose, kind, dir = 1, eyes = "open", mouth = "flat", glow = 0, messy, stink = 0, parts = "full", red, t, holdN, holdF, outfit }) => {
  const hip: V = [pose.x, pose.y];
  const sh = add(hip, pose.tr, 60);
  const neck = add(hip, pose.tr, LIM.torso);
  // nb = dobra do pescoço (deitado: corpo reto no colchão, só a cabeça sobe no travesseiro)
  const head = pose.nb ? add(neck, pose.tr + pose.nb, LIM.head + 4 + NECK * 0.7) : add(hip, pose.tr, LIM.torso + NECK + LIM.head + 2);
  const neckTop = pose.nb ? add(neck, pose.tr + pose.nb, NECK * 0.7 + 6) : add(hip, pose.tr, LIM.torso + NECK + 6);
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
          <path d={curve(armF)} stroke={farColor} strokeWidth={13 * THIN + extra} fill="none" strokeLinecap="round" />
          <path d={curve(legF)} stroke={farColor} strokeWidth={15 * THIN + extra} fill="none" strokeLinecap="round" />
          <line x1={hip[0]} y1={hip[1]} x2={neck[0]} y2={neck[1]} stroke={color} strokeWidth={30 * THIN + extra} strokeLinecap="round" />
          {showHead && <line x1={neck[0]} y1={neck[1]} x2={neckTop[0]} y2={neckTop[1]} stroke={color} strokeWidth={9 + extra} strokeLinecap="round" />}
          <path d={curve(legN)} stroke={color} strokeWidth={15 * THIN + extra} fill="none" strokeLinecap="round" />
        </>
      )}
      {showNear && <path d={curve(armN)} stroke={color} strokeWidth={13 * THIN + extra} fill="none" strokeLinecap="round" />}
      {showHead && <circle cx={head[0]} cy={head[1]} r={LIM.head + extra / 2} fill={color} />}
    </>
  );
  // rosto
  const ex = head[0] + dir * 8, ey = head[1] - 2;
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
  const mx = head[0] + dir * 9, my = head[1] + 11;
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
          <path key={i} d={`M${head[0] + o} ${head[1] - 23} q${4 - i * 2} -14 ${-3 + i * 3} -22`} stroke="#55525f" strokeWidth={3} fill="none" strokeLinecap="round" />
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
// "POR QUE VOCÊ COMEÇOU?" v5 — roteiro novo (uma ideia só): o caderno com o motivo (o filho)
// ==================================================================
const HOOK = ["QUANDO DER VONTADE DE PARAR,", "LEMBRE POR QUE COMEÇOU."];
const DUR = [3.2, 5.4, 4.4, 5.0, 5.0, 4.0]; // v11: narração Fish Audio (voz clonada)
const ST: number[] = DUR.reduce<number[]>((a, d, i) => [...a, i === 0 ? 0 : a[i - 1] + DUR[i - 1]], []);
export const TOTAL = ST[ST.length - 1] + DUR[DUR.length - 1];
// [texto, arquivo, início relativo à cena, duração da fala, mostra legenda]
type LineT = [string, number, number, number, boolean] | null;
const LINES: LineT[] = [["Dia um. Ele escreveu as metas dele.", 0, 0.2, 2.32, true], ["Os dias passaram. O cansaço chegou. E o caderno foi parar no fundo da gaveta.", 1, 0.3, 4.69, true], ["Até o dia em que ele pensou: pra que vou fazer isso?", 2, 0.9, 3.11, true], ["Aí ele abriu a gaveta. E lembrou.", 3, 0.2, 2.32, true], null, ["Quando der vontade de parar, lembre por que começou.", 4, 0.3, 3.16, false]];
const WORDT: Record<number, number[]> = { 0: [0.0, 0.24, 0.78, 0.86, 1.36, 1.46, 1.88], 1: [0.0, 0.14, 0.38, 1.14, 1.2, 1.74, 2.06, 2.4, 2.48, 2.98, 3.1, 3.42, 3.58, 3.86, 4.02], 2: [0.0, 0.34, 0.5, 0.72, 0.88, 0.96, 1.04, 1.78, 1.88, 2.06, 2.3, 2.6], 3: [0.0, 0.32, 0.5, 0.86, 0.92, 1.4, 1.72] }; // tempos reais (faster-whisper) das falas do Fish
const KEY = ["isso", "um", "metas", "cansaço", "caderno", "gaveta", "quê", "lembrou", "parar", "começou"];
const VOICE_DIR = "por_que_comecou/fala_fish";
const MOTIVO = ["QUERO ESTUDAR", "TODOS OS DIAS."]; // v6 (antes: energia pro filho)
const METAS = ["ESTUDAR TODOS OS DIAS", "2 HORAS DE ESTUDO POR DIA", "LER 1 LIVRO POR MÊS", "APRENDER INGLÊS", "PASSAR NA PROVA"]; // v7: bilhete de metas
const sceneOf = (t: number) => { let s = 0; for (let i = 0; i < ST.length; i++) if (t >= ST[i]) s = i; return s; };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const backPop = (x: number) => { if (x <= 0) return 0; if (x >= 0.3) return 1; const k = x / 0.3; return 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); };
function kfT(t: number, keys: [number, number][]) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) { const [t0, v0] = keys[i - 1]; return lerp(v0, v1, ease((t - t0) / (t1 - t0))); }
  }
  return keys[keys.length - 1][1];
}

// câmera: centro e zoom no mundo do quarto; screen = desenho direto em 1080×1260 (closes)
type Cam = { cx: number; cy: number; z: number; screen?: boolean };
const VIEW_W = 1080, VIEW_H = 1260;

// --- poses
const SIT_PHONE5 = P(560, 372, 180, [30, 120], [20, 105], [95, 5], [85, 0]);
const STAND_C = P(560, 342, 180, [-8, -4], [8, 4], [-4, 0], [4, 0]);
const walkP = (x: number, y: number, ph: number, amp = 1): Pose => {
  const s = Math.sin(ph), c = Math.cos(ph);
  return P(x, y - Math.abs(c) * 3 * amp, 172, [(-22 * s - 4) * amp, (-22 * s + 30) * amp], [(22 * s - 4) * amp, (22 * s + 30) * amp], [26 * s * amp, (26 * s - 10 - 14 * Math.max(0, s)) * amp], [-26 * s * amp, (-26 * s - 10 - 14 * Math.max(0, -s)) * amp]);
};

// --- boneco que passa de dourado para cinza (k = 1 dourado, 0 cinza)
const Duo: React.FC<{ k: number; pose: Pose; t: number; eyes: [Eyes, Eyes]; mouth: [Mouth, Mouth]; glow?: number; holdN?: React.ReactNode; dir?: 1 | -1; messy?: boolean }> = ({ k, pose, t, eyes, mouth, glow = 0, holdN, dir = 1, messy }) => (
  <g>
    {k < 1 && <g opacity={1 - k}><Body t={t} pose={pose} kind="gray" eyes={eyes[0]} mouth={mouth[0]} holdN={holdN} dir={dir} messy={messy} /></g>}
    {k > 0 && <g opacity={k}><Body t={t} pose={pose} kind="gold" eyes={eyes[1]} mouth={mouth[1]} glow={glow * k} holdN={holdN} dir={dir} /></g>}
  </g>
);

// --- caderno fechado (objeto pequeno no mundo)
const NoteClosed: React.FC<{ rot?: number }> = ({ rot = 0 }) => (
  <g transform={`rotate(${rot})`}>
    <rect x={-16} y={-5} width={32} height={10} rx={2} fill="#8a5a2a" stroke="#4a2e14" strokeWidth={1.5} />
    <rect x={-16} y={-5} width={4} height={10} fill={GOLD} />
  </g>
);
// --- página do caderno em close (tela cheia, legível no celular)
const Page: React.FC<{ t: number; reveal: number; glow: number; gray?: number; hand?: boolean }> = ({ t, reveal, glow, gray = 0, hand = true }) => {
  // v7: "METAS:" + lista de metas de estudo, escritas uma a uma
  const total = METAS.reduce((a, m) => a + m.length, 0);
  let left = Math.floor(clamp01(reveal) * total);
  const shown = METAS.map((m) => { const n = Math.max(0, Math.min(m.length, left)); left -= m.length; return m.slice(0, n); });
  let cur = shown.findIndex((x, k) => x.length < METAS[k].length);
  if (cur < 0) cur = METAS.length - 1;
  const penX = 210 + shown[cur].length * 27.5;
  const penY = 520 + cur * 92;
  return (
    <g>
      <rect x={-50} y={-50} width={1180} height={1360} fill="#1a1410" />
      <circle cx={540} cy={640} r={620} fill={GOLD} opacity={0.18 * glow} filter="url(#glowGold)" />
      <g transform={`rotate(-3 540 640)`}>
        <rect x={110} y={300} width={860} height={700} rx={14} fill="#f6efdc" stroke="#b9ae92" strokeWidth={4} />
        <rect x={110} y={300} width={18} height={700} fill={GOLD} />
        {Array.from({ length: 7 }).map((_, k) => <line key={k} x1={150} y1={438 + k * 92} x2={940} y2={438 + k * 92} stroke="#d9cfb2" strokeWidth={3} />)}
        <text x={160} y={410} fontFamily={BARLOW} fontWeight={700} fontSize={72} fill="#9a6a10" letterSpacing={3}>METAS:</text>
        {METAS.map((m, k) => (
          <g key={k}>
            <rect x={160} y={482 + k * 92} width={34} height={34} rx={5} fill="none" stroke="#1e1c28" strokeWidth={4} opacity={shown[k].length > 0 ? 1 : 0} />
            <text x={212} y={516 + k * 92} fontFamily={BARLOW} fontWeight={700} fontSize={56} fill="#1e1c28" letterSpacing={1}>{shown[k]}</text>
          </g>
        ))}
        {reveal >= 1 && <path d="M205 532 Q 470 548 770 528" stroke={GOLD} strokeWidth={8} fill="none" strokeLinecap="round" opacity={clamp01((reveal - 1) * 4)} />}
      </g>
      {hand && (
        <g transform={`translate(${penX + Math.sin(t * 30) * 4},${penY + Math.cos(t * 26) * 3}) rotate(-25)`}>
          <rect x={-6} y={-150} width={12} height={150} rx={4} fill="#2a2836" />
          <path d="M-6 0 L0 18 L6 0 Z" fill="#2a2836" />
          <path d="M0 -40 Q 40 40 110 120 Q 190 210 250 330" stroke={GOLD} strokeWidth={46} fill="none" strokeLinecap="round" opacity={0.35 * glow} filter="url(#glowGold)" />
          <path d="M0 -40 Q 40 40 110 120 Q 190 210 250 330" stroke={GOLD} strokeWidth={36} fill="none" strokeLinecap="round" />
          <path d="M0 -40 Q 40 40 110 120 Q 190 210 250 330" stroke={WHITE} strokeWidth={28} fill="none" strokeLinecap="round" />
          <circle cx={0} cy={-40} r={22} fill={WHITE} stroke={GOLD} strokeWidth={4} />
        </g>
      )}
      {gray > 0 && <rect x={-50} y={-50} width={1180} height={1360} fill="#2a2836" opacity={gray} />}
    </g>
  );
};

// --- notificação
const NOTIF = ["MENSAGEM", "E-MAIL", "BOLETO", "LEMBRETE", "REUNIÃO", "GRUPO (99+)", "COBRANÇA", "PRAZO HOJE"];
const NOTIF_C = ["#3ac06a", "#4a8ae8", "#e0554a", "#e8b04b", "#8a6ae0", "#3ac06a", "#e0554a", "#e8b04b"];
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

// --- sala: sofá, cômoda com gaveta, porta, tênis jogado (mundo: chão em 440)
const Living: React.FC<{ t: number; drawer: number; night: number; shoes?: "corner" | "none"; sofa?: boolean }> = ({ t, drawer, night, shoes = "corner", sofa = true }) => (
  <g>
    <rect x={-200} y={-200} width={1480} height={640} fill="#4a4e6e" />
    <rect x={-200} y={430} width={1480} height={10} fill="#3b3f5c" />
    <rect x={-200} y={440} width={1480} height={400} fill="#33364f" />
    {/* janela */}
    <rect x={140} y={150} width={150} height={150} fill={night > 0.5 ? "#141a3c" : "#ffb36b"} />
    <rect x={134} y={144} width={162} height={162} fill="none" stroke="#2b2e45" strokeWidth={10} />
    <line x1={215} y1={150} x2={215} y2={300} stroke="#2b2e45" strokeWidth={7} />
    {night > 0.5 && <circle cx={255} cy={185} r={14} fill="#e8e4d0" opacity={0.8} />}
    {/* porta (direita) */}
    <rect x={900} y={170} width={110} height={270} fill="#2b2e45" />
    <rect x={906} y={176} width={98} height={264} fill="#3b3f5c" />
    <circle cx={920} cy={320} r={5} fill="#c9a24a" />
    {/* cômoda com gaveta (esquerda) */}
    <rect x={40} y={350} width={130} height={90} fill="#7a563f" />
    <rect x={40 + drawer * 50} y={366} width={130} height={34} fill="#8a6449" stroke="#5a3e2c" strokeWidth={3} />
    <circle cx={105 + drawer * 50} cy={383} r={4} fill="#c9a24a" />
    <rect x={40} y={404} width={130} height={30} fill="#8a6449" stroke="#5a3e2c" strokeWidth={3} />
    <rect x={95} y={330} width={30} height={20} fill="#c9a24a" />
    {/* sofá (v8): cor destacada da parede, encosto e assento com almofadas, braços arredondados, pés de madeira */}
    {sofa && <g>
    <g stroke="#1e1c28" strokeWidth={3} strokeLinejoin="round">
      <rect x={428} y={286} width={334} height={96} rx={24} fill="#2f6f78" />
      <rect x={440} y={298} width={150} height={74} rx={18} fill="#3f8a94" />
      <rect x={600} y={298} width={150} height={74} rx={18} fill="#3f8a94" />
      <rect x={426} y={362} width={170} height={42} rx={14} fill="#4a9aa4" />
      <rect x={594} y={362} width={170} height={42} rx={14} fill="#4a9aa4" />
      <rect x={418} y={398} width={354} height={28} rx={10} fill="#25585f" />
      <rect x={392} y={326} width={56} height={100} rx={26} fill="#2f6f78" />
      <rect x={742} y={326} width={56} height={100} rx={26} fill="#2f6f78" />
      <path d="M432 426 L446 426 L443 440 L435 440 Z" fill="#5a3a24" />
      <path d="M744 426 L758 426 L755 440 L747 440 Z" fill="#5a3a24" />
      <rect x={452} y={318} width={58} height={50} rx={14} fill={GOLD} transform="rotate(-12 481 343)" />
    </g>
    <path d="M404 334 Q420 326 436 334" stroke="#7fc2ca" strokeWidth={4} fill="none" opacity={0.6} />
    <path d="M754 334 Q770 326 786 334" stroke="#7fc2ca" strokeWidth={4} fill="none" opacity={0.6} />
    <path d="M450 306 Q515 298 580 306" stroke="#7fc2ca" strokeWidth={4} fill="none" opacity={0.5} />
    <path d="M610 306 Q675 298 740 306" stroke="#7fc2ca" strokeWidth={4} fill="none" opacity={0.5} />
    </g>}
    {/* tênis jogado no canto */}
    {shoes === "corner" && (
      <g>
        <path d="M820 440 l0 -10 q10 -6 22 0 l6 10 z" fill="#f2f2f2" transform="rotate(-18 834 436)" />
        <path d="M852 440 l0 -10 q10 -6 22 0 l6 10 z" fill="#f2f2f2" transform="rotate(24 866 436)" />
      </g>
    )}
    {void t}
  </g>
);

// --- rua do amanhecer
const Dawn: React.FC<{ t: number; scroll?: number }> = ({ t, scroll = 0 }) => (
  <g>
    <defs><linearGradient id="dawnSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1d2350" /><stop offset="0.55" stopColor="#6a5fa0" /><stop offset="1" stopColor="#ffb36b" /></linearGradient></defs>
    <rect x={-200} y={-200} width={1480} height={640} fill="url(#dawnSky)" />
    <circle cx={880} cy={410} r={70} fill="#ffe2a0" opacity={0.85} />
    {Array.from({ length: 16 }).map((_, i) => {
      const h = [120, 180, 140, 210, 100, 160, 190, 130, 170, 110, 200, 150, 120, 180, 140, 160][i];
      const x = ((i * 92 - scroll * 0.4) % 1472 + 1472) % 1472 - 200;
      return <rect key={i} x={x} y={440 - h} width={86} height={h} fill="#171a33" opacity={0.9} />;
    })}
    <rect x={-200} y={440} width={1480} height={400} fill="#262a48" />
    {Array.from({ length: 30 }).map((_, i) => <rect key={i} x={((i * 70 - scroll) % 2100 + 2100) % 2100 - 300} y={470} width={36} height={5} fill="#3a3f63" />)}
    {void t}
  </g>
);
const Ball: React.FC = () => (
  <g>
    <circle r={11} fill="#e8743a" stroke="#2a2836" strokeWidth={1.6} />
    <path d="M-11 0 Q0 6 11 0 M0 -11 Q-6 0 0 11" stroke="#2a2836" strokeWidth={1.4} fill="none" />
  </g>
);
// --- mesa de estudo (v6): mesa, cadeira, luminária, pilha de livros e livro aberto
const Desk: React.FC<{ t: number; lamp: number; open?: number; flip?: number; glow?: number }> = ({ t, lamp, open = 1, flip = 0, glow = 0 }) => (
  <g>
    {lamp > 0 && <circle cx={720} cy={300} r={170} fill="#ffd28a" opacity={0.22 * lamp} filter="url(#glowGold)" />}
    <rect x={600} y={350} width={250} height={14} rx={4} fill="#8a6449" />
    <rect x={612} y={364} width={12} height={76} fill="#6b4a36" />
    <rect x={826} y={364} width={12} height={76} fill="#6b4a36" />
    {/* luminária */}
    <rect x={800} y={340} width={34} height={10} fill="#2a2a33" />
    <line x1={817} y1={340} x2={790} y2={290} stroke="#2a2a33" strokeWidth={5} />
    <path d="M770 300 L806 284 L800 270 L766 286 Z" fill={lamp > 0.5 ? "#ffe2a0" : "#5a5a66"} stroke="#2a2a33" strokeWidth={2} />
    {/* pilha de livros */}
    {["#4a8ae8", "#e0554a", "#3ac06a", GOLD].map((c, i) => <rect key={i} x={740 + (i % 2) * 4} y={338 - i * 10} width={46} height={10} rx={2} fill={c} stroke="#2a2836" strokeWidth={1.2} />)}
    {/* caderno aberto (v9): capa marrom, duas páginas com linhas, fita dourada, levemente inclinado para a câmera */}
    {open > 0 && (
      <g transform="translate(668,344)">
        <ellipse cx={0} cy={4} rx={70} ry={16} fill={GOLD} opacity={0.35 * glow} filter="url(#glowGold)" />
        <path d="M-62 -2 L-4 -12 L4 -12 L62 -2 L58 10 L-58 10 Z" fill="#8a5a2a" stroke="#4a2e14" strokeWidth={1.8} strokeLinejoin="round" />
        <path d="M-56 -4 Q-30 -12 -2 -12 L-2 6 Q-30 4 -54 7 Z" fill="#fbf6e8" stroke="#b9ae92" strokeWidth={1.4} />
        <path d="M56 -4 Q30 -12 2 -12 L2 6 Q30 4 54 7 Z" fill="#fbf6e8" stroke="#b9ae92" strokeWidth={1.4} />
        {[0, 1, 2].map((k) => <path key={k} d={`M-48 ${-4 + k * 4} Q-26 ${-10 + k * 4} -8 ${-9 + k * 4}`} stroke="#c9b98a" strokeWidth={1.1} fill="none" />)}
        {[0, 1, 2].map((k) => <path key={k} d={`M8 ${-9 + k * 4} Q26 ${-10 + k * 4} 48 ${-4 + k * 4}`} stroke="#c9b98a" strokeWidth={1.1} fill="none" />)}
        <path d="M-40 -6 L-18 -9" stroke="#2a2836" strokeWidth={1.6} />
        <path d="M0 6 L3 18 L6 6" fill={GOLD} />
        {flip > 0 && flip < 1 && <path d={`M2 -12 Q${2 + 26 * Math.cos(flip * Math.PI)} ${-14 - 22 * Math.sin(flip * Math.PI)} ${2 + 52 * Math.cos(flip * Math.PI)} ${-4 - 18 * Math.sin(flip * Math.PI)} L${2 + 50 * Math.cos(flip * Math.PI)} ${6 - 18 * Math.sin(flip * Math.PI)} Q${2 + 26 * Math.cos(flip * Math.PI)} ${4 - 20 * Math.sin(flip * Math.PI)} 2 6 Z`} fill="#fffaf0" stroke="#b9ae92" strokeWidth={1.2} />}
      </g>
    )}
    {void t}
  </g>
);
const STUDY = P(560, 372, 186, [55, 104], [48, 96], [95, 5], [85, 0]);
const StudyChair: React.FC = () => (
  <g>
    <rect x={500} y={300} width={10} height={140} fill="#6b4a36" />
    <rect x={500} y={372} width={90} height={10} fill="#6b4a36" />
    <rect x={580} y={382} width={8} height={58} fill="#6b4a36" />
  </g>
);
// filho: mesmo boneco, menor (escala 0,62 a partir dos pés)
const Kid: React.FC<{ pose: Pose; t: number; ball?: boolean; dir?: 1 | -1 }> = ({ pose, t, ball = true, dir = -1 }) => {
  const k = 0.62, fy = 442;
  return (
    <g transform={`translate(${pose.x},${fy}) scale(${k}) translate(${-pose.x},${-fy})`}>
      <Body t={t} pose={pose} kind="gold" dir={dir} eyes="open" mouth="smile" glow={0.7} holdN={ball ? <g transform="translate(0,6) scale(1.5)"><Ball /></g> : undefined} />
    </g>
  );
};

// ================================================================== cenas
// S0 DIA 1: close no caderno, a mão dourada escrevendo o motivo (legível desde o quadro 0)
const S0 = (t: number) => <Page t={t} reveal={kfT(t, [[0, 0.22], [2.6, 1.0], [3.2, 1.25]])} glow={1} />;
const C0 = (): Cam => ({ cx: 540, cy: 630, z: 1, screen: true });

// S1 os dias passam: notificações, ele fica cinza, o caderno vai para a gaveta
const DAY_JUMPS = [0.0, 1.1, 2.2, 3.3];
const S1 = (t: number) => {
  const k = 1 - er(t, 0.6, 3.6);
  const drawer = er(t, 3.4, 3.8) * (1 - er(t, 4.5, 4.9));
  const slide = er(t, 3.7, 4.3);
  const noteX = lerp(120, 150, slide);
  const noteY = lerp(345, 383, slide);
  return (
    <g>
      <Living t={t} drawer={drawer} night={1} shoes="none" />
      <rect x={-200} y={-200} width={1480} height={1000} fill="#0b0d1e" opacity={0.25 + (1 - k) * 0.2} />
      <Duo k={k} t={t} pose={SIT_PHONE5} eyes={["droopy", "down"]} mouth={["frown", "flat"]} glow={0.6} holdN={<Phone scroll={t * 2} />} />
      {slide < 0.95 && <g transform={`translate(${noteX},${noteY})`} opacity={1 - ramp(slide, 0.75, 0.95)}><NoteClosed rot={slide * 10} /></g>}
      {[0.3, 0.7, 1.1, 1.5, 1.9, 2.3, 2.7, 3.1].map((a, i) => <Notif key={i} i={i} x={[480, 640, 520, 610, 470, 650, 560, 540][i]} y={[200, 220, 150, 140, 250, 270, 110, 240][i]} rot={[-6, 5, 3, -4, 8, -7, 2, -3][i]} p={t - a} />)}
    </g>
  );
};
const C1 = (t: number): Cam => ({ cx: kfT(t, [[0, 520], [3.2, 520], [3.8, 240], [5.4, 240]]), cy: 0, z: kfT(t, [[0, 2.0], [3.2, 2.0], [3.8, 2.3]]) });

// S2 DIA 247 à noite: afundado no sofá, celular, tênis no canto; "PRA QUÊ?"
const SOFA = P(590, 376, 160, [25, 70], [10, 100], [95, 10], [85, 5]);
const S2 = (t: number) => {
  const q = backPop(t - 2.6); // v11: entra junto com "pra que" na voz do Fish
  return (
    <g>
      <Living t={t} drawer={0} night={1} />
      <rect x={-200} y={-200} width={1480} height={1000} fill="#0b0d1e" opacity={0.45} />
      <defs><radialGradient id="ph5" cx="640" cy="300" r="200" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#7cc4ff" stopOpacity={0.45} /><stop offset="1" stopColor="#7cc4ff" stopOpacity={0} /></radialGradient></defs>
      <rect x={-200} y={-200} width={1480} height={1000} fill="url(#ph5)" style={{ mixBlendMode: "screen" }} />
      <Body t={t} pose={SOFA} kind="gray" eyes="droopy" red mouth="frown" messy holdN={<Phone scroll={t * 1.5} rot={-20} />} />
      {q > 0 && (
        <g transform={`translate(590,214) scale(${q * 0.92})`}>
          <circle cx={-46} cy={74} r={6} fill="#f4f1ea" stroke="#2a2836" strokeWidth={2} />
          <circle cx={-30} cy={52} r={10} fill="#f4f1ea" stroke="#2a2836" strokeWidth={2} />
          <ellipse cx={0} cy={-6} rx={112} ry={58} fill="#f4f1ea" stroke="#2a2836" strokeWidth={3} />
          <text x={0} y={-14} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={32} fill="#2a2836">PRA QUE VOU</text>
          <text x={0} y={22} textAnchor="middle" fontFamily={BARLOW} fontWeight={700} fontSize={32} fill="#2a2836">FAZER ISSO?</text>
        </g>
      )}
    </g>
  );
};
const C2 = (t: number): Cam => ({ cx: kfT(t, [[0, 600], [4, 610]]), cy: 0, z: kfT(t, [[0, 2.1], [4, 2.3]]) });

// S3 abre a gaveta, acha o caderno; close na frase; o filho aparece na porta com a bola
const PG = 1.7, KID = 3.4;
const S3 = (t: number) => {
  if (t >= PG && t < KID) return <Page t={t} reveal={1.3} glow={er(t, PG, KID)} hand={false} gray={0.35 * (1 - er(t, PG, KID))} />;
  if (t >= KID) {
    // v6: corte para a mesa de estudo esperando por ele (luminária acende, livro brilha)
    return (
      <g>
        <Living t={t} drawer={0} night={1} shoes="none" sofa={false} />
        <rect x={-200} y={-200} width={1480} height={1000} fill="#0b0d1e" opacity={0.3} />
        <StudyChair />
        <Desk t={t} lamp={er(t, KID + 0.3, KID + 0.6)} glow={er(t, KID + 0.5, KID + 1.2)} />
      </g>
    );
  }
  const drawer = er(t, 0.15, 0.6);
  const take = er(t, 0.7, 1.1);
  const pose = mixPose(P(240, 342, 180, [-8, -4], [8, 4], [-4, 0], [4, 0]), P(240, 342, 162, [30, 20], [40, 30], [-4, 0], [4, 0]), Math.max(drawer, 0) * (1 - take * 0.6));
  return (
    <g>
      <Living t={t} drawer={drawer} night={1} />
      <rect x={-200} y={-200} width={1480} height={1000} fill="#0b0d1e" opacity={0.4} />
      {take < 0.5 && <g transform={`translate(${105 + 45},${380})`}><NoteClosed /></g>}
      <g transform={`translate(${240 * 2},0) scale(-1,1)`}>
        <Body t={t} pose={pose} kind="gray" dir={1} eyes="down" mouth="flat" messy holdN={take >= 0.5 ? <NoteClosed rot={-20} /> : undefined} />
      </g>
      {take > 0.5 && <circle cx={200} cy={300} r={20 + take * 20} fill={GOLD} opacity={0.35 * take} filter="url(#glowGold)" />}
    </g>
  );
};
const C3 = (t: number): Cam => t >= PG && t < KID ? { cx: 540, cy: 630, z: 1, screen: true } : t >= KID ? { cx: 690, cy: 0, z: 2.2 } : { cx: 200, cy: 0, z: 2.3 };

// S4 (v6) volta a ficar dourado (o brilho nasce do caderno) e senta para estudar; amanhecer na janela
const SIT_AT = 1.4;
const S4 = (t: number) => {
  const k = er(t, 0.2, 1.3);
  if (t < SIT_AT) {
    const ring = er(t, 0.1, 1.2);
    return (
      <g>
        <Living t={t} drawer={0} night={1} shoes="none" sofa={false} />
        <rect x={-200} y={-200} width={1480} height={1000} fill="#0b0d1e" opacity={0.35 - k * 0.2} />
        <StudyChair />
        <Desk t={t} lamp={1} glow={1} />
        {ring > 0 && ring < 1 && <circle cx={575} cy={300} r={20 + ring * 260} fill="none" stroke={GOLD} strokeWidth={8 * (1 - ring)} opacity={1 - ring} />}
        <Duo k={k} t={t} pose={P(470, 342, 180, [10, 60], [20, 70], [-4, 0], [4, 0])} eyes={["down", "open"]} mouth={["flat", "smile"]} glow={1} holdN={<NoteClosed rot={-30} />} />
      </g>
    );
  }
  const w = t - SIT_AT;
  const flip = [1.2, 2.4].map((a) => ramp(w, a, a + 0.4)).reduce((acc, v) => acc + (v > 0 && v < 1 ? v : 0), 0);
  const write = Math.sin(w * 14) * 3;
  return (
    <g>
      <Living t={t} drawer={0} night={1 - er(w, 0.3, 2.5)} shoes="none" sofa={false} />
      <rect x={-200} y={-200} width={1480} height={1000} fill="#ffd28a" opacity={er(w, 0.3, 2.5) * 0.08} />
      <StudyChair />
      <Body t={t} pose={{ ...STUDY, aN: [STUDY.aN[0] + write, STUDY.aN[1]] as [number, number] }} kind="gold" dir={1} eyes="down" mouth="smile" glow={0.9} holdN={<line x1={0} y1={0} x2={6} y2={-14} stroke="#2a2836" strokeWidth={3} strokeLinecap="round" />} />
      <Desk t={t} lamp={1} flip={flip} glow={0.8} />
      <g transform="translate(150,330)"><NoteClosed /></g>
    </g>
  );
};
const C4 = (t: number): Cam => t < SIT_AT ? { cx: 600, cy: 0, z: 2.1 } : { cx: kfT(t, [[SIT_AT, 640], [5, 650]]), cy: 0, z: kfT(t, [[SIT_AT, 2.2], [5, 2.4]]) };

// S5 frase final grande no centro
const S5 = (t: number) => (
  <g>
    <Dawn t={t} scroll={140 + t * 40} />
    <rect x={-200} y={-200} width={1480} height={1000} fill="#07080f" opacity={0.55} />
  </g>
);
const C5 = (): Cam => ({ cx: 590, cy: 0, z: 2.0 });

const SCENES: [(t: number) => React.ReactNode, (t: number) => Cam][] = [[S0, C0], [S1, C1], [S2, C2], [S3, C3], [S4, C4], [S5, C5]];

// ------------------------------------------------------------------ selo DIA X
const dayAt = (s: number, lt: number) => {
  if (s === 0) return 1;
  if (s === 1) { const j = DAY_JUMPS.filter((a) => lt >= a).length; return [30, 90, 180, 247][Math.max(0, j - 1)]; }
  if (s === 2 || s === 3) return 247;
  return 248;
};
const DaySeal: React.FC<{ s: number; lt: number }> = ({ s, lt }) => {
  if (s === 5) return null;
  const d = dayAt(s, lt);
  const color = d === 1 ? WHITE : d >= 248 ? GOLD : "#9a97a8";
  const jump = s === 1 ? Math.max(0, ...DAY_JUMPS.map((a) => (lt >= a && lt < a + 0.25 ? 1 - (lt - a) / 0.25 : 0))) : 0;
  return (
    <div style={{ position: "absolute", top: 372, right: 210, transform: `scale(${1 + jump * 0.15})`, transformOrigin: "right center", padding: "6px 18px", borderRadius: 12, background: "#07080fcc", border: `4px solid ${color}`, fontFamily: BARLOW, fontWeight: 700, fontSize: 48, letterSpacing: 2, color }}>
      DIA {d}
    </div>
  );
};

// ------------------------------------------------------------------ legenda palavra por palavra
const Caption: React.FC<{ t: number }> = ({ t }) => {
  const s = sceneOf(t);
  const ln = LINES[s];
  if (!ln || !ln[4]) return null;
  const [txt, id, st, dur] = ln;
  const t0 = ST[s] + st;
  const words = txt.split(" ");
  const total = txt.replace(/ /g, "").length;
  let acc = 0;
  const real = WORDT[id];
  const times = real && real.length === words.length ? real.map((v) => t0 + v) : words.map((w) => { const a = t0 + (acc / total) * dur; acc += w.length; return a; });
  const chunks: number[][] = [];
  let cur: number[] = [], len = 0;
  words.forEach((w, i) => { if (len + w.length > 22 && cur.length) { chunks.push(cur); cur = []; len = 0; } cur.push(i); len += w.length + 1; if (/[.!?:,]$/.test(w) && len > 8) { chunks.push(cur); cur = []; len = 0; } });
  if (cur.length) chunks.push(cur);
  const idx = Math.max(0, chunks.findIndex((c, i) => t < (chunks[i + 1] ? times[chunks[i + 1][0]] : 1e9)));
  if (t < t0 - 0.05 || t > t0 + dur + 0.6) return null;
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
  const Z = 1.25;
  const vw = c.screen ? VIEW_W : VIEW_W / (c.z * Z), vh = c.screen ? VIEW_H : VIEW_H / (c.z * Z);
  const cx = c.screen ? 540 : c.cx;
  const cy = c.screen ? 630 : 442 - 330 / (c.z * Z); // chão sempre acima da legenda
  const flash = s > 0 ? Math.max(0, 1 - lt / 0.14) * 0.2 : 0;
  const dayFlash = s === 1 ? Math.max(0, ...DAY_JUMPS.slice(1).map((a) => (lt >= a && lt < a + 0.12 ? 1 - (lt - a) / 0.12 : 0))) * 0.25 : 0;
  const LAST = SCENES.length - 1;
  const f1 = s === LAST ? er(lt, 0.15, 0.55) : 0;
  const hookOut = s === LAST ? er(lt, 0, 0.25) : 0;
  return (
    <AbsoluteFill style={{ background: "#07080f" }}>
      {LINES.map((ln, i) => ln && (
        <Sequence key={i} from={Math.round((ST[i] + ln[2]) * fps)}><Audio src={staticFile(`${VOICE_DIR}/n${ln[1]}.wav`)} /></Sequence>
      ))}
      <Audio src={staticFile("por_que_comecou/sfx.wav")} volume={0.4} />
      <div style={{ position: "absolute", left: 0, top: SCENE_Y, width: 1080, height: VIEW_H, overflow: "hidden" }}>
        <svg width={1080} height={VIEW_H} viewBox={`${cx - vw / 2} ${cy - vh / 2} ${vw} ${vh}`}>
          <defs>
            <filter id="glowGold" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={7} /></filter>
          </defs>
          {draw(lt)}
        </svg>
        <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash + dayFlash }} />
        <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 140px rgba(0,0,0,.75)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 140, background: "linear-gradient(#07080f, rgba(7,8,15,0))" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 330, background: "linear-gradient(rgba(7,8,15,0), #07080f)" }} />
      </div>
      {/* frase fixa em cima */}
      <div style={{ position: "absolute", top: 228, left: 120, right: 120, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 56, lineHeight: 1.02, letterSpacing: 2, textShadow: "0 3px 0 rgba(0,0,0,.6)", opacity: 1 - hookOut }}>
        <div style={{ color: WHITE }}>{HOOK[0]}</div>
        <div style={{ color: GOLD }}>{HOOK[1]}</div>
      </div>
      <DaySeal s={s} lt={lt} />
      {/* final: a frase de cima vira a frase grande no centro */}
      {s === LAST && (
        <div style={{ position: "absolute", left: 120, right: 120, top: 760 - (1 - f1) * 420, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, letterSpacing: 2, lineHeight: 1.04, opacity: Math.max(f1, 0.001), transform: `scale(${lerp(0.62, 1, f1)})` }}>
          <div style={{ fontSize: 88, color: WHITE, WebkitTextStroke: "10px #07080f", paintOrder: "stroke fill" }}>QUANDO DER<br />VONTADE DE PARAR,</div>
          <div style={{ marginTop: 18, fontSize: 88, color: GOLD, WebkitTextStroke: "10px #07080f", paintOrder: "stroke fill" }}>LEMBRE POR QUE<br />COMEÇOU.</div>
        </div>
      )}
      <Caption t={t} />
    </AbsoluteFill>
  );
};
