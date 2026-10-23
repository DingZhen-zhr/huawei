import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  server: {
    port: 3000,
    host: true,
    // 知识库 /@fs/ 读取（工作台证据面板使用）
    fs: {
      allow: [
        path.resolve(__dirname, ".."),
        path.resolve(__dirname, "../../.."),
        "D:/KimiData/kimi/Workspaces/华为浙客松",
      ],
    },
    // 服务端代理：自由对话 / RAG 检索交给 Node 服务端
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
