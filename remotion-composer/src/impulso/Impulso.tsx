import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// ==================================================================
// IMPULSO — estilingue gravitacional. Duas naves de luz rumo a uma estrela:
// a dourada vai reto, na mesma velocidade; a azul desvia, contorna dois planetas,
// ganha impulso na gravidade de cada um e chega primeiro. Sem texto. Loop.
// ==================================================================
export const TOTAL = 14.0;
const T_BLUE = 10.6, T_GOLD = 11.9, T_RESET = 13.3;
const GOLD = "#F2C14E", BLUE = "#53D2FF", WHITE = "#F4F8FF";
type V = [number, number];
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (x: number) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const kf = (t: number, keys: [number, number][]) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) { const [t0, v0] = keys[i - 1]; const u = (t - t0) / (t1 - t0); return lerp(v0, v1, u); }
  }
  return keys[keys.length - 1][1];
};
// gerador pseudo-aleatório fixo
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------------- mundo
const START_B: V = [-70, 0], START_G: V = [70, 0];
const STAR: V = [0, -4100];
const P1 = { c: [-720, -1180] as V, r: 230 };
const P2 = { c: [690, -2620] as V, r: 200 };
// caminho da azul (Catmull-Rom pelos pontos): cai no planeta 1, contorna por fora, vai ao planeta 2, contorna, segue à estrela
const WP: V[] = [START_B, [-140, -380], [-430, -820], [-830, -870], [-1030, -1120], [-960, -1420], [-640, -1520], [-250, -1730], [200, -2180], [470, -2390], [930, -2460], [980, -2760], [700, -2950], [330, -3300], [80, -3750], STAR];
const catmull = (p0: V, p1: V, p2: V, p3: V, u: number): V => {
  const u2 = u * u, u3 = u2 * u;
  const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
};
const PATH: V[] = (() => {
  const pts: V[] = [];
  const P = [WP[0], ...WP, WP[WP.length - 1]];
  for (let i = 0; i < P.length - 3; i++) for (let k = 0; k < 120; k++) pts.push(catmull(P[i], P[i + 1], P[i + 2], P[i + 3], k / 120));
  pts.push(STAR);
  return pts;
})();
const CUM: number[] = (() => { const c = [0]; for (let i = 1; i < PATH.length; i++) c.push(c[i - 1] + Math.hypot(PATH[i][0] - PATH[i - 1][0], PATH[i][1] - PATH[i - 1][1])); return c; })();
const LEN = CUM[CUM.length - 1];
const atLen = (s: number): V => {
  s = Math.max(0, Math.min(LEN, s));
  let lo = 0, hi = CUM.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (CUM[m] < s) lo = m; else hi = m; }
  const k = (s - CUM[lo]) / Math.max(1e-6, CUM[hi] - CUM[lo]);
  return [lerp(PATH[lo][0], PATH[hi][0], k), lerp(PATH[lo][1], PATH[hi][1], k)];
};
// fração do caminho percorrida pela azul no tempo (devagar caindo, acelera no planeta, impulso na saída)
const BLUE_KEYS: [number, number][] = [[0, 0], [1.0, 0.035], [2.4, 0.11], [3.6, 0.2], [4.6, 0.3], [5.6, 0.4], [6.8, 0.53], [7.7, 0.63], [8.6, 0.75], [9.6, 0.88], [T_BLUE, 1]];
const blueFrac = (t: number) => {
  // spline monótona simples sobre os pontos (interpolação suave por trecho com derivadas médias)
  const K = BLUE_KEYS;
  if (t <= 0) return 0; if (t >= T_BLUE) return 1;
  let i = 1; while (K[i][0] < t) i++;
  const [t0, v0] = K[i - 1], [t1, v1] = K[i];
  const d = (j: number) => { const a = K[Math.max(0, j - 1)], b = K[Math.min(K.length - 1, j + 1)]; return (b[1] - a[1]) / (b[0] - a[0]); };
  const h = t1 - t0, u = (t - t0) / h;
  const m0 = d(i - 1) * h, m1 = d(i) * h;
  return (2 * u ** 3 - 3 * u ** 2 + 1) * v0 + (u ** 3 - 2 * u ** 2 + u) * m0 + (-2 * u ** 3 + 3 * u ** 2) * v1 + (u ** 3 - u ** 2) * m1;
};
const bluePos = (t: number): V => atLen(blueFrac(t) * LEN);
const goldPos = (t: number): V => { const k = clamp01(t / T_GOLD); return [lerp(START_G[0], STAR[0] + 30, k), lerp(START_G[1], STAR[1] + 40, k)]; };
const speedOf = (f: (t: number) => V, t: number) => { const a = f(t - 0.05), b = f(t + 0.05); return Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1; };
const headingOf = (f: (t: number) => V, t: number) => { const a = f(t - 0.04), b = f(t + 0.04); return Math.atan2(b[1] - a[1], b[0] - a[0]); };
// momentos de impulso (saída de cada planeta)
const BOOSTS = [5.55, 8.55];

