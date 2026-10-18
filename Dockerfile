FROM node:22-bookworm-slim AS build
WORKDIR /workspace/app
COPY app/package*.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /workspace
COPY --from=build /workspace/app/dist ./app/dist
COPY app/server.mjs ./app/server.mjs
COPY 系统提示词骨架.md ./系统提示词骨架.md
ENV NODE_ENV=production PORT=7860
USER node
EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:7860/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "app/server.mjs"]
