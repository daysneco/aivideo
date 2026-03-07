#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { generateContent } from './llm-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Default configuration
const FPS = 30;

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node generate-book-script.mjs <bookName> [outlineFile]');
    process.exit(1);
  }

  const bookName = args[0];
  const outlineFile = args[1];
  
  let outlineContent = '';
  if (outlineFile) {
    let outlinePath = outlineFile.startsWith('/') ? outlineFile : join(process.cwd(), outlineFile);
    if (!existsSync(outlinePath)) {
      const base = outlineFile.replace(/^.*[/\\]/, '');
      const tryTemp = join(process.cwd(), 'temp', base);
      if (existsSync(tryTemp)) outlinePath = tryTemp;
      else if (base === 'naval.txt' && existsSync(join(process.cwd(), 'temp', 'noval.txt'))) outlinePath = join(process.cwd(), 'temp', 'noval.txt');
    }
    if (existsSync(outlinePath)) {
      outlineContent = readFileSync(outlinePath, 'utf-8');
      console.log(`Loaded outline from ${outlinePath}`);
    } else {
      console.warn(`Outline file not found: ${outlineFile}, generating without it.`);
    }
  }

  console.log(`Generating narrative-style script for book: "${bookName}"...`);

  const prompt = `
你是一位顶级短视频流量专家。请为《${bookName}》写一个**贯穿始终、逻辑严密**的短视频脚本。

【核心痛点：拒绝割裂】
目前生成的视频内容太散，像是在罗列概念。我要的是一个**有灵魂、有连贯逻辑**的解说。
想象你正在面对面跟一个焦虑的年轻人说话，你要用一个核心论点（Thesis）把整本书串起来。

【硬性要求】
1. **统一叙事线**：整条剧本必须是一段**完整的、不可分割的论证**。每一场必须是上一场的「下一句」：要么是推论（于是/所以），要么是转折（但/其实），要么是深化（更扎心的是）。
2. **禁止清单**：禁止出现“第一点、第二点”这种列表式表达。禁止在两句之间无衔接地跳到新话题。
3. **时长**：60～80秒。约 20～26 个场景。
4. **口语化**：每句 ≤15 字。像机关枪一样密集但逻辑清晰。
5. **黄金开头**：第 1 句必须是反问或认知反差，引入一个钩子引起人们的注意。第 2 个场景必须是介绍今天讲的书（“今天要介绍的书是《${bookName}》...”），并且**必须承接第 1 句的痛点**，用因果关系把 hook 和书名连起来（例如"…今天要介绍的书…它会告诉你这背后的真正原因"）。绝对不能出现孤立的、没有逻辑衔接的短句。

---

## 一、脚本结构流 (Narrative Flow)

1. **破题与引入 (The Hook & Intro)**：
   - 第 1 个场景 (id 必须为: hook-1)：戳破现状，引入钩子，建立危机感。
   - 第 2 个场景 (id 必须为: intro-book)：必须承接 hook 的情绪，自然引出书名（"今天要介绍的书是《${bookName}》..."），并用一句话说明这本书如何回应第 1 句的痛点。hook → intro-book 必须形成因果关系，不能断裂。
2. **因果链路 (The Chain)**：
   - 为什么我们会这样？（分析根源）
   - 这本书给出的“唯一出路”是什么？（引入核心论点）
   - 沿着这个出路走下去，你会遇到什么？（深度拆解）
3. **觉醒时刻 (The Aha!)**：用一个极具反差的结论，让观众觉得“原来如此”。
4. **行动/升华 (The Payoff)**：给出一个具体的起步动作 + 书中金句。id: quote-1, cta-1

---

## 二、输出格式（仅输出一个合法 JSON）

- **themes**：5 个逻辑阶段。例如 ["现状破防", "寻找根源", "逻辑重构", "觉醒时刻", "最后一步"]
- **highlightKeywords**：8～15 个字幕高亮词。
- **scenes**：共 20～26 个。每项含 id, title, theme, narration, narrationEn, durationSeconds:3.2, icon, color。

narration 必须体现逻辑衔接词（于是、因为、这意味着、更可怕的是...）。
`;

  try {
    let data = await generateContent(prompt);
    
    // Robustness: Handle nested data or missing scenes
    if (!data.scenes && data.data && data.data.scenes) data = data.data;
    if (!data.scenes) {
      console.error('LLM Response missing scenes:', JSON.stringify(data, null, 2));
      throw new Error('LLM failed to generate scenes in the required JSON format');
    }

    const bookTitle = data.bookTitle || bookName;
    const bookAuthor = data.bookAuthor || '';

    const iconMap = { question: 'HelpCircle', book: 'BookOpen', eye: 'Eye', code: 'Code', scissors: 'Scissors', partition: 'Columns', export: 'LogOut', bulb: 'Lightbulb', rise: 'TrendingUp', like: 'ThumbsUp', home: 'Home', branches: 'GitBranch' };

    const processedScenes = data.scenes.map(scene => {
      let icon = (scene.icon || 'BookOpen').replace(/<|>/g, '').trim();
      icon = iconMap[icon.toLowerCase()] || (icon.charAt(0).toUpperCase() + icon.slice(1));
      return {
        ...scene,
        durationInFrames: Math.round((scene.durationSeconds || 3) * FPS),
        icon
      };
    });

    const totalDuration = processedScenes.reduce((acc, s) => acc + s.durationInFrames, 0);

    const highlightKeywords = Array.isArray(data.highlightKeywords) ? data.highlightKeywords : [];
    if (!highlightKeywords.includes(bookTitle)) {
      highlightKeywords.unshift(bookTitle);
    }

    const finalData = {
      bookTitle,
      bookAuthor,
      coverSubtitle: (data.coverSubtitle && !data.coverSubtitle.includes('undefined')) ? data.coverSubtitle : `关于《${bookTitle}》的深度解读`,
      highlightKeywords: highlightKeywords.length > 0 ? highlightKeywords : undefined,
      outline: outlineContent || undefined,
      totalDuration,
      themes: data.themes,
      scenes: processedScenes
    };

    const outputPath = join(root, 'src/data/bookScript.ts');
    const fileContent = `import { BookScript } from '../types/book';

export const bookScript: BookScript = ${JSON.stringify(finalData, null, 2)};
`;

    writeFileSync(outputPath, fileContent, 'utf-8');
    const manifestPath = join(root, 'src/data/imageManifest.ts');
    writeFileSync(manifestPath, "export const sceneIdsWithImages: string[] = [];\nexport const coverFileName: string = 'book_cover.png';\n", 'utf-8');
    console.log(`Success! Script written to ${outputPath}`);
    console.log(`Total Scenes: ${finalData.scenes.length}`);
    console.log(`Total Duration: ${(totalDuration / FPS / 60).toFixed(1)} minutes`);
    console.log(`Themes: ${finalData.themes.join(', ')}`);

  } catch (error) {
    console.error('Error generating script:', error);
    process.exit(1);
  }
}

main();
