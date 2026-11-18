import React from "react";
import { AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadSpaceGrotesk } from "../lib/localFonts";
import captionsData from "./captions.json";
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
}> = ({ pal, pose = "idle", head = "m", size = 14, x, y, visor, visorColor, visorOff, visorPulse, gray, flip, style }) => (
  <div style={{ position: "absolute", left: x, top: y, filter: gray ? "grayscale(1) brightness(0.75)" : undefined, transform: flip ? "scaleX(-1)" : undefined, ...style }}>
    <PixelArt grid={grid(pose, head)} palette={pal} size={size} />
    {visor !== undefined && <Visor value={visor} size={size} color={visorColor} off={visorOff} pulse={visorPulse} />}
  </div>
);

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
  vila: L(2) - 0.15,
  spk100: L(5) - CHIME - 0.15,
  valdir: L(6) - 0.15,
  medico: L(9) - 0.15,
  fila: L(11) - 0.15,
  spk50: L(12) - CHIME - 0.15,
  comite: L(13) - 0.15,
  spk20: L(15) - CHIME - 0.15,
  noite: L(16) - 0.15,
  dialogo: L(18) - 0.15,
  escola: L(20) - 0.15,
  avental: L(22) - 0.15,
  spk1: L(23) - CHIME - 0.15,
  anos: L(24) - 0.15,
  adulto: L(25) - 0.15,
  sabado: L(28) - 0.15,
  spk0: L(29) - CHIME - 0.15,
  semPao: L(30) - 0.15,
  revela: L(31) - 0.15,
  tiago: L(34) - 0.15,
  spk1b: L(36) - CHIME - 0.15,
  fim: L(37) - 0.15,
  end: TOTAL,
};
const ORDER = Object.entries(S).sort((a, b) => a[1] - b[1]);
const sceneRange = (k: keyof typeof S) => {
  const i = ORDER.findIndex(([n]) => n === k);
  return [ORDER[i][1], ORDER[i + 1] ? ORDER[i + 1][1] : TOTAL] as const;
};

// valor da média e do segundo placar ao longo do tempo
const MEDIA: [number, string][] = [
  [0, "---"],
  [W(4, "testa"), "100"],
  [W(8, "pra"), "99"],
  [W(10, "pra"), "98"],
  [W(11, "professora"), "97"],
  [W(11, "mecânico"), "96"],
  [W(11, "motorista"), "95"],
  [W(12, "cinquenta"), "50"],
  [W(15, "vinte"), "20"],
  [W(23, "um"), "1"],
  [W(29, "zero"), "0"],
  [W(36, "um"), "1"],
];
const valueAt = (tbl: [number, string][], t: number) => tbl.filter(([a]) => t >= a).pop()![1];
const lastChange = (tbl: [number, string][], t: number) => tbl.filter(([a]) => t >= a).pop()![0];

type Box2 = { label: string; value: string; tone?: "gold" | "red" | "dim" };
const box2At = (t: number): Box2 => {
  if (t < W(2, "cem")) return { label: "MORADORES", value: "---", tone: "dim" };
  if (t < W(8, "pra")) return { label: "TRABALHANDO", value: "100/100", tone: "gold" };
  if (t < W(10, "pra")) return { label: "TRABALHANDO", value: "99/100", tone: "gold" };
  if (t < W(11, "professora")) return { label: "TRABALHANDO", value: "98/100" };
  if (t < W(11, "mecânico")) return { label: "TRABALHANDO", value: "97/100" };
  if (t < W(11, "motorista")) return { label: "TRABALHANDO", value: "96/100" };
  if (t < W(12, "cinquenta")) return { label: "TRABALHANDO", value: "95/100", tone: "red" };
  if (t < W(14, "voltou")) return { label: "TRABALHANDO", value: "50/100", tone: "red" };
  if (t < W(16, "verdade")) return { label: "TRABALHANDO", value: "100/100" };
  if (t < W(22, "pendurou")) return { label: "DE VERDADE", value: "1/100", tone: "gold" };
  if (t < W(31, "comitê")) return { label: "DE VERDADE", value: "0/100", tone: "red" };
  if (t < W(34, "acendeu")) return { label: "DE VERDADE", value: "1/100", tone: "gold" };
  return { label: "DE VERDADE", value: "1/100", tone: "gold" };
};

// ---------------------------------------------------------------- HUD
const HudBox: React.FC<{ label: string; value: string; tone?: "gold" | "red" | "dim"; bumpAt?: number; seg?: boolean }> = ({ label, value, tone, bumpAt = -9, seg }) => {
  const { t } = useT();
  const since = t - bumpAt;
  const scale = 1 + interpolate(since, [0, 0.08, 0.4], [0, 0.18, 0], clamp);
  const c = tone === "red" ? RED : tone === "gold" ? GOLD : "#3a3a3a";
  const vc = seg ? (tone === "red" ? RED : ORANGE) : tone === "red" ? RED : WHITE;
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
          textShadow: seg && value !== "---" ? `0 0 14px ${vc}` : "none",
        }}
      >
        {value}
      </div>
    </div>
  );
};

const Hud: React.FC = () => {
  const { t } = useT();
  const m = valueAt(MEDIA, t);
  const mTone = m === "---" ? "dim" : Number(m) <= 1 ? "red" : Number(m) < 100 ? "gold" : "gold";
  const b = box2At(t);
  return (
    <div style={{ position: "absolute", top: 120, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 40 }}>
      <HudBox label="MÉDIA DE HOJE" value={m} tone={mTone as Box2["tone"]} bumpAt={lastChange(MEDIA, t)} seg />
      <HudBox label={b.label} value={b.value} tone={b.tone} />
    </div>
  );
};

