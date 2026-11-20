import React from "react";
import { Composition, registerRoot } from "remotion";
import { AgoraDepois, TOTAL } from "./AgoraDepois";

const Root: React.FC = () => (
  <Composition id="AgoraDepois" component={AgoraDepois} durationInFrames={Math.ceil(TOTAL * 30)} fps={30} width={1080} height={1920} />
);
registerRoot(Root);
