import React from 'react';
import { Series, AbsoluteFill } from 'remotion';
import { script } from './data/script';
import { Scene } from './components/Scene';

export const MyComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: 'white' }}>
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
