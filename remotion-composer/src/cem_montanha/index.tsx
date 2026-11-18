import React from "react";
import { Composition, registerRoot } from "remotion";
import { TelaDividida, TOTAL } from "./TelaDividida";

const Root: React.FC = () => (
  <Composition id="TelaDividida" component={TelaDividida} durationInFrames={Math.ceil(TOTAL * 30)} fps={30} width={1080} height={1920} />
);
registerRoot(Root);
