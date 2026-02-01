import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { ScriptItem } from '../data/script';

export const Scene: React.FC<{ item: ScriptItem }> = ({ item }) => {
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

  const subtextOpacity = interpolate(frame, [40, 70], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const Icon = item.icon;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
        fontFamily: 'Helvetica, Arial, sans-serif',
      }}
    >
      <div
        style={{
          transform: `scale(${iconScale})`,
          marginBottom: 50,
        }}
      >
        <div
          style={{
            backgroundColor: item.color,
            borderRadius: '50%',
            padding: 60,
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Icon size={120} color="white" strokeWidth={2.5} />
        </div>
      </div>

      <h1
        style={{
          fontSize: 100,
          fontWeight: 'bold',
          color: '#333',
          margin: 0,
          opacity: textOpacity,
          transform: `translateY(${textTranslate}px)`,
          textAlign: 'center',
        }}
      >
        {item.text}
      </h1>

      {item.subtext && (
        <h2
          style={{
            fontSize: 50,
            fontWeight: 'normal',
            color: '#666',
            marginTop: 30,
            opacity: subtextOpacity,
            textAlign: 'center',
            maxWidth: '80%',
          }}
        >
          {item.subtext}
        </h2>
      )}
    </div>
  );
};
