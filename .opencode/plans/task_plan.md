# 讲书视频生成系统 - 项目计划

## 目标
创建一个完整的讲书视频生成系统，用户输入书籍名称，自动生成：
1. 讲书内容脚本和分镜
2. 每个场景的旁白文本
3. 顶部导航主题（至少4个）
4. 使用Edge TTS生成音频

## 数据结构

### 新增数据结构

```typescript
// src/data/bookScript.ts
export interface Scene {
  id: string;
  title: string;
  theme: string;          // 核心主题
  narration: string;      // 旁白文本
  durationInFrames: number;
  icon: string;           // Lucide icon name
  color: string;
  audioFile?: string;     // 音频文件路径
}

export interface BookScript {
  bookTitle: string;
  bookAuthor?: string;
  totalDuration: number;  // 总帧数
  themes: string[];       // 顶部导航主题（4+个）
  scenes: Scene[];
}
```

### 文件结构
```
src/
  data/
    bookScript.ts         # 生成的脚本数据
    bookConfig.ts         # 书籍配置（名称、作者等）
  components/
    BookComposition.tsx   # 新的Composition组件
    BookScene.tsx         # 支持旁白的Scene组件
    Subtitle.tsx          # 字幕显示组件
scripts/
  generate-book.mjs       # 主生成脚本
  llm-client.mjs          # LLM客户端封装
  generate-audio.mjs      # 使用Edge TTS生成音频
```

## 执行阶段

### Phase 1: 重构数据结构
**状态**: pending

1. 创建 `src/data/bookScript.ts` - 新脚本数据结构
2. 创建 `src/types/book.ts` - 类型定义文件

**预计耗时**: 10分钟

### Phase 2: 创建生成脚本
**状态**: pending

1. 创建 `scripts/llm-client.mjs` - LLM客户端封装（支持OpenAI/Anthropic）
2. 创建 `scripts/generate-book.mjs` - 主脚本，生成完整脚本
3. 创建 `scripts/generate-audio.mjs` - Edge TTS音频生成

**预计耗时**: 30分钟

### Phase 3: 更新组件
**状态**: pending

1. 创建 `src/components/BookScene.tsx` - 支持旁白和音频的场景组件
2. 创建 `src/components/Subtitle.tsx` - 字幕显示组件
3. 创建 `src/BookComposition.tsx` - 整合BookScene和Subtitle
4. 更新 `src/Root.tsx` - 使用新的Composition

**预计耗时**: 25分钟

### Phase 4: 集成测试
**状态**: pending

1. 添加npm scripts到package.json
2. 测试端到端流程
3. 验证音频同步

**预计耗时**: 15分钟

## LLM Prompt设计

### 生成脚本 Prompt
```
系统角色：专业讲书视频编剧

根据书籍《{bookName}》生成讲书视频脚本，要求：
1. 至少4个核心主题（用于顶部导航）
2. 每个主题对应1-2个场景，总场景数6-8个
3. 每个场景包含：
   - id: 唯一标识（如"intro", "chapter-1"等）
   - title: 标题（简洁有力，2-6字）
   - theme: 核心主题（一句话总结）
   - narration: 旁白文本（口语化，150-300字，讲书风格）
   - durationSeconds: 建议时长（秒数，8-15秒）
   - icon: 图标名称（从Lucide图标库选择，如Book, Lightbulb, Target等）
   - color: 配色方案（hex色值，符合书籍主题）

4. 输出严格JSON格式：
{
  "bookTitle": "书籍名称",
  "themes": ["主题1", "主题2", "主题3", "主题4"],
  "scenes": [
    {
      "id": "intro",
      "title": "开场",
      "theme": "介绍书籍核心价值",
      "narration": "旁白文本...",
      "durationSeconds": 10,
      "icon": "BookOpen",
      "color": "#3b82f6"
    }
  ]
}

5. 旁白要求：
   - 第一人称讲述，口语化、有感染力
   - 避免书面语和长难句
   - 开场白吸引注意力，结束语有行动号召
   - 每个场景的旁白要流畅连贯
```

## Edge TTS集成

使用 edge-tts Python包（通过child_process调用）：
- 语音：zh-CN-XiaoxiaoNeural（女声）
- 输出：public/audio/{scene-id}.mp3

## 新增依赖

需要安装 edge-tts：
```bash
pip install edge-tts
```

npm依赖无需新增，使用child_process调用。

## 命令设计

```bash
# 生成完整讲书内容（脚本 + 音频）
npm run generate-book -- 小狗钱钱

# 仅生成脚本
npm run generate-book:script -- 小狗钱钱

# 仅生成音频（基于已有脚本）
npm run generate-book:audio
```

## 技术要点

1. **音频同步**：Remotion `<Audio>` 组件 + `staticFile()`
2. **字幕显示**：根据durationInFrames计算显示时机
3. **动画保持**：使用现有spring/interpolate动画
4. **错误处理**：LLM JSON验证、音频生成检查

## 完成标准

- [ ] 输入书籍名称可生成完整脚本
- [ ] 顶部导航显示至少4个主题
- [ ] 每个场景有旁白文本和对应音频文件
- [ ] 视频播放时音频与字幕同步
- [ ] 可通过npm命令一键生成
