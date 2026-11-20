import React from "react";
import { Composition, registerRoot } from "remotion";
import { MarcosDia2, TOTAL } from "./Dia2";

const Root: React.FC = () => (
  <Composition id="MarcosDia2" component={MarcosDia2} durationInFrames={Math.ceil(TOTAL * 30)} fps={30} width={1080} height={1920} />
);
registerRoot(Root);
