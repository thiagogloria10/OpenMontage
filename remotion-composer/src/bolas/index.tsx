import React from "react";
import { Composition, registerRoot } from "remotion";
import { Bolas, TOTAL } from "./Bolas";

const Root: React.FC = () => (
  <Composition id="Bolas" component={Bolas} durationInFrames={Math.ceil(TOTAL * 30)} fps={30} width={1080} height={1920} />
);
registerRoot(Root);
