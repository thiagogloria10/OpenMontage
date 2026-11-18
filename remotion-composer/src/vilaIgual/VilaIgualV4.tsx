import React from "react";
import { AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadSpaceGrotesk } from "../lib/localFonts";
import captionsData from "./captions_v4.json";
import { PixelArt } from "./Pixel";

const { fontFamily: HEAD } = loadSpaceGrotesk(["500", "700"]);
const MONO = "'JetBrains Mono', 'DejaVu Sans Mono', monospace";

const GOLD = "#E8B84A";
const ORANGE = "#ff9a2e";
const RED = "#e0554a";
const BLUE = "#7aa7e0";
const BG = "#121212";
const WHITE = "#f2f2f2";
const DIM = "#4a4a4a";

type Cap = { w: string; s: number; e: number; line: number; spk: boolean };
const CAPS = captionsData as Cap[];
export const TOTAL = CAPS[CAPS.length - 1].e + 2.2;

const L = (line: number) => CAPS.find((c) => c.line === line)!.s;
const W = (line: number, w: string, nth = 0) => {
  const m = CAPS.filter((x) => x.line === line && x.w.toLowerCase().replace(/[^a-zà-ú0-9]/g, "").startsWith(w.toLowerCase()));
  return m.length ? m[Math.min(nth, m.length - 1)].s : L(line);
};
const CHIME = 0.95; // o "ding-dong" toca antes da fala do alto-falante

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const useT = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return { t: frame / fps, frame, fps };
};
const ramp = (t: number, a: number, b: number) => interpolate(t, [a, b], [0, 1], clamp);
const sp = (t: number, at: number, fps: number, damping = 12, stiffness = 180) =>
  spring({ frame: Math.round((t - at) * fps), fps, config: { damping, stiffness } });

// ---------------------------------------------------------------- personagens
type Pal = Record<string, string>;
const basePal = (o: Partial<Pal>): Pal => ({
  H: "#2b1d14", S: "#d9a074", s: "#b9805a", E: "#141414", B: "#3d5a80", b: "#4f6f99", G: GOLD, P: "#1c2533", K: "#f2f2f2", M: "#8a5a3c", W: "#f0ece0", w: "#d8d2c0", ...o,
});
const PAL = {
  voce: basePal({}),
  valdir: basePal({ H: "#8a8a8a", B: "#4f7a4a", b: "#5f8f5a", G: "#3d5d39", P: "#5a4a3a" }),
  medico: basePal({ H: "#1a1a1a", B: "#e6e6e6", b: "#f4f4f4", G: BLUE, P: "#2a3a55" }),
  prof: basePal({ H: "#5a2e1e", B: "#b05a7a", b: "#c46d8d", G: "#f2f2f2", P: "#2d2d3d" }),
  mecanico: basePal({ H: "#3a2a1a", B: "#33496e", b: "#40598a", G: ORANGE, P: "#33496e" }),
  motorista: basePal({ H: "#151515", S: "#a8714d", s: "#8a5a3c", B: "#8a6a3a", b: "#a07c46", G: "#5a4424", P: "#2b2b2b" }),
  rosa: basePal({ H: "#6b4a3a", B: "#c0504d", b: "#d0605d", G: "#c0504d", P: "#4a3a3a", W: "#f0ece0", w: "#d8d2c0" }),
  rosaVelha: basePal({ H: "#b8b8b8", B: "#c0504d", b: "#d0605d", G: "#c0504d", P: "#4a3a3a" }),
  tiago: basePal({ H: "#2b1d14", B: "#4a6fa5", b: "#5a82bb", G: GOLD, P: "#2a2a2a" }),
  tiagoAvental: basePal({ H: "#2b1d14", B: "#4a6fa5", b: "#5a82bb", G: GOLD, P: "#2a2a2a" }),
  kid1: basePal({ H: "#d8b04a", B: "#7a9a4a", b: "#8aaa5a", G: "#5a7a3a" }),
  kid2: basePal({ H: "#151515", S: "#a8714d", s: "#8a5a3c", B: "#a04a8a", b: "#b05a9a", G: "#702a60" }),
  kid3: basePal({ H: "#7a3a1a", B: "#c08a3a", b: "#d09a4a", G: "#906020" }),
  cinza: basePal({ H: "#555", S: "#8a8a8a", s: "#6a6a6a", B: "#4a4a4a", b: "#5a5a5a", G: "#3a3a3a", P: "#333", K: "#888", M: "#555" }),
};

const BODY_IDLE = [
  "...BBBGBBB...",
  "..BBBBGBBBB..",
  ".BBbBBGBBbBB.",
  ".BB.BBBBB.BB.",
  ".BB.BBBBB.BB.",
  ".SS.BBBBB.SS.",
  "....BBBBB....",
  "....PP.PP....",
  "....PP.PP....",
  "....PP.PP....",
  "....PP.PP....",
  "...KKK.KKK...",
];
const BODY_APRON = [
  "...BBWWWBB...",
  "..BBBWWWBBB..",
  ".BBbWWWWWbBB.",
  ".BB.WWWWW.BB.",
  ".BB.WWwWW.BB.",
  ".SS.WWWWW.SS.",
  "....WWWWW....",
  "....PP.PP....",
  "....PP.PP....",
  "....PP.PP....",
  "....PP.PP....",
  "...KKK.KKK...",
];
const BODY_UP = [
  "...BBBGBBB...",
  "...BBBGBBB...",
  "...BbBGBbB...",
  "...BBBBBBB...",
  "...BBBBBBB...",
  "....BBBBB....",
  "....BBBBB....",
  "....PP.PP....",
  "....PP.PP....",
  "...PP...PP...",
  "...PP...PP...",
  "..KKK...KKK..",
];
const BODY_SIT = [
  "...BBBGBBB...",
  "..BBBBGBBBB..",
  ".BBbBBGBBbBB.",
  ".BBBBBBBBBBB.",
  "..SS.BGB.SS..",
  "....BBBBB....",
  "...PPPPPPP...",
  "...PP...PP...",
  "...PP...PP...",
  "..KKK...KKK..",
];
const HEAD_M = [
  "....HHHHH....",
  "...HHHHHHH...",
  "...HSSSSSH...",
  "...SSSSSSS...",
  "...SESSSES...",
  "...SSSSSSS...",
  "....SSMSS....",
  ".....sss.....",
];
const HEAD_F = [
  "....HHHHH....",
  "...HHHHHHH...",
  "..HHSSSSSHH..",
  "..HSSSSSSSH..",
  "..HSESSSESH..",
  "..HSSSSSSSH..",
  "..H.SSMSS.H..",
  ".....sss.....",
];
const HEAD_BUN = [
  ".....HHH.....",
  "....HHHHH....",
  "...HSSSSSH...",
  "...SSSSSSS...",
  "...SESSSES...",
  "...SSSSSSS...",
  "....SSMSS....",
  ".....sss.....",
];
const HEAD_SLEEPY = [
  "....HHHHH....",
  "...HHHHHHH...",
  "...HSSSSSH...",
  "...SSSSSSS...",
  "...SEESEES...",
  "...SSSSSSS...",
  "....SSSSS....",
  ".....sss.....",
];
const HEAD_ANGRY = [
  "....HHHHH....",
  "...HHHHHHH...",
  "...HEESEEH...",
  "...SSSSSSS...",
  "...SESSSES...",
  "...SSSSSSS...",
  "....SMMMS....",
  ".....sss.....",
];
const HEAD_LAUGH = [
  "....HHHHH....",
  "...HHHHHHH...",
  "...HSSSSSH...",
  "...SSSSSSS...",
  "...SEESEES...",
  "...SSSSSSS...",
  "....SMMMS....",
  ".....sMs.....",
];
const ARMS_UP_TOP = [".SS........SS", ".BB........BB", ".BB........BB"];