// ---------------------------------------------------------------- manchete
type HL = { text: string; at: number; color?: string; big?: boolean };
const HEADLINES: { from: number; lines: HL[] }[] = [
  { from: 0, lines: [{ text: "TODO ESFORÇO,", at: 0.3 }, { text: "A MESMA RECOMPENSA", at: W(0, "mesma"), color: GOLD, big: true }] },
  { from: S.vila, lines: [{ text: "VILA IGUAL", at: S.vila + 0.1, color: GOLD, big: true }, { text: "100 MORADORES", at: W(2, "cem") }] },
  { from: W(3, "tudo"), lines: [{ text: "TUDO NO DEPÓSITO", at: W(3, "tudo") }, { text: "DIVIDIDO IGUAL", at: W(3, "dividido"), color: GOLD, big: true }] },
  { from: W(4, "e"), lines: [{ text: "A MÉDIA ACENDE", at: W(4, "média") }, { text: "NA TESTA", at: W(4, "testa"), color: ORANGE, big: true }] },
  { from: S.spk100, lines: [] },
  { from: S.valdir, lines: [{ text: "SEU VALDIR", at: W(6, "valdir"), color: GOLD, big: true }, { text: "FEZ A CONTA", at: W(6, "conta") }] },
  { from: W(8, "um"), lines: [{ text: "−1 PONTO", at: W(8, "um"), color: RED, big: true }, { text: "+ UMA VIDA NA REDE", at: W(8, "vida") }] },
  { from: S.medico, lines: [{ text: "10 ANOS DE ESTUDO", at: W(9, "dez") }, { text: "= VALDIR?", at: W(9, "valdir"), color: GOLD, big: true }] },
  { from: S.fila, lines: [{ text: "DEPOIS...", at: S.fila + 0.1 }] },
  { from: S.spk50, lines: [] },
  { from: S.comite, lines: [{ text: "O COMITÊ", at: W(13, "comitê"), color: RED, big: true }, { text: "FEZ UMA LEI", at: W(13, "lei") }] },
  { from: S.comite + 0.01 + (W(14, "e") - S.comite), lines: [{ text: "TODO MUNDO TRABALHANDO...", at: W(14, "voltou") }, { text: "DE MENTIRA", at: W(14, "mentira"), color: RED, big: true }] },
  { from: S.spk20, lines: [] },
  { from: S.noite, lines: [{ text: "DONA ROSA", at: W(16, "rosa"), color: GOLD, big: true }, { text: "DE VERDADE", at: W(16, "verdade") }] },
  { from: W(17, "às"), lines: [{ text: "04:00", at: W(17, "quatro"), color: ORANGE, big: true }, { text: "SÓ UMA LUZ ACESA", at: W(17, "única") }] },
  { from: S.dialogo, lines: [{ text: "POR QUE TRABALHAR", at: W(18, "por") }, { text: "SE GANHA IGUAL?", at: W(18, "ganha"), color: GOLD, big: true }] },
  { from: W(19, "porque"), lines: [{ text: "ALGUÉM TEM QUE", at: W(19, "alguém") }, { text: "FAZER O PÃO", at: W(19, "fazer"), color: GOLD, big: true }] },
  { from: S.escola, lines: [{ text: "NA ESCOLA", at: S.escola + 0.1 }, { text: "\"FILHO DA TROUXA\"", at: W(20, "trouxa"), color: RED, big: true }] },
  { from: W(21, "mãe"), lines: [{ text: "MÃE,", at: W(21, "mãe") }, { text: "PARA COM ISSO!", at: W(21, "para"), color: RED, big: true }] },
  { from: S.avental, lines: [{ text: "ELA PENDUROU", at: W(22, "ela") }, { text: "O AVENTAL", at: W(22, "avental"), color: GOLD, big: true }] },
  { from: S.spk1, lines: [] },
  { from: S.anos, lines: [{ text: "A MÉDIA", at: S.anos + 0.1 }, { text: "PAROU NO 1", at: W(24, "parou"), color: ORANGE, big: true }] },
  { from: S.adulto, lines: [{ text: "TIAGO CRESCEU", at: W(25, "cresceu"), color: GOLD, big: true }, { text: "E FEZ... NADA", at: W(25, "nada") }] },
  { from: W(27, "coisa"), lines: [{ text: "\"COISA DE VELHA\"", at: W(27, "coisa"), color: WHITE, big: true }] },
  { from: S.sabado, lines: [{ text: "NUM SÁBADO...", at: W(28, "sábado") }] },
  { from: S.spk0, lines: [] },
  { from: S.semPao, lines: [{ text: "15 ANOS DEPOIS", at: W(30, "quinze") }, { text: "NINGUÉM TEM PÃO", at: W(30, "ninguém"), color: RED, big: true }] },
  { from: S.revela, lines: [{ text: "AQUELE 1", at: W(31, "aquele"), color: ORANGE, big: true }, { text: "NUNCA VEIO DO COMITÊ", at: W(31, "nunca") }] },
  { from: W(32, "por"), lines: [{ text: "04:00, ESCONDIDA", at: W(32, "quatro") }, { text: "POR 15 ANOS", at: W(32, "quinze"), color: GOLD, big: true }] },
  { from: W(33, "cem"), lines: [{ text: "100 PÃES POR DIA", at: W(33, "cem"), color: GOLD, big: true }, { text: "PRA CADA UM GANHAR 1", at: W(33, "cada") }] },
  { from: S.tiago, lines: [{ text: "04:00", at: W(34, "quatro"), color: ORANGE, big: true }, { text: "A LUZ ACENDEU", at: W(34, "luz") }] },
  { from: W(35, "alguém"), lines: [{ text: "ALGUÉM TEM QUE", at: W(35, "alguém") }, { text: "FAZER O PÃO", at: W(35, "fazer"), color: GOLD, big: true }] },
  { from: S.spk1b, lines: [] },
  { from: S.fim, lines: [{ text: "TODO MUNDO", at: W(37, "todo") }, { text: "GANHA A MÉDIA", at: W(37, "ganha"), color: WHITE, big: true }] },
  { from: W(38, "e"), lines: [{ text: "E A MÉDIA, AGORA,", at: W(38, "e") }, { text: "ERA O TIAGO", at: W(38, "tiago"), color: GOLD, big: true }] },
];