// ---------------- câmera: segue as duas naves e enquadra a corrida (dentro da área segura)
type Cam = { x: number; y: number; z: number };
const rawCam = (t: number): Cam => {
  const tt = Math.min(t, T_GOLD + 0.2);
  const b = bluePos(tt), g = goldPos(tt);
  const xs = [b[0], g[0]], ys = [b[1], g[1]];
  // inclui o planeta mais próximo da azul para mostrar a "queda"
  for (const P of [P1, P2]) { const d = Math.hypot(b[0] - P.c[0], b[1] - P.c[1]); if (d < 900) { xs.push(P.c[0] - P.r, P.c[0] + P.r); ys.push(P.c[1] - P.r, P.c[1] + P.r); } }
  if (tt > 9.3) { xs.push(STAR[0]); ys.push(STAR[1]); }
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const w = maxx - minx + 420, h = maxy - miny + 520;
  const z = Math.max(0.32, Math.min(1.05, Math.min(840 / w, 1250 / h)));
  return { x: (minx + maxx) / 2, y: (miny + maxy) / 2 - 40 / z, z };
};
const camAt = (t: number): Cam => {
  // média de vários instantes para a câmera ficar macia
  let x = 0, y = 0, z = 0, n = 0;
  for (let k = -12; k <= 12; k++) { const w = 1 - Math.abs(k) / 13; const c = rawCam(Math.max(0, t + k * 0.06)); x += c.x * w; y += c.y * w; z += c.z * w; n += w; }
  return { x: x / n, y: y / n, z: z / n };
};

