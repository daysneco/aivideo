import React, { useMemo, useCallback } from 'react';
import { interpolate, useCurrentFrame, useVideoConfig, spring, staticFile, Img } from 'remotion';
import * as LucideIcons from 'lucide-react';
import { Scene } from '../types/book';
import { TRANSITION_FRAMES, AUDIO_PADDING_FRAMES } from '../BookComposition';
import { VIDEO_CONFIG } from '../config';
import { sceneIdsWithImages } from '../data/imageManifest';
import { bookScript } from '../data/bookScript';

// ──────────────────────────────────────────────
// Helper Functions
// ──────────────────────────────────────────────

// 文本高亮渲染函数
const renderHighlightedText = (content: string, highlightKeywords?: string[]) => {
  const keywords = highlightKeywords && highlightKeywords.length > 0 ? highlightKeywords : [];
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

// Fragmented Image Fly-In Component
const FragmentedImageFlyIn: React.FC<{
  src: string;
  width: number;
  height: number;
  durationInFrames: number;
}> = ({ src, width, height, durationInFrames }) => {
  const frame = useCurrentFrame();

  // 将图片分割成8x8的网格，总共64个碎片
  const gridSize = 8;
  const totalFragments = gridSize * gridSize;

  // 动画时长分配 - 更快的飞入速度
  const flyInDuration = Math.floor(durationInFrames * 0.2); // 20%时间用于飞入（更快）
  const settleDuration = durationInFrames - flyInDuration; // 60%时间用于稳定

  const fragments = useMemo(() => {
    const result = [];
    const fragmentWidth = width / gridSize;
    const fragmentHeight = height / gridSize;

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const index = row * gridSize + col;

        // 计算碎片的起始位置（屏幕边缘的随机位置）
        // 8个方向：上、下、左、右、左上、右上、左下、右下
        const directions = [
          { x: Math.random() * width, y: -fragmentHeight - Math.random() * 300 }, // 上
          { x: Math.random() * width, y: height + Math.random() * 300 },         // 下
          { x: -fragmentWidth - Math.random() * 300, y: Math.random() * height }, // 左
          { x: width + Math.random() * 300, y: Math.random() * height },         // 右
          { x: -fragmentWidth - Math.random() * 300, y: -fragmentHeight - Math.random() * 300 }, // 左上
          { x: width + Math.random() * 300, y: -fragmentHeight - Math.random() * 300 },         // 右上
          { x: -fragmentWidth - Math.random() * 300, y: height + Math.random() * 300 },         // 左下
          { x: width + Math.random() * 300, y: height + Math.random() * 300 },                  // 右下
        ];

        const startPos = directions[index % directions.length];

        // 计算碎片距离中心的距离，用于决定延迟
        const centerX = (gridSize - 1) * fragmentWidth / 2;
        const centerY = (gridSize - 1) * fragmentHeight / 2;
        const fragmentCenterX = col * fragmentWidth + fragmentWidth / 2;
        const fragmentCenterY = row * fragmentHeight + fragmentHeight / 2;
        const distanceFromCenter = Math.sqrt(
          Math.pow(fragmentCenterX - centerX, 2) +
          Math.pow(fragmentCenterY - centerY, 2)
        );
        const maxDistance = Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2));

        result.push({
          index,
          row,
          col,
          x: col * fragmentWidth,
          y: row * fragmentHeight,
          width: fragmentWidth,
          height: fragmentHeight,
          startX: startPos.x,
          startY: startPos.y,
          // 更快的延迟：距离中心越远的碎片延迟越小，先飞入
          delay: Math.floor((1 - distanceFromCenter / maxDistance) * flyInDuration * 0.08),
        });
      }
    }

    return result;
  }, [width, height, gridSize, flyInDuration, totalFragments]);

  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden' }}>
      {fragments.map((fragment) => {
        const fragmentFrame = Math.max(0, frame - fragment.delay);

        // 计算碎片的当前位置
        let currentX, currentY, currentScale, currentRotation;

        if (fragmentFrame < flyInDuration) {
          // 飞入阶段 - 使用更平滑的动画
          const progress = fragmentFrame / flyInDuration;

          // 使用easeOutQuart缓动，更平滑
          const easedProgress = 1 - Math.pow(1 - progress, 4);

          currentX = interpolate(easedProgress, [0, 1], [fragment.startX, fragment.x]);
          currentY = interpolate(easedProgress, [0, 1], [fragment.startY, fragment.y]);
          currentScale = interpolate(easedProgress, [0, 1], [0.8, 1]); // 减少缩放变化
          currentRotation = interpolate(easedProgress, [0, 1], [0, 0]); // 移除旋转，减少抖动
        } else {
          // 稳定阶段
          currentX = fragment.x;
          currentY = fragment.y;
          currentScale = 1;
          currentRotation = 0;
        }

        const opacity = fragmentFrame > 0 ? 1 : 0;

        return (
          <div
            key={fragment.index}
            style={{
              position: 'absolute',
              left: currentX,
              top: currentY,
              width: fragment.width,
              height: fragment.height,
              transform: `scale(${currentScale}) rotate(${currentRotation}deg)`,
              transformOrigin: 'center',
              opacity,
              overflow: 'hidden',
            }}
          >
            <Img
              src={src}
              style={{
                position: 'absolute',
                left: -fragment.col * fragment.width,
                top: -fragment.row * fragment.height,
                width: width,
                height: height,
                objectFit: 'cover',
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

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
// Image-based scene layout with Fragmented Fly-In Effect
// ──────────────────────────────────────────────
const ImageScene: React.FC<{ item: Scene }> = ({ item }) => {
  const frame = useCurrentFrame();
  const imageSrc = staticFile(`${item.id}.png`);

  const enterOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const exitOpacity = interpolate(frame, [item.durationInFrames - 15, item.durationInFrames], [1, 0], { extrapolateRight: 'clamp' });
  const sceneOpacity = Math.min(enterOpacity, exitOpacity);

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
            opacity: sceneOpacity,
          }}
        >
          <div style={{ opacity: enterOpacity }}>
            <FragmentedImageFlyIn
              src={imageSrc}
              width={1080}
              height={1440}
              durationInFrames={item.durationInFrames}
            />
          </div>

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
              {`《${(bookScript.bookTitle || '').replace(/[《》]/g, '').trim()}》`}
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
// Fallback icon scene (no AI image)
// ──────────────────────────────────────────────
const IconScene: React.FC<{ item: Scene }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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
  // Use real Douban cover for intro-1 scene, AI cover for others
  const imageSrc = item.id === 'intro-1' ? staticFile('book_cover_real.png') : staticFile('book_cover.png');

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
              {`《${(bookScript.bookTitle || '').replace(/[《》]/g, '').trim()}》`}
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
// 特效类型枚举
export enum EffectType {
  FRAGMENTS = 'fragments',      // 64碎片飞入特效
  FADE_IN = 'fade_in',          // 简单图片淡入淡出
  ICON = 'icon',                // 图标效果
  COVER = 'cover',              // 封面特效
}

// 特效选择逻辑 - 可以根据场景ID自定义特效
function getEffectForScene(sceneId: string): EffectType {
  // intro场景使用封面特效
  if (sceneId === 'intro-1') {
    return EffectType.COVER;
  }

  // point开头的场景使用碎片特效
  if (sceneId.startsWith('point')) {
    return EffectType.FRAGMENTS;
  }

  // 其他场景使用简单淡入淡出
  return EffectType.FADE_IN;
}

// 使用现有的hasImage函数检查图片是否存在

const SimpleImageScene: React.FC<{ item: Scene }> = ({ item }) => {
  const frame = useCurrentFrame();
  const imageSrc = staticFile(`${item.id}.png`);

  const enterOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const exitOpacity = interpolate(frame, [item.durationInFrames - 15, item.durationInFrames], [1, 0], { extrapolateRight: 'clamp' });
  const sceneOpacity = Math.min(enterOpacity, exitOpacity);

  const imageScale = interpolate(spring({ frame, fps: 30, config: { damping: 20 } }), [0, 1], [0.95, 1]);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000000',
      opacity: sceneOpacity,
    }}>
      {/* 背景光晕效果 */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 240,
          background: `radial-gradient(circle, rgba(0, 120, 255, ${interpolate(frame, [0, 30], [0, 0.3], { extrapolateRight: 'clamp' })}) 0%, transparent 80%)`,
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
          zIndex: 3,
        }}>

          <div style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: 240,
            padding: `0 ${VIDEO_CONFIG.LAYOUT.SUBTITLE_PADDING_H}px`,
          }}>
            <p
              style={{
                fontSize: 44,
                fontWeight: 'bold',
                color: '#FFFFFF',
                textAlign: 'center',
                lineHeight: 1.2,
                padding: `0 ${VIDEO_CONFIG.LAYOUT.SUBTITLE_PADDING_H}px`,
                maxWidth: '100%',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
              }}
            >
              {renderHighlightedText(item.segment)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const BookScene: React.FC<{ item: Scene }> = ({ item }) => {
  const effectType = getEffectForScene(item.id);
  const imageExists = hasImage(item.id);

  // 如果没有图片，终止程序
  if (!imageExists) {
    console.error(`❌ 错误：场景 ${item.id} 缺少对应的图片文件！`);
    console.error(`请确保 public/images/${item.id}.png 文件存在。`);
    process.exit(1);
  }

  switch (effectType) {
    case EffectType.COVER:
      return <CoverIntroScene item={item} />;
    case EffectType.FRAGMENTS:
      return <ImageScene item={item} />;
    case EffectType.FADE_IN:
    default:
      return <SimpleImageScene item={item} />;
  }
};
