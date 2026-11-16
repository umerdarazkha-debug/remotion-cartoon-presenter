// A flat 2D cartoon presenter drawn entirely in SVG: no image files, no rigging tool.
// Lip-sync: lipSync() turns word timings into mouth shapes (A to H plus X for rest) by looking at the letters
// of each word, so no extra tools are needed. Gestures ease between arm poses, and a small head bob keeps
// the character alive between words.
import React from "react";
import { interpolate } from "remotion";

/** One spoken word: [text, start in milliseconds, end in milliseconds]. */
export type Word = [text: string, startMs: number, endMs: number];
/** Mouth shapes for speech. X = rest, A = M B P, B = most consonants, C = E, D = A, E = O, F = U W, G = F V, H = L. */
export type Viseme = "X" | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";
/** Speech shapes plus four reaction mouths: shock O, toothy grin, flat unimpressed line, smirk. */
export type Mouthy = Viseme | "shock" | "grin" | "flat" | "smirk";
export type Gesture = "idle" | "pointUp" | "pointLeft" | "wave" | "explain" | "thumbsUp";
export type HandShape = "open" | "point" | "fist" | "thumb";
/** One arm. Angles in degrees: 0 = hanging down, 90 = straight out sideways, 180 = straight up.
 *  a1 = upper arm, a1 + a2 = forearm. rock = how far the forearm swings back and forth (a wave). */
export type ArmPose = { a1: number; a2: number; hand: HandShape; rock?: number };
/** Both arms. L is the arm on the left of the screen, R the arm on the right. */
export type Pose = { L: ArmPose; R: ArmPose };

/* ---------------- the look: every colour and the hair / glasses style ---------------- */
export type Look = {
  skin: string;
  skinShade: string;
  hair: string;
  hairShine: string;
  hairStyle: "slick" | "long" | "none";
  glasses: "sunglasses" | "none";
  lens: string;
  eye: string;
  jacket: string;
  jacketShade: string;
  shirt: string;
  lip: string;
  mouth: string;
  tongue: string;
  teeth: string;
};

const CLASSIC: Look = {
  skin: "#D9A27A",
  skinShade: "#C08560",
  hair: "#1C1512",
  hairShine: "#3A2C25",
  hairStyle: "slick",
  glasses: "sunglasses",
  lens: "#0E0E12",
  eye: "#2A1A14",
  jacket: "#26324F",
  jacketShade: "#1C2540",
  shirt: "#F4F4F2",
  lip: "#9C4E3E",
  mouth: "#3A1712",
  tongue: "#D9686A",
  teeth: "#FFFFFF",
};

/** Ready-made looks. Pass one as `look`, or spread one and change a few colours. */
export const LOOKS = {
  classic: CLASSIC,
  sunny: { ...CLASSIC, skin: "#FFCB4C", skinShade: "#E5A62E", hair: "#3B2A20", hairShine: "#5A4334", jacket: "#0F766E", jacketShade: "#0B5850", lip: "#B4552D" },
  studio: { ...CLASSIC, skin: "#F0C2A2", skinShade: "#D9A07E", hair: "#7A3B1D", hairShine: "#9B5530", hairStyle: "long", glasses: "none", eye: "#3B2417", jacket: "#C2410C", jacketShade: "#9A3412", lip: "#B5524A" },
  night: { ...CLASSIC, skin: "#8D5A3C", skinShade: "#734529", hair: "#0F0B0A", hairShine: "#2A201C", hairStyle: "none", glasses: "none", eye: "#1B100B", jacket: "#6D28D9", jacketShade: "#5521B5", lip: "#6E3328" },
} satisfies Record<string, Look>;

/* ---------------- lip-sync from word timings ---------------- */
/** Which mouth shape each letter gets. Letters not listed here use B (a slightly open mouth). */
export const LETTER_VISEMES: Record<string, Viseme> = {
  m: "A", b: "A", p: "A",
  f: "G", v: "G",
  o: "E",
  u: "F", w: "F", q: "F",
  a: "D", i: "D",
  e: "C", y: "C",
  l: "H",
};

