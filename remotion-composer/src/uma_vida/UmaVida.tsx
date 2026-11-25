import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Intro3D, T_A, T_B } from "./Intro3D";

// ==================================================================
// "UMA VIDA" — áudio do reel DZtkSrmAHQl (fala de Dean Graziosi) + 6 vídeos do Pinterest.
// 0–5,9 s: abertura em "flip" rápido (estilo abertura de estúdio de cinema): clipes trocando cada vez mais rápido,
// tom vermelho, flashes; fecha com o título UMA VIDA. com os clipes passando dentro das letras.
// 5,9 s em diante: clipes em tela cheia trocando nas frases, legenda em português palavra por palavra,
// frase fixa em cima e assinatura da marca.
// ==================================================================
const D = "uma_vida";
const FPS = 30;
export const TOTAL = 27.7;
const INTRO = 5.9;
const GOLD = "#e8b04b", WHITE = "#f4f1ea", INK = "#0a0605";
const BARLOW = "'Barlow Condensed', sans-serif";

// duração de cada clipe (s) — para não passar do fim ao escolher o ponto de início
const CLIP_LEN: Record<number, number> = { 1: 13.4, 2: 12.2, 3: 15.0, 4: 14.4, 5: 7.0, 6: 7.4 };

// --- abertura: cortes acelerando (duração de cada corte) e de qual clipe/ponto
const FLIPS: [number, number][] = (() => {
  const out: [number, number][] = [];
  let t = 0, i = 0;
  while (t < 4.25) {
    const d = Math.max(0.07, 0.34 * Math.pow(0.86, i));
    out.push([t, d]);
    t += d; i++;
  }
  return out;
})();
const flipClip = (i: number) => [1, 4, 2, 6, 5, 3][i % 6];
const flipFrom = (i: number) => { const c = flipClip(i); return ((i * 2.3) % Math.max(1, CLIP_LEN[c] - 1.5)); };

// --- parte principal: [início, fim, clipe, ponto de início no clipe]
const SHOTS: [number, number, number, number][] = [
  [INTRO, 8.3, 1, 0.0],
  [8.3, 10.6, 4, 0.5],
  [10.6, 12.3, 2, 1.0],
  [12.3, 14.2, 5, 0.5],
  [14.2, 16.9, 6, 0.0],
  [16.9, 19.25, 3, 2.0],
  [19.25, 21.0, 1, 6.0],
  [21.0, 23.3, 5, 3.5],
  [23.3, 24.95, 4, 6.0],
  [24.95, TOTAL, 3, 9.0],
];

// --- legenda em português (tradução da legenda do próprio reel), por frase, nos tempos da fala em inglês
const SUBS: [number, number, string][] = [
  [6.04, 7.45, "Por que não estamos correndo"],
  [7.48, 8.33, "como se estivéssemos pegando fogo"],
  [8.36, 10.5, "em direção aos nossos maiores sonhos?"],
  [10.62, 12.25, "Nós só temos uma chance nisso."],
  [12.32, 14.15, "Por que não somos como os loucos?"],
  [14.3, 15.32, "Eu quero que as pessoas olhem para mim"],
  [15.34, 16.85, "e digam: “esse cara é maluco.”"],
  [16.98, 17.85, "Ótimo."],
  [17.9, 19.27, "Eu só tenho uma chance nessa vida."],
  [19.3, 20.94, "Prefiro que me chamem de louco"],
  [20.96, 23.25, "e sonhador do que de acomodado."],
  [23.32, 24.94, "Você não nasceu para ficar na fila."],
  [24.98, TOTAL, "Você nasceu para se destacar."],
];
const KEY = ["fogo", "sonhos", "chance", "loucos", "maluco", "vida", "louco", "sonhador", "acomodado", "fila", "destacar"];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const er = (t: number, a: number, b: number) => ease((t - a) / (b - a));

