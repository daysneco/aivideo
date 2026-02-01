/** @type {import('remotion').Config} */
import { Config } from '@remotion/cli/config';

// Allow extra time for font loading (LXGWWenKai) during render
Config.setDelayRenderTimeoutInMilliseconds(90000);

// Config.setVideoImageFormat('jpeg');
// Config.setOutputFormat('mp4');
