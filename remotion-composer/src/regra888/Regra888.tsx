import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadSpaceGrotesk } from "../lib/localFonts";
import captionsData from "./captions.json";
import {
  CHAR_ARMS_UP,
  CHAR_IDLE,
  CHAR_PAL,
  CHAR_SIT,
  CHAR_SLEEP,
  ICONS,
  ICON_PAL,
  PixelArt,
} from "./Pixel";

const { fontFamily: HEAD } = loadSpaceGrotesk(["500", "700"]);
const MONO = "'JetBrains Mono', 'DejaVu Sans Mono', monospace";

const GOLD = "#E8B84A";
const BLUE = "#7aa7e0";
const BG = "#121212";
const DIM = "#5a5a5a";

type Cap = { w: string; s: number; e: number; line: number };
const CAPS = captionsData as Cap[];

// Scene boundaries (seconds), derived from the narration word timings
const T = {
  blocks: 3.0,
  split: 6.0,
  work: 8.0,
  sleep: 11.0,
  rest: 13.8,
  f: 16.8,
  a: 20.5,
  s: 25.5,
  end: 29.9,
  total: 34.0,
};

const capTime = (w: string, line: number) => {
  const c = CAPS.find((x) => x.line === line && x.w.toLowerCase().startsWith(w.toLowerCase()));
  return c ? c.s : 0;
};

const useT = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return { t: frame / fps, frame, fps };
};

