import React from "react";
import { Composition, registerRoot } from "remotion";
import { MarcosTeste, TOTAL } from "./Teste";

const Root: React.FC = () => (
  <Composition id="MarcosTeste" component={MarcosTeste} durationInFrames={Math.ceil(TOTAL * 30)} fps={30} width={1080} height={1920} />
);
registerRoot(Root);
