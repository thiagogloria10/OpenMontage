import React, { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";

// ==================================================================
// Abertura 3D no estilo das aberturas de estúdio de cinema (referência: pin 728738783452739043):
// A (0–2,1 s) voo por um túnel de painéis com as imagens dos vídeos;
// B (2,1–4,3 s) câmera passando rente às letras 3D de "UMA / VIDA." (imagens na face, lateral dourada);
// C (4,3–5,9 s) câmera recua e a palavra inteira assenta no centro.
// Texturas = quadros dos 6 vídeos (public/uma_vida/fr/cN_XX.jpg, 10 por vídeo), trocando rápido.
// ==================================================================
const D = "uma_vida";
const FR = Array.from({ length: 6 }).flatMap((_, c) => Array.from({ length: 10 }).map((__, k) => `${D}/fr/c${c + 1}_${String(k + 1).padStart(2, "0")}.jpg`));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const easeIO = (x: number) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const lerpV = (a: THREE.Vector3, b: THREE.Vector3, k: number) => a.clone().lerp(b, k);

export const T_A = 2.1, T_B = 4.3;

// painéis do túnel (posição, rotação, quadro inicial)
const PANELS = Array.from({ length: 22 }).map((_, i) => {
  const side = i % 2 ? 1 : -1;
  const z = -i * 2.4;
  return { p: V(side * (1.3 + ((i * 37) % 10) / 10), (((i * 53) % 21) - 10) / 6, z), ry: -side * (0.35 + ((i * 17) % 5) / 20), rz: (((i * 29) % 7) - 3) / 30, f: (i * 7) % 60 };
});

type Assets = { tex: THREE.Texture[]; font: any };
const useAssets = (): Assets | null => {
  const [a, setA] = useState<Assets | null>(null);
  const [h] = useState(() => delayRender("texturas 3D"));
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const texs = FR.map((src) => new Promise<THREE.Texture>((res, rej) => loader.load(staticFile(src), (t) => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, rej)));
    const font = fetch(staticFile(`${D}/barlow700.typeface.json`)).then((r) => r.json()).then((j) => new FontLoader().parse(j));
    Promise.all([Promise.all(texs), font]).then(([tex, f]) => { setA({ tex, font: f }); continueRender(h); }).catch((e) => { console.error(e); continueRender(h); });
  }, [h]);
  return a;
};

// texto 3D com UV da face ocupando a palavra inteira (as duas linhas juntas)
const useWord = (font: any) => useMemo(() => {
  const mk = (s: string) => {
    const g = new TextGeometry(s, { font, size: 3, depth: 1.1, curveSegments: 6, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.05, bevelSegments: 2 });
    g.computeBoundingBox();
    const b = g.boundingBox!;
    g.translate(-(b.max.x + b.min.x) / 2, 0, -0.55);
    return g;
  };
  const g1 = mk("UMA"), g2 = mk("VIDA.");
  g1.translate(0, 0.25, 0); g2.translate(0, -3.25, 0);
  const box = new THREE.Box3();
  [g1, g2].forEach((g) => { g.computeBoundingBox(); box.union(g.boundingBox!); });
  const w = box.max.x - box.min.x, hgt = box.max.y - box.min.y;
  [g1, g2].forEach((g) => {
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - box.min.x) / w, (pos.getY(i) - box.min.y) / hgt);
    uv.needsUpdate = true;
    g.translate(0, -(box.max.y + box.min.y) / 2, 0);
  });
  return { g1, g2, w, h: hgt };
}, [font]);

