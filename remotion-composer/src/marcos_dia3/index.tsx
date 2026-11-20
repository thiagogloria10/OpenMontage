import React from "react";
import { Composition, registerRoot } from "remotion";
import { MarcosDia3, TOTAL } from "./Dia3";

const Root: React.FC = () => (
  <Composition id="MarcosDia3" component={MarcosDia3} durationInFrames={Math.ceil(TOTAL * 30)} fps={30} width={1080} height={1920} />
);
registerRoot(Root);
