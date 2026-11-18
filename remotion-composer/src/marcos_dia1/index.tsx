import React from "react";
import { Composition, registerRoot } from "remotion";
import { MarcosDia1, TOTAL } from "./Dia1";

const Root: React.FC = () => (
  <Composition id="MarcosDia1" component={MarcosDia1} durationInFrames={Math.ceil(TOTAL * 30)} fps={30} width={1080} height={1920} />
);
registerRoot(Root);
