import React from "react";
import { Composition, registerRoot } from "remotion";
import { Regra888 } from "./Regra888";

const RegraRoot: React.FC = () => (
  <Composition id="Regra888" component={Regra888} durationInFrames={34 * 30} fps={30} width={1080} height={1920} />
);
registerRoot(RegraRoot);
