import React from 'react';
import { Composition, staticFile } from 'remotion';
import { BookComposition } from './BookComposition';
import { bookScript } from './data/bookScript';

import { AbsoluteFill } from 'remotion';

const GlobalStyle = () => {
  const fontUrl = staticFile('LXGWWenKai.ttf');
  return (
    <style>
      {`
        @font-face {
          font-family: 'LXGW WenKai';
          src: url('${fontUrl}') format('truetype');
          font-weight: normal;
          font-style: normal;
        }
        body {
          font-family: 'LXGW WenKai', sans-serif;
        }
      `}
    </style>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <GlobalStyle />
      <Composition
        id="BookVideo"
        component={BookComposition}
        durationInFrames={bookScript.totalDuration}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
