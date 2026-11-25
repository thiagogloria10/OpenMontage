import React from "react";
import { Composition, registerRoot } from "remotion";
import { Janela, TOTAL } from "./Janela";

const Root: React.FC = () => (
  <Composition id="Janela" component={Janela} durationInFrames={Math.ceil(TOTAL * 30)} fps={30} width={1080} height={1920} />
);
registerRoot(Root);
