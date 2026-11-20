import React from "react";
import { Composition, registerRoot } from "remotion";
import { BolasRef, TOTAL } from "./BolasRef";

const Root: React.FC = () => (
  <Composition id="BolasRef" component={BolasRef} durationInFrames={Math.ceil(TOTAL * 60)} fps={60} width={1080} height={1920} />
);
registerRoot(Root);
