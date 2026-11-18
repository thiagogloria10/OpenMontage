import React from "react";
import { Composition, registerRoot } from "remotion";
import { CincoFases } from "./CincoFases";

const Root: React.FC = () => (
  <Composition id="CincoFases" component={CincoFases} durationInFrames={1125} fps={30} width={1080} height={1920} />
);
registerRoot(Root);