// ---------- small helpers ----------
const Pop: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  at,
  children,
  style,
}) => {
  const { frame, fps } = useT();
  const sp = spring({ frame: frame - at * fps, fps, config: { damping: 12, stiffness: 180 } });
  const op = interpolate(frame - at * fps, [0, 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <div style={{ transform: `scale(${0.6 + 0.4 * sp})`, opacity: op, ...style }}>{children}</div>;
};

const inScene = (t: number, a: number, b: number) => t >= a && t < b;

const sceneOpacity = (t: number, a: number, b: number) =>
  interpolate(t, [a, a + 0.25, b - 0.2, b], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

// ---------- HUD ----------
const HudBox: React.FC<{ label: string; value: string; active?: boolean; bumpAt?: number[] }> = ({
  label,
  value,
  active,
  bumpAt = [],
}) => {
  const { t } = useT();
  const last = bumpAt.filter((b) => b <= t).pop();
  const since = last === undefined ? 99 : t - last;
  const plusOp = interpolate(since, [0, 0.1, 0.6], [0, 1, 0], { extrapolateRight: "clamp" });
  const scale = 1 + interpolate(since, [0, 0.08, 0.3], [0, 0.12, 0], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "relative",
        width: 420,
        height: 128,
        border: `4px solid ${active ? GOLD : "#3a3a3a"}`,
        background: active ? "rgba(232,184,74,0.08)" : "#181818",
        borderRadius: 6,
        padding: "14px 22px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: 4, color: active ? GOLD : "#8a8a8a", fontWeight: 700 }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 56,
          fontWeight: 800,
          color: "#f2f2f2",
          textAlign: "right",
          lineHeight: 1,
          transform: `scale(${scale})`,
          transformOrigin: "right center",
        }}
      >
        {value}
      </div>
      <div
        style={{
          position: "absolute",
          right: 10,
          top: -46,
          fontFamily: MONO,
          fontWeight: 800,
          fontSize: 34,
          color: GOLD,
          opacity: plusOp,
        }}
      >
        +1
      </div>
    </div>
  );
};

const countUp = (t: number, from: number, to: number, a: number, b: number) =>
  Math.round(interpolate(t, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

const bumps = (from: number, to: number, a: number, b: number) => {
  const out: number[] = [];
  for (let i = 1; i <= to - from; i++) out.push(a + ((b - a) * i) / (to - from));
  return out;
};

const WORK_A = capTime("Oito", 3);
const WORK_B = capTime("foco", 3) + 0.4;
const SLEEP_A = capTime("Oito", 4);
const SLEEP_B = capTime("negociar", 4) + 0.3;

const CHECKS = {
  familia: capTime("família", 6),
  felicidade: capTime("felicidade", 6),
  fe: capTime("fé", 6),
  alimentacao: capTime("alimentação", 7),
  atividade: capTime("atividade", 7),
  aprendizado: capTime("aprendizado", 7),
  saude: capTime("saúde", 8),
  socializacao: capTime("socialização", 8),
  sabedoria: capTime("sabedoria", 8),
};
const checkCount = (t: number) => Object.values(CHECKS).filter((x) => t >= x).length;

const Hud: React.FC = () => {
  const { t } = useT();
  let left: React.ReactNode;
  let right: React.ReactNode;
  if (t < T.work) {
    left = <HudBox label="HORAS" value="24" active={t >= T.blocks} />;
    right = <HudBox label="PARTES" value={t >= T.split ? "3" : "0"} bumpAt={[T.split]} active={t >= T.split} />;
  } else if (t < T.sleep) {
    const v = countUp(t, 0, 8, WORK_A, WORK_B);
    left = <HudBox label="TRABALHO" value={`${v}h`} active bumpAt={bumps(0, 8, WORK_A, WORK_B)} />;
    right = <HudBox label="TOTAL" value={`${v}/24`} />;
  } else if (t < T.rest) {
    const v = countUp(t, 0, 8, SLEEP_A, SLEEP_B);
    left = <HudBox label="SONO" value={`${v}h`} active bumpAt={bumps(0, 8, SLEEP_A, SLEEP_B)} />;
    right = <HudBox label="TOTAL" value={`${8 + v}/24`} />;
  } else if (t < T.f) {
    left = <HudBox label="SOBRAM" value="8h" active />;
    right = <HudBox label="TOTAL" value="16/24" />;
  } else if (t < T.end) {
    const group = t < T.a ? "3F" : t < T.s ? "3A" : "3S";
    const base = t < T.a ? 0 : t < T.s ? 3 : 6;
    const n = Math.max(0, Math.min(3, checkCount(t) - base));
    left = <HudBox label={group} value={`${n}/3`} active bumpAt={Object.values(CHECKS)} />;
    right = <HudBox label="CHECKLIST" value={`${checkCount(t)}/9`} />;
  } else {
    left = <HudBox label="HORAS" value="24/24" active />;
    right = <HudBox label="CHECKLIST" value="9/9" active />;
  }
  return (
    <div style={{ position: "absolute", top: 120, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 40 }}>
      {left}
      {right}
    </div>
  );
};

// ---------- Headline ----------
const Headline: React.FC = () => {
  const { t } = useT();
  const H = (lines: { text: string; gold?: boolean; at: number }[]) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      {lines.map((l, i) =>
        t >= l.at ? (
          <Pop key={i} at={l.at}>
            <div
              style={{
                fontFamily: HEAD,
                fontWeight: 700,
                fontSize: l.gold ? 104 : 84,
                lineHeight: 1.02,
                color: l.gold ? GOLD : "#f2f2f2",
                letterSpacing: -1,
                textAlign: "center",
                textShadow: "0 6px 0 rgba(0,0,0,0.5)",
              }}
            >
              {l.text}
            </div>
          </Pop>
        ) : (
          <div key={i} style={{ height: l.gold ? 106 : 86 }} />
        )
      )}
    </div>
  );
  let content: React.ReactNode = null;
  if (t < T.blocks) content = H([{ text: "A REGRA", at: 0.9 }, { text: "8 + 8 + 8", gold: true, at: 1.5 }]);
  else if (t < T.work)
    content = H([
      { text: "24 HORAS", at: T.blocks + 0.1 },
      { text: "3 PARTES", gold: true, at: T.split },
    ]);
  else if (t < T.sleep)
    content = H([
      { text: "8h DE TRABALHO", at: WORK_A },
      { text: "COM FOCO", gold: true, at: capTime("foco", 3) },
    ]);
  else if (t < T.rest)
    content = H([
      { text: "8h DE SONO", at: SLEEP_A },
      { text: "SEM NEGOCIAR", gold: true, at: capTime("negociar", 4) },
    ]);
  else if (t < T.f)
    content = H([
      { text: "AS 8 QUE SOBRAM", at: capTime("sobram", 5) - 0.3 },
      { text: "DECIDEM QUEM", gold: true, at: capTime("decidem", 5) },
      { text: "VOCÊ VIRA", gold: true, at: capTime("vira", 5) },
    ]);
  else if (t < T.a) content = H([{ text: "3F", gold: true, at: capTime("três", 6) }]);
  else if (t < T.s) content = H([{ text: "3A", gold: true, at: capTime("Três", 7) }]);
  else if (t < T.end) content = H([{ text: "3S", gold: true, at: capTime("três", 8) }]);
  else
    content = H([
      { text: "SALVA", gold: true, at: capTime("Salva", 9) },
      { text: "E MONTA SEU DIA", at: capTime("monta", 9) },
    ]);
  return <div style={{ position: "absolute", top: 300, left: 40, right: 40 }}>{content}</div>;
};

// ---------- 24-hour bar ----------
const HourBar: React.FC<{ y: number }> = ({ y }) => {
  const { t, frame, fps } = useT();
  const split = t >= T.split;
  const blocks = [];
  for (let i = 0; i < 24; i++) {
    const appear = T.blocks + 0.15 + i * 0.06;
    const op = interpolate(t, [appear, appear + 0.12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    let fill = "#242424";
    let border = "#3a3a3a";
    if (i < 8) {
      const at = WORK_A + ((WORK_B - WORK_A) * (i + 1)) / 8;
      if (t >= at) { fill = GOLD; border = GOLD; }
    } else if (i < 16) {
      const at = SLEEP_A + ((SLEEP_B - SLEEP_A) * (i - 7)) / 8;
      if (t >= at) { fill = BLUE; border = BLUE; }
    } else {
      if (t >= T.rest && t < T.f) {
        const blink = Math.floor((frame / fps) * 3) % 2 === 0;
        border = blink ? GOLD : "#3a3a3a";
      }
      if (t >= T.f) {
        const filled = Math.floor((checkCount(t) / 9) * 8 + 0.001);
        if (i - 16 < filled) { fill = "#f2f2f2"; border = "#f2f2f2"; }
      }
    }
    const gap = split && (i === 8 || i === 16) ? 26 : 0;
    blocks.push(
      <div
        key={i}
        style={{
          width: 30,
          height: 54,
          marginLeft: i === 0 ? 0 : 6 + gap,
          background: fill,
          border: `3px solid ${border}`,
          boxSizing: "border-box",
          opacity: op,
        }}
      />
    );
  }
  const labels = split ? (
    <div style={{ display: "flex", justifyContent: "center", gap: 0, marginTop: 14, fontFamily: MONO, fontSize: 24, fontWeight: 700 }}>
      <div style={{ width: 282, textAlign: "center", color: t >= WORK_A ? GOLD : DIM }}>TRABALHO</div>
      <div style={{ width: 26 }} />
      <div style={{ width: 282, textAlign: "center", color: t >= SLEEP_A ? BLUE : DIM }}>SONO</div>
      <div style={{ width: 26 }} />
      <div style={{ width: 282, textAlign: "center", color: t >= T.rest ? "#f2f2f2" : DIM }}>LIVRE</div>
    </div>
  ) : null;
  return (
    <div style={{ position: "absolute", top: y, left: 0, right: 0 }}>
      <div style={{ display: "flex", justifyContent: "center" }}>{blocks}</div>
      {labels}
    </div>
  );
};

// ---------- Stage scenes ----------
const Floor: React.FC<{ y: number }> = ({ y }) => (
  <div style={{ position: "absolute", top: y, left: 120, right: 120, height: 6, background: "#2c2c2c" }} />
);

const SceneIntro: React.FC = () => {
  const { t, frame } = useT();
  const bob = Math.sin(frame / 8) * 4;
  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(t, 0, T.work) }}>
      <div style={{ position: "absolute", left: 540 - 91, top: 760 + bob }}>
        <PixelArt grid={CHAR_IDLE} palette={CHAR_PAL} size={14} />
      </div>
      <Floor y={1046} />
      {t >= T.blocks && <HourBar y={1120} />}
    </AbsoluteFill>
  );
};

const SceneWork: React.FC = () => {
  const { t, frame } = useT();
  const type = Math.floor(frame / 4) % 2;
  const lines = Math.floor((t - T.work) * 5);
  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(t, T.work, T.sleep) }}>
      {/* character sitting behind desk */}
      <div style={{ position: "absolute", left: 540 - 91, top: 760 + (type ? 2 : 0) }}>
        <PixelArt grid={CHAR_SIT} palette={CHAR_PAL} size={14} />
      </div>
      {/* laptop */}
      <div style={{ position: "absolute", left: 540 - 128, top: 880 }}>
        <div style={{ width: 256, height: 150, background: "#2b2b2b", border: "8px solid #3d3d3d", boxSizing: "border-box", padding: 14 }}>
          {Array.from({ length: Math.min(6, lines) }).map((_, i) => (
            <div key={i} style={{ height: 10, width: `${40 + ((i * 37) % 55)}%`, background: i % 3 === 0 ? GOLD : BLUE, marginBottom: 8, opacity: 0.85 }} />
          ))}
        </div>
      </div>
      {/* desk */}
      <div style={{ position: "absolute", left: 220, right: 220, top: 1030, height: 26, background: "#6b4a32" }} />
      <div style={{ position: "absolute", left: 250, top: 1056, width: 22, height: 0, background: "#4f3524" }} />
      <HourBar y={1120} />
    </AbsoluteFill>
  );
};