const useFonts = () => {
  const [h] = useState(() => delayRender("fontes"));
  useEffect(() => {
    const f7 = new FontFace("Barlow Condensed", `url(${staticFile(`${D}/barlow-condensed-latin-700-normal.woff2`)})`, { weight: "700" });
    const f6 = new FontFace("Barlow Condensed", `url(${staticFile(`${D}/barlow-condensed-latin-600-normal.woff2`)})`, { weight: "600" });
    Promise.all([f7.load(), f6.load()]).then((fs) => { fs.forEach((f) => document.fonts.add(f)); continueRender(h); }).catch(() => continueRender(h));
  }, [h]);
};

// um clipe em tela cheia (o 3 é horizontal: largura toda + fundo desfocado)
const Clip: React.FC<{ c: number; from: number; zoom?: number }> = ({ c, from, zoom = 1 }) => {
  const src = staticFile(`${D}/c${c}.mp4`);
  const start = Math.round(from * FPS);
  if (c === 3) {
    return (
      <AbsoluteFill style={{ background: INK }}>
        <OffthreadVideo src={src} startFrom={start} muted style={{ position: "absolute", left: -540, top: 0, width: 2160 * 1.6, height: 1920, objectFit: "cover", filter: "blur(40px) brightness(0.55)" }} />
        <OffthreadVideo src={src} startFrom={start} muted style={{ position: "absolute", left: (1080 - 1080 * 1.35) / 2, top: (1920 - 607.5 * 1.35) / 2, width: 1080 * 1.35, height: 607.5 * 1.35, objectFit: "cover" }} />
      </AbsoluteFill>
    );
  }
  return <OffthreadVideo src={src} startFrom={start} muted style={{ width: 1080, height: 1920, objectFit: "cover", transform: `scale(${zoom})` }} />;
};

