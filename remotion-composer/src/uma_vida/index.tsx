import React from "react";
import { Composition, registerRoot } from "remotion";
import { UmaVida, TOTAL } from "./UmaVida";

const Root: React.FC = () => (
  <Composition id="UmaVida" component={UmaVida} durationInFrames={Math.ceil(TOTAL * 30)} fps={30} width={1080} height={1920} />
);
registerRoot(Root);