const SceneSleep: React.FC = () => {
  const { t, fps, frame } = useT();
  const zs = [0, 0.5, 1.0].map((d, i) => {
    const p = ((t - T.sleep + d) % 1.5) / 1.5;
    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: 420 + p * 120 + i * 10,
          top: 820 - p * 160,
          fontFamily: MONO,
          fontWeight: 800,
          fontSize: 40 + i * 12,
          color: BLUE,
          opacity: interpolate(p, [0, 0.2, 0.8, 1], [0, 1, 1, 0]),
        }}
      >
        Z
      </div>
    );
  });
  const breathe = Math.sin(frame / (fps * 0.4)) * 2;
  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(t, T.sleep, T.rest) }}>
      {/* bed */}
      <div style={{ position: "absolute", left: 200, top: 900, width: 680, height: 90, background: "#3b2c22" }} />
      <div style={{ position: "absolute", left: 200, top: 840, width: 26, height: 200, background: "#4f3a2c" }} />
      <div style={{ position: "absolute", left: 854, top: 870, width: 26, height: 170, background: "#4f3a2c" }} />
      <div style={{ position: "absolute", left: 232, top: 850, width: 170, height: 56, background: "#e9e9e9" }} />
      <div style={{ position: "absolute", left: 255, top: 790 }}>
        <PixelArt grid={CHAR_SLEEP} palette={CHAR_PAL} size={14} />
      </div>
      {/* blanket over the body, breathing */}
      <div style={{ position: "absolute", left: 385, top: 858 - breathe, width: 470, height: 52, background: "#2f4a6b", borderTop: "8px solid #3e5f88" }} />
      <div style={{ position: "absolute", left: 385, top: 884 - breathe, width: 470, height: 8, background: GOLD, opacity: 0.8 }} />
      {zs}
      <HourBar y={1120} />
    </AbsoluteFill>
  );
};

