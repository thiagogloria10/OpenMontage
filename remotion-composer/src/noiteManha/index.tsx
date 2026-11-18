import React from "react";
import { Composition, registerRoot } from "remotion";
import { NoiteManha, TOTAL } from "./NoiteManha";

const Root: React.FC = () => (
  <Composition id="NoiteManha" component={NoiteManha} durationInFrames={Math.ceil(TOTAL * 30)} fps={30} width={1080} height={1920} />
);
registerRoot(Root);