type Pose = "idle" | "up" | "sit" | "apron";
type HeadKind = "m" | "f" | "bun" | "sleepy" | "angry" | "laugh";
const HEADS: Record<HeadKind, string[]> = { m: HEAD_M, f: HEAD_F, bun: HEAD_BUN, sleepy: HEAD_SLEEPY, angry: HEAD_ANGRY, laugh: HEAD_LAUGH };

const grid = (pose: Pose, head: HeadKind) => {
  const h = HEADS[head];
  if (pose === "up") {
    const top = h.map((r, i) => (i < 3 ? ARMS_UP_TOP[i].split("").map((c, x) => (c !== "." ? c : r[x])).join("") : r));
    const t2 = top.map((r, i) => (i >= 3 && i < 6 ? "." + r.slice(1, 2).replace(/./, "B") + r.slice(2, 11) + "B." : r));
    return [...t2, ...BODY_UP];
  }
  if (pose === "sit") return [...h, ...BODY_SIT];
  if (pose === "apron") return [...h, ...BODY_APRON];
  return [...h, ...BODY_IDLE];
};

// visor de 7 segmentos na testa
const Visor: React.FC<{ value: string; size: number; color?: string; off?: boolean; pulse?: number }> = ({ value, size, color = ORANGE, off, pulse = 0 }) => (
  <div
    style={{
      position: "absolute",
      left: 3 * size - size * 0.3,
      top: -size * 1.1,
      width: 7 * size + size * 0.6,
      height: size * 2.4,
      background: "#0c0c0c",
      border: `${Math.max(2, size * 0.22)}px solid #2c2c2c`,
      borderRadius: size * 0.35,
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      paddingRight: size * 0.35,
      fontFamily: MONO,
      fontWeight: 800,
      fontSize: size * 1.75,
      letterSpacing: -size * 0.05,
      color: off ? "#2a2a2a" : color,
      textShadow: off ? "none" : `0 0 ${size * (0.6 + pulse)}px ${color}`,
      transform: `scale(${1 + pulse * 0.25})`,
    }}
  >
    {value}
  </div>
);

const Person: React.FC<{
  pal: Pal;
  pose?: Pose;
  head?: HeadKind;
  size?: number;
  x: number;
  y: number;
  visor?: string;
  visorColor?: string;
  visorOff?: boolean;
  visorPulse?: number;
  gray?: boolean;
  flip?: boolean;
  style?: React.CSSProperties;
  k?: number;
}> = ({ pal, pose = "idle", head = "m", size = 14, x, y, visor, visorColor, visorOff, visorPulse, gray, flip, style, k = PK }) => {
  const g = grid(pose, head);
  const w = 13 * size, h = g.length * size, sz = size * k;
  return (
    <div style={{ position: "absolute", left: x - ((k - 1) * w) / 2, top: y - (k - 1) * h, filter: gray ? "grayscale(1) brightness(0.75)" : undefined, transform: flip ? "scaleX(-1)" : undefined, ...style }}>
      <PixelArt grid={g} palette={pal} size={sz} />
      {visor !== undefined && <Visor value={visor} size={sz} color={visorColor} off={visorOff} pulse={visorPulse} />}
    </div>
  );
};
const PK = 1.5; // personagens 1,5x (pedido da análise), crescendo a partir dos pés

// ícones
const ICON_PAL: Pal = {
  R: "#c8553d", r: "#9a3f2c", W: "#e9e1cf", w: "#bfb6a2", D: "#3a2a20", Y: "#ffd27a", y: "#e8a33a", K: "#1a1a1a", B: "#c48a4a", b: "#9a6a34", G: GOLD, g: "#8a8a8a", N: "#6a8a5a", A: BLUE,
};
const HOUSE = (lit: boolean) => [
  "....RRR....",
  "...RRRRR...",
  "..RRRRRRR..",
  ".RRRRRRRRR.",
  "RRRRRRRRRRR",
  ".WWWWWWWWW.",
  ".W" + (lit ? "YY" : "KK") + "WWW" + (lit ? "YY" : "KK") + "W.",
  ".W" + (lit ? "YY" : "KK") + "WDW" + (lit ? "YY" : "KK") + "W.",
  ".WWWWDWWWW.",
  ".WWWWDWWWW.",
];
const BREAD = ["..BBBBBB..", ".BbBBbBBB.", "BBBBBBBBBB", "BbBBbBBbBB", ".BBBBBBBB."];
const BOOK = ["GGGGGGGGGG", "GWWWWWWWWG", "GGGGGGGGGG"];
const STAR = ["....G....", "...GGG...", "GGGGGGGGG", ".GGGGGGG.", "..GGGGG..", ".GG...GG.", "GG.....GG"];

// ---------------------------------------------------------------- cenas (tempos)
const S = {
  hook: 0,
  cofre: L(2) - 0.15,
  voce: L(3) - 0.15,
  domingo: L(4) - 0.15,
  zeca: L(5) - 0.15,
  conta: L(6) - 0.15,
  academia: L(7) - 0.15,
  semanas: L(8) - 0.15,
  parou: W(8, "você") - 0.15,
  jantar: L(9) - 0.15,
  espelho: L(10) - 0.15,
  vinha: L(11) - 0.15,
  manha: L(12) - 0.15,
  fim: L(13) - 0.15,
  end: TOTAL,
};
const ORDER = Object.entries(S).sort((a, b) => a[1] - b[1]);
const sceneRange = (k: keyof typeof S) => {
  const i = ORDER.findIndex(([n]) => n === k);
  return [ORDER[i][1], ORDER[i + 1] ? ORDER[i + 1][1] : TOTAL] as const;
};

const MEDIA: [number, string][] = [
  [0, "---"],
  [W(2, "cem"), "100"],
  [W(8, "quarenta"), "40"],
  [W(8, "dez"), "10"],
  [W(8, "um"), "1"],
  [W(10, "apaga"), "OFF"],
  [S.fim, "SUA"],
];
const valueAt = (tbl: [number, string][], t: number) => tbl.filter(([a]) => t >= a).pop()![1];
const lastChange = (tbl: [number, string][], t: number) => tbl.filter(([a]) => t >= a).pop()![0];

type Box2 = { label: string; value: string; tone?: "gold" | "red" | "dim" };
const countUp = (t: number, from: number, to: number, a: number, b: number) => Math.round(interpolate(t, [a, b], [from, to], clamp));
const box2At = (t: number): Box2 => {
  if (t < S.voce) return t < S.cofre ? { label: "MORADORES", value: "---", tone: "dim" } : { label: "MORADORES", value: "120" };
  if (t < W(8, "semana")) return { label: "SEU ESFORÇO", value: String(countUp(t, 0, 300, W(3, "acorda"), W(3, "filhos") + 0.3)), tone: "gold" };
  if (t < W(8, "parou")) return { label: "SEU ESFORÇO", value: String(countUp(t, 300, 60, W(8, "semana"), W(8, "você"))) };
  if (t < W(12, "dia")) return { label: "SEU ESFORÇO", value: "0", tone: "red" };
  return { label: "SEU ESFORÇO", value: String(countUp(t, 0, 300, W(12, "dia"), S.fim + 1)), tone: "gold" };
};

