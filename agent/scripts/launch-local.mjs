import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
if(Number(process.versions.node.split('.')[0])<20){console.error('需要 Node.js 20 或更新版本。当前版本：'+process.versions.node);process.exit(1);}
let port=Number(process.env.PORT)||3000;
try{const text=await readFile(resolve(root,'.env'),'utf8');const match=text.match(/^\s*PORT\s*=\s*(\d+)\s*$/m);if(match&&!process.env.PORT)port=Number(match[1]);}catch{}
const url=`http://127.0.0.1:${port}`;
async function available(){try{const response=await fetch(url+'/api/config',{signal:AbortSignal.timeout(800)});const data=await response.json();return response.ok&&data.ima?.kb_name==='任德耀新建华为PC知识库'&&data.demo_available===true;}catch{return false;}}
function browse(){
 console.log(`工作台已就绪：${url}`);
 if(process.platform==='win32'){
  const opener=spawn(process.env.ComSpec||'cmd.exe',['/d','/c','start','',url],{windowsHide:true,stdio:'ignore'});
  opener.on('error',()=>console.log('请手动在浏览器打开上方地址。'));
 }
}
if(await available()){browse();}
else{
 console.log('正在启动本地工作台。服务运行期间请保留本窗口；关闭窗口将停止本次启动的服务。');
 const child=spawn(process.execPath,[resolve(root,'scripts/init.mjs')],{cwd:root,stdio:'inherit',windowsHide:false});
 let exited=false;
 child.on('error',()=>{console.error('无法启动本地服务，请确认文件已完整解压。');process.exitCode=1;exited=true;});
 child.on('exit',code=>{exited=true;if(code){console.error('服务未启动。若端口被其他程序占用，可在 .env 中设置 PORT 后重试。');process.exitCode=1;}});
 let ready=false;
 for(let attempt=0;attempt<30&&!exited;attempt++){
  if(await available()){ready=true;browse();break;}
  await new Promise(r=>setTimeout(r,300));
 }
 if(!ready&&!exited){console.error('启动等待超时，请检查上方输出；可手动打开 '+url);}
 process.on('SIGINT',()=>{child.kill();});
}
