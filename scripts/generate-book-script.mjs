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

  console.log(`Generating script for book: "${bookName}"...`);

  const prompt = `
你是一位资深短视频书评编剧。请为《${bookName}》写一条**像一个人连续在说话**的解说剧本：整条剧本读下来必须是一段完整的论证，不能像几十条独立金句拼在一起。

【重要】下方「参考大纲」是论证的**唯一顺序**。你必须严格按大纲的章节与逻辑顺序展开，每一场都是上一场的「下一句」：要么是上句的推论（所以/于是），要么是举例（比如说/比如），要么是递进（再进一步/更重要的是），要么是转折过渡（那/而/说到这儿/接下来）。**禁止**在两句之间无衔接地跳到新话题。

${outlineContent ? `【参考大纲——必须按此顺序与逻辑展开】\n${outlineContent}\n` : ''}

---

## 一、结构（严格按大纲对应）

1. **钩子 + 点题**：第 1 句**必须是反问句**引入（例如：为什么越努力越穷？为什么大多数人读了很多书却没用？为什么聪明人反而更焦虑？），第 2 句必须出现「今天要介绍的书是《${bookName}》」或「今天要聊的就是这本《${bookName}》」。id: hook-1, intro-1
2. **书籍引入**：用 2～3 句说明这本书讲什么、为什么值得看，并自然接到大纲第一节。id: intro-2, intro-3
3. **三个核心观点**：完全按大纲的 1→2→3→4→5 节顺序展开，节内与节间用衔接词串联。id: point1-*, point2-*, point3-*
4. **情绪总结**：2～3 句收束，与前面观点呼应。id: summary-1, summary-2
5. **结尾**：**必须用书中一两句金句收尾**。从参考大纲或该书经典表述中选取/改写 1～2 句可作为「金句」的短句（每句 ≤20 字），放在最后 1～2 个场景，让观众以书中原味收尾。例如纳瓦尔宝典可选用「改变它、接受它，或离开它」「你只是宇宙中的一道微光」「第二次生命便已开启」等意境的句子。金句后可再加一句极短的互动（如「下本书见」）。id: quote-1, quote-2, cta-1

---

## 二、连贯性与时长

- **每两句之间**：narration 里带衔接词或内容上为推论/举例/对比，整条像连续口播。
- **每句 ≤20 字**，口语化，适合字幕。
- **总时长必须在 150～180 秒之间**：即约 **50～58 个场景**（按每场景 3 秒计），内容要铺满，不能过短。

---

## 三、输出格式（仅输出一个合法 JSON，不要 markdown 代码块）

- **themes**：5 个。["钩子与引入", "核心观点一", "核心观点二", "核心观点三", "总结与行动"]
- **highlightKeywords**：该书解说中需要**在字幕里高亮**的核心概念词，8～15 个。例如《纳瓦尔宝典》可填：["财富", "杠杆", "幸福", "判断力", "专长", "责任感", "地位", "金钱", "第一性原理", "复利"]；《自卑与超越》可填：["自卑", "超越", "合作", "勇气", "童年", "意义"]。只填会在 narration 里出现的核心词，用于字幕高亮。
- **scenes**：共 **50～58 个**，每项含 id, title, theme, narration（≤20字）, narrationEn, durationSeconds:3, icon, color。hook-1 必须是**反问句**；intro-1 为点题「今天要聊的就是这本《${bookName}》」；结尾用 quote-1、quote-2 放**书中金句**（从大纲中选/改），cta-1 可极短互动。只输出一个合法 JSON，不要 markdown 包裹。
`;

  try {
    const data = await generateContent(prompt);
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

    const finalData = {
      bookTitle,
      bookAuthor,
      coverSubtitle: (data.coverSubtitle && !data.coverSubtitle.includes('undefined')) ? data.coverSubtitle : `关于《${bookTitle}》的深度解读`,
      highlightKeywords: Array.isArray(data.highlightKeywords) && data.highlightKeywords.length > 0 ? data.highlightKeywords : undefined,
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
    writeFileSync(manifestPath, "export const sceneIdsWithImages: string[] = [];\n", 'utf-8');
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
