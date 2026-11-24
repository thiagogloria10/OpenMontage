import React from "react";
import { Composition, registerRoot } from "remotion";
import { PorQueComecou, TOTAL } from "./PorQueComecou";

const Root: React.FC = () => (
  <Composition id="PorQueComecou" component={PorQueComecou} durationInFrames={Math.ceil(TOTAL * 30)} fps={30} width={1080} height={1920} />
);
registerRoot(Root);