/** Mouth shape at time `ms`: each word's letters are spread over its duration, with rest between words. */
export const lipSync = (words: Word[], ms: number, letters: Record<string, Viseme> = LETTER_VISEMES): Viseme => {
  const w = words.find(([, s, e]) => ms >= s && ms < e);
  if (!w) return "X";
  const [text, s, e] = w;
  const clean = text.toLowerCase().replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");
  if (!clean) return "X";
  const i = Math.min(clean.length - 1, Math.floor(((ms - s) / Math.max(1, e - s)) * clean.length));
  return letters[clean[i]] ?? "B";
};

/**
 * Estimated word timings from plain text, for when you have no voice-over yet.
 * Longer words take longer, and commas and full stops add a pause. `wpm` = words per minute.
 */
export const timeWords = (text: string, opts: { wpm?: number; startMs?: number } = {}): Word[] => {
  const { wpm = 150, startMs = 0 } = opts;
  const tokens = text.split(/\s+/).filter(Boolean);
  const perLetter = 60000 / wpm / 6.5; // an average word is about 4.5 letters, plus 2 so short words stay readable
  const out: Word[] = [];
  let t = startMs;
  for (const tok of tokens) {
    const lettersIn = tok.replace(/[^A-Za-z0-9]/g, "").length;
    const dur = Math.round((Math.max(1, lettersIn) + 2) * perLetter);
    out.push([tok, Math.round(t), Math.round(t + dur)]);
    const pause = /[.!?]["')]?$/.test(tok) ? 380 : /[,;:]$/.test(tok) ? 180 : 40;
    t += dur + pause;
  }
  return out;
};

/** Converts captions in Remotion's format ({ text, startMs, endMs }, as Whisper tools for Remotion write them) to words. */
export const fromCaptions = (captions: { text: string; startMs: number; endMs: number }[]): Word[] =>
  captions.map((c) => [c.text.trim(), Math.round(c.startMs), Math.round(c.endMs)] as Word).filter((w) => w[0].length > 0);

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]/g, "");

/**
 * Finds the frame where a spoken phrase starts, so moves can be tied to words instead of frame numbers.
 * cue() throws when the phrase is missing (a changed script fails loudly); has() lets you check first.
 */
export const makeCue = (words: Word[], fps = 30) => {
  const toks = words.map((w) => norm(w[0]));
  const split = (phrase: string) => phrase.split(/\s+/).map(norm).filter(Boolean);
  const find = (phrase: string, nth = 0): number => {
    const p = split(phrase);
    let seen = 0;
    for (let i = 0; p.length > 0 && i + p.length <= toks.length; i++) {
      if (p.every((tk, j) => toks[i + j] === tk)) {
        if (seen === nth) return i;
        seen++;
      }
    }
    return -1;
  };
  const must = (phrase: string, nth: number) => {
    const i = find(phrase, nth);
    if (i < 0) throw new Error(`cue not found: "${phrase}" #${nth}`);
    return i;
  };
  const has = (phrase: string, nth = 0) => find(phrase, nth) >= 0;
  const cue = (phrase: string, nth = 0) => Math.round((words[must(phrase, nth)][1] / 1000) * fps);
  const cueEnd = (phrase: string, nth = 0) => Math.round((words[must(phrase, nth) + split(phrase).length - 1][2] / 1000) * fps);
  return { cue, cueEnd, has };
};

/* ---------------- gestures ---------------- */
const REST: ArmPose = { a1: 12, a2: 6, hand: "fist" };
/** The built-in arm poses. Copy one and change the angles to make your own, then pass it as `gesture`. */
export const POSES: Record<Gesture, Pose> = {
  idle: { L: REST, R: REST },
  pointUp: { L: REST, R: { a1: 100, a2: 75, hand: "point" } },
  pointLeft: { L: { a1: 105, a2: 30, hand: "point" }, R: REST },
  wave: { L: REST, R: { a1: 95, a2: 70, hand: "open", rock: 16 } },
  explain: { L: { a1: 40, a2: 70, hand: "open" }, R: { a1: 40, a2: 70, hand: "open" } },
  thumbsUp: { L: REST, R: { a1: 50, a2: 125, hand: "thumb" } },
};

const toPose = (g: Gesture | Pose): Pose => (typeof g === "string" ? POSES[g] : g);
const mix = (a: ArmPose, b: ArmPose, t: number): ArmPose => ({
  a1: a.a1 + (b.a1 - a.a1) * t,
  a2: a.a2 + (b.a2 - a.a2) * t,
  hand: t < 0.5 ? a.hand : b.hand,
  rock: (a.rock ?? 0) + ((b.rock ?? 0) - (a.rock ?? 0)) * t,
});

