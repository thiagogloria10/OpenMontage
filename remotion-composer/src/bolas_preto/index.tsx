import React from "react";
import { Composition, registerRoot } from "remotion";
import { BolasPreto, TOTAL } from "./BolasPreto";

const Root: React.FC = () => (
  <Composition id="BolasPreto" component={BolasPreto} durationInFrames={Math.ceil(TOTAL * 60)} fps={60} width={1080} height={1920} />
);
registerRoot(Root);
