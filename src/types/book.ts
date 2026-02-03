export interface Scene {
  id: string;
  title: string;
  theme: string;          // 核心主题
  narration: string;      // 旁白文本
  durationInFrames: number;
  durationSeconds: number; // 原始秒数，用于调试和音频生成
  icon: string;           // Lucide icon name
  color: string;
  audioFile?: string;     // 音频文件路径
}

export interface BookScript {
  bookTitle: string;
  bookAuthor?: string;
  outline?: string;       // 用户提供的大纲
  totalDuration: number;  // 总帧数
  themes: string[];       // 顶部导航主题（4+个）
  scenes: Scene[];
}
