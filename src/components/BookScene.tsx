import React, { useMemo } from 'react';
import { interpolate, useCurrentFrame, useVideoConfig, spring, Audio, staticFile } from 'remotion';
import * as LucideIcons from 'lucide-react';
import { Scene } from '../types/book';

// Dynamic Icon component
const DynamicIcon = ({ name, size, color }: { name: string; size: number; color: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.HelpCircle;
  return <IconComponent size={size} color={color} strokeWidth={2.5} />;
};

// Subtitle component
const Subtitle: React.FC<{ text: string; totalFrames: number }> = ({ text, totalFrames }) => {
  const frame = useCurrentFrame();
  
  // Advanced segmentation logic
  const { segments, segmentEndFrames } = useMemo(() => {
    const maxCharsPerLine = 22; // Slightly increased
    // Split by punctuation but include delimiters in the parts
    // We want to combine text + its following punctuation into a single "atom"
    const punishTokens = /([，。！？；：、])/;
    const rawParts = text.split(punishTokens);
    
    // Combine text and punctuation
    let atomParts: string[] = [];
    for (let i = 0; i < rawParts.length; i += 2) {
      const t = rawParts[i];
      const p = rawParts[i + 1] || ''; // Punctuation
      if (t || p) {
        atomParts.push(t + p);
      }
    }

    const finalSegments: string[] = [];
    let currentLine = '';

    // Reassemble into lines with smart wrapping
    atomParts.forEach(part => {
      // 1. Hard limit check
      const willExceed = currentLine.length + part.length > maxCharsPerLine;
      
      // 2. Aesthetic check: Avoid appending a short "orphan" phrase to the end of a long line.
      // If the current line is already substantial (> 12 chars), and the next part is short (< 5 chars),
      // it looks better to start a new line with that short part (e.g. "其实，")
      const isLineLong = currentLine.length > 12;
      const isPartShort = part.length < 5;
      const avoidOrphan = isLineLong && isPartShort;

      if ((willExceed || avoidOrphan) && currentLine.length > 0) {
        finalSegments.push(currentLine);
        currentLine = part;
      } else {
        currentLine += part;
      }
    });
    if (currentLine) finalSegments.push(currentLine);

    // Calculate timing weights based on character count
    const totalChars = text.length;
    let accumulatedFrames = 0;
    const endFrames: number[] = [];

    finalSegments.forEach(seg => {
      const weight = seg.length / totalChars;
      const duration = weight * totalFrames;
      accumulatedFrames += duration;
      endFrames.push(accumulatedFrames);
    });

    return { segments: finalSegments, segmentEndFrames: endFrames };
  }, [text, totalFrames]);

  // Determine current segment
  let currentSegmentIndex = 0;
  for (let i = 0; i < segmentEndFrames.length; i++) {
    if (frame < segmentEndFrames[i]) {
      currentSegmentIndex = i;
      break;
    }
    // If we are at the last frame or beyond, stay on last segment
    if (i === segmentEndFrames.length - 1) currentSegmentIndex = i;
  }

  const currentSegment = segments[currentSegmentIndex] || '';
  
  // Calculate relative frame timing
  const segmentStartFrame = currentSegmentIndex === 0 ? 0 : segmentEndFrames[currentSegmentIndex - 1];
  const segmentDuration = segmentEndFrames[currentSegmentIndex] - segmentStartFrame;
  const framesInSegment = frame - segmentStartFrame;
  
  // Fade in animation for the whole segment instead of typewriter
  const opacity = interpolate(
    framesInSegment,
    [0, 5],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  return (
    <p
      style={{
        fontSize: 38,
        fontWeight: 'normal',
        color: '#555',
        textAlign: 'center',
        margin: 0,
        lineHeight: 1.5,
        textShadow: '0 2px 10px rgba(255,255,255,0.8)',
        backgroundColor: 'rgba(255,255,255,0.9)',
        padding: '16px 32px',
        borderRadius: 16,
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        minHeight: '1.5em',
        display: 'inline-block',
        opacity, // Apply fade in
      }}
    >
      {currentSegment} 
    </p>
  );
};

export const BookScene: React.FC<{ item: Scene }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animations
  const iconScale = spring({
    frame,
    fps,
    config: { damping: 12 },
  });

  const textOpacity = interpolate(frame, [20, 50], [0, 1], {
    extrapolateRight: 'clamp',
  });
  
  const textTranslate = interpolate(frame, [20, 50], [50, 0], {
    extrapolateRight: 'clamp',
  });

  const audioSrc = staticFile(`audio/${item.id}.mp3`);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
        fontFamily: '"LXGW WenKai", "KaiTi", sans-serif',
      }}
    >
      <Audio src={audioSrc} />

      {/* Main Visual Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          paddingBottom: 100, // Make room for subtitles
        }}
      >
        <div
          style={{
            transform: `scale(${iconScale})`,
            marginBottom: 60,
          }}
        >
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

      {/* Subtitle / Narration Area */}
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
