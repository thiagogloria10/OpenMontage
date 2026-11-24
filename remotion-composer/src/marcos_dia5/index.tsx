import React from "react";
import { Composition, registerRoot } from "remotion";
import { MarcosDia5, TOTAL } from "./Dia5";

const Root: React.FC = () => (
  <Composition id="MarcosDia5" component={MarcosDia5} durationInFrames={Math.ceil(TOTAL * 30)} fps={30} width={1080} height={1920} />
);
registerRoot(Root);
