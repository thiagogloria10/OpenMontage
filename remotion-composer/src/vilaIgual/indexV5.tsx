import React from "react";
import { Composition, registerRoot } from "remotion";
import { VilaIgual, TOTAL } from "./VilaIgualV5";

const Root: React.FC = () => (
  <Composition id="VilaIgualV5" component={VilaIgual} durationInFrames={Math.ceil(TOTAL * 30)} fps={30} width={1080} height={1920} />
);
registerRoot(Root);