const Headline: React.FC = () => {
  const { t, fps } = useT();
  const cur = HEADLINES.filter((h) => t >= h.from).pop();
  if (!cur) return null;
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

const Hammock: React.FC<{ x: number; y: number; w?: number; pal: Pal; asleep?: boolean; visor?: string; visorColor?: string; t0?: number }> = ({ x, y, w = 420, pal, asleep = true, visor, visorColor, t0 = 0 }) => {
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

// alto-falante + placar
const Speaker: React.FC<{ value: string; tone?: "gold" | "red"; at: number }> = ({ value, tone = "gold", at }) => {
  const { t, fps } = useT();
  const shown = t >= at;
  const p = sp(t, at, fps, 10, 160);
  const buzz = t < at ? Math.sin(t * 60) * 3 : 0;
  const col = tone === "red" ? RED : ORANGE;
  const digits = value.padStart(3, " ").split("");
  const waves = [0, 1, 2].map((i) => {
    const q = ((t * 1.6 + i / 3) % 1);
    return (
      <React.Fragment key={i}>
        <div style={{ position: "absolute", left: 540 - 300 - q * 60, top: 560 - q * 40, width: 60 + q * 40, height: 120 + q * 80, border: `5px solid ${GOLD}`, borderRight: "none", borderTop: "none", borderBottom: "none", borderRadius: "50%", opacity: 0.6 * (1 - q) }} />
        <div style={{ position: "absolute", left: 540 + 240 + q * 60, top: 560 - q * 40, width: 60 + q * 40, height: 120 + q * 80, border: `5px solid ${GOLD}`, borderLeft: "none", borderTop: "none", borderBottom: "none", borderRadius: "50%", opacity: 0.6 * (1 - q) }} />
      </React.Fragment>
    );
  });
  return (
    <>
      <div style={{ position: "absolute", left: 530, top: 600, width: 20, height: 600, background: "#3a3a3a" }} />
      <div style={{ position: "absolute", left: 540 - 250, top: 560 + buzz, width: 230, height: 150, background: "#bdbdbd", clipPath: "polygon(0 0, 100% 35%, 100% 65%, 0 100%)", transform: "none" }} />
      <div style={{ position: "absolute", left: 540 + 20, top: 560 - buzz, width: 230, height: 150, background: "#bdbdbd", clipPath: "polygon(0 35%, 100% 0, 100% 100%, 0 65%)" }} />
      <div style={{ position: "absolute", left: 540 - 40, top: 595, width: 80, height: 80, borderRadius: 40, background: "#8a8a8a" }} />
      {waves}
      <div
        style={{
          position: "absolute",
          left: 540 - 330,
          top: 780,
          width: 660,
          height: 330,
          background: "#1b1b1b",
          border: `6px solid ${shown ? col : "#3a3a3a"}`,
          borderRadius: 18,
          boxShadow: shown ? `0 0 ${40 * p}px ${col}55` : "none",
          transform: `scale(${shown ? 1 + 0.06 * (1 - p) : 1})`,
        }}
      >
        <div style={{ textAlign: "center", fontFamily: HEAD, fontWeight: 700, fontSize: 46, color: WHITE, marginTop: 18, letterSpacing: 2 }}>MÉDIA DE HOJE</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 16 }}>
          {digits.map((d, i) => {
            const flip = shown ? Math.max(0, 1 - sp(t, at + i * 0.06, fps, 14, 220)) : 0;
            return (
              <div key={i} style={{ width: 170, height: 190, background: "#0b0b0b", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontWeight: 800, fontSize: 170, color: shown && d !== " " ? col : "#222", textShadow: shown && d !== " " ? `0 0 26px ${col}` : "none", transform: `perspective(600px) rotateX(${flip * 90}deg)`, position: "relative", overflow: "hidden" }}>
                {shown ? (d === " " ? "8" : d) : "8"}
                <div style={{ position: "absolute", left: 0, right: 0, top: 93, height: 4, background: "#000" }} />
              </div>
            );
          })}
        </div>
      </div>
    </>
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
      {/* gotas de suor */}
      {[0, 1].map((i) => {
        const q = ((t * 1.8 + i * 0.5) % 1);
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

const SceneVila: React.FC = () => {
  const { t, fps } = useT();
  const a = S.vila + 0.2;
  const lit = W(4, "testa");
  const dep = W(3, "depósito");
  const div = W(3, "dividido");
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < 100; i++) {
    const r = Math.floor(i / 10), c = i % 10;
    const at = a + (r + c) * 0.035;
    const p = sp(t, at, fps, 12, 220);
    // fase "depósito": um tijolinho sobe de cada um até o depósito e volta dividido
    const toDep = ramp(t, dep + (i % 10) * 0.02, dep + 0.5 + (i % 10) * 0.02) * (1 - ramp(t, div, div + 0.5));
    const isLit = t >= lit + (r + c) * 0.02;
    const x = 140 + c * 82, y = 620 + r * 46;
    cells.push(
      <div key={i} style={{ position: "absolute", left: x, top: y, transform: `scale(${p})`, opacity: p }}>
        <PixelArt grid={HEAD_M.slice(0, 7)} palette={[PAL.voce, PAL.prof, PAL.valdir, PAL.mecanico, PAL.motorista][i % 5]} size={5} />
        <div style={{ position: "absolute", left: 13, top: -4, width: 40, height: 12, borderRadius: 3, background: isLit ? ORANGE : "#222", boxShadow: isLit ? `0 0 8px ${ORANGE}` : "none" }} />
        {t > dep && t < div + 0.5 && (
          <div style={{ position: "absolute", left: 22, top: -10 - toDep * (y - 560), width: 16, height: 16, background: GOLD, opacity: toDep > 0.95 ? 0 : 1 }} />
        )}
      </div>
    );
  }
  const depShow = t >= dep - 0.1 && t < lit;
  return (
    <>
      {depShow && (
        <Pop2 at={dep - 0.1}>
          <div style={{ position: "absolute", left: 540 - 170, top: 520, width: 340, height: 74, border: `5px solid ${GOLD}`, background: "#1a1a1a", fontFamily: MONO, fontWeight: 800, fontSize: 40, color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8 }}>
            {t >= div ? "÷ 100" : "DEPÓSITO"}
          </div>
        </Pop2>
      )}
      {cells}
    </>
  );
};

const Pop2: React.FC<{ at: number; children: React.ReactNode }> = ({ at, children }) => {
  const { t, fps } = useT();
  const p = sp(t, at, fps, 11, 200);
  return <div style={{ position: "absolute", inset: 0, transform: `scale(${0.6 + 0.4 * p})`, opacity: Math.min(1, p * 2), transformOrigin: "540px 560px" }}>{children}</div>;
};

const SceneSpeaker: React.FC<{ value: string; at: number; tone?: "gold" | "red" }> = ({ value, at, tone }) => <Speaker value={value} at={at} tone={tone} />;

const SceneValdir: React.FC = () => {
  const { t, fps } = useT();
  const lie = W(8, "vida");
  const calc = W(7, "se");
  if (t < lie) {
    return (
      <>
        <Person pal={PAL.valdir} head="m" x={170} y={720} size={14} visor="100" />
        {/* calculadora */}
        <Pop2 at={calc}>
          <div style={{ position: "absolute", left: 470, top: 640, width: 420, height: 380, background: "#2a2a2a", border: "6px solid #444", borderRadius: 16, padding: 20, boxSizing: "border-box" }}>
            <div style={{ height: 110, background: "#9fb08a", borderRadius: 8, fontFamily: MONO, fontWeight: 800, fontSize: 60, color: "#1f2a17", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 18 }}>
              {t < W(7, "média") ? "100" : t < W(7, "um") ? "100 − 1" : "= 99"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 18 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} style={{ height: 52, background: i === 11 ? GOLD : "#4a4a4a", borderRadius: 6 }} />
              ))}
            </div>
          </div>
        </Pop2>
        <Chip at={W(7, "só")} text="SÓ 1 PONTO" x={680} y={1110} color={GOLD} />
        <Floor y={1046} />
      </>
    );
  }
  return (
    <>
      <Hammock x={270} y={960} w={540} pal={PAL.valdir} visor="99" t0={lie} />
      <Stamp at={W(8, "pra")} text="PRA QUÊ?" x={540} y={660} />
      <Floor y={1046} />
    </>
  );
};

const SceneMedico: React.FC = () => {
  const { t, fps } = useT();
  const lie = W(10, "pra");
  const books = Array.from({ length: 10 }).map((_, i) => {
    const at = W(9, "dez") + i * 0.07;
    const p = sp(t, at, fps, 12, 220);
    return (
      <div key={i} style={{ position: "absolute", left: 160 + (i % 2) * 8, top: 1020 - i * 34 - (1 - p) * 300, opacity: p }}>
        <PixelArt grid={BOOK} palette={{ ...ICON_PAL, G: ["#c8553d", BLUE, GOLD, "#6a8a5a"][i % 4] }} size={14} />
      </div>
    );
  });
  return (
    <>
      {t < lie ? (
        <>
          {books}
          <Person pal={PAL.medico} x={330} y={720} size={14} visor="99" />
          <div style={{ position: "absolute", left: 560, top: 820, fontFamily: HEAD, fontWeight: 700, fontSize: 120, color: GOLD, opacity: t > W(9, "igual") ? 1 : 0 }}>=</div>
          {t > W(9, "igual") && (
            <div style={{ position: "absolute", left: 650, top: 900, transform: "scale(0.62)", transformOrigin: "0 0" }}>
              <Hammock x={0} y={160} w={380} pal={PAL.valdir} visor="99" />
            </div>
          )}
        </>
      ) : (
        <>
          <Hammock x={270} y={960} w={540} pal={PAL.medico} visor="98" t0={lie} />
          <Stamp at={lie} text="PRA QUÊ?" x={540} y={660} />
        </>
      )}
      <Floor y={1046} />
    </>
  );
};

const SceneFila: React.FC = () => {
  const { t, fps } = useT();
  const who = [
    { pal: PAL.prof, head: "f" as HeadKind, label: "PROFESSORA", at: W(11, "professora") },
    { pal: PAL.mecanico, head: "m" as HeadKind, label: "MECÂNICO", at: W(11, "mecânico") },
    { pal: PAL.motorista, head: "m" as HeadKind, label: "MOTORISTA", at: W(11, "motorista") },
  ];
  return (
    <>
      {who.map((w, i) => {
        const x = 160 + i * 270;
        const p = sp(t, S.fila + 0.1 + i * 0.12, fps, 12, 200);
        const fall = ramp(t, w.at + 0.35, w.at + 0.75);
        const val = String(97 - i + (t >= w.at ? -0 : 1));
        return (
          <React.Fragment key={i}>
            <div style={{ position: "absolute", left: x, top: 720, transform: `translateY(${(1 - p) * 200 + fall * 40}px) scaleY(${1 - fall * 0.12})`, transformOrigin: "50% 100%", opacity: p }}>
              <Person pal={w.pal} head={t >= w.at ? "sleepy" : w.head} x={0} y={0} size={13} visor={val} gray={t >= w.at + 0.35} />
              {fall > 0.5 && <div style={{ position: "absolute", left: 120, top: -60, fontFamily: MONO, fontWeight: 800, fontSize: 40, color: BLUE, opacity: Math.abs(Math.sin(t * 3)) }}>z</div>}
            </div>
            <Chip at={w.at - 0.05} text={w.label} x={x + 85} y={1110} color={t >= w.at + 0.35 ? DIM : GOLD} />
          </React.Fragment>
        );
      })}
      <Floor y={1046} />
    </>
  );
};

const SceneComite: React.FC = () => {
  const { t, frame, fps } = useT();
  const fake = W(14, "e");
  if (t < fake) {
    const p = sp(t, S.comite + 0.05, fps, 12, 160);
    return (
      <>
        <div style={{ position: "absolute", left: 230, top: 640 + (1 - p) * 300, width: 620, height: 400, background: "#3a3a3a", border: "6px solid #555", borderRadius: 6, opacity: p }}>
          <div style={{ position: "absolute", left: 270, top: -70 }}>
            <PixelArt grid={STAR} palette={{ G: RED }} size={10} />
          </div>
          <div style={{ textAlign: "center", fontFamily: MONO, fontWeight: 800, fontSize: 48, color: WHITE, marginTop: 24, letterSpacing: 6 }}>COMITÊ</div>
          <div style={{ position: "absolute", left: 250, bottom: 0, width: 120, height: 170, background: "#222" }} />
        </div>
        {t >= W(13, "quem") && (
          <div style={{ position: "absolute", left: 540, top: 840, transform: `translate(-50%,-50%) rotate(-4deg) scale(${sp(t, W(13, "quem"), fps, 9, 260)})`, background: "#f2efe6", border: `8px solid ${RED}`, padding: "20px 36px", textAlign: "center" }}>
            <div style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 64, color: RED, lineHeight: 1 }}>PROIBIDO</div>
            <div style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 96, color: RED, lineHeight: 1 }}>PARAR</div>
          </div>
        )}
        {t >= W(13, "preso") && (
          <div style={{ position: "absolute", left: 230, top: 640, width: 620, height: 400, display: "flex", justifyContent: "space-around", transform: `translateY(${(1 - sp(t, W(13, "preso"), fps, 9, 240)) * -500}px)` }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{ width: 16, height: "100%", background: "#9a9a9a", boxShadow: "inset -4px 0 0 #6a6a6a" }} />
            ))}
          </div>
        )}
        <Floor y={1046} />
      </>
    );
  }
  // todo mundo "trabalhando" de mentira
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => {
        const pal = [PAL.prof, PAL.mecanico, PAL.valdir, PAL.motorista, PAL.medico][i];
        const fakeMove = Math.floor((frame + i * 5) / 12) % 2 === 0;
        const p = sp(t, fake + i * 0.08, fps, 12, 200);
        return (
          <div key={i} style={{ position: "absolute", left: 130 + i * 165, top: 760 + (1 - p) * 300, opacity: p }}>
            <Person pal={pal} pose={fakeMove ? "up" : "idle"} head="sleepy" x={0} y={0} size={10} visor={t < W(15, "vinte") ? "50" : "20"} gray={t >= W(14, "mentira")} />
          </div>
        );
      })}
      <Chip at={W(14, "trabalhar")} text="TRABALHANDO: 100/100" x={540} y={680} color={GOLD} out={W(14, "mentira")} />
      <Stamp at={W(14, "mentira")} text="DE MENTIRA" x={540} y={690} size={80} />
      <Floor y={1046} />
    </>
  );
};

