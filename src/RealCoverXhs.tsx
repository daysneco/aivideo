import React from 'react';
import { AbsoluteFill, staticFile, Img } from 'remotion';
import { coverFileName } from './data/imageManifest';
import { hasIntroBackground } from './data/introBackground';

export const RealCoverXhs: React.FC = () => {
  const imageSrc = staticFile(coverFileName);
  
  return (
    <AbsoluteFill style={{ backgroundColor: '#000', position: 'relative', overflow: 'hidden' }}>
      <Img
        src={hasIntroBackground ? staticFile('intro_background.png') : imageSrc}
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          ...(hasIntroBackground
            ? { filter: 'brightness(0.7)' }
            : { filter: 'blur(30px) brightness(0.5)', transform: 'scale(1.2)' })
        }}
      />
      <div style={{
        position: 'absolute',
        top: 0, left: 0, width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Img
          src={imageSrc}
          style={{
            width: '80%',
            maxHeight: '80%',
            objectFit: 'contain',
            borderRadius: '12px',
            boxShadow: '0 30px 80px rgba(0,0,0,1)'
          }}
        />
      </div>
      
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        boxShadow: 'inset 0 0 150px rgba(0,0,0,0.9)', zIndex: 5, pointerEvents: 'none'
      }} />
    </AbsoluteFill>
  );
};
