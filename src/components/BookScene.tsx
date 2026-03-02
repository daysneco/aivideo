import React, { useMemo, useCallback } from 'react';
import { interpolate, useCurrentFrame, useVideoConfig, spring, Audio, staticFile, Img } from 'remotion';
import * as LucideIcons from 'lucide-react';
import { Scene } from '../types/book';
import { TRANSITION_FRAMES, AUDIO_PADDING_FRAMES } from '../BookComposition';
import { VIDEO_CONFIG } from '../config';
import { sceneIdsWithImages } from '../data/imageManifest';
import { bookScript } from '../data/bookScript';

// Dynamic Icon component
const DynamicIcon = ({ name, size, color }: { name: string; size: number; color: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.HelpCircle;
  return <IconComponent size={size} color={color} strokeWidth={2.5} />;
};

// Only use ImageScene when we know the PNG was generated (avoids 404 during render)
const hasImage = (sceneId: string): boolean => sceneIdsWithImages.includes(sceneId);

const MAX_CHARS_PER_LINE = VIDEO_CONFIG.LAYOUT.MAX_CHARS_PER_LINE;

// 默认高亮词（当 bookScript.highlightKeywords 未配置时使用）
const DEFAULT_HIGHLIGHT_KEYWORDS = [
  '自卑', '超越', '生活风格', '社会兴趣', '合作', '勇气', '奉献', '意义', '童年', '记忆', '焦虑', '目标'
];

// ──────────────────────────────────────────────
// Subtitle component (Strict single line, Auto-switch)
// ──────────────────────────────────────────────
const Subtitle: React.FC<{ 
  text: string; 
  textEn?: string;
  totalFrames: number; 
  darkMode?: boolean; 
  fontSize?: number;
  /** 本书核心概念词，字幕中出现则高亮；不传则用默认词表 */
  highlightKeywords?: string[];
}> = ({
  text,
  textEn = "",
  totalFrames,
  darkMode = false,
  fontSize = VIDEO_CONFIG.LAYOUT.SUBTITLE_CN_SIZE,
  highlightKeywords,
}) => {
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
      if (currentBuffer && (currentBuffer.length + clause.length > MAX_CHARS_PER_LINE)) {
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
    if (!textEn) return segments.map(() => "");
    
    const clausesEn = textEn.split(/(?<=[,.!?;:])\s+/);
    
    if (clausesEn.length === segments.length) return clausesEn;
    
    const words = textEn.split(/\s+/);
    const cnTotal = segments.join('').length;
    const result: string[] = [];
    let wordIdx = 0;
    
    for (let i = 0; i < segments.length; i++) {
      if (i === segments.length - 1) {
        result.push(words.slice(wordIdx).join(' '));
        break;
      }
      const targetWordCount = Math.max(1, Math.round((segments[i].length / cnTotal) * words.length));
      result.push(words.slice(wordIdx, wordIdx + targetWordCount).join(' '));
      wordIdx += targetWordCount;
    }
    return result;
  }, [textEn, segments]);

  const segmentTimings = useMemo(() => {
    const getWeight = (s: string) => {
      let weight = s.length;
      const punctuationMatch = s.match(/[。！？，、；：]/g);
      if (punctuationMatch) {
        weight += punctuationMatch.length * 2; 
      }
      return weight;
    };

    const weights = segments.map(getWeight);
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
    if (frame < segmentTimings[i].end) {
      currentIndex = i;
      break;
    }
  }

  const rawSegment = segments[currentIndex] || '';
  const currentSegment = rawSegment.replace(/[。！？，、；：,.!?;:]+$/, '');
  const currentSegmentEn = segmentsEn[currentIndex] || '';
  
  const keywords = (highlightKeywords && highlightKeywords.length > 0) ? highlightKeywords : DEFAULT_HIGHLIGHT_KEYWORDS;
  const renderHighlightedText = (content: string) => {
    if (keywords.length === 0) return <>{content}</>;
    const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${escaped})`, 'g');
    const parts = content.split(regex);
    return parts.map((part, i) => {
      const isKeyword = keywords.includes(part);
      return (
        <span key={i} style={{ color: isKeyword ? '#2563eb' : 'inherit' }}>
          {part}
        </span>
      );
    });
  };

  let opacity = 1;
  if (frame > audioFrames) {
    opacity = interpolate(frame, [audioFrames, audioFrames + 15], [1, 0], { extrapolateRight: 'clamp' });
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: 10,
      width: '100%',
      opacity 
    }}>
      <p
        style={{
          fontSize: 44,
          fontWeight: 'bold',
          color: '#000000',
          textAlign: 'center',
          lineHeight: 1.2,
          padding: `0 ${VIDEO_CONFIG.LAYOUT.SUBTITLE_PADDING_H}px`,
          maxWidth: '100%',
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {renderHighlightedText(currentSegment)}
      </p>
      {currentSegmentEn && (
        <p
          style={{
            fontSize: 32,
            fontWeight: 'normal',
            color: 'rgba(0, 0, 0, 0.7)',
            textAlign: 'center',
            lineHeight: 1.2,
            padding: `0 ${VIDEO_CONFIG.LAYOUT.SUBTITLE_PADDING_H}px`,
            maxWidth: '100%',
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {currentSegmentEn}
        </p>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────
// Image-based scene layout (Simplified: No Nav, No Zoom, Clean Top Bar)
// ──────────────────────────────────────────────
const ImageScene: React.FC<{ item: Scene }> = ({ item }) => {
  const frame = useCurrentFrame();
  const imageSrc = staticFile(`images/${item.id}.png`);
  const audioSrc = staticFile(`audio/${item.id}.wav`);

  const enterOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  const audioVolume = useCallback((f: number) => {
    const fadeIn = interpolate(f, [0, 10], [0, 2], { extrapolateRight: 'clamp' });
    const fadeOut = interpolate(f, [item.durationInFrames - TRANSITION_FRAMES, item.durationInFrames], [2, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    return Math.min(fadeIn, fadeOut);
  }, [item.durationInFrames]);

  const glowPulse = interpolate(
    Math.sin(frame / 20),
    [-1, 1],
    [0.1, 0.35]
  );

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"LXGW WenKai", "KaiTi", sans-serif',
        backgroundColor: '#000000',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 240,
            background: `radial-gradient(circle, rgba(0, 120, 255, ${glowPulse}) 0%, transparent 80%)`,
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 240,
            background: `radial-gradient(circle, rgba(0, 120, 255, ${glowPulse}) 0%, transparent 80%)`,
            zIndex: 0,
          }}
        />

        <div
          style={{
            width: 1080,
            height: 1920,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#000',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <Img
            src={imageSrc}
            style={{
              width: 1080,
              height: 1440,
              objectFit: 'cover',
              opacity: enterOpacity,
            }}
          />

          <div style={{ 
            position: 'absolute',
            top: 270,
            left: 0,
            right: 0,
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            zIndex: 10,
          }}>
            <span style={{ 
              color: VIDEO_CONFIG.TITLE_COLOR, 
              fontSize: VIDEO_CONFIG.TITLE_FONT_SIZE, 
              fontWeight: 'bold', 
              fontStyle: 'italic',
              letterSpacing: 4,
              textShadow: '2px 2px 10px rgba(0,0,0,0.8)',
            }}>
              {(bookScript.bookTitle || '').replace(/[《》]/g, '').trim()}
            </span>
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: 270,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              padding: `0 ${VIDEO_CONFIG.LAYOUT.SUBTITLE_PADDING_H}px`,
              zIndex: 10,
            }}
          >
            <Subtitle 
              text={item.narration} 
              textEn={item.narrationEn}
              totalFrames={item.durationInFrames}
              highlightKeywords={bookScript.highlightKeywords}
            />
          </div>
        </div>
      </div>

      <Audio src={audioSrc} volume={audioVolume} />
    </div>
  );
};

// ──────────────────────────────────────────────
// Fallback icon scene (no AI image)
// ──────────────────────────────────────────────
const IconScene: React.FC<{ item: Scene }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const audioSrc = staticFile(`audio/${item.id}.wav`);

  const audioVolume = useCallback((f: number) => {
    const fadeIn = interpolate(f, [0, 10], [0, 2], { extrapolateRight: 'clamp' });
    const fadeOut = interpolate(f, [item.durationInFrames - TRANSITION_FRAMES, item.durationInFrames], [2, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    return Math.min(fadeIn, fadeOut);
  }, [item.durationInFrames]);

  const iconScale = spring({ frame, fps, config: { damping: 12 } });
  const textOpacity = interpolate(frame, [20, 50], [0, 1], { extrapolateRight: 'clamp' });
  const textTranslate = interpolate(frame, [20, 50], [50, 0], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0a0a0f',
        fontFamily: '"LXGW WenKai", "KaiTi", sans-serif',
      }}
    >
      <Audio src={audioSrc} volume={audioVolume} />

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          paddingBottom: 100,
        }}
      >
        <div style={{ transform: `scale(${iconScale})`, marginBottom: 60 }}>
          <div
            style={{
              backgroundColor: item.color,
              borderRadius: '50%',
              padding: 70,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <DynamicIcon name={item.icon} size={140} color="white" />
          </div>
        </div>

        <h1
          style={{
            fontSize: 80,
            fontWeight: 'bold',
            color: '#333',
            margin: 0,
            opacity: textOpacity,
            transform: `translateY(${textTranslate}px)`,
            textAlign: 'center',
            maxWidth: '90%',
            lineHeight: 1.2,
          }}
        >
          {item.title}
        </h1>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 100,
          left: VIDEO_CONFIG.LAYOUT.SUBTITLE_PADDING_H,
          right: VIDEO_CONFIG.LAYOUT.SUBTITLE_PADDING_H,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Subtitle text={item.narration} textEn={item.narrationEn} totalFrames={item.durationInFrames} highlightKeywords={bookScript.highlightKeywords} />
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────
// Cover Intro Scene (Top Image 80%, Bottom Text 20%)
// ──────────────────────────────────────────────
const CoverIntroScene: React.FC<{ item: Scene }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const imageSrc = staticFile('book_cover.png'); 
  const audioSrc = staticFile(`audio/${item.id}.wav`);

  const audioVolume = useCallback((f: number) => {
    const fadeIn = interpolate(f, [0, 10], [0, 2], { extrapolateRight: 'clamp' });
    const fadeOut = interpolate(f, [item.durationInFrames - TRANSITION_FRAMES, item.durationInFrames], [2, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    return Math.min(fadeIn, fadeOut);
  }, [item.durationInFrames]);

  const enterOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const imageScale = interpolate(spring({ frame, fps, config: { damping: 20 } }), [0, 1], [0.96, 1]);

  const glowPulse = interpolate(
    Math.sin(frame / 20),
    [-1, 1],
    [0.1, 0.35]
  );

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"LXGW WenKai", "KaiTi", sans-serif',
        backgroundColor: '#000000',
        position: 'relative',
        overflow: 'hidden',
        opacity: enterOpacity,
      }}
    >
      <Audio src={audioSrc} volume={audioVolume} />

      <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 240,
            background: `radial-gradient(circle, rgba(0, 120, 255, ${glowPulse}) 0%, transparent 80%)`,
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 240,
            background: `radial-gradient(circle, rgba(0, 120, 255, ${glowPulse}) 0%, transparent 80%)`,
            zIndex: 0,
          }}
        />

        <div
          style={{
            width: 1080,
            height: 1920,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#000',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <Img
            src={imageSrc}
            style={{
              width: 1080,
              height: 1440,
              objectFit: 'cover',
              transform: `scale(${imageScale})`,
            }}
          />

          <div style={{ 
            position: 'absolute',
            top: 270,
            left: 0,
            right: 0,
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            zIndex: 10,
          }}>
            <span style={{ 
              color: VIDEO_CONFIG.TITLE_COLOR, 
              fontSize: VIDEO_CONFIG.TITLE_FONT_SIZE, 
              fontWeight: 'bold', 
              fontStyle: 'italic',
              letterSpacing: 4,
              textShadow: '2px 2px 10px rgba(0,0,0,0.8)',
            }}>
              {(bookScript.bookTitle || '').replace(/[《》]/g, '').trim()}
            </span>
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: 270,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              padding: `0 ${VIDEO_CONFIG.LAYOUT.SUBTITLE_PADDING_H}px`,
              zIndex: 10,
            }}
          >
            <Subtitle 
              text={item.narration} 
              textEn={item.narrationEn}
              totalFrames={item.durationInFrames}
              highlightKeywords={bookScript.highlightKeywords}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────
// Main export
// ──────────────────────────────────────────────
export const BookScene: React.FC<{ item: Scene }> = ({ item }) => {
  // Use Cover Intro layout only for the first time book name is shown (intro-1)
  if (item.id === 'intro-1') {
    return <CoverIntroScene item={item} />;
  }
  const imageExists = hasImage(item.id);
  return imageExists ? <ImageScene item={item} /> : <IconScene item={item} />;
};
