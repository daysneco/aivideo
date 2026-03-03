import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { bookScript } from './data/bookScript';
import { BookScene } from './components/BookScene';

// Transition duration in frames (shared with ThemeNavBar)
export const TRANSITION_FRAMES = 30; // 1s at 30fps — longer for smoother scene transitions
export const AUDIO_PADDING_FRAMES = 45; // 1.5s silence padding at end of each scene

export const BookComposition: React.FC = () => {
  const scenes = bookScript.scenes;
  const timeline = scenes.map((scene, index) => {
    const from = scenes
      .slice(0, index)
      .reduce((acc, s) => acc + s.durationInFrames, 0);

    return {
      ...scene,
      from,
    };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      {/* Centralized audio track: hard cut, full scene audio duration */}
      {timeline.map((item, index) => (
        <Sequence key={`audio-${item.id}`} from={item.from} durationInFrames={item.durationInFrames}>
          <Audio
            src={staticFile(`audio/${item.id}.wav`)}
            volume={(f) => {
              // tiny fade to avoid click, no overlap
              const fadeIn = Math.min(1, f / 3);
              const fadeOut = Math.min(1, Math.max(0, (item.durationInFrames - f) / 3));
              return Math.min(fadeIn, fadeOut);
            }}
          />
        </Sequence>
      ))}

      {timeline.map((item) => (
        <Sequence key={`visual-${item.id}`} from={item.from} durationInFrames={item.durationInFrames}>
          <BookScene item={item} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
