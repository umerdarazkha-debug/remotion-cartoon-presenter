// A short example video: the presenter stands bottom-right, says the script, and moves on the words you choose.
// Everything he says and does comes from the props at the bottom of this file.
// Copy this file to start your own video.
import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig, type CalculateMetadataFunction } from "remotion";
import { FONT } from "./font";
import { LOOKS, Presenter, gestureAt, gestureK, lipSync, makeCue, timeWords, type Gesture, type Word } from "./Presenter";

export type ExampleProps = {
  /** what the presenter says. The mouth follows these words. */
  script: string;
  /** the heading at the top. */
  title: string;
  /** rows on the board. Each row lights up when the phrase in `when` is spoken. */
  points: { text: string; when: string }[];
  /** [phrase, gesture]: the presenter changes pose when the phrase is spoken. */
  moves: [string, Gesture][];
  /** the sunglasses slide down for a moment when this phrase is spoken. "" turns it off. */
  peekOn: string;
  /** speaking speed in words per minute, used when you give no `words`. */
  wpm: number;
  /** one of the ready-made looks in Presenter.tsx. */
  look: keyof typeof LOOKS;
  /** highlight colour. */
  accent: string;
  /** optional: your voice-over file in the public/ folder, for example "voice.mp3". */
  audio?: string;
  /** optional: real word timings for that voice-over, as [text, startMs, endMs]. */
  words?: Word[];
};

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const wordsFor = (p: ExampleProps): Word[] => (p.words && p.words.length > 0 ? p.words : timeWords(p.script, { wpm: p.wpm, startMs: 500 }));

/** The video is as long as the script, plus a second and a half at the end. */
export const exampleMetadata: CalculateMetadataFunction<ExampleProps> = ({ props }) => {
  const words = wordsFor(props);
  const endMs = words.length > 0 ? words[words.length - 1][2] : 0;
  return { durationInFrames: Math.max(60, Math.ceil((endMs / 1000 + 1.5) * 30)) };
};

/** Splits the words into sentences so the speech bubble shows one sentence at a time. */
const sentences = (words: Word[]): Word[][] => {
  const out: Word[][] = [[]];
  for (const w of words) {
    out[out.length - 1].push(w);
    if (/[.!?]["')]?$/.test(w[0])) out.push([]);
  }
  return out.filter((s) => s.length > 0);
};

export const Example: React.FC<ExampleProps> = (props) => {
  const { title, points, moves, peekOn, look, accent, audio } = props;
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (f / fps) * 1000;
  const words = wordsFor(props);
  const { cue, has } = makeCue(words, fps);
  const lastEnd = words.length > 0 ? Math.round((words[words.length - 1][2] / 1000) * fps) : 0;

  // moves: phrases that are not in the script are skipped, so editing the script never breaks the video
  const timed = moves.filter(([phrase]) => has(phrase)).map(([phrase, g]) => [cue(phrase), g] as [number, Gesture]).sort((a, b) => a[0] - b[0]);
  const { gesture, from, at } = gestureAt(f, timed);
  // eyebrows lift for a moment on every new move
  const brow = timed.length > 0 && f >= at ? interpolate(f - at, [0, 5, 16], [0, 1, 0], CLAMP) : 0;
  const peekAt = peekOn && has(peekOn) ? cue(peekOn) : -1;
  const peek = peekAt >= 0 ? interpolate(f - peekAt, [0, 6, 26, 34], [0, 1, 1, 0], CLAMP) : 0;
  const done = f > lastEnd + 4;

  const said = sentences(words);
  const current = said.filter((s) => s[0][1] <= ms).pop();
  const bubbleIn = current ? interpolate(ms - current[0][1], [0, 160], [0, 1], CLAMP) : 0;

  return (
    <AbsoluteFill style={{ background: "#0F1322", fontFamily: FONT, color: "#FFF" }}>
      <AbsoluteFill style={{ background: `radial-gradient(900px 700px at 78% 82%, ${accent}33, transparent 70%)` }} />
      <div style={{ position: "absolute", left: 70, top: 120, right: 70, fontSize: 84, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05 }}>{title}</div>

      {/* the board he talks about */}
      <div style={{ position: "absolute", left: 70, right: 70, top: 350, display: "flex", flexDirection: "column", gap: 22 }}>
        {points.map((p, i) => {
          const on = has(p.when) ? interpolate(f - cue(p.when), [0, 8], [0, 1], CLAMP) : 1;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 26, padding: "30px 34px", borderRadius: 28, background: "#16203A", border: `3px solid ${on > 0.5 ? accent : "rgba(255,255,255,0.08)"}`, opacity: 0.4 + 0.6 * on, transform: `scale(${0.97 + 0.03 * on})` }}>
              <div style={{ width: 64, height: 64, borderRadius: 32, flex: "none", display: "grid", placeItems: "center", background: on > 0.5 ? accent : "rgba(255,255,255,0.12)", color: "#0F1322", fontSize: 34, fontWeight: 800 }}>{on > 0.5 ? "✓" : i + 1}</div>
              <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: "-0.02em" }}>{p.text}</div>
            </div>
          );
        })}
      </div>

      {/* speech bubble: the current sentence, filling in word by word */}
      {current && (
        <div style={{ position: "absolute", right: 200, bottom: 790, width: "fit-content", minWidth: 280, maxWidth: 800, opacity: bubbleIn, transform: `translateY(${(1 - bubbleIn) * 20}px)` }}>
          <div style={{ background: "#FFF", color: "#0F1322", borderRadius: 36, padding: "30px 38px", fontSize: 50, fontWeight: 700, lineHeight: 1.22, letterSpacing: "-0.01em" }}>
            {current.map(([text, s, e], i) => (
              <span key={i} style={{ opacity: ms >= s ? 1 : 0.28, boxShadow: ms >= s && ms < e ? `inset 0 -0.42em 0 ${accent}` : undefined }}>
                {text}{" "}
              </span>
            ))}
          </div>
          <svg width={90} height={70} viewBox="0 0 90 70" style={{ position: "absolute", right: 130, bottom: -62 }}>
            <path d="M0 0 H64 Q62 40 88 68 Q30 54 0 0 Z" fill="#FFF" />
          </svg>
        </div>
      )}

      {/* the presenter, bottom-right. His body is cut off by the edge of the frame. */}
      <div style={{ position: "absolute", left: 370, top: 1150 }}>
        <Presenter viseme={lipSync(words, ms)} mouth={done ? "grin" : undefined} gesture={gesture} from={from} k={gestureK(f, at, 7)} t={f / fps} brow={brow} peek={peek} eyeX={-0.6} blink={0} look={LOOKS[look]} width={680} />
      </div>
      {audio ? <Audio src={staticFile(audio)} /> : null}
    </AbsoluteFill>
  );
};

export const exampleDefaults: ExampleProps = {
  title: "Meet your presenter",
  script: "Hi! I'm your presenter. I'm drawn in code, so you can change my look, my words and my moves. Type a script and my mouth follows every word. No camera needed. Easy!",
  points: [
    { text: "Change my look", when: "my look" },
    { text: "Change my words", when: "my words" },
    { text: "Change my moves", when: "my moves" },
  ],
  moves: [
    ["Hi", "wave"],
    ["I'm your", "idle"],
    ["I'm drawn", "explain"],
    ["my look", "pointUp"],
    ["Type a script", "pointLeft"],
    ["No camera", "explain"],
    ["Easy", "thumbsUp"],
  ],
  peekOn: "No camera",
  wpm: 150,
  look: "classic",
  accent: "#FFC857",
};