const Night: React.FC<{ dark?: number; children?: React.ReactNode }> = ({ dark = 1, children }) => (
  <div style={{ position: "absolute", left: 100, top: 560, width: 880, height: 520, borderRadius: 14, overflow: "hidden", background: `linear-gradient(#0b1020, #1a2238)`, opacity: dark, border: "4px solid #262c40" }}>{children}</div>
);

const Bakery: React.FC<{ x: number; y: number; lit: boolean; who?: "rosa" | "tiago"; t0: number }> = ({ x, y, lit, who, t0 }) => {
  const { t } = useT();
  const knead = Math.sin((t - t0) * 9) * 4;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 330, height: 300 }}>
      <div style={{ position: "absolute", left: 0, top: 60, width: 330, height: 240, background: "#4a3a32", border: "5px solid #2a201c" }} />
      <div style={{ position: "absolute", left: -12, top: 30, width: 354, height: 44, background: "#7a2e26" }} />
      <div style={{ position: "absolute", left: 40, top: 86, width: 250, height: 36, background: "#e9e1cf", fontFamily: MONO, fontWeight: 800, fontSize: 26, color: "#3a2a20", display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: 4 }}>PADARIA</div>
      <div style={{ position: "absolute", left: 40, top: 140, width: 250, height: 130, background: lit ? "#ffcf6a" : "#151515", boxShadow: lit ? "0 0 70px 20px rgba(255,190,90,0.45)" : "none", overflow: "hidden" }}>
        {lit && who && (
          <div style={{ position: "absolute", left: 85, top: 22 + knead, filter: "brightness(0.15)" }}>
            <PixelArt grid={grid("idle", who === "rosa" ? "bun" : "m").slice(0, 14)} palette={who === "rosa" ? PAL.rosa : PAL.tiago} size={7} />
          </div>
        )}
      </div>
    </div>
  );
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