/** Ease helper: 0 to 1 progress of a gesture change that started at frame `at`. */
export const gestureK = (f: number, at: number, dur = 8) => interpolate(f - at, [0, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/**
 * Picks the current move from a list of [frame, gesture] pairs sorted by frame.
 * Returns the gesture, the one before it (to ease from) and the frame it started at.
 */
export const gestureAt = <G extends Gesture | Pose>(f: number, moves: [number, G][]): { gesture: G | "idle"; from: G | "idle"; at: number } => {
  let i = -1;
  for (let j = 0; j < moves.length; j++) if (moves[j][0] <= f) i = j;
  if (i < 0) return { gesture: "idle", from: "idle", at: 0 };
  return { gesture: moves[i][1], from: i > 0 ? moves[i - 1][1] : "idle", at: moves[i][0] };
};

/* ---------------- mouth shapes ---------------- */
/** The mouth is drawn around this point of the 600x700 drawing. Custom shapes in `mouths` should be too. */
export const MOUTH_AT = { x: 300, y: 405 };

const Mouth: React.FC<{ v: Mouthy; c: Look }> = ({ v, c }) => {
  const cx = MOUTH_AT.x;
  const cy = MOUTH_AT.y;
  switch (v) {
    case "shock": // tall open O, jaw dropped
      return (
        <g>
          <ellipse cx={cx} cy={cy + 18} rx={30} ry={42} fill={c.mouth} stroke={c.lip} strokeWidth={6} />
          <ellipse cx={cx} cy={cy + 44} rx={16} ry={9} fill={c.tongue} />
        </g>
      );
    case "grin": // wide toothy smile
      return (
        <g>
          <path d={`M${cx - 58} ${cy - 10} Q${cx} ${cy + 62} ${cx + 58} ${cy - 10} Z`} fill={c.mouth} stroke={c.lip} strokeWidth={5} strokeLinejoin="round" />
          <path d={`M${cx - 50} ${cy - 6} Q${cx} ${cy + 8} ${cx + 50} ${cy - 6} L${cx + 44} ${cy + 8} Q${cx} ${cy + 20} ${cx - 44} ${cy + 8} Z`} fill={c.teeth} />
        </g>
      );
    case "flat": // unimpressed straight line
      return <path d={`M${cx - 34} ${cy + 6} L${cx + 34} ${cy + 2}`} stroke={c.lip} strokeWidth={9} fill="none" strokeLinecap="round" />;
    case "smirk":
      return <path d={`M${cx - 30} ${cy + 4} Q${cx + 4} ${cy + 12} ${cx + 34} ${cy - 10}`} stroke={c.lip} strokeWidth={8} fill="none" strokeLinecap="round" />;
    case "A": // M B P: lips pressed
      return <path d={`M${cx - 34} ${cy} Q${cx} ${cy + 6} ${cx + 34} ${cy}`} stroke={c.lip} strokeWidth={9} fill="none" strokeLinecap="round" />;
    case "B": // most consonants: slightly open, teeth showing
      return (
        <g>
          <path d={`M${cx - 36} ${cy - 4} Q${cx} ${cy + 16} ${cx + 36} ${cy - 4} Q${cx} ${cy + 26} ${cx - 36} ${cy - 4} Z`} fill={c.mouth} />
          <path d={`M${cx - 28} ${cy - 1} Q${cx} ${cy + 9} ${cx + 28} ${cy - 1}`} stroke={c.teeth} strokeWidth={6} fill="none" />
        </g>
      );
    case "C": // E: open and wide
      return (
        <g>
          <path d={`M${cx - 40} ${cy - 6} Q${cx} ${cy + 8} ${cx + 40} ${cy - 6} Q${cx} ${cy + 36} ${cx - 40} ${cy - 6} Z`} fill={c.mouth} />
          <path d={`M${cx - 30} ${cy - 2} Q${cx} ${cy + 8} ${cx + 30} ${cy - 2}`} stroke={c.teeth} strokeWidth={7} fill="none" />
        </g>
      );
    case "D": // A: wide open
      return (
        <g>
          <ellipse cx={cx} cy={cy + 12} rx={38} ry={30} fill={c.mouth} />
          <ellipse cx={cx} cy={cy + 28} rx={20} ry={10} fill={c.tongue} />
          <path d={`M${cx - 28} ${cy - 6} Q${cx} ${cy + 2} ${cx + 28} ${cy - 6}`} stroke={c.teeth} strokeWidth={8} fill="none" />
        </g>
      );
    case "E": // O: rounded
      return <ellipse cx={cx} cy={cy + 8} rx={22} ry={26} fill={c.mouth} stroke={c.lip} strokeWidth={6} />;
    case "F": // U W: puckered
      return <ellipse cx={cx} cy={cy + 4} rx={14} ry={14} fill={c.mouth} stroke={c.lip} strokeWidth={7} />;
    case "G": // F V: upper teeth on the lip
      return (
        <g>
          <path d={`M${cx - 32} ${cy} Q${cx} ${cy + 18} ${cx + 32} ${cy} Z`} fill={c.mouth} />
          <rect x={cx - 24} y={cy - 4} width={48} height={10} rx={3} fill={c.teeth} />
        </g>
      );
    case "H": // L: open, tongue up
      return (
        <g>
          <ellipse cx={cx} cy={cy + 10} rx={32} ry={22} fill={c.mouth} />
          <ellipse cx={cx} cy={cy + 2} rx={14} ry={9} fill={c.tongue} />
        </g>
      );
    default: // X rest: relaxed smile
      return <path d={`M${cx - 30} ${cy} Q${cx} ${cy + 16} ${cx + 30} ${cy}`} stroke={c.lip} strokeWidth={8} fill="none" strokeLinecap="round" />;
  }
};

/* ---------------- arms ---------------- */
const Hand: React.FC<{ x: number; y: number; ang: number; kind: HandShape; c: Look }> = ({ x, y, ang, kind, c }) => (
  <g transform={`translate(${x} ${y}) rotate(${ang})`}>
    <ellipse cx={0} cy={0} rx={24} ry={26} fill={c.skin} />
    {kind === "point" && <rect x={-7} y={-62} width={14} height={46} rx={7} fill={c.skin} />}
    {kind === "thumb" && (
      <g>
        <rect x={-13} y={-72} width={26} height={56} rx={13} fill={c.skin} stroke={c.skinShade} strokeWidth={3} />
        <path d="M-18 -6 H16 M-18 6 H16" stroke={c.skinShade} strokeWidth={3} strokeLinecap="round" />
      </g>
    )}
    {kind === "open" && [-16, -5, 6, 17].map((fx, i) => <rect key={i} x={fx - 5} y={-52 + Math.abs(i - 1.5) * 5} width={10} height={34} rx={5} fill={c.skin} />)}
  </g>
);

/** One arm from the shoulder: upper arm then forearm, in a jacket sleeve. side -1 = left of the screen. */
const Arm: React.FC<{ sx: number; sy: number; side: 1 | -1; p: ArmPose; c: Look }> = ({ sx, sy, side, p, c }) => {
  const L1 = 104;
  const L2 = 96;
  const r1 = (p.a1 * Math.PI) / 180;
  const ex = sx + side * Math.sin(r1) * L1;
  const ey = sy + Math.cos(r1) * L1;
  const r2 = ((p.a1 + p.a2) * Math.PI) / 180;
  const hx = ex + side * Math.sin(r2) * L2;
  const hy = ey + Math.cos(r2) * L2;
  const handAng = side * -(p.a1 + p.a2) + 180;
  return (
    <g>
      <path d={`M${sx} ${sy} L${ex} ${ey} L${hx} ${hy}`} stroke={c.jacket} strokeWidth={58} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Hand x={hx} y={hy} ang={handAng} kind={p.hand} c={c} />
    </g>
  );
};

/* ---------------- the presenter ---------------- */
export type PresenterProps = {
  /** mouth shape for this frame, usually lipSync(words, ms). Default "X" (rest). */
  viseme?: Viseme;
  /** the arm pose to show: a built-in name or your own pose. Default "idle". */
  gesture?: Gesture | Pose;
  /** the pose to ease from, with `k` going 0 to 1 (see gestureK). */
  from?: Gesture | Pose;
  k?: number;
  /** time in seconds. Drives the head bob, the wave, the glare on the glasses and the blinks. */
  t?: number;
  /** width in pixels. The drawing is 600 wide by 700 tall and scales with this. */
  width?: number;
  /** colours and style. Start from LOOKS.classic and change what you like. */
  look?: Partial<Look>;
  /** a reaction mouth that overrides the lip-sync for a moment. */
  mouth?: Mouthy;
  /** your own drawings for any mouth shape, as SVG drawn around MOUTH_AT. */
  mouths?: Partial<Record<Mouthy, React.ReactNode>>;
  /** eyebrows: 0 = resting, 1 = raised. */
  brow?: number;
  /** eyebrow tilt: positive raises one brow and lowers the other (a sceptical look). */
  browTilt?: number;
  /** 0 to 1: the sunglasses slide down the nose and the eyes show. */
  peek?: number;
  /** -1 to 1: where the eyes look, left to right. */
  eyeX?: number;
  /** 0 to 1: closes the eyes. Leave it out and the character blinks on its own. */
  blink?: number;
  /** 0 to 1: shows `lensText` on both lenses of the sunglasses. */
  lensSign?: number;
  lensText?: string;
  lensColor?: string;
  /** 0 to 1: a drop of sweat on the forehead. */
  sweat?: number;
  /** moves the head up (negative) or down (positive), in drawing units. */
  headY?: number;
};

export const Presenter: React.FC<PresenterProps> = ({
  viseme = "X", gesture = "idle", from, k = 1, t = 0, width = 600, look, mouth, mouths,
  brow = 0, browTilt = 0, peek = 0, eyeX = 0, blink, lensSign = 0, lensText = "$", lensColor = "#6FE39A", sweat = 0, headY = 0,
}) => {
  const clipId = `lens-${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const c: Look = { ...CLASSIC, ...look };
  const P = toPose(gesture);
  const F = toPose(from ?? gesture);
  const L0 = mix(F.L, P.L, k);
  const R0 = mix(F.R, P.R, k);
  // a waving forearm rocks at the elbow
  const rock = (p: ArmPose): ArmPose => (p.rock ? { ...p, a2: p.a2 + Math.sin(t * 11) * p.rock } : p);
  const L = rock(L0);
  const R = rock(R0);
  const bob = Math.sin(t * 2.2) * 4 + headY;
  const tilt = Math.sin(t * 0.9) * 2.5;
  const browY = -brow * 10;
  const glare = (t * 0.35) % 1;
  const shades = c.glasses === "sunglasses";
  const showEyes = !shades || peek > 0;
  // a quick blink every 3.4 seconds unless the caller controls it
  const closed = blink ?? (t % 3.4 > 3.28 ? 1 : 0);
  const shape = mouth ?? viseme;
  return (
    <svg width={width} height={(width * 700) / 600} viewBox="0 0 600 700" style={{ overflow: "visible" }}>
      {/* long hair falls behind the shoulders, so it is drawn first */}
      {c.hairStyle === "long" && (
        <g transform={`translate(0 ${bob}) rotate(${tilt} 300 470)`}>
          <path d="M152 300 Q130 120 300 100 Q470 120 448 300 L470 500 Q474 548 424 548 L176 548 Q126 548 130 500 Z" fill={c.hair} />
        </g>
      )}
      {/* torso: jacket over a tee */}
      <path d="M80 700 Q90 520 200 490 L400 490 Q510 520 520 700 Z" fill={c.jacket} />
      <path d="M240 490 L300 600 L360 490 Z" fill={c.shirt} />
      <path d="M200 492 L250 560 L235 700" stroke={c.jacketShade} strokeWidth={10} fill="none" />
      <path d="M400 492 L350 560 L365 700" stroke={c.jacketShade} strokeWidth={10} fill="none" />
      <Arm sx={160} sy={530} side={-1} p={L} c={c} />
      <Arm sx={440} sy={530} side={1} p={R} c={c} />
      <g transform={`translate(0 ${bob}) rotate(${tilt} 300 470)`}>
        {/* neck */}
        <rect x={258} y={410} width={84} height={90} rx={20} fill={c.skinShade} />
        {/* ears */}
        <ellipse cx={168} cy={320} rx={22} ry={32} fill={c.skinShade} />
        <ellipse cx={432} cy={320} rx={22} ry={32} fill={c.skinShade} />
        {/* head */}
        <path d="M172 250 Q172 150 300 145 Q428 150 428 250 L428 330 Q428 450 300 455 Q172 450 172 330 Z" fill={c.skin} />
        {/* hair */}
        {c.hairStyle === "slick" && (
          <g>
            <path d="M168 285 Q150 150 260 112 Q340 88 410 130 Q452 165 436 285 Q430 220 400 196 Q350 178 300 182 Q235 182 200 205 Q176 228 168 285 Z" fill={c.hair} />
            <path d="M222 150 Q300 118 392 150" stroke={c.hairShine} strokeWidth={6} fill="none" opacity={0.7} />
          </g>
        )}
        {c.hairStyle === "long" && (
          <g>
            <path d="M160 330 Q140 140 300 112 Q460 140 440 330 Q436 236 372 206 Q318 232 240 222 Q176 240 160 330 Z" fill={c.hair} />
            <path d="M214 176 Q296 138 386 172" stroke={c.hairShine} strokeWidth={6} fill="none" opacity={0.7} />
          </g>
        )}
        {/* brows */}
        <path d={`M196 ${250 + browY + browTilt * 4} Q236 ${236 + browY + browTilt * 6} 274 ${246 + browY + browTilt * 8}`} stroke={c.hair} strokeWidth={13} fill="none" strokeLinecap="round" />
        <path d={`M326 ${246 + browY - browTilt * 10} Q364 ${236 + browY - browTilt * 12} 404 ${250 + browY - browTilt * 8}`} stroke={c.hair} strokeWidth={13} fill="none" strokeLinecap="round" />
        {/* eyes: always there without glasses, or seen when the sunglasses slide down (peek) */}
        {showEyes &&
          [239, 361].map((ex) =>
            closed > 0.5 ? (
              <path key={ex} d={`M${ex - 28} 292 Q${ex} 304 ${ex + 28} 292`} stroke={c.eye} strokeWidth={6} fill="none" strokeLinecap="round" />
            ) : (
              <g key={ex}>
                <ellipse cx={ex} cy={290} rx={30} ry={18} fill="#FFF" />
                <circle cx={ex + eyeX * 16} cy={292} r={12} fill={c.eye} />
                <circle cx={ex + eyeX * 16 + 4} cy={288} r={3.5} fill="#FFF" />
                <path d={`M${ex - 32} 284 Q${ex} 270 ${ex + 32} 284`} stroke={c.skinShade} strokeWidth={6} fill="none" />
              </g>
            ),
          )}
        {shades && (
          <g transform={`translate(0 ${peek * 44})`}>
            <rect x={188} y={262} width={102} height={70} rx={20} fill={c.lens} />
            <rect x={310} y={262} width={102} height={70} rx={20} fill={c.lens} />
            <path d="M290 282 Q300 274 310 282" stroke={c.lens} strokeWidth={8} fill="none" />
            <path d="M188 280 L170 274 M412 280 L430 274" stroke={c.lens} strokeWidth={8} />
            {/* moving glare */}
            <clipPath id={clipId}>
              <rect x={188} y={262} width={102} height={70} rx={20} />
              <rect x={310} y={262} width={102} height={70} rx={20} />
            </clipPath>
            <g clipPath={`url(#${clipId})`}>
              <rect x={150 + glare * 320} y={240} width={26} height={120} fill="rgba(255,255,255,0.22)" transform={`rotate(25 ${163 + glare * 320} 300)`} />
            </g>
            {lensSign > 0 &&
              [239, 361].map((lx) => (
                <text key={lx} x={lx} y={316} textAnchor="middle" fontFamily="Inter, Arial, sans-serif" fontWeight={800} fontSize={64} fill={lensColor} opacity={lensSign} transform={`scale(${0.6 + 0.4 * lensSign})`} style={{ transformOrigin: `${lx}px 297px`, transformBox: "view-box" }}>
                  {lensText}
                </text>
              ))}
          </g>
        )}
        {/* nose */}
        <path d="M300 330 Q290 362 300 372 Q312 372 316 362" stroke={c.skinShade} strokeWidth={7} fill="none" strokeLinecap="round" />
        {mouths?.[shape] ?? <Mouth v={shape} c={c} />}
        {sweat > 0 && <path d={`M438 ${200 + sweat * 40} q-14 24 0 34 q14 -10 0 -34 Z`} fill="#8FD3FF" opacity={Math.min(1, sweat * 1.5)} />}
      </g>
    </svg>
  );
};
