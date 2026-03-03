#!/usr/bin/env node
/**
 * 实时监控视频生成进度
 * 显示详细的生成状态和预计剩余时间
 */

import { existsSync, readFileSync, watchFile } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PROGRESS_FILE = join(ROOT, 'output', 'video_progress.txt');

// 进度状态管理
let lastProgress = '';
let startTime = Date.now();
let lastUpdateTime = Date.now();

// 颜色输出函数
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function colorize(text, color) {
  return `${color}${text}${colors.reset}`;
}

// 格式化时间
function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// 解析进度信息
function parseProgress(line) {
  const timestamp = line.match(/\[([^\]]+)\]/)?.[1] || '';
  const message = line.replace(/^\[[^\]]+\]\s*/, '');

  // 解析渲染进度
  const renderMatch = message.match(/Rendering video\.\.\. (\d+)\/(\d+) frames/);
  if (renderMatch) {
    const [, current, total] = renderMatch;
    const percentage = ((parseInt(current) / parseInt(total)) * 100).toFixed(1);
    return {
      type: 'render',
      current: parseInt(current),
      total: parseInt(total),
      percentage: parseFloat(percentage),
      message: `🎬 渲染视频: ${current}/${total} 帧 (${percentage}%)`
    };
  }

  // 解析音频生成进度
  const audioMatch = message.match(/Generating audio\.\.\. (\d+)\/(\d+)/);
  if (audioMatch) {
    const [, current, total] = audioMatch;
    const percentage = ((parseInt(current) / parseInt(total)) * 100).toFixed(1);
    return {
      type: 'audio',
      current: parseInt(current),
      total: parseInt(total),
      percentage: parseFloat(percentage),
      message: `🎵 生成音频: ${current}/${total} 个文件 (${percentage}%)`
    };
  }

  // 解析图片生成进度
  const imageMatch = message.match(/Generating images\.\.\. (\d+)\/(\d+)/);
  if (imageMatch) {
    const [, current, total] = imageMatch;
    const percentage = ((parseInt(current) / parseInt(total)) * 100).toFixed(1);
    return {
      type: 'image',
      current: parseInt(current),
      total: parseInt(total),
      percentage: parseFloat(percentage),
      message: `🖼️ 生成图片: ${current}/${total} 张图片 (${percentage}%)`
    };
  }

  // 其他进度信息
  return {
    type: 'info',
    message: message
  };
}

// 显示进度条
function showProgressBar(current, total, width = 40) {
  const percentage = current / total;
  const filled = Math.round(width * percentage);
  const empty = width - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const percent = (percentage * 100).toFixed(1);

  return `[${bar}] ${percent}%`;
}

// 显示状态
function displayStatus(progress) {
  console.clear();

  const elapsed = Date.now() - startTime;
  const elapsedStr = formatTime(elapsed);

  console.log(colorize('🎬 《被讨厌的勇气》视频生成监控', colors.cyan));
  console.log(colorize('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan));
  console.log(`⏱️  已运行时间: ${colorize(elapsedStr, colors.yellow)}`);
  console.log('');

  if (progress.type === 'render' && progress.total > 0) {
    const progressBar = showProgressBar(progress.current, progress.total);
    const remaining = progress.total - progress.current;
    const avgTimePerFrame = elapsed / progress.current;
    const eta = remaining * avgTimePerFrame;
    const etaStr = formatTime(eta);

    console.log(colorize('🎬 当前任务: 视频渲染', colors.green));
    console.log(`${progressBar}`);
    console.log(`📊 进度: ${progress.current}/${progress.total} 帧`);
    console.log(`⏳ 预计剩余: ${colorize(etaStr, colors.yellow)}`);
    console.log(`🚀 速度: ${colorize((progress.current / (elapsed / 1000)).toFixed(1), colors.blue)} 帧/秒`);
  } else if (progress.type === 'audio' || progress.type === 'image') {
    const progressBar = showProgressBar(progress.current, progress.total);
    console.log(colorize(`🎯 当前任务: ${progress.type === 'audio' ? '音频生成' : '图片生成'}`, colors.green));
    console.log(`${progressBar}`);
    console.log(`📊 进度: ${progress.current}/${progress.total} 个文件`);
  } else {
    console.log(colorize('🎯 当前任务:', colors.green), progress.message || '准备中...');
  }

  console.log('');
  console.log(colorize('📁 输出目录: output/被讨厌的勇气/', colors.magenta));
  console.log(colorize('🎞️ 最终视频: out/BookVideo.mp4', colors.magenta));

  // 显示最后更新时间
  const timeSinceUpdate = Date.now() - lastUpdateTime;
  if (timeSinceUpdate > 30000) { // 30秒没有更新
    console.log('');
    console.log(colorize('⚠️  警告: 进度更新已停止，可能需要检查进程状态', colors.red));
  }
}

// 监控进度文件
function startMonitoring() {
  console.clear();
  console.log(colorize('🎬 启动视频生成进度监控...', colors.cyan));
  console.log('按 Ctrl+C 退出监控\n');

  if (!existsSync(PROGRESS_FILE)) {
    console.log(colorize('📝 等待进度文件生成...', colors.yellow));
  }

  // 监控进度文件变化
  watchFile(PROGRESS_FILE, { interval: 1000 }, (curr, prev) => {
    if (curr.mtime > prev.mtime) {
      try {
        const content = readFileSync(PROGRESS_FILE, 'utf-8');
        const lines = content.trim().split('\n');
        const lastLine = lines[lines.length - 1];

        if (lastLine && lastLine !== lastProgress) {
          lastProgress = lastLine;
          lastUpdateTime = Date.now();

          const progress = parseProgress(lastLine);
          displayStatus(progress);
        }
      } catch (error) {
        // 文件可能正在写入，忽略错误
      }
    }
  });

  // 定期检查文件是否存在
  const checkInterval = setInterval(() => {
    if (!existsSync(PROGRESS_FILE)) {
      console.clear();
      console.log(colorize('📝 等待进度文件生成...', colors.yellow));
      console.log('进度文件位置:', PROGRESS_FILE);
    }
  }, 2000);

  // 处理退出信号
  process.on('SIGINT', () => {
    clearInterval(checkInterval);
    console.log('\n' + colorize('👋 监控已停止', colors.cyan));
    process.exit(0);
  });
}

// 主函数
function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('🎬 视频生成进度监控工具');
    console.log('');
    console.log('使用方法:');
    console.log('  node scripts/monitor-progress.mjs');
    console.log('');
    console.log('功能:');
    console.log('  • 实时显示视频生成进度');
    console.log('  • 显示预计剩余时间');
    console.log('  • 监控渲染速度');
    console.log('  • 检测进度更新状态');
    console.log('');
    console.log('按 Ctrl+C 退出监控');
    process.exit(0);
  }

  startMonitoring();
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { startMonitoring, parseProgress };