// ---------------------------------------------------------------- HUD
const HudBox: React.FC<{ label: string; value: string; tone?: "gold" | "red" | "dim"; bumpAt?: number; seg?: boolean }> = ({ label, value, tone, bumpAt = -9, seg }) => {
  const { t } = useT();
  const since = t - bumpAt;
  const scale = 1 + interpolate(since, [0, 0.08, 0.4], [0, 0.18, 0], clamp);
  const c = tone === "red" ? RED : tone === "gold" ? GOLD : "#3a3a3a";
  const vc = value === "OFF" ? "#2a2a2a" : seg ? (tone === "red" ? RED : ORANGE) : tone === "red" ? RED : WHITE;
  return (
    <div
      style={{
        width: 420,
        height: 128,
        border: `4px solid ${c}`,
        background: tone === "red" ? "rgba(224,85,74,0.10)" : tone === "gold" ? "rgba(232,184,74,0.08)" : "#181818",
        borderRadius: 6,
        padding: "14px 22px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: 4, color: tone === "red" ? RED : tone === "gold" ? GOLD : "#8a8a8a", fontWeight: 700 }}>{label}</div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 58,
          fontWeight: 800,
          color: vc,
          textAlign: "right",
          lineHeight: 1,
          transform: `scale(${scale})`,
          transformOrigin: "right center",
          textShadow: seg && value !== "---" && value !== "OFF" ? `0 0 14px ${vc}` : "none",
        }}
      >
        {value === "OFF" ? "888" : value}
      </div>
    </div>
  );
};

const Hud: React.FC = () => {
  const { t } = useT();
  const m = valueAt(MEDIA, t);
  const mTone = m === "---" || m === "OFF" ? "dim" : m === "SUA" ? "gold" : Number(m) <= 10 ? "red" : "gold";
  const b = box2At(t);
  return (
    <div style={{ position: "absolute", top: 120, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 40 }}>
      <HudBox label="RECOMPENSA" value={m} tone={mTone as Box2["tone"]} bumpAt={lastChange(MEDIA, t)} seg />
      <HudBox label={b.label} value={b.value} tone={b.tone} />
    </div>
  );
};

// ---------------------------------------------------------------- manchete
type HL = { text: string; at: number; color?: string; big?: boolean };
const HEADLINES: { from: number; lines: HL[] }[] = [
  { from: 0, lines: [{ text: "TODO ESFORÇO,", at: 0.3 }, { text: "A MESMA RECOMPENSA", at: W(0, "mesma"), color: GOLD, big: true }] },
  { from: S.cofre, lines: [{ text: "COFRE DA PRAÇA", at: W(2, "cofre"), color: GOLD, big: true }, { text: "DIVIDE IGUAL", at: W(2, "divide") }] },
  { from: W(2, "cofre"), lines: [{ text: "120 MORADORES", at: W(2, "cofre") }, { text: "120 TESTAS", at: W(2, "cem"), color: ORANGE, big: true }] },
  { from: S.voce, lines: [{ text: "AGORA,", at: S.voce + 0.1 }, { text: "VOCÊ", at: W(3, "você"), color: GOLD, big: true }] },
  { from: S.domingo, lines: [{ text: "DOMINGO", at: S.domingo + 0.1, color: GOLD, big: true }, { text: "SUA TESTA: 100", at: W(4, "cem") }] },
  { from: W(4, "a"), lines: [{ text: "O ZECA DORMIU", at: W(4, "zeca") }, { text: "TAMBÉM 100", at: W(4, "também"), color: RED, big: true }] },
  { from: S.zeca, lines: [{ text: "O CONSELHO DO ZECA", at: W(5, "zeca") }, { text: "\"RELAXA.\"", at: W(5, "relaxa"), color: BLUE, big: true }] },
  { from: S.conta, lines: [{ text: "A VILA INTEIRA", at: W(6, "vila") }, { text: "PRA QUÊ?", at: W(6, "pra"), color: RED, big: true }] },
  { from: S.academia, lines: [{ text: "MAIS UM MÊS", at: W(7, "mês"), color: GOLD, big: true }, { text: "SOZINHO", at: W(7, "sozinho") }] },
  { from: W(7, "vila"), lines: [{ text: "\"TRABALHA DOBRADO", at: W(7, "vila") }, { text: "PRA GANHAR IGUAL?\"", at: W(7, "vila") }] },
  { from: S.semanas, lines: [{ text: "SEMANA 2", at: W(8, "semana"), color: GOLD, big: true }, { text: "A ACADEMIA FECHA", at: W(8, "dez") }] },
  { from: W(8, "semana", 1), lines: [{ text: "SEMANA 5", at: W(8, "semana", 1), color: ORANGE, big: true }, { text: "O MERCADO SEM PÃO", at: W(8, "dez") }] },
  { from: S.parou, lines: [{ text: "SEMANA 9", at: S.parou + 0.1, color: RED, big: true }, { text: "VOCÊ TAMBÉM PAROU", at: W(8, "parou") }] },
  { from: S.jantar, lines: [{ text: "\"PAI, POR QUE", at: W(9, "pai") }, { text: "VOCÊ PAROU?\"", at: W(9, "parou"), color: GOLD, big: true }] },
  { from: S.espelho, lines: [{ text: "NO ESPELHO...", at: W(10, "espelho") }, { text: "O NÚMERO APAGA", at: W(10, "apaga"), color: RED, big: true }] },
  { from: S.vinha, lines: [{ text: "A RECOMPENSA", at: W(11, "recompensa") }, { text: "NUNCA VEIO DO COFRE", at: W(11, "nunca") }] },
  { from: W(11, "vinha"), lines: [{ text: "VINHA DO QUE", at: W(11, "vinha") }, { text: "VOCÊ FAZIA", at: W(11, "fazia"), color: GOLD, big: true }] },
  { from: S.manha, lines: [{ text: "DIA SEGUINTE", at: S.manha + 0.1 }, { text: "05:00", at: W(12, "cinco"), color: ORANGE, big: true }] },
  { from: W(12, "só"), lines: [{ text: "SÓ VOCÊ", at: W(12, "só"), color: GOLD, big: true }] },
  { from: S.fim, lines: [{ text: "NA SUA VIDA,", at: S.fim + 0.1 }, { text: "A RECOMPENSA", at: W(13, "recompensa"), color: GOLD, big: true }, { text: "É SUA.", at: W(13, "sua", 1), color: GOLD, big: true }] },
];

