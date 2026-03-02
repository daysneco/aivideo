export interface Scene {
  id: string;
  title: string;
  theme: string;          // 核心主题
  narration: string;      // 旁白文本
  narrationEn?: string;
  durationInFrames: number;
  durationSeconds: number; // 原始秒数，用于调试和音频生成
  icon: string;           // Lucide icon name
  color: string;
  audioFile?: string;     // 音频文件路径
}

export interface BookScript {
  bookTitle: string;
  bookAuthor?: string;
  publisher?: string;   // 出版社，从 Douban/Open Library 拉取
  coverSubtitle?: string; // New: Dynamic subtitle for cover/thumbnail
  /** 字幕中要高亮的核心概念（按本书关键观点配置，如纳瓦尔：财富、杠杆、幸福） */
  highlightKeywords?: string[];
  outline?: string;       // 用户提供的大纲
  totalDuration: number;  // 总帧数
  themes: string[];       // 顶部导航主题（4+个）
  scenes: Scene[];
}
