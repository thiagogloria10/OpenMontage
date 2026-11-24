import React from "react";
import { Composition, registerRoot } from "remotion";
import { MarcosDia6, TOTAL } from "./Dia6";

const Root: React.FC = () => (
  <Composition id="MarcosDia6" component={MarcosDia6} durationInFrames={Math.ceil(TOTAL * 30)} fps={30} width={1080} height={1920} />
);
registerRoot(Root);
