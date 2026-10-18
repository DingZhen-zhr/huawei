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
    // 允许前端通过 /@fs/ 读取知识库 v7 的 markdown 文件（仅本工作区内）
    fs: {
      allow: [
        path.resolve(__dirname, ".."),
        path.resolve(__dirname, "../../.."),
        "D:/KimiData/kimi/Workspaces/华为浙客松",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
