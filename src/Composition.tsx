import React from 'react';
import { Series, AbsoluteFill } from 'remotion';
import { script } from './data/script';
import { topics } from './data/topics';
import { Scene } from './components/Scene';
import { ThemeNavBar } from './components/ThemeNavBar';

export const MyComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: 'white' }}>
      <ThemeNavBar items={topics} />
      <Series>
        {script.map((item) => (
          <Series.Sequence key={item.id} durationInFrames={item.durationInFrames}>
            <Scene item={item} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
