// The character sheet: every mouth shape, reaction, gesture and ready-made look on one page.
// Open it in Remotion Studio to check a new look or a new pose before it goes into a video.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT } from "./font";
import { LOOKS, Presenter, type Gesture, type Look, type Mouthy, type PresenterProps, type Viseme } from "./Presenter";

const SPEECH: [Viseme, string][] = [["X", "X  rest"], ["A", "A  m b p"], ["B", "B  s t k"], ["C", "C  e"], ["D", "D  a"], ["E", "E  o"], ["F", "F  u w"], ["G", "G  f v"], ["H", "H  l"]];
const REACT: [Mouthy, string][] = [["shock", "shock"], ["grin", "grin"], ["flat", "flat"], ["smirk", "smirk"]];
const EXTRAS: [string, PresenterProps][] = [
  ["brow", { brow: 1 }],
  ["browTilt", { browTilt: 1 }],
  ["peek + eyeX", { peek: 1, eyeX: -0.8, blink: 0 }],
  ["sweat", { sweat: 1, mouth: "flat" }],
  ["lensSign", { lensSign: 1 }],
];
const GESTURES: Gesture[] = ["idle", "pointUp", "pointLeft", "wave", "explain", "thumbsUp"];

const W = 196;
const tile: React.CSSProperties = { position: "relative", overflow: "hidden", background: "#16203A", borderRadius: 16, flex: "none" };
const tag: React.CSSProperties = { position: "absolute", left: 8, bottom: 8, fontSize: 22, fontWeight: 700, padding: "2px 10px", borderRadius: 10, background: "rgba(15,19,34,0.82)" };
const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8FA3D9", margin: "16px 0 10px" }}>{children}</div>;

/** A close-up of the face. */
const Face: React.FC<{ label: string; look?: Partial<Look> } & PresenterProps> = ({ label, ...p }) => (
  <div style={{ ...tile, width: W, height: 224 }}>
    <div style={{ position: "absolute", left: -42, top: -42 }}>
      <Presenter width={280} {...p} />
    </div>
    <div style={tag}>{label}</div>
  </div>
);

export const CharacterSheet: React.FC<{ look?: keyof typeof LOOKS }> = ({ look = "classic" }) => {
  const t = useCurrentFrame() / useVideoConfig().fps;
  const c = LOOKS[look];
  return (
    <AbsoluteFill style={{ background: "#0F1322", fontFamily: FONT, color: "#FFF", padding: 30 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
        <div style={{ fontSize: 54, fontWeight: 800, letterSpacing: "-0.03em" }}>Cartoon presenter</div>
        <div style={{ fontSize: 26, fontWeight: 600, color: "#8FA3D9" }}>drawn in code for Remotion: 9 speech mouths, 4 reactions, 6 gestures, 4 looks</div>
      </div>

      <Label>Mouth shapes for speech (viseme)</Label>
      <div style={{ display: "flex", gap: 12 }}>
        {SPEECH.map(([v, l]) => <Face key={v} label={l} viseme={v} look={c} />)}
      </div>

      <Label>Reactions (mouth) and extras</Label>
      <div style={{ display: "flex", gap: 12 }}>
        {REACT.map(([m, l]) => <Face key={m} label={l} mouth={m} look={c} />)}
        {EXTRAS.map(([l, p]) => <Face key={l} label={l} {...p} look={c} />)}
      </div>

      <Label>Gestures (gesture)</Label>
      <div style={{ display: "flex", gap: 12 }}>
        {GESTURES.map((g) => (
          <div key={g} style={{ ...tile, width: 300, height: 320 }}>
            <div style={{ position: "absolute", left: 30, top: 44 }}>
              <Presenter gesture={g} t={t} look={c} width={240} />
            </div>
            <div style={tag}>{g}</div>
          </div>
        ))}
      </div>

      <Label>Ready-made looks (look)</Label>
      <div style={{ display: "flex", gap: 12 }}>
        {(Object.keys(LOOKS) as (keyof typeof LOOKS)[]).map((name) => (
          <div key={name} style={{ ...tile, width: 300, height: 260 }}>
            <div style={{ position: "absolute", left: 30, top: 6 }}>
              <Presenter gesture="idle" t={t} look={LOOKS[name]} width={240} />
            </div>
            <div style={tag}>{name}</div>
          </div>
        ))}
        <div style={{ ...tile, flex: 1, height: 260, padding: "26px 30px", fontSize: 26, fontWeight: 600, lineHeight: 1.45, color: "#C9D4F2" }}>
          Every colour is a prop. Start from a look and change what you like:
          <div style={{ marginTop: 16, fontFamily: "monospace", fontSize: 24, color: "#FFC857", whiteSpace: "pre" }}>{`<Presenter\n  look={{ ...LOOKS.classic,\n    jacket: "#0F766E" }} />`}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