const SceneNoite: React.FC = () => {
  const { t } = useT();
  const [a] = sceneRange("noite");
  return (
    <Night>
      <div style={{ position: "absolute", left: 720, top: 40, width: 80, height: 80, borderRadius: 40, background: "#e9e4c8", boxShadow: "0 0 40px #e9e4c855" }} />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ position: "absolute", left: 10 + i * 140 + (i > 2 ? 230 : 0), top: 330 + (i % 2) * 20, display: i === 3 || i === 2 ? "none" : "block" }}>
          <PixelArt grid={HOUSE(false)} palette={{ ...ICON_PAL, R: "#3a2a2a", W: "#3a3a44", D: "#222" }} size={11} />
        </div>
      ))}
      <Bakery x={275} y={160} lit who="rosa" t0={a} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 460, height: 60, background: "#141826" }} />
      <Clock x={40} y={40} at={W(17, "quatro")} />
      {t < 0 && null}
    </Night>
  );
};

const SceneDialogo: React.FC = () => {
  const { t } = useT();
  return (
    <>
      <Person pal={PAL.tiago} x={230} y={830} size={10} head={t < W(18, "por") ? "m" : "m"} visor="20" />
      <Person pal={PAL.rosa} pose="apron" head="bun" x={600} y={700} size={14} visor="20" />
      <Bubble at={W(18, "mãe")} text="Por quê, mãe?" x={330} y={790} out={W(19, "porque") - 0.1} />
      <Bubble at={W(19, "porque")} text="Alguém tem que fazer o pão." x={560} y={680} color={GOLD} tail="right" />
      {t > W(19, "pão") && (
        <div style={{ position: "absolute", left: 470, top: 960 }}>
          <PixelArt grid={BREAD} palette={ICON_PAL} size={12} />
        </div>
      )}
      <Floor y={1046} />
    </>
  );
};

