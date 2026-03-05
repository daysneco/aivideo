/**
 * Global Configuration for Video Generation Style
 */

export const VIDEO_CONFIG = {
  TITLE_FONT_SIZE: 60,
  TITLE_COLOR: '#fbbf24',
  TITLE_GLOW: '0 4px 10px rgba(0, 0, 0, 0.5)',
  
  AUDIO_SPEED: '+35%', 
  AUDIO_PADDING_FRAMES: 15,
  
  THEME: {
    GRADIENT_TOP: 'linear-gradient(to bottom, #0f172a, #000000)',
    GRADIENT_BOTTOM: 'linear-gradient(to top, #0f172a, #000000)',
    NEON_BORDER: '2px solid #fbbf24',
    NEON_GLOW: '0 0 20px rgba(251, 191, 36, 0.4)',
    NEON_GLOW_REVERSE: '0 0 20px rgba(251, 191, 36, 0.4)',
    SUBTITLE_TEXT_SHADOW: '0 0 10px rgba(0,0,0,1)',
  },
  
  LAYOUT: {
    IMAGE_MARGIN_TOP: 0,
    SUBTITLE_PADDING_TOP: 40,
    SUBTITLE_PADDING_H: 60, // 字幕距左右边缘
    MAX_CHARS_PER_LINE: 15,
    SUBTITLE_CN_SIZE: 64,
    SUBTITLE_EN_SIZE: 32,
  }
};
