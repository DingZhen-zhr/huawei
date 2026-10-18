import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { inspectAttr } from 'kimi-plugin-inspect-react';
import { workflowApi } from './server/plugin';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: './',
    plugins: [inspectAttr(), react(), workflowApi({
      imaUrl: env.IMA_GATEWAY_URL, imaKey: env.IMA_API_KEY,
      modelUrl: env.MODEL_API_BASE_URL, modelKey: env.MODEL_API_KEY, model: env.MODEL_NAME,
    })],
    server: { port: 3000, host: '127.0.0.1', fs: { allow: [path.resolve(__dirname)] } },
    preview: { host: '127.0.0.1' },
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  };
});
