import React from "react";
import { Composition, registerRoot } from "remotion";
import { Escapa, TOTAL } from "./Escapa";

const Root: React.FC = () => (
  <Composition id="Escapa" component={Escapa} durationInFrames={Math.ceil(TOTAL * 30)} fps={30} width={1080} height={1920} />
);
registerRoot(Root);
