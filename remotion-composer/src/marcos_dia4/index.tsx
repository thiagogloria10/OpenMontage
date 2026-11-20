import React from "react";
import { Composition, registerRoot } from "remotion";
import { MarcosDia4, TOTAL } from "./Dia4";

const Root: React.FC = () => (
  <Composition id="MarcosDia4" component={MarcosDia4} durationInFrames={Math.ceil(TOTAL * 30)} fps={30} width={1080} height={1920} />
);
registerRoot(Root);
