import React from "react";
import { Composition, registerRoot } from "remotion";
import { LadoALado, TOTAL } from "./LadoALado";

const Root: React.FC = () => (
  <Composition id="LadoALado" component={LadoALado} durationInFrames={Math.ceil(TOTAL * 30)} fps={30} width={1080} height={1920} />
);
registerRoot(Root);
