#!/usr/bin/env node
import { existsSync, unlinkSync, statSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
const __dirname = dirname(fileURLToPath(import.meta.url));
const input = process.argv[2];
if (!input || !existsSync(input)) { console.error("Usage: node scripts/compress-video.mjs <video.mp4>"); process.exit(1); }
const temp = input.replace(/\.mp4$/, "_compressed.mp4");
console.log("Compressing to <50MB...");
execSync(`ffmpeg -y -i \"${input}\" -c:v libx264 -b:v 2200k -maxrate 2200k -bufsize 4400k -c:a aac -b:a 96k \"${temp}\"`, { stdio: "inherit" });
unlinkSync(input);
execSync(`mv \"${temp}\" \"${input}\"`);
console.log("Done:", input, (statSync(input).size/1024/1024).toFixed(1), "MB");