// ---------------- desenho
const Stars: React.FC<{ cam: Cam; t: number }> = ({ cam, t }) => (
  <g>
    {[0.15, 0.35, 0.6].map((par, L) => (
      <g key={L}>
        {Array.from({ length: 140 }).map((_, i) => {
          const id = L * 1000 + i;
          const sx = rnd(id) * 2600 - 760, sy = rnd(id + 7) * 3800 - 950;
          // paralaxe: estrelas distantes andam menos que a câmera
          const x = ((sx - cam.x * par * cam.z) % 2600 + 2600) % 2600 - 760;
          const y = ((sy - cam.y * par * cam.z) % 3800 + 3800) % 3800 - 950;
          const tw = 0.55 + 0.45 * Math.sin(t * (1.5 + rnd(id + 3) * 3) + id);
          const r = (0.6 + rnd(id + 5) * 1.6) * (0.6 + L * 0.5);
          return <circle key={i} cx={x} cy={y} r={r} fill={rnd(id + 9) > 0.85 ? "#ffd9a8" : "#dfe9ff"} opacity={(0.35 + L * 0.25) * tw} />;
        })}
      </g>
    ))}
  </g>
);
const Nebula: React.FC<{ cam: Cam }> = ({ cam }) => {
  const ox = -cam.x * 0.08 * cam.z, oy = -cam.y * 0.08 * cam.z;
  return (
    <g style={{ mixBlendMode: "screen" }}>
      <defs>
        <radialGradient id="nb1"><stop offset="0" stopColor="#6a2bd9" stopOpacity={0.35} /><stop offset="1" stopColor="#6a2bd9" stopOpacity={0} /></radialGradient>
        <radialGradient id="nb2"><stop offset="0" stopColor="#0fb5c9" stopOpacity={0.28} /><stop offset="1" stopColor="#0fb5c9" stopOpacity={0} /></radialGradient>
        <radialGradient id="nb3"><stop offset="0" stopColor="#d9467a" stopOpacity={0.22} /><stop offset="1" stopColor="#d9467a" stopOpacity={0} /></radialGradient>
      </defs>
      <ellipse cx={200 + ox} cy={500 + (oy % 1600)} rx={700} ry={520} fill="url(#nb1)" />
      <ellipse cx={900 + ox * 0.7} cy={1300 + (oy * 0.7) % 1800} rx={640} ry={700} fill="url(#nb2)" />
      <ellipse cx={500 + ox * 1.2} cy={((oy * 1.2) % 2400 + 2400) % 2400 - 300} rx={600} ry={420} fill="url(#nb3)" />
    </g>
  );
};
const Planet: React.FC<{ c: V; r: number; t: number; kind: number; pull: number }> = ({ c, r, t, kind, pull }) => {
  const id = `pl${kind}`;
  const base = kind === 0 ? ["#ffb36b", "#d9573a", "#5a1830"] : ["#9ff3ff", "#2f8fd8", "#0b2050"];
  return (
    <g>
      <defs>
        <radialGradient id={`${id}g`} cx="0.35" cy="0.3" r="0.85"><stop offset="0" stopColor={base[0]} /><stop offset="0.55" stopColor={base[1]} /><stop offset="1" stopColor={base[2]} /></radialGradient>
        <radialGradient id={`${id}a`}><stop offset="0.72" stopColor={base[1]} stopOpacity={0.55} /><stop offset="1" stopColor={base[1]} stopOpacity={0} /></radialGradient>
        <clipPath id={`${id}c`}><circle cx={c[0]} cy={c[1]} r={r} /></clipPath>
      </defs>
      {/* poço de gravidade: anéis que puxam para dentro */}
      {[0, 1, 2, 3, 4].map((i) => {
        const q = ((t * 0.45 + i / 5) % 1);
        const rr = r * (3.4 - q * 2.2);
        return <circle key={i} cx={c[0]} cy={c[1]} r={rr} fill="none" stroke={base[0]} strokeWidth={3 + pull * 4} strokeDasharray="10 18" opacity={(0.1 + pull * 0.35) * Math.sin(q * Math.PI)} />;
      })}
      <circle cx={c[0]} cy={c[1]} r={r * 1.35} fill={`url(#${id}a)`} />
      <circle cx={c[0]} cy={c[1]} r={r} fill={`url(#${id}g)`} />
      <g clipPath={`url(#${id}c)`} opacity={0.35}>
        {kind === 0
          ? [-0.6, -0.3, 0.05, 0.35, 0.62].map((k, i) => <path key={i} d={`M${c[0] - r * 1.2},${c[1] + k * r + Math.sin(t * 0.6 + i) * 6} Q${c[0]},${c[1] + k * r - 30} ${c[0] + r * 1.2},${c[1] + k * r + 10}`} stroke={i % 2 ? "#ffd2a0" : "#7a2030"} strokeWidth={r * 0.13} fill="none" />)
          : [[-0.3, -0.25, 0.18], [0.35, 0.1, 0.12], [-0.05, 0.45, 0.1], [0.2, -0.5, 0.08]].map(([dx, dy, rr], i) => <circle key={i} cx={c[0] + dx * r} cy={c[1] + dy * r} r={rr * r} fill="#0b2a60" opacity={0.7} />)}
      </g>
      {/* terminador (sombra do lado de fora da luz) */}
      <circle cx={c[0] + r * 0.35} cy={c[1] + r * 0.35} r={r * 1.05} fill="#000" opacity={0.35} clipPath={`url(#${id}c)`} />
      {kind === 0 && (
        <g>
          <ellipse cx={c[0]} cy={c[1]} rx={r * 1.75} ry={r * 0.36} fill="none" stroke="#ffe0b8" strokeWidth={10} opacity={0.45} transform={`rotate(-18 ${c[0]} ${c[1]})`} />
          <ellipse cx={c[0]} cy={c[1]} rx={r * 1.55} ry={r * 0.3} fill="none" stroke="#ff9f6a" strokeWidth={5} opacity={0.4} transform={`rotate(-18 ${c[0]} ${c[1]})`} />
        </g>
      )}
    </g>
  );
};
const Star: React.FC<{ t: number; hit: number; hit2: number }> = ({ t, hit, hit2 }) => (
  <g>
    <defs>
      <radialGradient id="star"><stop offset="0" stopColor="#ffffff" /><stop offset="0.25" stopColor="#fff2c4" /><stop offset="1" stopColor="#ffb84a" stopOpacity={0} /></radialGradient>
    </defs>
    <circle cx={STAR[0]} cy={STAR[1]} r={360 + Math.sin(t * 3) * 14} fill="url(#star)" opacity={0.9} />
    {Array.from({ length: 12 }).map((_, i) => { const a = (i / 12) * Math.PI * 2 + t * 0.15; const L = 420 + (i % 2) * 240; return <line key={i} x1={STAR[0]} y1={STAR[1]} x2={STAR[0] + Math.cos(a) * L} y2={STAR[1] + Math.sin(a) * L} stroke="#fff3cf" strokeWidth={i % 2 ? 3 : 6} opacity={0.25} />; })}
    <circle cx={STAR[0]} cy={STAR[1]} r={70} fill="#fff" />
    {hit > 0 && hit < 1 && <circle cx={STAR[0]} cy={STAR[1]} r={80 + hit * 900} fill="none" stroke={BLUE} strokeWidth={30 * (1 - hit)} opacity={1 - hit} />}
    {hit2 > 0 && hit2 < 1 && <circle cx={STAR[0]} cy={STAR[1]} r={80 + hit2 * 600} fill="none" stroke={GOLD} strokeWidth={20 * (1 - hit2)} opacity={1 - hit2} />}
  </g>
);
const Trail: React.FC<{ f: (t: number) => V; t: number; color: string; z: number; tEnd: number }> = ({ f, t, color, z, tEnd }) => {
  // rastro contínuo: várias faixas sobrepostas, cada uma mais curta e mais grossa (brilho no núcleo)
  const tt = Math.min(t, tEnd);
  const fade = t > tEnd ? Math.max(0, 1 - (t - tEnd) * 0.6) : 1;
  const pts = (dur: number) => { const n = 60, out: string[] = []; for (let k = 0; k <= n; k++) { const p = f(Math.max(0, tt - (k / n) * dur)); out.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`); } return out.join(" "); };
  const bands: [number, number, number][] = [[2.2, 6, 0.18], [1.5, 12, 0.22], [0.9, 18, 0.35], [0.45, 26, 0.5], [0.18, 34, 0.8]];
  return (
    <g style={{ mixBlendMode: "screen" }} opacity={fade}>
      {bands.map(([d, w, o], i) => <polyline key={i} points={pts(d)} fill="none" stroke={i === 4 ? "#ffffff" : color} strokeWidth={w / Math.sqrt(z)} strokeLinecap="round" strokeLinejoin="round" opacity={o} />)}
    </g>
  );
};
const Ship: React.FC<{ p: V; ang: number; color: string; z: number; boost: number; t: number }> = ({ p, ang, color, z, boost, t }) => {
  const s = 1.15 / Math.sqrt(z);
  const fl = 1 + 0.25 * Math.sin(t * 60) + boost * 1.6;
  return (
    <g transform={`translate(${p[0]},${p[1]}) rotate(${(ang * 180) / Math.PI + 90}) scale(${s})`}>
      <ellipse cx={0} cy={34} rx={10 + boost * 6} ry={26 * fl} fill={color} opacity={0.75} style={{ filter: "blur(4px)" }} />
      <ellipse cx={0} cy={30} rx={5} ry={14 * fl} fill="#fff" opacity={0.9} />
      <circle cx={0} cy={0} r={46 + boost * 30} fill={color} opacity={0.18 + boost * 0.2} />
      <path d="M0,-34 L16,10 L30,24 L10,20 L0,28 L-10,20 L-30,24 L-16,10 Z" fill="#0d1424" stroke={color} strokeWidth={4} strokeLinejoin="round" />
      <path d="M0,-24 L7,4 L0,10 L-7,4 Z" fill={color} />
      <circle cx={0} cy={-8} r={3.5} fill="#fff" />
    </g>
  );
};
// barras de velocidade (sem texto): dourada × azul
const Hud: React.FC<{ vb: number; vg: number; t: number; fade: number }> = ({ vb, vg, t, fade }) => {
  const max = 900;
  const bar = (x: number, v: number, color: string) => {
    const k = clamp01(v / max);
    return (
      <g transform={`translate(${x},250)`}>
        <rect x={0} y={0} width={300} height={22} rx={11} fill="#ffffff10" stroke={color} strokeOpacity={0.5} strokeWidth={2} />
        <rect x={3} y={3} width={294 * k} height={16} rx={8} fill={color} style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
        {Array.from({ length: 10 }).map((_, i) => <rect key={i} x={30 * i + 28} y={4} width={2} height={14} fill="#0a0f1e" opacity={0.6} />)}
        <circle cx={-22} cy={11} r={9} fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      </g>
    );
  };
  return <g opacity={fade}>{bar(160, vg, GOLD)}{bar(620, vb, BLUE)}{void t}</g>;
};

export const Impulso: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const T = frame / fps;
  // reinício em loop: no fim tudo rebobina rápido até o começo
  const rw = clamp01((T - T_RESET) / (TOTAL - T_RESET));
  const t = T < T_RESET ? T : lerp(T_RESET, 0, smooth(rw));
  const cam = camAt(t);
  const b = bluePos(Math.min(t, T_BLUE)), g = goldPos(Math.min(t, T_GOLD));
  const vb = t < T_BLUE ? speedOf(bluePos, t) : 0, vg = t < T_GOLD ? speedOf(goldPos, t) : 0;
  const boost = Math.max(0, ...BOOSTS.map((bt) => Math.max(0, 1 - Math.abs(t - bt) / 0.5)));
  const pull1 = clamp01(1 - Math.hypot(b[0] - P1.c[0], b[1] - P1.c[1]) / 700), pull2 = clamp01(1 - Math.hypot(b[0] - P2.c[0], b[1] - P2.c[1]) / 650);
  const hit = clamp01((t - T_BLUE) / 0.9) * (t >= T_BLUE ? 1 : 0), hit2 = clamp01((t - T_GOLD) / 0.8) * (t >= T_GOLD ? 1 : 0);
  const flash = t >= T_BLUE ? Math.max(0, 1 - (t - T_BLUE) / 0.35) * 0.4 : 0;
  const bflash = Math.max(...BOOSTS.map((bt) => (t >= bt ? Math.max(0, 1 - (t - bt) / 0.25) : 0))) * 0.07;
  const shake = boost * 6;
  return (
    <AbsoluteFill style={{ background: "#03050c" }}>
      <Audio src={staticFile("impulso/sfx.wav")} volume={0.6} />
      <svg width={1080} height={1920} viewBox="0 0 1080 1920">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#050818" /><stop offset="0.5" stopColor="#0a0f2a" /><stop offset="1" stopColor="#04060f" /></linearGradient>
          <radialGradient id="vig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stopColor="#000" stopOpacity={0} /><stop offset="1" stopColor="#000" stopOpacity={0.7} /></radialGradient>
        </defs>
        <rect width={1080} height={1920} fill="url(#bg)" />
        <Nebula cam={cam} />
        <Stars cam={cam} t={T} />
        <g transform={`translate(${540 + Math.sin(T * 70) * shake},${900 + Math.cos(T * 63) * shake}) scale(${cam.z}) translate(${-cam.x},${-cam.y})`}>
          <Star t={T} hit={hit} hit2={hit2} />
          <Planet c={P1.c} r={P1.r} t={T} kind={0} pull={pull1} />
          <Planet c={P2.c} r={P2.r} t={T} kind={1} pull={pull2} />
          {/* rota reta da dourada, tracejada e quase invisível */}
          <line x1={START_G[0]} y1={START_G[1]} x2={STAR[0] + 30} y2={STAR[1] + 40} stroke={GOLD} strokeWidth={3 / cam.z} strokeDasharray={`${14 / cam.z} ${22 / cam.z}`} opacity={0.18} />
          <Trail f={goldPos} t={t} color={GOLD} z={cam.z} tEnd={T_GOLD} />
          <Trail f={bluePos} t={t} color={BLUE} z={cam.z} tEnd={T_BLUE} />
          {/* onda de choque no impulso */}
          {BOOSTS.map((bt, i) => { const q = (t - bt) / 0.8; if (q < 0 || q > 1) return null; const p = bluePos(bt); return <circle key={i} cx={p[0]} cy={p[1]} r={40 + q * 420} fill="none" stroke={BLUE} strokeWidth={(18 * (1 - q)) / cam.z + 2} opacity={1 - q} />; })}
          {t < T_GOLD + 0.1 && <Ship p={g} ang={headingOf(goldPos, Math.min(t, T_GOLD - 0.05))} color={GOLD} z={cam.z} boost={0} t={T} />}
          {t < T_BLUE + 0.1 && <Ship p={b} ang={headingOf(bluePos, Math.min(t, T_BLUE - 0.05))} color={BLUE} z={cam.z} boost={boost} t={T} />}
        </g>
        {/* linhas de velocidade no impulso */}
        {boost > 0.05 && Array.from({ length: 26 }).map((_, i) => { const a = rnd(i) * Math.PI * 2; const r0 = 420 + rnd(i + 3) * 300; return <line key={i} x1={540 + Math.cos(a) * r0} y1={900 + Math.sin(a) * r0} x2={540 + Math.cos(a) * (r0 + 220 * boost)} y2={900 + Math.sin(a) * (r0 + 220 * boost)} stroke="#cdeeff" strokeWidth={3} opacity={boost * 0.5} />; })}
        <Hud vb={vb} vg={vg} t={T} fade={T < T_RESET ? 1 : 1 - rw} />
        <rect width={1080} height={1920} fill="url(#vig)" />
        <rect width={1080} height={1920} fill="#ffffff" opacity={flash + bflash} />
        {rw > 0 && <rect width={1080} height={1920} fill="#9fd8ff" opacity={Math.sin(rw * Math.PI) * 0.35} />}
      </svg>
    </AbsoluteFill>
  );
};
