import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
try{for(const line of (await readFile(resolve(root,'.env'),'utf8')).split(/\r?\n/)){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');}}catch{}
const {createServer,envConfig}=await import('../server/index.mjs');
const cfg=envConfig();console.log(`模型：${cfg.llm_api_key?'已提供配置（尚未验证）':'待配置'}；ima：${cfg.ima_client_id&&cfg.ima_api_key?'已提供配置（尚未验证）':'待配置'}；演示模式需要用户主动选择。`);
const port=Number(process.env.PORT)||3000;
createServer(cfg,{root}).listen(port,'127.0.0.1',()=>console.log(`打开 http://127.0.0.1:${port}`));