const Scene: React.FC<{ t: number; a: Assets }> = ({ t, a }) => {
  const { camera } = useThree();
  const word = useWord(a.font);
  const frame = (base: number, rate = 10) => a.tex[(base + Math.floor(t * rate)) % a.tex.length];

  // material das faces: imagem trocando (cortada para caber na palavra sem distorcer)
  // faces das letras: só vídeos claros (o 4, carro à noite, deixa a letra preta)
  const BRIGHT = a.tex.filter((_, i) => Math.floor(i / 10) !== 3);
  const faceTex = BRIGHT[(3 + Math.floor(t * 8)) % BRIGHT.length];
  const ft = useMemo(() => faceTex.clone(), [faceTex]);
  const imgA = 405 / 720, wordA = word.w / word.h;
  // perto das letras a imagem se repete (cada letra mostra uma imagem inteira); no recuo volta a cobrir a palavra toda
  const rf = t < T_B ? 2.6 : lerp(2.6, 1, easeIO((t - T_B) / 1.1));
  ft.wrapS = ft.wrapT = THREE.RepeatWrapping;
  ft.repeat.set(rf, rf * (imgA / wordA > 1 ? 1 : imgA / wordA)); // retrato no quadrado: corta em cima/embaixo
  ft.offset.set((1 - ft.repeat.x) / 2, (1 - ft.repeat.y) / 2);
  ft.needsUpdate = true;
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d39a35", metalness: 0.85, roughness: 0.32 }), []);
  const face = useMemo(() => new THREE.MeshBasicMaterial({ map: ft, color: new THREE.Color(1.0, 0.9, 0.82) }), [ft]);

  // câmera
  const persp = camera as THREE.PerspectiveCamera;
  persp.fov = 50; persp.near = 0.05; persp.far = 200;
  const fitDist = (word.w / 0.68) / (2 * Math.tan((50 / 2) * Math.PI / 180) * (1080 / 1920));
  let pos: THREE.Vector3, look: THREE.Vector3, roll = 0;
  if (t < T_A) {
    const k = Math.pow(t / T_A, 1.6);
    pos = V(Math.sin(t * 1.3) * 0.3, Math.cos(t * 1.1) * 0.2, lerp(6, -48, k));
    look = pos.clone().add(V(0, 0, -5));
    roll = Math.sin(t * 2) * 0.08;
  } else if (t < T_B) {
    const k = easeIO((t - T_A) / (T_B - T_A));
    // passa rente às letras, da esquerda (U) para a direita (A.), meio de lado
    pos = lerpV(V(-4.2, 2.6, 2.2), V(3.6, -3.2, 3.0), k);
    look = lerpV(V(-1.2, 1.4, -0.4), V(2.2, -1.6, -0.4), k);
    roll = lerp(-0.35, 0.22, k);
  } else {
    const k = easeIO((t - T_B) / (5.9 - T_B - 0.35));
    pos = lerpV(V(3.6, -3.2, 3.0), V(0, -1.6, fitDist), k);
    look = lerpV(V(2.2, -1.6, -0.4), V(0, -1.6, 0), k); // palavra um pouco acima do centro (espaço para o subtítulo)
    roll = lerp(0.22, 0, k);
  }
  persp.position.copy(pos);
  persp.up.set(Math.sin(roll), Math.cos(roll), 0);
  persp.lookAt(look);
  persp.updateProjectionMatrix();

  return (
    <>
      <color attach="background" args={["#0b0605"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 10]} intensity={2.2} color="#fff1d6" />
      <directionalLight position={[-8, -4, 6]} intensity={1.2} color="#ff9a5a" />
      <pointLight position={[0, 0, 6]} intensity={30} color="#ffd29a" />
      {t < T_A + 0.1 && PANELS.map((p, i) => (
        <mesh key={i} position={p.p} rotation={[0, p.ry, p.rz]}>
          <planeGeometry args={[1.8, 3.2]} />
          <meshBasicMaterial map={frame(p.f, 12)} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {t >= T_A - 0.05 && (
        <group>
          <mesh geometry={word.g1} material={[face, gold]} />
          <mesh geometry={word.g2} material={[face, gold]} />
        </group>
      )}
    </>
  );
};

export const Intro3D: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const a = useAssets();
  const t = frame / fps;
  if (!a) return null;
  return (
    <ThreeCanvas width={width} height={height} camera={{ fov: 50, position: [0, 0, 6] }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
      <Scene t={t} a={a} />
    </ThreeCanvas>
  );
};