const SceneRest: React.FC = () => {
  const { t, frame } = useT();
  const bob = Math.sin(frame / 8) * 4;
  const q = Math.floor(frame / 10) % 2 === 0;
  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(t, T.rest, T.f) }}>
      <div style={{ position: "absolute", left: 540 - 91, top: 760 + bob }}>
        <PixelArt grid={CHAR_IDLE} palette={CHAR_PAL} size={14} />
      </div>
      <div style={{ position: "absolute", left: 640, top: 700, fontFamily: MONO, fontSize: 90, fontWeight: 800, color: q ? GOLD : "#f2f2f2" }}>?</div>
      <Floor y={1046} />
      <HourBar y={1120} />
    </AbsoluteFill>
  );
};

const CARD_LABELS: Record<string, string> = {
  familia: "FAMÍLIA",
  felicidade: "FELICIDADE",
  fe: "FÉ",
  alimentacao: "ALIMENTAÇÃO",
  atividade: "ATIVIDADE FÍSICA",
  aprendizado: "APRENDIZADO",
  saude: "SAÚDE",
  socializacao: "SOCIALIZAÇÃO",
  sabedoria: "SABEDORIA",
};

const Card: React.FC<{ id: keyof typeof CHECKS; appear: number }> = ({ id, appear }) => {
  const { t, frame, fps } = useT();
  const at = CHECKS[id];
  const done = t >= at;
  const sp = spring({ frame: frame - appear * fps, fps, config: { damping: 14, stiffness: 160 } });
  const ck = spring({ frame: frame - at * fps, fps, config: { damping: 9, stiffness: 220 } });
  return (
    <div
      style={{
        width: 860,
        height: 168,
        display: "flex",
        alignItems: "center",
        gap: 34,
        padding: "0 34px",
        boxSizing: "border-box",
        background: done ? "rgba(232,184,74,0.10)" : "#1a1a1a",
        border: `4px solid ${done ? GOLD : "#333"}`,
        borderRadius: 8,
        transform: `translateX(${(1 - sp) * 140}px)`,
        opacity: Math.min(1, sp * 1.4),
      }}
    >
      <div style={{ width: 120, display: "flex", justifyContent: "center" }}>
        <PixelArt grid={ICONS[id]} palette={ICON_PAL} size={9} />
      </div>
      <div style={{ flex: 1, fontFamily: HEAD, fontWeight: 700, fontSize: 52, color: done ? "#f2f2f2" : "#9a9a9a" }}>{CARD_LABELS[id]}</div>
      <div
        style={{
          width: 74,
          height: 74,
          border: `5px solid ${done ? GOLD : "#4a4a4a"}`,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: MONO,
          fontSize: 54,
          fontWeight: 800,
          color: BG,
          background: done ? GOLD : "transparent",
        }}
      >
        {done ? <span style={{ transform: `scale(${ck})` }}>✓</span> : null}
      </div>
    </div>
  );
};