const Headline: React.FC = () => {
  const { t, fps } = useT();
  const cur = HEADLINES.filter((h) => t >= h.from).pop();
  // análise: tirar títulos que repetem a fala; ficam só o do gancho e o do final
  if (!cur || (cur.from !== 0 && cur.from !== S.fim)) return null;
  return (
    <div style={{ position: "absolute", top: 300, left: 60, right: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      {cur.lines.map((l, i) => {
        const p = sp(t, l.at, fps, 11, 200);
        const op = ramp(t, l.at, l.at + 0.1);
        return (
          <div
            key={i}
            style={{
              fontFamily: HEAD,
              fontWeight: 700,
              fontSize: l.big ? 100 : 74,
              lineHeight: 1.04,
              color: l.color ?? WHITE,
              letterSpacing: -1,
              textAlign: "center",
              textShadow: "0 6px 0 rgba(0,0,0,0.5)",
              opacity: t >= l.at ? op : 0,
              transform: `scale(${0.5 + 0.5 * p}) translateY(${(1 - p) * 30}px)`,
            }}
          >
            {l.text}
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- utilidades de cena
const Floor: React.FC<{ y: number; color?: string }> = ({ y, color = "#2c2c2c" }) => (
  <div style={{ position: "absolute", top: y, left: 120, right: 120, height: 6, background: color }} />
);

const Stamp: React.FC<{ at: number; text: string; x: number; y: number; color?: string; rot?: number; size?: number }> = ({ at, text, x, y, color = RED, rot = -8, size = 72 }) => {
  const { t, fps } = useT();
  if (t < at) return null;
  const p = sp(t, at, fps, 9, 260);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${2.2 - 1.2 * p})`,
        opacity: Math.min(1, p * 2),
        border: `7px solid ${color}`,
        color,
        fontFamily: HEAD,
        fontWeight: 700,
        fontSize: size,
        padding: "6px 26px",
        borderRadius: 10,
        whiteSpace: "nowrap",
        background: "rgba(18,18,18,0.85)",
        letterSpacing: 2,
      }}
    >
      {text}
    </div>
  );
};

const Chip: React.FC<{ at: number; text: string; x: number; y: number; color?: string; out?: number }> = ({ at, text, x, y, color = GOLD, out = 9999 }) => {
  const { t, fps } = useT();
  if (t < at) return null;
  const p = sp(t, at, fps, 12, 200);
  const o = 1 - ramp(t, out, out + 0.25);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%,-50%) scale(${p})`,
        opacity: o,
        border: `4px solid ${color}`,
        color,
        background: "#141414",
        fontFamily: MONO,
        fontWeight: 800,
        fontSize: 34,
        padding: "8px 18px",
        borderRadius: 6,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};

const Bubble: React.FC<{ at: number; text: string; x: number; y: number; color?: string; out?: number; tail?: "left" | "right" }> = ({ at, text, x, y, color = WHITE, out = 9999, tail = "left" }) => {
  const { t, fps } = useT();
  if (t < at || t > out + 0.3) return null;
  const p = sp(t, at, fps, 11, 220);
  const o = 1 - ramp(t, out, out + 0.25);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-100%) scale(${p})`, transformOrigin: tail === "left" ? "20% 100%" : "80% 100%", opacity: o }}>
      <div style={{ background: color, color: BG, fontFamily: HEAD, fontWeight: 700, fontSize: 44, padding: "14px 26px", borderRadius: 18, whiteSpace: "nowrap" }}>{text}</div>
      <div
        style={{
          position: "absolute",
          bottom: -22,
          left: tail === "left" ? 30 : undefined,
          right: tail === "right" ? 30 : undefined,
          width: 0,
          height: 0,
          borderLeft: "16px solid transparent",
          borderRight: "16px solid transparent",
          borderTop: `24px solid ${color}`,
        }}
      />
    </div>
  );
};

type HamProps = { x: number; y: number; w?: number; pal: Pal; asleep?: boolean; visor?: string; visorColor?: string; t0?: number; k?: number };
const Hammock: React.FC<HamProps> = (p) => {
  const k = p.k ?? 1.25;
  const w = p.w ?? 420;
  if (k === 1) return <HammockBase {...p} />;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, transform: `scale(${k})`, transformOrigin: `${p.x + w / 2}px ${p.y + 80}px` }}>
      <HammockBase {...p} />
    </div>
  );
};
const HammockBase: React.FC<HamProps> = ({ x, y, w = 420, pal, asleep = true, visor, visorColor, t0 = 0 }) => {
  const { t } = useT();
  const sway = Math.sin((t - t0) * 2.2) * 6;
  const zs = [0, 0.6, 1.2].map((d, i) => {
    const p = (((t - t0 + d) % 1.8) + 1.8) % 1.8 / 1.8;
    return (
      <div key={i} style={{ position: "absolute", left: x + w * 0.25 + p * 90 + i * 8, top: y - 120 - p * 130, fontFamily: MONO, fontWeight: 800, fontSize: 34 + i * 10, color: BLUE, opacity: asleep ? interpolate(p, [0, 0.2, 0.8, 1], [0, 1, 1, 0]) : 0 }}>
        Z
      </div>
    );
  });
  return (
    <>
      <div style={{ position: "absolute", left: x - 16, top: y - 120, width: 14, height: 200, background: "#5a4030" }} />
      <div style={{ position: "absolute", left: x + w + 2, top: y - 120, width: 14, height: 200, background: "#5a4030" }} />
      <div style={{ position: "absolute", left: x, top: y - 110 + sway, transform: `rotate(${sway * 0.3}deg)` }}>
        <svg width={w} height={140} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <path d={`M0 0 Q ${w / 2} 150 ${w} 0`} stroke="#c9b08a" strokeWidth={6} fill="none" />
        </svg>
        {/* corpo deitado */}
        <div style={{ position: "absolute", left: w * 0.3, top: 42, width: w * 0.48, height: 48, background: pal.B, borderRadius: 18, transform: "rotate(4deg)" }} />
        <div style={{ position: "absolute", left: w * 0.72, top: 52, width: w * 0.22, height: 26, background: pal.P, borderRadius: 10, transform: "rotate(-14deg)" }} />
        <div style={{ position: "absolute", left: w * 0.1, top: -30 }}>
          <div style={{ position: "relative" }}>
            <PixelArt grid={HEAD_SLEEPY.slice(0, 8)} palette={pal} size={11} />
            {visor !== undefined && <Visor value={visor} size={11} color={visorColor} />}
          </div>
        </div>
        <svg width={w} height={140} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <path d={`M${w * 0.18} 42 Q ${w / 2} 128 ${w * 0.88} 40`} stroke="#e0c99e" strokeWidth={22} fill="none" opacity={0.9} />
        </svg>
      </div>
      {zs}
    </>
  );
};

const Pop2: React.FC<{ at: number; children: React.ReactNode }> = ({ at, children }) => {
  const { t, fps } = useT();
  const p = sp(t, at, fps, 11, 200);
  return <div style={{ position: "absolute", inset: 0, transform: `scale(${0.6 + 0.4 * p})`, opacity: Math.min(1, p * 2), transformOrigin: "540px 560px" }}>{children}</div>;
};

const Clock: React.FC<{ x: number; y: number; text?: string; at: number }> = ({ x, y, text = "04:00", at }) => {
  const { t, frame } = useT();
  if (t < at) return null;
  const blink = Math.floor(frame / 15) % 2 === 0;
  return (
    <div style={{ position: "absolute", left: x, top: y, background: "#0b0b0b", border: "4px solid #333", borderRadius: 8, padding: "6px 16px", fontFamily: MONO, fontWeight: 800, fontSize: 48, color: ORANGE, textShadow: `0 0 12px ${ORANGE}` }}>
      {blink ? text : text.replace(":", " ")}
    </div>
  );
};

// ---------------------------------------------------------------- cenas
const SceneHook: React.FC = () => {
  const { t, frame, fps } = useT();
  const hit = Math.floor(frame / 7) % 2 === 0;
  const eq = sp(t, W(1, "até"), fps, 10, 200);
  return (
    <>
      <Person pal={PAL.voce} pose={hit ? "up" : "idle"} x={170} y={700} size={14} visor={t > 0.7 ? "100" : "888"} visorOff={t <= 0.7} visorPulse={t > 0.7 ? Math.max(0, 1 - (t - 0.7) * 3) : 0} />
      {[0, 1].map((i) => {
        const q = (t * 1.8 + i * 0.5) % 1;
        return <div key={i} style={{ position: "absolute", left: 160 + i * 190, top: 760 + q * 60, width: 12, height: 18, borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%", background: BLUE, opacity: 1 - q }} />;
      })}
      <Hammock x={560} y={940} w={360} pal={PAL.valdir} visor={t > 0.7 ? "100" : undefined} />
      <div style={{ position: "absolute", left: 540 - 40, top: 820, fontFamily: HEAD, fontWeight: 700, fontSize: 130, color: GOLD, transform: `scale(${eq})`, opacity: t > W(1, "até") ? 1 : 0 }}>=</div>
      <Chip at={W(1, "tudo")} text="FAZ TUDO" x={260} y={1120} color={GOLD} />
      <Chip at={W(1, "nada")} text="NÃO FAZ NADA" x={740} y={1120} color={BLUE} />
      <Floor y={1046} />
    </>
  );
};

const Panel: React.FC<{ at: number; x: number; y: number; label: string; children: React.ReactNode }> = ({ at, x, y, label, children }) => {
  const { t, fps } = useT();
  if (t < at) return null;
  const p = sp(t, at, fps, 12, 200);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 400, height: 260, background: "#191919", border: `4px solid ${GOLD}55`, borderRadius: 10, overflow: "hidden", transform: `scale(${0.5 + 0.5 * p})`, opacity: Math.min(1, p * 2) }}>
      {children}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 44, background: "#0f0f0f", fontFamily: MONO, fontWeight: 800, fontSize: 26, color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: 3 }}>{label}</div>
    </div>
  );
};

const SceneQuatro: React.FC = () => {
  const { t, frame } = useT();
  const cem = W(2, "cem");
  const v = t >= cem ? "100" : undefined;
  const pulse = t >= cem ? Math.max(0, 1 - (t - cem) * 3) : 0;
  const up = Math.floor(frame / 8) % 2 === 0;
  return (
    <>
      <Panel at={W(2, "treina")} x={120} y={560} label="TREINA">
        <Person pal={PAL.voce} pose={up ? "up" : "idle"} x={155} y={50} size={7} visor={v} visorPulse={pulse} k={1} />
        <div style={{ position: "absolute", left: 120, top: up ? 52 : 92, width: 160, height: 8, background: "#888" }} />
        <div style={{ position: "absolute", left: 112, top: up ? 40 : 80, width: 16, height: 32, background: "#555" }} />
        <div style={{ position: "absolute", left: 272, top: up ? 40 : 80, width: 16, height: 32, background: "#555" }} />
      </Panel>
      <Panel at={W(2, "trabalha")} x={560} y={560} label="TRABALHA">
        <Person pal={PAL.mecanico} pose="sit" x={110} y={70} size={7} visor={v} visorPulse={pulse} k={1} />
        <div style={{ position: "absolute", left: 190, top: 120, width: 110, height: 70, background: "#2b2b2b", border: "5px solid #3d3d3d" }} />
        <div style={{ position: "absolute", left: 60, top: 190, width: 280, height: 12, background: "#6b4a32" }} />
      </Panel>
      <Panel at={W(2, "cuida")} x={120} y={840} label="CUIDA DA FAMÍLIA">
        <Person pal={PAL.prof} head="f" x={110} y={40} size={7} visor={v} visorPulse={pulse} k={1} />
        <Person pal={PAL.kid1} x={220} y={110} size={5} k={1} />
      </Panel>
      <Panel at={W(2, "rede")} x={560} y={840} label="NA REDE">
        <Hammock x={70} y={170} w={260} pal={PAL.valdir} visor={v} k={1} />
      </Panel>
    </>
  );
};

const Cofre: React.FC<{ x: number; y: number; label: string; gray?: boolean; scale?: number }> = ({ x, y, label, gray, scale = 1 }) => (
  <div style={{ position: "absolute", left: x, top: y, width: 300, height: 240, transform: `scale(${scale})`, transformOrigin: "50% 50%", filter: gray ? "grayscale(1) brightness(0.6)" : undefined }}>
    <div style={{ position: "absolute", inset: 0, background: "#5a5f66", border: "8px solid #3a3e44", borderRadius: 14 }} />
    <div style={{ position: "absolute", left: 100, top: 50, width: 100, height: 100, borderRadius: 50, border: "10px solid #2a2e33", background: "#8a9099" }} />
    <div style={{ position: "absolute", left: 146, top: 60, width: 8, height: 40, background: "#2a2e33" }} />
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, textAlign: "center", fontFamily: MONO, fontWeight: 800, fontSize: 30, color: GOLD }}>{label}</div>
  </div>
);

const SceneCofre: React.FC = () => {
  const { t, fps } = useT();
  const a = S.cofre + 0.2;
  const junta = W(2, "junta");
  const div = W(2, "divide");
  const lit = W(2, "cem");
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < 120; i++) {
    const r = Math.floor(i / 12), c = i % 12;
    const p = sp(t, a + (r + c) * 0.03, fps, 12, 220);
    const x = 128 + c * 70, y = 830 + r * 36;
    const up = ramp(t, junta + c * 0.02, junta + 0.45 + c * 0.02);
    const down = ramp(t, div + 0.3 + c * 0.02, div + 0.75 + c * 0.02);
    const tx = interpolate(up - down * 0, [0, 1], [x + 18, 532]);
    const ty = interpolate(up, [0, 1], [y - 8, 680]);
    const bx = down > 0 ? interpolate(down, [0, 1], [532, x + 18]) : tx;
    const by = down > 0 ? interpolate(down, [0, 1], [680, y - 8]) : ty;
    const isLit = t >= lit + (r + c) * 0.015;
    cells.push(
      <React.Fragment key={i}>
        <div style={{ position: "absolute", left: x, top: y, transform: `scale(${p})`, opacity: p }}>
          <PixelArt grid={HEAD_M.slice(0, 7)} palette={[PAL.voce, PAL.prof, PAL.valdir, PAL.mecanico, PAL.motorista][i % 5]} size={4} />
          <div style={{ position: "absolute", left: 10, top: -4, width: 32, height: 10, borderRadius: 3, background: isLit ? ORANGE : "#222", boxShadow: isLit ? `0 0 8px ${ORANGE}` : "none" }} />
        </div>
        {t > junta && t < div + 0.8 + c * 0.02 && (up < 0.98 || down > 0.02) && <div style={{ position: "absolute", left: bx, top: by, width: 14, height: 14, background: GOLD }} />}
      </React.Fragment>
    );
  }
  return (
    <>
      <Cofre x={390} y={560} label={t >= div ? "÷ 120" : "COFRE"} scale={0.9 + 0.1 * sp(t, S.cofre, fps, 10, 160)} />
      {cells}
    </>
  );
};

const CheckRow: React.FC<{ at: number; appear: number; label: string; y: number }> = ({ at, appear, label, y }) => {
  const { t, fps } = useT();
  const p = sp(t, appear, fps, 14, 160);
  const done = t >= at;
  const ck = sp(t, at, fps, 9, 220);
  return (
    <div style={{ position: "absolute", left: 410, top: y, width: 520, height: 104, display: "flex", alignItems: "center", gap: 20, padding: "0 24px", boxSizing: "border-box", background: done ? "rgba(232,184,74,0.10)" : "#1a1a1a", border: `4px solid ${done ? GOLD : "#333"}`, borderRadius: 8, transform: `translateX(${(1 - p) * 160}px)`, opacity: Math.min(1, p * 1.4) }}>
      <div style={{ flex: 1, fontFamily: HEAD, fontWeight: 700, fontSize: 40, color: done ? WHITE : "#8a8a8a" }}>{label}</div>
      <div style={{ width: 58, height: 58, border: `5px solid ${done ? GOLD : "#4a4a4a"}`, boxSizing: "border-box", background: done ? GOLD : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontWeight: 800, fontSize: 40, color: BG }}>
        {done ? <span style={{ transform: `scale(${ck})` }}>✓</span> : null}
      </div>
    </div>
  );
};

const SceneVoce: React.FC = () => {
  const { t, frame } = useT();
  const a = S.voce;
  const rows: [string, string][] = [["acorda", "05:00 ACORDA"], ["treina", "TREINA"], ["trabalha", "TRABALHA 2×"], ["janta", "JANTAR C/ FILHOS"]];
  const bob = Math.sin(frame / 6) * 4;
  return (
    <>
      <Person pal={PAL.voce} pose={t >= W(3, "treina") && t < W(3, "trabalha") && Math.floor(frame / 7) % 2 === 0 ? "up" : "idle"} x={140} y={720 + bob} size={14} />
      {rows.map(([w, label], i) => (
        <CheckRow key={i} at={W(3, w)} appear={a + 0.2 + i * 0.12} label={label} y={600 + i * 122} />
      ))}
      <Floor y={1046} />
    </>
  );
};

const Bell: React.FC<{ x: number; y: number; t0: number }> = ({ x, y, t0 }) => {
  const { t } = useT();
  const sw = Math.sin((t - t0) * 9) * 22 * Math.exp(-Math.max(0, t - t0) * 0.9);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `rotate(${sw}deg)`, transformOrigin: "50% 0" }}>
      <svg width={120} height={130} viewBox="0 0 120 130">
        <rect x={54} y={0} width={12} height={16} fill="#8a6a2a" />
        <path d="M60 14 C 25 14 22 60 18 92 L 8 106 L 112 106 L 102 92 C 98 60 95 14 60 14 Z" fill={GOLD} stroke="#a07a2a" strokeWidth={5} />
        <circle cx={60 + sw * 0.6} cy={116} r={11} fill="#a07a2a" />
      </svg>
    </div>
  );
};

const SceneDomingo: React.FC = () => {
  const { t, fps } = useT();
  const [a] = sceneRange("domingo");
  const tb = W(4, "também");
  return (
    <>
      <Bell x={480} y={540} t0={a} />
      <Person pal={PAL.voce} x={170} y={720} size={14} visor={t >= W(4, "cem") ? "100" : "---"} visorPulse={t >= W(4, "cem") ? Math.max(0, 1 - (t - W(4, "cem")) * 3) : 0} />
      <Chip at={W(4, "sua")} text="ESFORÇO: 300" x={260} y={1120} color={GOLD} />
      {t >= W(4, "zeca") && (
        <div style={{ opacity: sp(t, W(4, "zeca"), fps) }}>
          <Hammock x={560} y={940} w={360} pal={PAL.valdir} visor={t >= tb ? "100" : "---"} />
          <Chip at={W(4, "dormiu")} text="ESFORÇO: 0" x={740} y={1120} color={BLUE} />
        </div>
      )}
      <div style={{ position: "absolute", left: 500, top: 820, fontFamily: HEAD, fontWeight: 700, fontSize: 130, color: RED, transform: `scale(${sp(t, tb, fps, 9, 240)})`, opacity: t >= tb ? 1 : 0 }}>=</div>
      <Floor y={1046} />
    </>
  );
};

const SceneZeca: React.FC = () => {
  const { t } = useT();
  return (
    <>
      <Person pal={PAL.valdir} head="sleepy" x={150} y={730} size={14} visor="100" />
      <Bubble at={W(5, "relaxa")} text="Relaxa." x={290} y={720} color={BLUE} />
      <Pop2 at={W(5, "se")}>
        <div style={{ position: "absolute", left: 480, top: 650, width: 420, height: 360, background: "#2a2a2a", border: "6px solid #444", borderRadius: 16, padding: 20, boxSizing: "border-box" }}>
          <div style={{ height: 110, background: "#9fb08a", borderRadius: 8, fontFamily: MONO, fontWeight: 800, fontSize: 52, color: "#1f2a17", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 18 }}>
            {t < W(5, "cai") ? "SE PARAR:" : "100 → 98"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 18 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ height: 46, background: i === 11 ? GOLD : "#4a4a4a", borderRadius: 6 }} />
            ))}
          </div>
        </div>
      </Pop2>
      <Chip at={W(5, "quase")} text="QUASE NADA" x={690} y={1110} color={GOLD} />
      <Floor y={1046} />
    </>
  );
};

const SceneConta: React.FC = () => {
  const { t, fps } = useT();
  const pra = W(6, "pra");
  const pals = [PAL.prof, PAL.mecanico, PAL.motorista, PAL.medico, PAL.kid2, PAL.valdir];
  return (
    <>
      {pals.map((p, i) => {
        const x = 130 + i * 140;
        const q = W(6, "vila") + i * 0.18;
        return (
          <React.Fragment key={i}>
            <Person pal={p} head={t >= pra ? "sleepy" : i === 0 || i === 4 ? "f" : "m"} x={x} y={820} size={9} visor="100" gray={t >= pra + 0.2} k={1.12} />
            {t >= q && (
              <div style={{ position: "absolute", left: x + 30, top: 700, fontFamily: HEAD, fontWeight: 700, fontSize: 70, color: GOLD, transform: `scale(${sp(t, q, fps, 9, 240)})`, opacity: t >= pra + 0.2 ? 0 : 1 }}>?</div>
            )}
          </React.Fragment>
        );
      })}
      <Stamp at={pra} text="PRA QUÊ?" x={540} y={680} />
      <Floor y={1046} />
    </>
  );
};

const SceneAcademia: React.FC = () => {
  const { t, frame } = useT();
  const [a, b] = sceneRange("academia");
  const up = Math.floor(frame / 9) % 2 === 0;
  const laugh = Math.floor(frame / 6) % 2 === 0;
  const dia = Math.max(1, Math.round(interpolate(t, [a, b - 0.3], [1, 30], clamp)));
  return (
    <>
      <div style={{ position: "absolute", left: 140, top: 580, width: 800, height: 466, background: "#191919", border: "4px solid #2a2a2a" }} />
      {/* janela com a vila rindo */}
      <div style={{ position: "absolute", left: 620, top: 620, width: 280, height: 170, background: "#2a3a55", border: "8px solid #3a3a3a", overflow: "hidden" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ position: "absolute", left: 20 + i * 85, top: 70 + (laugh ? -3 : 0) }}>
            <PixelArt grid={(laugh ? HEAD_LAUGH : HEAD_M).slice(0, 8)} palette={[PAL.kid1, PAL.prof, PAL.valdir][i]} size={5} />
          </div>
        ))}
      </div>
      <Chip at={W(7, "vila")} text="HA HA HA" x={760} y={600} color={DIM} />
      {/* rack de halteres vazio */}
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ position: "absolute", left: 180, top: 640 + i * 70, width: 140, height: 10, background: "#444" }} />
      ))}
      <Person pal={PAL.voce} pose={up ? "up" : "idle"} x={380} y={760} size={14} k={1} />
      <div style={{ position: "absolute", left: 330, top: up ? 760 : 852, width: 280, height: 12, background: "#9a9a9a" }} />
      <div style={{ position: "absolute", left: 318, top: up ? 736 : 828, width: 26, height: 60, background: "#555" }} />
      <div style={{ position: "absolute", left: 596, top: up ? 736 : 828, width: 26, height: 60, background: "#555" }} />
      <div style={{ position: "absolute", left: 170, top: 960, fontFamily: MONO, fontWeight: 800, fontSize: 40, color: GOLD }}>DIA {dia}</div>
      <Floor y={1046} />
    </>
  );
};

const SceneSemanas: React.FC = () => {
  const { t, fps } = useT();
  const weeks: [number, string, number][] = [
    [S.semanas, "2", 5],
    [W(8, "semana"), "2", 3],
    [W(8, "semana", 1), "5", 1],
    [W(8, "semana", 2), "9", 0],
  ];
  const cur = weeks.filter(([a]) => t >= a).pop()!;
  const p = sp(t, cur[0], fps, 10, 240);
  return (
    <>
      <div style={{ position: "absolute", left: 540 - 190, top: 560, width: 380, height: 340, background: "#f2efe6", borderRadius: 14, overflow: "hidden", boxShadow: "0 14px 0 #00000066" }}>
        <div style={{ height: 76, background: RED, color: WHITE, fontFamily: MONO, fontWeight: 800, fontSize: 40, display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: 4 }}>SEMANA</div>
        <div style={{ textAlign: "center", fontFamily: HEAD, fontWeight: 700, fontSize: 210, color: "#1a1a1a", lineHeight: 1.2, transform: `perspective(700px) rotateX(${(1 - p) * 80}deg)`, transformOrigin: "50% 0" }}>{cur[1]}</div>
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ position: "absolute", left: 215 + i * 140, top: 940 }}>
          <PixelArt grid={HOUSE(i < cur[2])} palette={ICON_PAL} size={9} />
        </div>
      ))}
      <Floor y={1046} />
    </>
  );
};

const SceneParou: React.FC = () => {
  const { t, fps } = useT();
  const [a] = sceneRange("parou");
  const lie = a;
  if (t < lie) {
    const p = sp(t, a + 0.1, fps, 10, 240);
    return (
      <div style={{ position: "absolute", left: 540 - 200, top: 610, width: 400, height: 380, background: "#f2efe6", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ height: 80, background: RED, color: WHITE, fontFamily: MONO, fontWeight: 800, fontSize: 40, display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: 4 }}>SEMANA</div>
        <div style={{ textAlign: "center", fontFamily: HEAD, fontWeight: 700, fontSize: 220, color: "#1a1a1a", lineHeight: 1.2, transform: `perspective(700px) rotateX(${(1 - p) * 80}deg)`, transformOrigin: "50% 0" }}>9</div>
      </div>
    );
  }
  return (
    <>
      <Hammock x={270} y={960} w={540} pal={PAL.voce} visor="1" visorColor={RED} t0={lie} />
      <Floor y={1046} />
    </>
  );
};

const SceneJantar: React.FC = () => {
  const { t } = useT();
  return (
    <>
      <div style={{ position: "absolute", left: 300, top: 480, width: 480, height: 50, borderRadius: 30, background: "#e9e4c8", boxShadow: "0 0 80px 30px rgba(233,228,200,0.15)" }} />
      <Person pal={PAL.voce} pose="sit" head="sleepy" x={180} y={760} size={13} visor="1" visorColor={RED} k={1.2} />
      <Person pal={PAL.kid1} pose="sit" x={760} y={850} size={9} flip k={1.2} />
      <div style={{ position: "absolute", left: 300, top: 930, width: 520, height: 24, background: "#6b4a32" }} />
      <div style={{ position: "absolute", left: 320, top: 954, width: 18, height: 92, background: "#4f3524" }} />
      <div style={{ position: "absolute", left: 782, top: 954, width: 18, height: 92, background: "#4f3524" }} />
      <div style={{ position: "absolute", left: 470, top: 892, width: 110, height: 40, borderRadius: "0 0 55px 55px", background: "#ddd" }} />
      <Bubble at={W(9, "pai")} text="Pai, por que você parou?" x={690} y={830} color={GOLD} tail="right" out={W(9, "e") - 0.05} />
      <Bubble at={W(9, "e") + 0.3} text="..." x={300} y={740} color="#8a8a8a" />
      <Floor y={1046} />
      {t < 0 && null}
    </>
  );
};

const SceneEspelho: React.FC = () => {
  const { t, frame } = useT();
  const num = W(10, "número");
  const off = W(10, "apaga");
  const flicker = t >= num && t < off ? Math.floor(frame / 3) % 2 === 0 : false;
  const crack = t >= off;
  return (
    <>
      <div style={{ position: "absolute", left: 300, top: 560, width: 480, height: 500, borderRadius: "50% 50% 12px 12px", background: "linear-gradient(135deg,#2a3440,#1a2028)", border: "14px solid #6b4a32", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 60, top: 60, width: 30, height: 300, background: "rgba(255,255,255,0.06)", transform: "rotate(20deg)" }} />
        <Person pal={PAL.voce} head="sleepy" x={150} y={150} size={14} visor="1" visorColor={RED} visorOff={flicker || crack} k={1.15} />
        {crack && (
          <svg width={480} height={500} style={{ position: "absolute", left: 0, top: 0 }}>
            <path d="M240 150 L200 90 M240 150 L300 80 M240 150 L180 200 M240 150 L320 210 M240 150 L250 260" stroke="#cfd8e0" strokeWidth={4} fill="none" opacity={0.8} />
          </svg>
        )}
      </div>
    </>
  );
};

const SceneVinha: React.FC = () => {
  const { t, fps } = useT();
  const vinha = W(11, "vinha");
  const glow = t >= vinha ? sp(t, vinha, fps, 12, 120) : 0;
  return (
    <>
      <Cofre x={110} y={720} label="COFRE" gray={t >= W(11, "cofre")} scale={0.85} />
      {t >= W(11, "cofre") && (
        <svg width={300} height={240} style={{ position: "absolute", left: 110, top: 720, transform: "scale(0.85)" }}>
          <path d="M20 20 L280 220 M280 20 L20 220" stroke={RED} strokeWidth={18} strokeLinecap="round" strokeDasharray={330} strokeDashoffset={330 * (1 - ramp(t, W(11, "cofre"), W(11, "cofre") + 0.3))} />
        </svg>
      )}
      <div style={{ position: "absolute", left: 720 - 160, top: 860 - 160 + 60, width: 320, height: 320, borderRadius: 160, background: `radial-gradient(circle, ${GOLD}66, transparent 70%)`, opacity: glow, transform: `scale(${0.6 + 0.6 * glow})` }} />
      <Person pal={PAL.voce} pose={t >= vinha ? "up" : "idle"} x={630} y={700} size={14} />
      <Chip at={vinha} text="VOCÊ" x={720} y={1110} color={GOLD} />
      <Floor y={1046} />
    </>
  );
};

const SceneManha: React.FC = () => {
  const { t, frame } = useT();
  const [a, b] = sceneRange("manha");
  const dawn = ramp(t, a, b);
  const up = Math.floor(frame / 9) % 2 === 0 && t >= W(12, "dia");
  return (
    <>
      <div style={{ position: "absolute", left: 120, top: 560, width: 840, height: 490, borderRadius: 14, overflow: "hidden", background: `linear-gradient(${interpolate(dawn, [0, 1], [0, 1]) > 0.5 ? "#2a3a5a" : "#0b1020"}, ${dawn > 0.5 ? "#d9925a" : "#1a2238"})`, transition: "none" }}>
        <div style={{ position: "absolute", left: 360, top: 420 - dawn * 160, width: 120, height: 120, borderRadius: 60, background: "#ffcf6a", boxShadow: "0 0 80px #ffcf6a", opacity: dawn }} />
      </div>
      <Clock x={160} y={590} text="05:00" at={W(12, "cinco")} />
      <Person pal={PAL.voce} pose={up ? "up" : "idle"} x={449} y={720} size={14} />
      <Chip at={W(12, "sem")} text="SEM PLACAR" x={360} y={1120} color={DIM} />
      <Chip at={W(12, "só")} text="SÓ VOCÊ" x={720} y={1120} color={GOLD} />
      <Floor y={1046} />
    </>
  );
};

const SceneFim: React.FC = () => {
  const { t, frame } = useT();
  const jump = Math.abs(Math.sin(frame / 7)) * 30;
  return (
    <>
      <div style={{ position: "absolute", left: 540 - 220, top: 640, width: 440, height: 440, borderRadius: 220, background: `radial-gradient(circle, ${GOLD}44, transparent 70%)` }} />
      <Person pal={PAL.voce} pose="up" x={449} y={720 - jump} size={14} />
      <Floor y={1046} />
      {t < 0 && null}
    </>
  );
};

// ---------------------------------------------------------------- transições
type Enter = "zoom" | "left" | "right" | "up" | "drop" | "flash" | "iris";
const ENTER: Partial<Record<keyof typeof S, Enter>> = {
  hook: "zoom", cofre: "drop", voce: "right", domingo: "iris", zeca: "left", conta: "zoom", academia: "right",
  semanas: "drop", parou: "left", jantar: "iris", espelho: "zoom", vinha: "flash", manha: "iris", fim: "zoom",
};
const SHAKES = [W(4, "também"), W(6, "pra"), W(8, "quarenta"), W(8, "dez"), W(8, "dez"), W(8, "um"), W(10, "apaga")];

const Scene: React.FC<{ k: keyof typeof S; children: React.ReactNode }> = ({ k, children }) => {
  const { t, fps } = useT();
  const [a, b] = sceneRange(k);
  if (t < a - 0.01 || t >= b) return null;
  const e = ENTER[k] ?? "zoom";
  const p = sp(t, a, fps, 15, 140);
  const out = ramp(t, b - 0.12, b);
  let tf = "";
  let op = Math.min(1, ramp(t, a, a + 0.12)) * (1 - out);
  let clip: string | undefined;
  if (e === "zoom") tf = `scale(${1.25 - 0.25 * p})`;
  if (e === "left") tf = `translateX(${(1 - p) * -900}px)`;
  if (e === "right") tf = `translateX(${(1 - p) * 900}px)`;
  if (e === "up") tf = `translateY(${(1 - p) * 700}px)`;
  if (e === "drop") tf = `translateY(${(1 - sp(t, a, fps, 9, 170)) * -900}px)`;
  if (e === "flash") { tf = `scale(${1.1 - 0.1 * p})`; op = 1 - out; }
  if (e === "iris") { const r = interpolate(t, [a, a + 0.6], [0, 1300], clamp); clip = `circle(${r}px at 540px 820px)`; op = 1 - out; }
  return <AbsoluteFill style={{ transform: tf, opacity: op, clipPath: clip, transformOrigin: "540px 820px" }}>{children}</AbsoluteFill>;
};

const Flash: React.FC = () => {
  const { t } = useT();
  const pts = [W(11, "porque"), W(10, "apaga")];
  const v = Math.max(...pts.map((p) => interpolate(t, [p, p + 0.04, p + 0.35], [0, 0.85, 0], clamp)));
  const red = Math.max(...[W(8, "quarenta"), W(8, "dez"), W(8, "um")].map((p) => interpolate(t, [p, p + 0.05, p + 0.5], [0, 0.25, 0], clamp)));
  return (
    <>
      <AbsoluteFill style={{ background: WHITE, opacity: v, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: RED, opacity: red, pointerEvents: "none" }} />
    </>
  );
};

// ---------------------------------------------------------------- legenda (páginas de até 2 linhas)
type Page = { words: Cap[]; s: number; e: number; line: number; spk: boolean };
const PAGES: Page[] = (() => {
  const out: Page[] = [];
  const lines = Array.from(new Set(CAPS.map((c) => c.line)));
  for (const ln of lines) {
    const ws = CAPS.filter((c) => c.line === ln);
    let cur: Cap[] = [];
    let len = 0;
    const flush = () => {
      if (cur.length) out.push({ words: cur, s: cur[0].s, e: cur[cur.length - 1].e, line: ln, spk: cur[0].spk });
      cur = [];
      len = 0;
    };
    ws.forEach((w, i) => {
      cur.push(w);
      len += w.w.length + 1;
      const punct = /[,.?!:]$/.test(w.w);
      const rest = ws.slice(i + 1).reduce((s, x) => s + x.w.length + 1, 0);
      if (i < ws.length - 1 && ((len >= 20 && punct && rest > 6) || len >= 34)) flush();
    });
    flush();
  }
  return out;
})();
const GOLD_WORDS = new Set(["esforço", "recompensa.", "recompensa", "tudo...", "nada.", "cem.", "cem", "igual.", "cofre", "acesas.", "você.", "cinco,", "treina,", "dobrado", "filhos.", "zeca", "relaxa.", "mês.", "sozinho", "você", "fazia.", "só", "sua."]);
const RED_WORDS = new Set(["também.", "quê?", "quarenta.", "dez.", "um.", "parou.", "parou?", "apaga.", "fecha.", "pão."]);

const Captions: React.FC = () => {
  const { t } = useT();
  const page = PAGES.filter((p) => p.s <= t + 0.05).pop();
  if (!page) return null;
  const next = PAGES.find((p) => p.s > page.s);
  if (t > page.e + 0.8 && (!next || next.s > t)) return null;
  if (page.spk) {
    return (
      <div style={{ position: "absolute", top: 1400, left: 100, right: 100, textAlign: "center", fontFamily: MONO, fontWeight: 800, fontSize: 44, lineHeight: 1.3, color: ORANGE }}>
        <span style={{ display: "inline-block", border: `3px solid ${ORANGE}`, borderRadius: 8, padding: "2px 12px", marginRight: 14, fontSize: 30, verticalAlign: "middle" }}>ALTO-FALANTE</span>
        {page.words.map((c, i) => (
          <span key={i} style={{ color: c.s <= t + 0.05 ? ORANGE : "#4a3a20" }}>
            {c.w.toUpperCase()}
            {i < page.words.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", top: 1400, left: 100, right: 100, textAlign: "center", fontFamily: HEAD, fontWeight: 700, fontSize: 62, lineHeight: 1.22 }}>
      {page.words.map((c, i) => {
        const spoken = c.s <= t + 0.05;
        const lw = c.w.toLowerCase();
        const color = !spoken ? "#4a4a4a" : RED_WORDS.has(lw) ? RED : GOLD_WORDS.has(lw) ? GOLD : WHITE;
        const justNow = spoken && t - c.s < 0.15;
        return (
          <React.Fragment key={i}>
            <span style={{ color, display: "inline-block", transform: `scale(${justNow ? 1.1 : 1})` }}>{c.w}</span>
            {i < page.words.length - 1 ? " " : ""}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- raiz
export const VilaIgual: React.FC = () => {
  const { t, frame } = useT();
  const shake = Math.max(...SHAKES.map((s) => interpolate(t, [s, s + 0.04, s + 0.5], [0, 1, 0], clamp)));
  const sx = Math.sin(frame * 2.3) * 18 * shake;
  const sy = Math.cos(frame * 3.1) * 14 * shake;
  // a vila perde a cor nas semanas e volta quando a recompensa "vem de você"
  const back = W(11, "porque");
  const gray = t < back ? interpolate(t, [S.semanas, S.parou + 1], [0, 0.85], clamp) : interpolate(t, [back, back + 0.5], [0.85, 0], clamp);
  return (
    <AbsoluteFill
      style={{
        background: BG,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.025) 2px, transparent 2px)",
        backgroundSize: "60px 60px",
      }}
    >
      <Audio src={staticFile("vila_igual/audio_final_v4.wav")} />
      {/* área segura dos Reels: tudo reduzido a 90% e descido 20 px */}
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${20 + sy}px) scale(0.9)`, transformOrigin: "540px 960px" }}>
        <Hud />
        <Headline />
        <AbsoluteFill style={{ filter: gray > 0.01 ? `grayscale(${gray})` : undefined, transform: "translateY(90px) scale(1.08)", transformOrigin: "540px 1046px" }}>
          <Scene k="hook"><SceneHook /></Scene>
          <Scene k="cofre"><SceneCofre /></Scene>
          <Scene k="voce"><SceneVoce /></Scene>
          <Scene k="domingo"><SceneDomingo /></Scene>
          <Scene k="zeca"><SceneZeca /></Scene>
          <Scene k="conta"><SceneConta /></Scene>
          <Scene k="academia"><SceneAcademia /></Scene>
          <Scene k="semanas"><SceneSemanas /></Scene>
          <Scene k="parou"><SceneParou /></Scene>
          <Scene k="jantar"><SceneJantar /></Scene>
          <Scene k="espelho"><SceneEspelho /></Scene>
          <Scene k="vinha"><SceneVinha /></Scene>
          <Scene k="manha"><SceneManha /></Scene>
          <Scene k="fim"><SceneFim /></Scene>
        </AbsoluteFill>
        <Captions />
      </AbsoluteFill>
      <Flash />
    </AbsoluteFill>
  );
};
