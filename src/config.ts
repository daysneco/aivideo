/**
 * Global Configuration for Video Generation Style
 */

export const VIDEO_CONFIG = {
  TITLE_FONT_SIZE: 60,
  TITLE_COLOR: '#fbbf24',
  TITLE_GLOW: '0 4px 10px rgba(0, 0, 0, 0.5)',
  
  AUDIO_SPEED: '+50%', 
  AUDIO_PADDING_FRAMES: 45,
  
  THEME: {
    GRADIENT_TOP: 'linear-gradient(to bottom, #1a1a1a, #111111)',
    GRADIENT_BOTTOM: 'linear-gradient(to top, #1a1a1a, #111111)',
    NEON_BORDER: '1px solid rgba(226, 207, 182, 0.15)',
    NEON_GLOW: '0 4px 15px rgba(0, 0, 0, 0.3)',
    NEON_GLOW_REVERSE: '0 -4px 15px rgba(0, 0, 0, 0.3)',
    SUBTITLE_TEXT_SHADOW: '2px 2px 8px rgba(0,0,0,0.8)',
  },
  
  LAYOUT: {
    IMAGE_MARGIN_TOP: -20,
    SUBTITLE_PADDING_TOP: 20,
    SUBTITLE_PADDING_H: 48, // 字幕距左右边缘
    MAX_CHARS_PER_LINE: 28,
    SUBTITLE_CN_SIZE: 52,
    SUBTITLE_EN_SIZE: 38,
  }
};