const SceneEscola: React.FC = () => {
  const { t, frame } = useT();
  const angry = t >= W(21, "mãe");
  const laugh = Math.floor(frame / 6) % 2 === 0;
  if (angry) {
    return (
      <>
        <Person pal={PAL.tiago} head="angry" x={180} y={780} size={12} visor="20" />
        <Person pal={PAL.rosa} pose="apron" head="bun" x={600} y={720} size={13} visor="20" />
        <Bubble at={W(21, "mãe")} text="PARA COM ISSO!" x={300} y={770} color={RED} />
        <Chip at={W(21, "vila")} text="HAHAHA" x={540} y={620} color={DIM} />
        <Floor y={1046} />
      </>
    );
  }
  return (
    <>
      {[PAL.kid1, PAL.kid2, PAL.kid3, PAL.kid1].map((p, i) => (
        <Person key={i} pal={p} head={laugh ? "laugh" : "m"} x={[130, 270, 690, 830][i]} y={850 + (laugh ? -4 : 0)} size={9} flip={i > 1} />
      ))}
      <Person pal={PAL.tiago} head="sleepy" x={475} y={860} size={10} visor="20" />
      <Chip at={S.escola + 0.4} text="HA HA HA" x={250} y={780} color={DIM} />
      <Chip at={S.escola + 0.7} text="HA HA" x={820} y={780} color={DIM} />
      <Stamp at={W(20, "trouxa")} text="FILHO DA TROUXA" x={540} y={700} size={60} rot={-5} />
      <Floor y={1046} />
    </>
  );
};

const SceneAvental: React.FC = () => {
  const { t } = useT();
  const [a] = sceneRange("avental");
  const hang = W(22, "pendurou");
  const p = ramp(t, hang - 0.2, hang + 0.25);
  const swing = t > hang ? Math.sin((t - hang) * 5) * 10 * Math.exp(-(t - hang) * 0.8) : 0;
  return (
    <>
      <div style={{ position: "absolute", left: 160, top: 580, width: 760, height: 460, background: "#1a1a1a", border: "4px solid #2a2a2a" }} />
      <div style={{ position: "absolute", left: 530, top: 610, width: 20, height: 20, borderRadius: 10, background: "#777" }} />
      <div style={{ position: "absolute", left: 540 - 120, top: 620 + (1 - p) * 300, transform: `rotate(${swing}deg)`, transformOrigin: "50% 0", opacity: p }}>
        <svg width={240} height={340} viewBox="0 0 240 340">
          <path d="M120 0 L70 60 M120 0 L170 60" stroke="#ddd" strokeWidth={6} />
          <path d="M70 60 L170 60 L180 120 L215 130 L215 330 L25 330 L25 130 L60 120 Z" fill="#f0ece0" stroke="#bbb" strokeWidth={5} />
          <rect x={80} y={200} width={80} height={60} fill="none" stroke="#c9c2b0" strokeWidth={5} />
        </svg>
      </div>
      {t < a && null}
    </>
  );
};

const SceneAnos: React.FC = () => {
  const { t, fps } = useT();
  const steps: [number, string, string][] = [
    [S.anos, "", "ANO"],
    [W(24, "um", 1), "1", "ANO"],
    [W(24, "cinco"), "5", "ANOS"],
    [W(24, "quinze"), "15", "ANOS"],
  ];
  const cur = steps.filter(([a]) => t >= a).pop()!;
  const p = sp(t, cur[0], fps, 10, 240);
  const medal = t > W(24, "quinze") + 0.5;
  return (
    <>
      <div style={{ position: "absolute", left: 540 - 200, top: 610, width: 400, height: 380, background: "#f2efe6", borderRadius: 14, overflow: "hidden", boxShadow: "0 14px 0 #00000066" }}>
        <div style={{ height: 80, background: RED, color: WHITE, fontFamily: MONO, fontWeight: 800, fontSize: 40, display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: 4 }}>CALENDÁRIO</div>
        <div style={{ textAlign: "center", fontFamily: HEAD, fontWeight: 700, fontSize: 180, color: "#1a1a1a", lineHeight: 1.1, transform: `perspective(700px) rotateX(${(1 - p) * 80}deg)`, transformOrigin: "50% 0" }}>{cur[1] || "–"}</div>
        <div style={{ textAlign: "center", fontFamily: HEAD, fontWeight: 700, fontSize: 52, color: "#555", marginTop: -14 }}>{cur[2]}</div>
      </div>
      <div style={{ position: "absolute", left: 150, top: 1030, fontFamily: MONO, fontWeight: 800, fontSize: 36, color: ORANGE }}>MÉDIA: 1 · 1 · 1 · 1</div>
      {medal && (
        <div style={{ position: "absolute", left: 790, top: 840, transform: `scale(${sp(t, W(24, "quinze") + 0.5, fps, 9, 220)}) rotate(10deg)`, textAlign: "center" }}>
          <div style={{ width: 0, height: 0, margin: "0 auto", borderLeft: "30px solid transparent", borderRight: "30px solid transparent", borderTop: `60px solid ${RED}` }} />
          <div style={{ width: 110, height: 110, borderRadius: 55, background: GOLD, border: "6px solid #b88a2a", display: "flex", alignItems: "center", justifyContent: "center", marginTop: -6, fontFamily: MONO, fontWeight: 800, fontSize: 24, color: "#5a4010" }}>COMITÊ</div>
        </div>
      )}
    </>
  );
};

const SceneAdulto: React.FC = () => {
  const { t } = useT();
  const [a] = sceneRange("adulto");
  const bread = W(26, "pãozinho");
  const mom = W(26, "mãe");
  return (
    <>
      <Hammock x={140} y={900} w={420} pal={PAL.tiago} visor="1" visorColor={ORANGE} t0={a} />
      {t >= bread && (
        <>
          <div style={{ position: "absolute", left: 600, top: 930, width: 300, height: 22, background: "#6b4a32" }} />
          <div style={{ position: "absolute", left: 620, top: 952, width: 18, height: 94, background: "#4f3524" }} />
          <div style={{ position: "absolute", left: 862, top: 952, width: 18, height: 94, background: "#4f3524" }} />
          <div style={{ position: "absolute", left: 690, top: 870 - (1 - Math.min(1, (t - bread) * 4)) * 120 }}>
            <PixelArt grid={BREAD} palette={ICON_PAL} size={12} />
          </div>
        </>
      )}
      {t >= mom && (
        <div style={{ position: "absolute", left: 640, top: 640, opacity: ramp(t, mom, mom + 0.3) }}>
          <Person pal={PAL.rosaVelha} pose="sit" head="sleepy" x={0} y={0} size={11} visor="1" />
          <div style={{ position: "absolute", left: 140, top: -40, fontFamily: MONO, fontWeight: 800, fontSize: 40, color: BLUE, opacity: Math.abs(Math.sin(t * 2)) }}>z z</div>
        </div>
      )}
      <Bubble at={W(27, "coisa")} text="coisa de velha..." x={330} y={720} color="#cfcfcf" />
      <Floor y={1046} />
    </>
  );
};

