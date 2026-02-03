import React from 'react';
import { Series, AbsoluteFill } from 'remotion';
import { bookScript } from './data/bookScript';
import { BookScene } from './components/BookScene';
import { ThemeNavBar } from './components/ThemeNavBar';

export const BookComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: 'white' }}>
      <ThemeNavBar items={bookScript.themes} />
      <Series>
        {bookScript.scenes.map((item) => (
          <Series.Sequence key={item.id} durationInFrames={item.durationInFrames}>
            <BookScene item={item} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
