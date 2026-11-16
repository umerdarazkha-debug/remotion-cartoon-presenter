import React from "react";
import { Composition } from "remotion";
import { Example, exampleDefaults, exampleMetadata } from "./Example";
import { CharacterSheet } from "./Sheet";

// Each <Composition> shows up in the Remotion Studio sidebar.
export const RemotionRoot: React.FC = () => (
  <>
    {/* a short talking video: copy Example.tsx to start your own. npm run render */}
    <Composition id="Example" component={Example} durationInFrames={300} fps={30} width={1080} height={1920} defaultProps={exampleDefaults} calculateMetadata={exampleMetadata} />
    {/* every mouth, gesture and look on one page: npm run sheet */}
    <Composition id="CharacterSheet" component={CharacterSheet} durationInFrames={90} fps={30} width={1920} height={1388} defaultProps={{ look: "classic" as const }} />
  </>
);
