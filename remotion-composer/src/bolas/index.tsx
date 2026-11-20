import React from "react";
import { Composition, registerRoot } from "remotion";
import { Bolas, TOTAL } from "./Bolas";

const Root: React.FC = () => (
  <Composition id="Bolas" component={Bolas} durationInFrames={Math.ceil(TOTAL * 60)} fps={60} width={1080} height={1920} />
);
registerRoot(Root);
