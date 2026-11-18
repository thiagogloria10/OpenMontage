import React from "react";

// Renders a pixel-art grid. Each string row, each char = one pixel; "." = transparent.
export const PixelArt: React.FC<{
  grid: string[];
  palette: Record<string, string>;
  size: number;
  style?: React.CSSProperties;
}> = ({ grid, palette, size, style }) => {
  const w = Math.max(...grid.map((r) => r.length));
  const h = grid.length;
  const rects: React.ReactNode[] = [];
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === "." || c === " ") continue;
      const fill = palette[c];
      if (!fill) continue;
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={fill} />);
    }
  });
  return (
    <svg
      width={w * size}
      height={h * size}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      style={style}
    >
      {rects}
    </svg>
  );
};

// ---- Character (original design: dark hoodie with gold trim, brand colors) ----
export const CHAR_PAL: Record<string, string> = {
  H: "#2b1d14", // hair
  S: "#d9a074", // skin
  s: "#b9805a", // skin shade
  E: "#141414", // eyes
  B: "#262626", // hoodie
  b: "#3a3a3a", // hoodie light
  G: "#E8B84A", // gold trim
  P: "#1c2533", // pants
  K: "#f2f2f2", // sneakers
  M: "#8a5a3c", // mouth
};

export const CHAR_IDLE = [
  "....HHHHH....",
  "...HHHHHHH...",
  "...HSSSSSH...",
  "...SSSSSSS...",
  "...SESSSES...",
  "...SSSSSSS...",
  "....SSMSS....",
  ".....sss.....",
  "...BBBGBBB...",
  "..BBBBGBBBB..",
  ".BBbBBGBBbBB.",
  ".BB.BBBBB.BB.",
  ".BB.BGGGB.BB.",
  ".SS.BBBBB.SS.",
  "....BBBBB....",
  "....PP.PP....",
  "....PP.PP....",
  "....PP.PP....",
  "....PP.PP....",
  "...KKK.KKK...",
];

export const CHAR_ARMS_UP = [
  ".SS........SS",
  ".BB.HHHHH.BB.",
  ".BBHHHHHHHBB.",
  ".BBHSSSSSHBB.",
  "..BSSSSSSSB..",
  "..BSESSSESB..",
  "...SSSSSSS...",
  "....SMMMS....",
  ".....sss.....",
  "...BBBGBBB...",
  "...BBBGBBB...",
  "...BbBGBbB...",
  "...BBBBBBB...",
  "...BBGGGBB...",
  "....BBBBB....",
  "....PP.PP....",
  "....PP.PP....",
  "...PP...PP...",
  "...PP...PP...",
  "..KKK...KKK..",
];

// Sitting at a desk, seen from the side-ish front; arms forward
export const CHAR_SIT = [
  "....HHHHH....",
  "...HHHHHHH...",
  "...HSSSSSH...",
  "...SSSSSSS...",
  "...SESSSES...",
  "...SSSSSSS...",
  "....SSSSS....",
  ".....sss.....",
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

// Head on the pillow (sleeping), eyes closed
export const CHAR_SLEEP = [
  "..HHHHH..",
  ".HHHHHHH.",
  "HHSSSSSHH",
  "HSSSSSSSH",
  "HSEESEESH",
  "HSSSSSSSH",
  ".SSSMSSS.",
  "..SSSSS..",
];

// ---- Icons (8x8-ish) ----
export const ICON_PAL: Record<string, string> = {
  G: "#E8B84A",
  W: "#f2f2f2",
  R: "#e0554a",
  r: "#a63a32",
  N: "#6fbf73",
  n: "#3f8a45",
  O: "#c98a3a",
  A: "#7aa7e0",
  K: "#2b2b2b",
  S: "#d9a074",
  Y: "#ffe27a",
};

export const ICONS: Record<string, string[]> = {
  familia: [
    "..SS.....SS..",
    ".SSSS...SSSS.",
    ".SSSS...SSSS.",
    "..SS..S..SS..",
    ".AAAA.SS.RRRR",
    "AAAAA.SS.RRRR",
    "AAAAAGGGGRRRR",
    "AAAAAGGGGRRRR",
    ".AA..GGGG.RR.",
    ".AA..G..G.RR.",
  ],
  felicidade: [
    "..GGGGGG..",
    ".GGGGGGGG.",
    "GGKGGGGKGG",
    "GGKGGGGKGG",
    "GGGGGGGGGG",
    "GKGGGGGGKG",
    "GGKKGGKKGG",
    ".GGGKKGGG.",
    "..GGGGGG..",
  ],
  fe: [
    "....YY....",
    "...YGGY...",
    "...YGGY...",
    "....GG....",
    "...WWWW...",
    "...WWWW...",
    "...WWWW...",
    "...WWWW...",
    "...WWWW...",
    ".GGGGGGGG.",
  ],
  alimentacao: [
    ".....n....",
    "....nN....",
    "..RR.RR...",
    ".RRRRRRR..",
    "RRWRRRRRR.",
    "RRWRRRRRR.",
    "RRRRRRRRR.",
    ".RRRRRRr..",
    "..RRrRr...",
  ],
  atividade: [
    ".WW......WW.",
    "WWW......WWW",
    "WWW......WWW",
    "WWWGGGGGGWWW",
    "WWW......WWW",
    "WWW......WWW",
    ".WW......WW.",
  ],
  aprendizado: [
    "GGGGG.GGGGG",
    "GWWWW.WWWWG",
    "GWKKW.WKKWG",
    "GWWWW.WWWWG",
    "GWKKW.WKKWG",
    "GWWWW.WWWWG",
    "GGGGGGGGGGG",
  ],
  saude: [
    "...NNNN...",
    "...NNNN...",
    "NNNNNNNNNN",
    "NNNNNNNNNN",
    "NNNNNNNNNN",
    "...NNNN...",
    "...NNNN...",
  ],
  socializacao: [
    "WWWWWW......",
    "WKWKWW......",
    "WWWWWW.GGGGG",
    ".W.....GKGKG",
    "W......GGGGG",
    "..........G.",
    "...........G",
  ],
  sabedoria: [
    "...YYYY...",
    "..YYYYYY..",
    ".YYYGYYYY.",
    ".YYYGYYYY.",
    ".YYYYYYYY.",
    "..YYYYYY..",
    "...YYYY...",
    "...KKKK...",
    "...KKKK...",
    "....KK....",
  ],
  trabalho: [
    "..KKKKKKKKKKKK..",
    "..KAAAAAAAAAAK..",
    "..KAWWWWAAAAAK..",
    "..KAAAAAAAAAAK..",
    "..KAWWWWWWAAAK..",
    "..KAAAAAAAAAAK..",
    "..KKKKKKKKKKKK..",
    "WWWWWWWWWWWWWWWW",
  ],
};