const SceneGroup: React.FC<{ a: number; b: number; ids: (keyof typeof CHECKS)[] }> = ({ a, b, ids }) => {
  const { t } = useT();
  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(t, a, b) }}>
      <div style={{ position: "absolute", top: 560, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        {ids.map((id, i) => (
          <Card key={id} id={id} appear={a + 0.15 + i * 0.18} />
        ))}
      </div>
      <HourBar y={1180} />
    </AbsoluteFill>
  );
};

const SceneEnd: React.FC = () => {
  const { t, frame } = useT();
  const jump = Math.abs(Math.sin(frame / 7)) * 30;
  const ids = Object.keys(CHECKS) as (keyof typeof CHECKS)[];
  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(t, T.end, T.total + 1) }}>
      <div style={{ position: "absolute", top: 600, left: 120, width: 400, display: "grid", gridTemplateColumns: "repeat(3, 120px)", gap: 20 }}>
        {ids.map((id, i) => (
          <Pop key={id} at={T.end + 0.1 + i * 0.07}>
            <div style={{ width: 120, height: 120, border: `4px solid ${GOLD}`, background: "rgba(232,184,74,0.08)", display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
              <PixelArt grid={ICONS[id]} palette={ICON_PAL} size={7} />
            </div>
          </Pop>
        ))}
      </div>
      <div style={{ position: "absolute", left: 640, top: 690 - jump }}>
        <PixelArt grid={CHAR_ARMS_UP} palette={CHAR_PAL} size={14} />
      </div>
      <Floor y={1000} />
      <HourBar y={1120} />
    </AbsoluteFill>
  );
};

// ---------- Captions (word by word) ----------
const GOLD_WORDS = new Set(
  [
    "8+8+8?", "24", "trabalho", "foco.", "sono,", "negociar.", "sobram", "decidem", "vira.",
    "F:", "família,", "felicidade", "fé.", "A:", "alimentação,", "atividade", "física", "aprendizado.",
    "S:", "saúde,", "socialização", "sabedoria.", "Salva,", "dia",
  ].map((w) => w.toLowerCase())
);

const Captions: React.FC = () => {
  const { t } = useT();
  const started = CAPS.filter((c) => c.s <= t + 0.05);
  if (!started.length) return null;
  const line = started[started.length - 1].line;
  const lineWords = CAPS.filter((c) => c.line === line);
  const lineEnd = lineWords[lineWords.length - 1].e;
  if (t > lineEnd + 0.9 && line !== 9) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 1400,
        left: 90,
        right: 90,
        textAlign: "center",
        fontFamily: HEAD,
        fontWeight: 700,
        fontSize: 50,
        lineHeight: 1.25,
      }}
    >
      {lineWords.map((c, i) => {
        const spoken = c.s <= t + 0.05;
        const gold = GOLD_WORDS.has(c.w.toLowerCase());
        const color = spoken ? (gold ? GOLD : "#f2f2f2") : "#4a4a4a";
        return (
          <span key={i} style={{ color }}>
            {c.w}
            {i < lineWords.length - 1 ? " " : ""}
          </span>
        );
      })}
    </div>
  );
};

// ---------- Root composition ----------
export const Regra888: React.FC = () => {
  const { t } = useT();
  return (
    <AbsoluteFill
      style={{
        background: BG,
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.025) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.025) 2px, transparent 2px)",
        backgroundSize: "60px 60px",
      }}
    >
      <Audio src={staticFile("narracao.wav")} />
      <Hud />
      <Headline />
      {inScene(t, 0, T.work) && <SceneIntro />}
      {inScene(t, T.work, T.sleep) && <SceneWork />}
      {inScene(t, T.sleep, T.rest) && <SceneSleep />}
      {inScene(t, T.rest, T.f) && <SceneRest />}
      {inScene(t, T.f, T.a) && <SceneGroup a={T.f} b={T.a} ids={["familia", "felicidade", "fe"]} />}
      {inScene(t, T.a, T.s) && <SceneGroup a={T.a} b={T.s} ids={["alimentacao", "atividade", "aprendizado"]} />}
      {inScene(t, T.s, T.end) && <SceneGroup a={T.s} b={T.end} ids={["saude", "socializacao", "sabedoria"]} />}
      {t >= T.end && <SceneEnd />}
      <Captions />
    </AbsoluteFill>
  );
};
