import React, { useMemo, useCallback } from 'react';
import { interpolate, useCurrentFrame, useVideoConfig, spring, Audio, staticFile, Img } from 'remotion';
import * as LucideIcons from 'lucide-react';
import { Scene } from '../types/book';
import { TRANSITION_FRAMES, AUDIO_PADDING_FRAMES } from '../BookComposition';

// Dynamic Icon component
const DynamicIcon = ({ name, size, color }: { name: string; size: number; color: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.HelpCircle;
  return <IconComponent size={size} color={color} strokeWidth={2.5} />;
};

// Check if scene has a generated image
const hasImage = (sceneId: string): boolean => {
  try {
    staticFile(`images/${sceneId}.png`);
    return true;
  } catch {
    return false;
  }
};

// Max characters per subtitle line (keep short to guarantee single line)
const MAX_CHARS_PER_LINE = 22;

// ──────────────────────────────────────────────
// Ken Burns effect variants
// ──────────────────────────────────────────────
type KenBurnsEffect = {
  startScale: number;
  endScale: number;
  startX: number;
  endX: number;
  startY: number;
  endY: number;
};

const KEN_BURNS_EFFECTS: KenBurnsEffect[] = [
  // Zoom in + drift right
  { startScale: 1.0, endScale: 1.2,  startX: 0,   endX: -30, startY: 0,   endY: -10 },
  // Zoom out + drift left
  { startScale: 1.25, endScale: 1.05, startX: -20, endX: 10,  startY: -10, endY: 5 },
  // Slow zoom in centered
  { startScale: 1.05, endScale: 1.2,  startX: 0,   endX: 0,   startY: 5,   endY: -15 },
  // Pan left to right
  { startScale: 1.15, endScale: 1.15, startX: -40, endX: 20,  startY: 0,   endY: 0 },
  // Zoom out + drift down
  { startScale: 1.3,  endScale: 1.05, startX: 10,  endX: -5,  startY: -20, endY: 10 },
  // Pan right to left + slight zoom
  { startScale: 1.1,  endScale: 1.2,  startX: 30,  endX: -20, startY: 5,   endY: -5 },
];

function getKenBurnsEffect(sceneId: string): KenBurnsEffect {
  // Use scene id to deterministically pick an effect
  let hash = 0;
  for (let i = 0; i < sceneId.length; i++) {
    hash = ((hash << 5) - hash + sceneId.charCodeAt(i)) | 0;
  }
  return KEN_BURNS_EFFECTS[Math.abs(hash) % KEN_BURNS_EFFECTS.length];
}

// ──────────────────────────────────────────────
// Subtitle component
// ──────────────────────────────────────────────
const Subtitle: React.FC<{ text: string; totalFrames: number; darkMode?: boolean }> = ({
  text,
  totalFrames,
  darkMode = false,
}) => {
  const frame = useCurrentFrame();

  // Subtitle timing uses only the audio portion (exclude padding at end)
  const audioFrames = totalFrames - AUDIO_PADDING_FRAMES;

  const segments = useMemo(() => {
    const clauseRegex = /[^。！？，、；：]+[。！？，、；：]?/g;
    const clauses: string[] = [];
    let match;
    while ((match = clauseRegex.exec(text)) !== null) {
      if (match[0].trim()) clauses.push(match[0].trim());
    }

    // Merge clauses into subtitle lines ≤ MAX_CHARS_PER_LINE
    // Rule: short leading phrases (≤7 chars, ending with ，：；)
    // like "他认为，" "你会发现" should start a NEW line and merge with what follows
    const LEADING_MAX = 7;
    const merged: string[] = [];
    let current = '';
    for (let ci = 0; ci < clauses.length; ci++) {
      const clause = clauses[ci];
      const isLeading = clause.length <= LEADING_MAX
        && /[，：；,;:]$/.test(clause)
        && ci < clauses.length - 1;

      if (isLeading && current) {
        // Push what we have, then start fresh with this leading phrase
        merged.push(current);
        current = clause;
      } else if (current && current.length + clause.length > MAX_CHARS_PER_LINE) {
        merged.push(current);
        current = clause;
      } else {
        current += clause;
      }
    }
    if (current) merged.push(current);

    // Force-split any segment still too long (e.g. no punctuation in the middle)
    const result: string[] = [];
    for (const seg of merged) {
      if (seg.length <= MAX_CHARS_PER_LINE) {
        result.push(seg);
      } else {
        for (let j = 0; j < seg.length; j += MAX_CHARS_PER_LINE) {
          result.push(seg.slice(j, j + MAX_CHARS_PER_LINE));
        }
      }
    }
    return result;
  }, [text]);

  const segmentTimings = useMemo(() => {
    const totalChars = segments.reduce((sum, s) => sum + s.length, 0);
    let accumulatedFrames = 0;
    const timings: { start: number; end: number }[] = [];
    segments.forEach((segment) => {
      const duration = (segment.length / totalChars) * audioFrames;
      timings.push({ start: accumulatedFrames, end: accumulatedFrames + duration });
      accumulatedFrames += duration;
    });
    return timings;
  }, [segments, audioFrames]);

  // During padding time, keep showing the last segment
  let currentIndex = segments.length - 1;
  for (let i = 0; i < segmentTimings.length; i++) {
    if (frame < segmentTimings[i].end) {
      currentIndex = i;
      break;
    }
  }

  const rawSegment = segments[currentIndex] || '';
  // Remove trailing punctuation
  const currentSegment = rawSegment.replace(/[。！？，、；：,.!?;:]+$/, '');
  const timing = segmentTimings[currentIndex];

  let opacity = 1;
  if (timing) {
    const fadeFrames = 5;
    const progress = frame - timing.start;
    const remaining = timing.end - frame;
    if (progress < fadeFrames) opacity = progress / fadeFrames;
    else if (remaining < fadeFrames) opacity = remaining / fadeFrames;
  }
  // Fade out subtitle during the end padding
  if (frame > audioFrames) {
    opacity = interpolate(frame, [audioFrames, audioFrames + 15], [1, 0], { extrapolateRight: 'clamp' });
  }

  return (
    <p
      style={{
        fontSize: 48,
        fontWeight: 500,
        color: darkMode ? '#f0f0f0' : '#1a1a1a',
        textAlign: 'center',
        margin: 0,
        lineHeight: 1.4,
        padding: '18px 40px',
        maxWidth: '90%',
        whiteSpace: 'nowrap',
        opacity,
        textShadow: darkMode
          ? '0 2px 8px rgba(0,0,0,0.8), 0 0px 30px rgba(0,0,0,0.5)'
          : '0 1px 6px rgba(255,255,255,0.9)',
      }}
    >
      {currentSegment}
    </p>
  );
};

// ──────────────────────────────────────────────
// Image-based scene layout (Layout B: centered image + separate subtitle)
// ──────────────────────────────────────────────
const ImageScene: React.FC<{ item: Scene }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const imageSrc = staticFile(`images/${item.id}.png`);
  const audioSrc = staticFile(`audio/${item.id}.wav`);

  // Ken Burns effect
  const kb = getKenBurnsEffect(item.id);
  const progress = interpolate(frame, [0, item.durationInFrames], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(progress, [0, 1], [kb.startScale, kb.endScale]);
  const translateX = interpolate(progress, [0, 1], [kb.startX, kb.endX]);
  const translateY = interpolate(progress, [0, 1], [kb.startY, kb.endY]);

  // Entrance animations
  const enterOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const imageScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });

  // Audio volume: fade in at start, fade out before transition
  const audioVolume = useCallback((f: number) => {
    const fadeIn = interpolate(f, [0, 10], [0, 2], { extrapolateRight: 'clamp' });
    const fadeOut = interpolate(f, [item.durationInFrames - TRANSITION_FRAMES, item.durationInFrames], [2, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    return Math.min(fadeIn, fadeOut);
  }, [item.durationInFrames]);

  // Animated light beams
  const beam1X = interpolate(frame, [0, item.durationInFrames], [-200, 400], { extrapolateRight: 'clamp' });
  const beam2X = interpolate(frame, [0, item.durationInFrames], [1200, 600], { extrapolateRight: 'clamp' });
  const glowPulse = interpolate(frame % 120, [0, 60, 120], [0.3, 0.6, 0.3]);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"LXGW WenKai", "KaiTi", sans-serif',
        backgroundColor: '#0a0a0f',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Audio src={audioSrc} volume={audioVolume} />

      {/* ── Futuristic background effects ── */}
      {/* Radial gradient base */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(ellipse at 50% 40%, rgba(30, 60, 120, 0.3) 0%, rgba(10, 10, 15, 0) 70%)',
        }}
      />

      {/* Animated diagonal light beam 1 */}
      <div
        style={{
          position: 'absolute',
          top: -100,
          left: beam1X,
          width: 300,
          height: 1200,
          background: 'linear-gradient(135deg, rgba(100, 180, 255, 0.04) 0%, rgba(100, 180, 255, 0.08) 50%, rgba(100, 180, 255, 0) 100%)',
          transform: 'rotate(-25deg)',
          filter: 'blur(40px)',
        }}
      />

      {/* Animated diagonal light beam 2 */}
      <div
        style={{
          position: 'absolute',
          top: -200,
          left: beam2X,
          width: 200,
          height: 1400,
          background: 'linear-gradient(135deg, rgba(160, 120, 255, 0.03) 0%, rgba(160, 120, 255, 0.06) 50%, rgba(160, 120, 255, 0) 100%)',
          transform: 'rotate(-30deg)',
          filter: 'blur(50px)',
        }}
      />

      {/* Subtle grid lines */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: `
            linear-gradient(rgba(100, 180, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(100, 180, 255, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
          opacity: glowPulse,
        }}
      />

      {/* Corner accent glow - top left */}
      <div
        style={{
          position: 'absolute',
          top: -80,
          left: -80,
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(80, 160, 255, 0.12) 0%, transparent 70%)',
          filter: 'blur(30px)',
        }}
      />

      {/* Corner accent glow - bottom right */}
      <div
        style={{
          position: 'absolute',
          bottom: -60,
          right: -60,
          width: 250,
          height: 250,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(140, 100, 255, 0.1) 0%, transparent 70%)',
          filter: 'blur(25px)',
        }}
      />

      {/* ── Top area: reserved for nav bar ── */}
      <div style={{ height: 90, flexShrink: 0, position: 'relative', zIndex: 2 }} />

      {/* ── Middle: centered image area ── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '10px 60px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            width: '85%',
            maxHeight: '100%',
            aspectRatio: '16 / 9',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 0 60px rgba(80, 160, 255, 0.15), 0 8px 32px rgba(0,0,0,0.5)',
            border: '1px solid rgba(100, 180, 255, 0.1)',
            transform: `scale(${interpolate(imageScale, [0, 1], [0.9, 1])})`,
            opacity: enterOpacity,
          }}
        >
          <Img
            src={imageSrc}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
            }}
          />
        </div>
      </div>

      {/* ── Bottom: subtitle area ── */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '10px 40px 30px',
          minHeight: 100,
          position: 'relative',
          zIndex: 2,
        }}
      >
        <Subtitle text={item.narration} totalFrames={item.durationInFrames} darkMode />
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────
// Fallback icon scene (no AI image)
// ──────────────────────────────────────────────
const IconScene: React.FC<{ item: Scene }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const audioSrc = staticFile(`audio/${item.id}.wav`);

  const audioVolume = useCallback((f: number) => {
    const fadeIn = interpolate(f, [0, 10], [0, 2], { extrapolateRight: 'clamp' });
    const fadeOut = interpolate(f, [item.durationInFrames - TRANSITION_FRAMES, item.durationInFrames], [2, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    return Math.min(fadeIn, fadeOut);
  }, [item.durationInFrames]);

  const iconScale = spring({ frame, fps, config: { damping: 12 } });
  const textOpacity = interpolate(frame, [20, 50], [0, 1], { extrapolateRight: 'clamp' });
  const textTranslate = interpolate(frame, [20, 50], [50, 0], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0a0a0f',
        fontFamily: '"LXGW WenKai", "KaiTi", sans-serif',
      }}
    >
      <Audio src={audioSrc} volume={audioVolume} />

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          paddingBottom: 100,
        }}
      >
        <div style={{ transform: `scale(${iconScale})`, marginBottom: 60 }}>
          <div
            style={{
              backgroundColor: item.color,
              borderRadius: '50%',
              padding: 70,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <DynamicIcon name={item.icon} size={140} color="white" />
          </div>
        </div>

        <h1
          style={{
            fontSize: 110,
            fontWeight: 'bold',
            color: '#333',
            margin: 0,
            opacity: textOpacity,
            transform: `translateY(${textTranslate}px)`,
            textAlign: 'center',
            maxWidth: '90%',
            lineHeight: 1.2,
          }}
        >
          {item.title}
        </h1>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: 100,
          right: 100,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Subtitle text={item.narration} totalFrames={item.durationInFrames} />
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────
// Main export
// ──────────────────────────────────────────────
export const BookScene: React.FC<{ item: Scene }> = ({ item }) => {
  const imageExists = hasImage(item.id);
  return imageExists ? <ImageScene item={item} /> : <IconScene item={item} />;
};
