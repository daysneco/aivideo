import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming, springTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { flip } from '@remotion/transitions/flip';
import { bookScript } from './data/bookScript';
import { BookScene } from './components/BookScene';
import { ThemeNavBar } from './components/ThemeNavBar';
import { swingDoor, zoomRotate } from './transitions/custom3d';

// Transition duration in frames (shared with ThemeNavBar)
export const TRANSITION_FRAMES = 30; // 1s at 30fps — longer for smoother scene transitions
export const AUDIO_PADDING_FRAMES = 45; // 1.5s silence padding at end of each scene

// Pick transition effect based on theme change and scene index
function getTransition(prevTheme: string, nextTheme: string, index: number) {
  if (prevTheme === nextTheme) {
    // Same theme: alternate between fade and flip
    const sameThemeEffects = [
      fade(),
      flip({ direction: 'from-right', perspective: 1200 }),
    ];
    return {
      presentation: sameThemeEffects[index % sameThemeEffects.length],
      timing: index % 2 === 0
        ? linearTiming({ durationInFrames: TRANSITION_FRAMES })
        : springTiming({ durationInFrames: TRANSITION_FRAMES, config: { damping: 15 } }),
    };
  }
  // Cross-theme: cycle through 3D and directional effects
  const crossThemeEffects = [
    flip({ direction: 'from-left', perspective: 1000 }),
    swingDoor({ perspective: 1200 }),
    zoomRotate({ perspective: 1000 }),
    slide({ direction: 'from-bottom' }),
  ];
  const hash = (prevTheme.length + nextTheme.length + index) % crossThemeEffects.length;
  return {
    presentation: crossThemeEffects[hash],
    timing: springTiming({ durationInFrames: TRANSITION_FRAMES, config: { damping: 14 } }),
  };
}

export const BookComposition: React.FC = () => {
  const scenes = bookScript.scenes;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0f' }}>
      <ThemeNavBar
        themes={bookScript.themes}
        scenes={scenes}
        transitionFrames={TRANSITION_FRAMES}
      />
      <TransitionSeries>
        {scenes.map((item, index) => (
          <React.Fragment key={item.id}>
            <TransitionSeries.Sequence durationInFrames={item.durationInFrames}>
              <BookScene item={item} />
            </TransitionSeries.Sequence>
            {index < scenes.length - 1 && (() => {
              const t = getTransition(item.theme, scenes[index + 1].theme, index);
              return (
                <TransitionSeries.Transition
                  presentation={t.presentation}
                  timing={t.timing}
                />
              );
            })()}
          </React.Fragment>
        ))}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
