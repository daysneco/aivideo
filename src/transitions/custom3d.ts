import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from '@remotion/transitions';
import React, { useMemo } from 'react';
import { AbsoluteFill, interpolate } from 'remotion';

// ──────────────────────────────────────────────
// Swing Door — exiting scene rotates away around
// its left edge like a door opening in 3D
// ──────────────────────────────────────────────

type SwingDoorProps = {
  perspective?: number;
};

const SwingDoorComponent: React.FC<
  TransitionPresentationComponentProps<SwingDoorProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const perspective = passedProps.perspective ?? 1200;

  const style: React.CSSProperties = useMemo(() => {
    if (presentationDirection === 'exiting') {
      // Exiting scene: rotate away like opening a door
      const rotation = interpolate(presentationProgress, [0, 1], [0, -90]);
      const opacity = interpolate(presentationProgress, [0, 0.6, 1], [1, 0.8, 0]);
      return {
        width: '100%',
        height: '100%',
        perspective: `${perspective}px`,
        transformOrigin: 'left center',
        transform: `perspective(${perspective}px) rotateY(${rotation}deg)`,
        opacity,
      };
    }
    // Entering scene: fade in from behind
    const opacity = interpolate(presentationProgress, [0, 0.5, 1], [0, 0.5, 1]);
    const scale = interpolate(presentationProgress, [0, 1], [0.95, 1]);
    return {
      width: '100%',
      height: '100%',
      transform: `scale(${scale})`,
      opacity,
    };
  }, [presentationDirection, presentationProgress, perspective]);

  return React.createElement(
    AbsoluteFill,
    null,
    React.createElement(AbsoluteFill, { style }, children),
  );
};

export const swingDoor = (
  props?: SwingDoorProps,
): TransitionPresentation<SwingDoorProps> => {
  return { component: SwingDoorComponent, props: props ?? {} };
};

// ──────────────────────────────────────────────
// Zoom Rotate — exiting scene scales down with a
// subtle rotation; entering scene zooms in from
// the distance with rotation
// ──────────────────────────────────────────────

type ZoomRotateProps = {
  perspective?: number;
};

const ZoomRotateComponent: React.FC<
  TransitionPresentationComponentProps<ZoomRotateProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const perspective = passedProps.perspective ?? 1000;

  const style: React.CSSProperties = useMemo(() => {
    if (presentationDirection === 'exiting') {
      // Exiting: scale down, rotate slightly, fade out
      const scale = interpolate(presentationProgress, [0, 1], [1, 0.6]);
      const rotation = interpolate(presentationProgress, [0, 1], [0, 15]);
      const opacity = interpolate(presentationProgress, [0, 0.7, 1], [1, 0.5, 0]);
      const translateZ = interpolate(presentationProgress, [0, 1], [0, -300]);
      return {
        width: '100%',
        height: '100%',
        transform: `perspective(${perspective}px) scale(${scale}) rotateY(${rotation}deg) translateZ(${translateZ}px)`,
        opacity,
      };
    }
    // Entering: zoom in from far with reverse rotation
    const scale = interpolate(presentationProgress, [0, 1], [1.4, 1]);
    const rotation = interpolate(presentationProgress, [0, 1], [-10, 0]);
    const opacity = interpolate(presentationProgress, [0, 0.3, 1], [0, 0.6, 1]);
    const translateZ = interpolate(presentationProgress, [0, 1], [200, 0]);
    return {
      width: '100%',
      height: '100%',
      transform: `perspective(${perspective}px) scale(${scale}) rotateY(${rotation}deg) translateZ(${translateZ}px)`,
      opacity,
    };
  }, [presentationDirection, presentationProgress, perspective]);

  return React.createElement(
    AbsoluteFill,
    null,
    React.createElement(AbsoluteFill, { style }, children),
  );
};

export const zoomRotate = (
  props?: ZoomRotateProps,
): TransitionPresentation<ZoomRotateProps> => {
  return { component: ZoomRotateComponent, props: props ?? {} };
};
