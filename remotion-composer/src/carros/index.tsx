import React from "react";
import { Composition, registerRoot } from "remotion";
import { Carros, TOTAL } from "./Carros";

const Root: React.FC = () => (
  <Composition id="Carros" component={Carros} durationInFrames={Math.ceil(TOTAL * 60)} fps={60} width={1080} height={1920} />
);
registerRoot(Root);