// ------------------------------------------------------------------ abertura (v2: 3D, ver Intro3D.tsx)
const Intro: React.FC<{ t: number }> = ({ t }) => {
  // flashes nas viradas (túnel → letras → recuo) e piscadas rápidas durante o túnel
  const flashAt = [0.0, T_A, T_B];
  const flash = Math.max(0, ...flashAt.map((a) => (t >= a && t < a + 0.12 ? 1 - (t - a) / 0.12 : 0))) * 0.6;
  const tunnelBlink = t < T_A ? (Math.floor(t * 12) % 3 === 0 ? 0.08 : 0) : 0;
  return (
    <AbsoluteFill style={{ background: "#0b0605" }}>
      <Intro3D />
      {/* luz quente nas bordas, como na referência */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,.75) 100%)" }} />
      <AbsoluteFill style={{ background: "#ffb070", mixBlendMode: "soft-light", opacity: 0.35 }} />
      <AbsoluteFill style={{ background: "#fff", opacity: flash + tunnelBlink }} />
      {/* "One life." no começo */}
      {t < 1.0 && (
        <div style={{ position: "absolute", left: 120, right: 120, top: 1300, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 84, color: WHITE, letterSpacing: 4, opacity: er(t, 0, 0.12) * (1 - er(t, 0.8, 1.0)), WebkitTextStroke: "10px #0a0605", paintOrder: "stroke fill" }}>UMA VIDA.</div>
      )}
      <div style={{ position: "absolute", left: 120, right: 120, top: 1400, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 64, letterSpacing: 10, color: WHITE, opacity: er(t, 5.0, 5.3), transform: `translateY(${(1 - er(t, 5.0, 5.3)) * 16}px)`, textShadow: "0 4px 16px rgba(0,0,0,.8)" }}>APENAS UMA CHANCE.</div>
      <AbsoluteFill style={{ background: "#000", opacity: er(t, INTRO - 0.12, INTRO) }} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ legenda (cada palavra surge no ritmo da frase)
const Subtitle: React.FC<{ t: number }> = ({ t }) => {
  const s = SUBS.find(([a, b]) => t >= a - 0.05 && t < b + 0.05);
  if (!s) return null;
  const [a, b, txt] = s;
  const words = txt.split(" ");
  const total = words.reduce((n, w) => n + w.length, 0);
  const span = Math.min(b - a, Math.max(0.6, (b - a) * 0.8));
  let acc = 0;
  const out = Math.min(1, er(t, b - 0.08, b + 0.05) + 0);
  return (
    <div style={{ position: "absolute", left: 120, right: 120, top: 1290, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 66, lineHeight: 1.08, letterSpacing: 1, opacity: 1 - (b < TOTAL ? out : 0) }}>
      {words.map((w, i) => {
        const at = a + (acc / total) * span;
        acc += w.length;
        const p = clamp01((t - at) / 0.12);
        const clean = w.toLowerCase().replace(/[^a-zà-ú]/g, "");
        return (
          <span key={i} style={{ display: "inline-block", margin: "0 8px", color: KEY.includes(clean) ? GOLD : WHITE, opacity: p, transform: `translateY(${(1 - p) * 12}px)`, WebkitTextStroke: "9px #0a0605", paintOrder: "stroke fill", textShadow: "0 4px 14px rgba(0,0,0,.7)" }}>{w.toUpperCase()}</span>
        );
      })}
    </div>
  );
};

// ------------------------------------------------------------------ raiz
export const UmaVida: React.FC = () => {
  useFonts();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const shot = SHOTS.findIndex(([a, b]) => t >= a && t < b);
  const sinceShot = shot >= 0 ? t - SHOTS[shot][0] : 1;
  const hook = er(t, INTRO + 0.1, INTRO + 0.4);
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Audio src={staticFile(`${D}/audio.wav`)} />
      <Audio src={staticFile(`${D}/sfx.wav`)} volume={0.35} />
      {t < INTRO && <Intro t={t} />}
      {SHOTS.map(([a, b, c, from], i) => (
        <Sequence key={i} from={Math.round(a * FPS)} durationInFrames={Math.round((b - a) * FPS) + 1}>
          <AbsoluteFill style={{ transform: `scale(${1.02 + (t - a) * 0.012})` }}><Clip c={c} from={from} /></AbsoluteFill>
        </Sequence>
      ))}
      {t >= INTRO && (
        <AbsoluteFill>
          {/* degradês para os textos lerem sobre qualquer imagem */}
          <AbsoluteFill style={{ background: "linear-gradient(rgba(10,6,5,.75) 0%, rgba(10,6,5,0) 22%, rgba(10,6,5,0) 58%, rgba(10,6,5,.85) 100%)" }} />
          <AbsoluteFill style={{ background: "#fff", opacity: Math.max(0, 1 - sinceShot / 0.08) * 0.25 }} />
          <AbsoluteFill style={{ background: "#000", opacity: 1 - er(t, INTRO, INTRO + 0.15) }} />
          {/* frase fixa em cima */}
          <div style={{ position: "absolute", top: 228, left: 120, right: 120, textAlign: "center", fontFamily: BARLOW, fontWeight: 700, fontSize: 62, lineHeight: 1.0, letterSpacing: 2, opacity: hook, textShadow: "0 3px 0 rgba(0,0,0,.7), 0 0 18px rgba(0,0,0,.6)" }}>
            <div style={{ color: WHITE }}>VOCÊ SÓ TEM</div>
            <div style={{ color: GOLD }}>UMA CHANCE.</div>
          </div>
          <Subtitle t={t} />
        </AbsoluteFill>
      )}
      {/* assinatura da marca (o vídeo todo) */}
      <div style={{ position: "absolute", left: 0, top: 1556, width: 1080, height: 96, display: "flex", justifyContent: "center", alignItems: "center", gap: 22, color: "#edeae3", fontFamily: BARLOW }}>
        <Img src={staticFile(`${D}/avatar.png`)} style={{ width: 96, height: 96, borderRadius: "50%" }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: 700, fontSize: 44, lineHeight: "48px", letterSpacing: 1, opacity: 0.92 }}>Foco no essencial</span>
          <span style={{ fontWeight: 600, fontSize: 32, lineHeight: "38px", letterSpacing: 1.5, opacity: 0.55 }}>@foco_noessencial</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
