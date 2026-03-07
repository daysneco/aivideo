import React from 'react';
import { Composition, staticFile } from 'remotion';
import { BookComposition, TRANSITION_FRAMES } from './BookComposition';
import { CyberThumbnail } from './CyberThumbnail';
import { RealCoverXhs } from './RealCoverXhs';
import { bookScript } from './data/bookScript';
import { subtitleFontFile, subtitleFontFamily } from './data/subtitleFont';

const GlobalStyle = () => {
  const fontUrl = staticFile(subtitleFontFile);
  const format = subtitleFontFile.toLowerCase().endsWith('.otf') ? 'opentype' : 'truetype';
  return (
    <style>
      {`
        @font-face {
          font-family: '${subtitleFontFamily}';
          src: url('${fontUrl}') format('${format}');
          font-weight: normal;
          font-style: normal;
        }
        body {
          font-family: '${subtitleFontFamily}', sans-serif;
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
        width={1080}
        height={1920}
      />
      <Composition
        id="CyberCover"
        component={CyberThumbnail}
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="RealCoverXhs"
        component={RealCoverXhs}
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1440}
      />
    </>
  );
};
