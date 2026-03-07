import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { bookScript } from './data/bookScript';
import { BookScene } from './components/BookScene';

export const TRANSITION_FRAMES = 15; 
export const AUDIO_PADDING_FRAMES = 6; 

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
      {timeline.map((item) => (
        <Sequence key={`audio-${item.id}`} from={item.from} durationInFrames={item.durationInFrames}>
          <Audio
            src={staticFile(`audio/${item.id}.wav`)}
            volume={(f) => {
              const fadeIn = Math.min(1, f / 3);
              const fadeOut = Math.min(1, Math.max(0, (item.durationInFrames - f) / 3));
              return Math.min(fadeIn, fadeOut);
            }}
          />
        </Sequence>
      ))}

      {timeline.map((item, index) => {
        // 让视觉场景稍微多显示几帧，用于无缝覆盖
        const extraFrames = index < timeline.length - 1 ? 10 : 0;
        return (
          <Sequence key={`visual-${item.id}`} from={item.from} durationInFrames={item.durationInFrames + extraFrames}>
            <BookScene item={item} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
