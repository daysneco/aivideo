import React, { useMemo, useCallback } from 'react';
import { interpolate, useCurrentFrame, useVideoConfig, spring, staticFile, Img } from 'remotion';
import * as LucideIcons from 'lucide-react';
import { Scene } from '../types/book';
import { TRANSITION_FRAMES, AUDIO_PADDING_FRAMES } from '../BookComposition';
import { VIDEO_CONFIG } from '../config';
import { sceneIdsWithImages, coverFileName } from '../data/imageManifest';
import { hasIntroBackground } from '../data/introBackground';
import { subtitleFontFamily } from '../data/subtitleFont';
import { bookScript } from '../data/bookScript';

// ──────────────────────────────────────────────
// Helper Functions
// ──────────────────────────────────────────────

const renderHighlightedText = (content: string, highlightKeywords?: string[]) => {
  const keywords = highlightKeywords && highlightKeywords.length > 0 ? highlightKeywords : [];
  if (keywords.length === 0) return <>{content}</>;

  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${escaped})`, 'g');
  const parts = content.split(regex);

  return parts.map((part, i) => {
    const isKeyword = keywords.includes(part);
    return (
      <span key={i} style={{ 
        color: isKeyword ? '#fbbf24' : 'inherit',
        fontWeight: isKeyword ? '900' : 'inherit',
        textShadow: isKeyword ? '0 0 15px rgba(251, 191, 36, 0.6)' : 'inherit'
      }}>
        {part}
      </span>
    );
  });
};

// ──────────────────────────────────────────────
// Subtitle component
// ──────────────────────────────────────────────
const Subtitle: React.FC<{ 
  text: string; 
  textEn?: string;
  totalFrames: number; 
  highlightKeywords?: string[];
}> = ({ text, textEn, totalFrames, highlightKeywords }) => {
  const frame = useCurrentFrame();
  const audioFrames = totalFrames - AUDIO_PADDING_FRAMES;

  const segments = useMemo(() => {
    const clauseRegex = /[^。！？，、；：]+[。！？，、；：]?/g;
    const clauses: string[] = [];
    let match;
    while ((match = clauseRegex.exec(text)) !== null) {
      if (match[0].trim()) clauses.push(match[0].trim());
    }
    const result: string[] = [];
    let currentBuffer = "";
    for (const clause of clauses) {
      if (currentBuffer && (currentBuffer.length + clause.length > VIDEO_CONFIG.LAYOUT.MAX_CHARS_PER_LINE)) {
        result.push(currentBuffer);
        currentBuffer = clause;
      } else {
        currentBuffer += clause;
      }
    }
    if (currentBuffer) result.push(currentBuffer);
    return result;
  }, [text]);

  const segmentsEn = useMemo(() => {
    if (!textEn) return [];
    const words = textEn.split(' ');
    const totalChars = text.length;
    const result: string[] = [];
    let currentWordIdx = 0;
    
    segments.forEach((seg, i) => {
      if (i === segments.length - 1) {
        result.push(words.slice(currentWordIdx).join(' '));
      } else {
        const ratio = seg.length / totalChars;
        const count = Math.max(1, Math.round(words.length * ratio));
        result.push(words.slice(currentWordIdx, currentWordIdx + count).join(' '));
        currentWordIdx += count;
      }
    });
    return result;
  }, [text, textEn, segments]);

  const segmentTimings = useMemo(() => {
    const weights = segments.map(s => s.length + (s.match(/[。！？，、；：]/g)?.length || 0) * 2);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let accumulatedFrames = 0;
    return segments.map((seg, i) => {
      const duration = (weights[i] / totalWeight) * audioFrames;
      const timing = { start: accumulatedFrames, end: accumulatedFrames + duration };
      accumulatedFrames += duration;
      return timing;
    });
  }, [segments, audioFrames]);

  let currentIndex = segments.length - 1;
  for (let i = 0; i < segmentTimings.length; i++) {
    if (frame < segmentTimings[i].end) { currentIndex = i; break; }
  }

  const currentSegment = (segments[currentIndex] || '').replace(/[。！？，、；：,.!?;:]+$/, '');
  const currentSegmentEn = segmentsEn[currentIndex] || '';
  const keywords = (highlightKeywords && highlightKeywords.length > 0) ? highlightKeywords : [];

  const textScale = spring({
    frame: frame - (segmentTimings[currentIndex]?.start || 0),
    fps: 30,
    config: { damping: 10, stiffness: 200 }
  });

  let opacity = 1;
  if (frame > audioFrames) {
    opacity = interpolate(frame, [audioFrames, audioFrames + 15], [1, 0], { extrapolateRight: 'clamp' });
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      width: '100%', 
      padding: `0 ${VIDEO_CONFIG.LAYOUT.SUBTITLE_PADDING_H}px`,
      boxSizing: 'border-box',
      opacity 
    }}>
      <div style={{
        padding: `12px 24px`, 
        backgroundColor: 'rgba(0,0,0,0.5)', 
        borderRadius: 16,
        textShadow: '0 0 10px rgba(0,0,0,1), 0 0 20px rgba(0,0,0,0.8)',
        transform: `scale(${interpolate(textScale, [0, 1], [0.95, 1])})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <p style={{
            fontFamily: subtitleFontFamily,
            fontSize: VIDEO_CONFIG.LAYOUT.SUBTITLE_CN_SIZE, 
            fontWeight: '900', 
            color: '#FFFFFF', 
            textAlign: 'center', 
            lineHeight: 1.1,
            maxWidth: '100%', 
            margin: 0,
            whiteSpace: 'pre-wrap', 
            wordBreak: 'break-word',
          }}>
          {renderHighlightedText(currentSegment, keywords)}
        </p>
        {currentSegmentEn && (
          <p style={{
            fontFamily: subtitleFontFamily,
            fontSize: VIDEO_CONFIG.LAYOUT.SUBTITLE_EN_SIZE,
            fontWeight: '600',
            color: '#e2e8f0', 
            textAlign: 'center',
            lineHeight: 1.2,
            marginTop: 8,
            maxWidth: '100%',
            margin: '8px 0 0 0',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {currentSegmentEn}
          </p>
        )}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────
// Scene Types with Different Visual Effects
// ──────────────────────────────────────────────

const CinematicScene: React.FC<{ item: Scene; zoomDirection: 'in' | 'out' | 'left' | 'right' }> = ({ item, zoomDirection }) => {
  const frame = useCurrentFrame();
  const imageSrc = item.id === 'intro-book' ? staticFile(coverFileName) : staticFile(`images/${item.id}.png`);

  const enterOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  
  // Dynamic Ken Burns Effects
  let transform = '';
  const progress = frame / item.durationInFrames;
  
  if (zoomDirection === 'in') {
    const scale = interpolate(progress, [0, 1], [1, 1.2]);
    transform = `scale(${scale})`;
  } else if (zoomDirection === 'out') {
    const scale = interpolate(progress, [0, 1], [1.2, 1]);
    transform = `scale(${scale})`;
  } else if (zoomDirection === 'left') {
    const x = interpolate(progress, [0, 1], [-50, 50]);
    transform = `scale(1.2) translateX(${x}px)`;
  } else {
    const x = interpolate(progress, [0, 1], [50, -50]);
    transform = `scale(1.2) translateX(${x}px)`;
  }

  return (
    <div style={{ flex: 1, backgroundColor: '#000', position: 'relative', overflow: 'hidden', opacity: enterOpacity }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform }}>
        {item.id === 'intro-book' ? (
          <>
            {/* Background: AI landscape or blurred cover */}
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
            {/* Book cover on top */}
            <div style={{
              position: 'absolute',
              top: 0, left: 0, width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              paddingBottom: '200px'
            }}>
              <Img
                src={imageSrc}
                style={{
                  width: '75%',
                  maxHeight: '65%',
                  objectFit: 'contain',
                  borderRadius: '24px',
                  boxShadow: '0 30px 60px rgba(0,0,0,0.8)'
                }}
              />
            </div>
          </>
        ) : (
          <Img 
            src={imageSrc} 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover'
            }} 
          />
        )}
      </div>
      
      {/* Visual Overlays for "Punch" */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        boxShadow: 'inset 0 0 100px rgba(0,0,0,0.8)', zIndex: 5, pointerEvents: 'none'
      }} />

      <div style={{ position: 'absolute', bottom: 300, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10 }}>
        <Subtitle 
          text={item.narration} 
          textEn={item.narrationEn}
          totalFrames={item.durationInFrames} 
          highlightKeywords={bookScript.highlightKeywords} 
        />
      </div>
    </div>
  );
};

