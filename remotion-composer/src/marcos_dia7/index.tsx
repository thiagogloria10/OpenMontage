import React from "react";
import { Composition, registerRoot } from "remotion";
import { MarcosDia7, TOTAL } from "./Dia7";

const Root: React.FC = () => (
  <Composition id="MarcosDia7" component={MarcosDia7} durationInFrames={Math.ceil(TOTAL * 30)} fps={30} width={1080} height={1920} />
);
registerRoot(Root);
