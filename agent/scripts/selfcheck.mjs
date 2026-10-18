import {runTask} from '../harness/pipeline.mjs';
import {envConfig} from '../server/index.mjs';
const config=envConfig();
const input={product:'HUAWEI MateBook Pro S',audience:'大学新生',scene:'开学季',platform:'小红书',description:'每天背电脑赶早八',mode:process.argv.includes('--live')?'live':'demo'};
const result=await runTask(input,config,{emit:e=>console.log(`${e.stage}: ${e.status} ${e.message}`)});
console.log(JSON.stringify({status:result.status,mode:result.mode,source:result.source,evidence:result.evidence.length,pending:result.verification.pending,warnings:result.warnings},null,2));
if(result.status==='needs_configuration')process.exitCode=2;