const SceneSabado: React.FC = () => {
  const { t } = useT();
  const [a, b] = sceneRange("sabado");
  const dim = ramp(t, a + 0.5, b);
  return (
    <>
      <div style={{ position: "absolute", left: 200, top: 880, width: 680, height: 90, background: "#3b2c22" }} />
      <div style={{ position: "absolute", left: 200, top: 820, width: 26, height: 220, background: "#4f3a2c" }} />
      <div style={{ position: "absolute", left: 854, top: 850, width: 26, height: 190, background: "#4f3a2c" }} />
      <div style={{ position: "absolute", left: 232, top: 830, width: 170, height: 56, background: "#e9e9e9" }} />
      <div style={{ position: "absolute", left: 255, top: 760 }}>
        <PixelArt grid={HEAD_SLEEPY.slice(0, 7)} palette={PAL.rosaVelha} size={12} />
        <Visor value="1" size={12} />
      </div>
      <div style={{ position: "absolute", left: 385, top: 838, width: 470, height: 52, background: "#5a3a3a", borderTop: "8px solid #7a4a4a" }} />
      <Clock x={640} y={640} text="08:00" at={a + 0.2} />
      <div style={{ position: "absolute", inset: 0, background: "#000", opacity: dim * 0.75 }} />
    </>
  );
};

const SceneSemPao: React.FC = () => {
  const { t, fps } = useT();
  return (
    <>
      <div style={{ position: "absolute", left: 180, top: 600, width: 720, height: 420, background: "#1c1c1c", border: "5px solid #2c2c2c" }}>
        {[0, 1, 2].map((r) => (
          <div key={r} style={{ position: "absolute", left: 20, right: 20, top: 120 + r * 130, height: 12, background: "#4a3a2a" }} />
        ))}
        {Array.from({ length: 12 }).map((_, i) => {
          const r = Math.floor(i / 4), c = i % 4;
          const gone = ramp(t, S.semPao + 0.2 + i * 0.06, S.semPao + 0.4 + i * 0.06);
          return (
            <div key={i} style={{ position: "absolute", left: 50 + c * 165, top: 60 + r * 130, opacity: 1 - gone, transform: `translateY(${gone * 40}px)` }}>
              <PixelArt grid={BREAD} palette={ICON_PAL} size={11} />
            </div>
          );
        })}
      </div>
      <Stamp at={W(30, "ninguém")} text="0 PÃES" x={540} y={810} size={90} />
      {t < 0 && sp(t, 0, fps)}
    </>
  );
};

const SceneRevela: React.FC = () => {
  const { t, fps } = useT();
  const [a] = sceneRange("revela");
  const walk = W(32, "por");
  const count = W(33, "cem");
  const flyStart = W(33, "cada");
  if (t < walk) {
    // a média no placar ilumina e "1" pulsa
    const p = sp(t, a + 0.1, fps, 10, 200);
    return (
      <>
        <div style={{ position: "absolute", left: 540 - 200, top: 640, width: 400, height: 380, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontWeight: 800, fontSize: 380, color: ORANGE, textShadow: `0 0 50px ${ORANGE}`, transform: `scale(${0.6 + 0.4 * p})` }}>1</div>
        <Chip at={W(31, "comitê")} text="COMITÊ ✕" x={540} y={1070} color={RED} />
      </>
    );
  }
  if (t < count) {
    const x = interpolate(t, [walk, count], [150, 560], clamp);
    const step = Math.floor(t * 8) % 2;
    return (
      <div style={{ filter: "sepia(0.6)" }}>
        <Night>
          <Bakery x={520} y={160} lit={t > count - 0.6} who="rosa" t0={a} />
          {t < count - 0.6 && (
            <div style={{ position: "absolute", left: x - 100, top: 270 + step * 3 }}>
              <PixelArt grid={grid("apron", "bun")} palette={PAL.rosa} size={8} />
            </div>
          )}
          <div style={{ position: "absolute", left: 0, right: 0, top: 460, height: 60, background: "#141826" }} />
          <Clock x={40} y={40} at={walk} />
          <div style={{ position: "absolute", left: 40, top: 130, fontFamily: MONO, fontWeight: 800, fontSize: 34, color: GOLD }}>
            DIA {Math.round(interpolate(t, [walk, count], [1, 5475], clamp))}
          </div>
        </Night>
      </div>
    );
  }
  // 100 pães → 100 casas, cada uma ganha 1
  const n = Math.round(interpolate(t, [count, count + 1.2], [0, 100], clamp));
  return (
    <>
      <div style={{ position: "absolute", left: 540, top: 640, transform: "translateX(-50%)", fontFamily: MONO, fontWeight: 800, fontSize: 64, color: GOLD }}>PÃES: {n}</div>
      {Array.from({ length: 30 }).map((_, i) => {
        const r = Math.floor(i / 10), c = i % 10;
        const fly = ramp(t, flyStart + i * 0.02, flyStart + 0.5 + i * 0.02);
        const show = t >= count + i * 0.03;
        return (
          <React.Fragment key={i}>
            <div style={{ position: "absolute", left: 130 + c * 84, top: 870 + r * 64 }}>
              <PixelArt grid={HOUSE(fly > 0.9)} palette={ICON_PAL} size={5} />
            </div>
            {show && (
              <div style={{ position: "absolute", left: interpolate(fly, [0, 1], [500, 140 + c * 84]), top: interpolate(fly, [0, 1], [740, 860 + r * 64]), opacity: fly > 0.95 ? 0 : 1 }}>
                <PixelArt grid={BREAD} palette={ICON_PAL} size={4} />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};

const SceneTiago: React.FC = () => {
  const { t } = useT();
  const [a] = sceneRange("tiago");
  const lit = t >= W(34, "acendeu") - 0.1;
  if (t < W(35, "alguém")) {
    return (
      <Night>
        <div style={{ position: "absolute", left: 720, top: 40, width: 80, height: 80, borderRadius: 40, background: "#e9e4c8" }} />
        <Bakery x={275} y={160} lit={lit} who="tiago" t0={a} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 460, height: 60, background: "#141826" }} />
        <Clock x={40} y={40} at={W(34, "quatro")} />
      </Night>
    );
  }
  return (
    <>
      <div style={{ position: "absolute", left: 160, top: 600, width: 760, height: 440, background: "radial-gradient(circle at 50% 40%, #4a3520, #1a1410)", borderRadius: 14 }} />
      <Person pal={PAL.tiagoAvental} pose="apron" x={440} y={690} size={14} visor="1" visorPulse={Math.max(0, 1 - (t - W(35, "alguém")) * 2)} />
      <div style={{ position: "absolute", left: 300, top: 960, width: 480, height: 22, background: "#6b4a32" }} />
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ position: "absolute", left: 340 + i * 140, top: 905 }}>
          <PixelArt grid={BREAD} palette={ICON_PAL} size={10} />
        </div>
      ))}
    </>
  );
};