// Fragmented Image Fly-In (Retained for Points)
const FragmentedScene: React.FC<{ item: Scene }> = ({ item }) => {
  const frame = useCurrentFrame();
  const imageSrc = item.id === 'intro-book' ? staticFile(coverFileName) : staticFile(`images/${item.id}.png`);
  
  // Custom fragment logic would go here, using the one from V2 but maybe adding a rotation burst
  // For now, let's use a simpler "Split" effect for diversity
  const splitProgress = spring({ frame, fps: 30, config: { damping: 15 } });
  const opacity = interpolate(frame, [0, 10], [0, 1]);

  return (
    <div style={{ flex: 1, backgroundColor: '#000', position: 'relative', overflow: 'hidden', opacity }}>
       <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '50%', overflow: 'hidden' }}>
          <Img src={imageSrc} style={{ width: '100%', height: '200%', objectFit: 'cover', transform: `translateY(${interpolate(splitProgress, [0, 1], [-20, 0])}%)` }} />
       </div>
       <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '50%', overflow: 'hidden' }}>
          <Img src={imageSrc} style={{ width: '100%', height: '200%', objectFit: 'cover', top: '-100%', position: 'relative', transform: `translateY(${interpolate(splitProgress, [0, 1], [20, 0])}%)` }} />
       </div>
       <div style={{ position: 'absolute', bottom: 300, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10 }}>
        <Subtitle 
          text={item.narration} 
          textEn={item.narrationEn}
          totalFrames={item.durationInFrames} 
          highlightKeywords={bookScript.highlightKeywords} 
        />
      </div>
    </div>
  );
};

export const BookScene: React.FC<{ item: Scene }> = ({ item }) => {
  const frame = useCurrentFrame();
  const index = bookScript.scenes.findIndex(s => s.id === item.id);
  
  const hasImg = sceneIdsWithImages.includes(item.id);
  if (!hasImg) return null;

  // Cycle through 4 different cinematic movements
  const movements: ('in' | 'out' | 'left' | 'right')[] = ['in', 'right', 'out', 'left'];
  const move = movements[index % movements.length];

  // Special effects for specific scene types
  if (item.id.startsWith('point') && index % 2 === 0) {
    return <FragmentedScene item={item} />;
  }

  return <CinematicScene item={item} zoomDirection={move} />;
};
