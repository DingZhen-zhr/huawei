import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'
// @ts-expect-error shared Node runtime is plain JavaScript
import { createHandler } from './server.mjs'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react(), {name:'workbench-runtime', configureServer(server) {server.middlewares.use(createHandler({env:{...loadEnv(server.config.mode, process.cwd(), ""), ...process.env}}));}}],
  server: {
    port: 3000,
    host: true,

  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