const SceneFim: React.FC = () => {
  const { t, fps } = useT();
  const zoomIn = sp(t, W(38, "tiago"), fps, 16, 90);
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, transform: `scale(${1 + zoomIn * 0.35})`, transformOrigin: "540px 760px" }}>
        <Person pal={PAL.tiagoAvental} pose="apron" x={449} y={690} size={14} visor="1" visorPulse={t > W(38, "tiago") ? 0.4 + 0.2 * Math.sin(t * 6) : 0} />
        <Floor y={1046} />
      </div>
    </>
  );
};

// ---------------------------------------------------------------- transições
type Enter = "zoom" | "left" | "right" | "up" | "drop" | "flash" | "iris";
const ENTER: Partial<Record<keyof typeof S, Enter>> = {
  hook: "zoom", vila: "up", spk100: "drop", valdir: "right", medico: "left", fila: "right", spk50: "drop", comite: "zoom", spk20: "drop", noite: "iris",
  dialogo: "right", escola: "left", avental: "up", spk1: "drop", anos: "zoom", adulto: "right", sabado: "iris", spk0: "flash", semPao: "up", revela: "flash",
  tiago: "iris", spk1b: "drop", fim: "zoom",
};
const SHAKES = [W(8, "pra"), W(10, "pra"), W(12, "cinquenta"), W(13, "preso"), W(14, "mentira"), W(15, "vinte"), W(20, "trouxa"), W(23, "um"), W(29, "zero"), W(30, "ninguém")];

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
  const pts = [S.spk0, S.revela, W(29, "zero"), W(12, "cinquenta")];
  const v = Math.max(...pts.map((p) => interpolate(t, [p, p + 0.04, p + 0.3], [0, 0.85, 0], clamp)));
  const red = interpolate(t, [W(29, "zero"), W(29, "zero") + 0.05, W(29, "zero") + 0.6], [0, 0.35, 0], clamp);
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
      if (i < ws.length - 1 && ((len >= 26 && punct && rest > 8) || len >= 40)) flush();
    });
    flush();
  }
  return out;
})();
const GOLD_WORDS = new Set(["esforço", "recompensa.", "tudo...", "nada.", "igual", "igual.", "cem", "média", "valdir.", "um", "rede.", "dez", "estudo,", "comitê", "lei:", "rosa", "verdade.", "padaria.", "pão,", "pão.", "avental.", "quinze.", "nada.", "escondida,", "cem", "tiago.", "ganha", "pães"]);
const RED_WORDS = new Set(["quê?", "preso.", "mentira.", "trouxa.", "acordou.", "zero.", "ninguém", "vergonha."]);

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
    <div style={{ position: "absolute", top: 1400, left: 100, right: 100, textAlign: "center", fontFamily: HEAD, fontWeight: 700, fontSize: 52, lineHeight: 1.25 }}>
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
  const gray = interpolate(t, [W(14, "mentira"), W(14, "mentira") + 0.6, S.noite - 0.2, S.noite], [0, 0.0, 0, 0], clamp);
  return (
    <AbsoluteFill
      style={{
        background: BG,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.025) 2px, transparent 2px)",
        backgroundSize: "60px 60px",
      }}
    >
      <Audio src={staticFile("vila_igual/audio_final.wav")} />
      {/* área segura dos Reels: tudo reduzido a 90% e descido 20 px */}
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${20 + sy}px) scale(0.9)`, transformOrigin: "540px 960px", filter: gray ? `grayscale(${gray})` : undefined }}>
        <Hud />
        <Headline />
        <Scene k="hook"><SceneHook /></Scene>
        <Scene k="vila"><SceneVila /></Scene>
        <Scene k="spk100"><SceneSpeaker value="100" at={W(5, "cem")} /></Scene>
        <Scene k="valdir"><SceneValdir /></Scene>
        <Scene k="medico"><SceneMedico /></Scene>
        <Scene k="fila"><SceneFila /></Scene>
        <Scene k="spk50"><SceneSpeaker value="50" at={W(12, "cinquenta")} /></Scene>
        <Scene k="comite"><SceneComite /></Scene>
        <Scene k="spk20"><SceneSpeaker value="20" at={W(15, "vinte")} /></Scene>
        <Scene k="noite"><SceneNoite /></Scene>
        <Scene k="dialogo"><SceneDialogo /></Scene>
        <Scene k="escola"><SceneEscola /></Scene>
        <Scene k="avental"><SceneAvental /></Scene>
        <Scene k="spk1"><SceneSpeaker value="1" at={W(23, "um")} tone="red" /></Scene>
        <Scene k="anos"><SceneAnos /></Scene>
        <Scene k="adulto"><SceneAdulto /></Scene>
        <Scene k="sabado"><SceneSabado /></Scene>
        <Scene k="spk0"><SceneSpeaker value="0" at={W(29, "zero")} tone="red" /></Scene>
        <Scene k="semPao"><SceneSemPao /></Scene>
        <Scene k="revela"><SceneRevela /></Scene>
        <Scene k="tiago"><SceneTiago /></Scene>
        <Scene k="spk1b"><SceneSpeaker value="1" at={W(36, "um")} /></Scene>
        <Scene k="fim"><SceneFim /></Scene>
        <Captions />
      </AbsoluteFill>
      <Flash />
    </AbsoluteFill>
  );
};
