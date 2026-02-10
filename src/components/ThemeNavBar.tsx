import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { Scene } from '../types/book';

interface ThemeNavBarProps {
  themes: string[];
  scenes: Scene[];
  transitionFrames?: number;
}

export const ThemeNavBar: React.FC<ThemeNavBarProps> = ({
  themes,
  scenes,
  transitionFrames = 0,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Calculate which scene is currently playing,
  // accounting for transition overlap between scenes
  let accumulated = 0;
  let activeTheme = themes[0];
  for (let i = 0; i < scenes.length; i++) {
    if (frame < accumulated + scenes[i].durationInFrames) {
      activeTheme = scenes[i].theme;
      break;
    }
    // Each transition causes an overlap, so the next scene starts earlier
    const overlap = i < scenes.length - 1 ? transitionFrames : 0;
    accumulated += scenes[i].durationInFrames - overlap;
    // Fallback to the last scene's theme
    activeTheme = scenes[i].theme;
  }

  const activeIndex = themes.indexOf(activeTheme);

  // Overall progress percentage
  const progress = Math.min(frame / durationInFrames, 1);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
      }}
    >
      {/* Overall progress bar */}
      <div
        style={{
          height: 3,
          backgroundColor: 'rgba(255,255,255,0.08)',
          width: '100%',
        }}
      >
        <div
          style={{
            height: '100%',
            backgroundColor: '#5dadff',
            boxShadow: '0 0 10px rgba(80, 160, 255, 0.4)',
            width: `${progress * 100}%`,
          }}
        />
      </div>

      {/* Theme tabs */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 20,
          padding: '16px 40px 0',
        }}
      >
        {themes.map((theme, index) => (
          <div
            key={index}
            style={{
              padding: '10px 22px',
              borderRadius: 24,
              backgroundColor: index === activeIndex
                ? 'rgba(80, 160, 255, 0.25)'
                : 'rgba(255,255,255,0.06)',
              color: index === activeIndex ? '#7dc4ff' : 'rgba(255,255,255,0.4)',
              border: index === activeIndex
                ? '1px solid rgba(80, 160, 255, 0.3)'
                : '1px solid rgba(255,255,255,0.08)',
              fontSize: 26,
              fontWeight: index === activeIndex ? 600 : 400,
              whiteSpace: 'nowrap',
              fontFamily: '"LXGW WenKai", "KaiTi", sans-serif',
            }}
          >
            {theme}
          </div>
        ))}
      </div>
    </div>
  );
};
