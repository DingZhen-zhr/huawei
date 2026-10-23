// Netlify Function：复用 Express 应用
import serverless from "serverless-http";
import app from "../../server/index.mjs";

export const handler = serverless(app);
