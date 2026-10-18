const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

async function fixture(t, env = {}, upstream) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'zxt-deploy-'));
  const root = path.join(temp, 'app');
  const kb = path.join(temp, 'kb');
  await fs.mkdir(path.join(root, 'dist', 'assets'), { recursive: true });
  await fs.mkdir(kb);
  await fs.writeFile(path.join(root, 'dist', 'index.html'), '<html>workbench</html>');
  await fs.writeFile(path.join(root, 'dist', 'assets', 'main.js'), 'console.log("workbench")');
  await fs.writeFile(path.join(temp, '系统提示词骨架.md'), '# 系统提示词\n角色与任务');
  await fs.writeFile(path.join(kb, 'fact.md'), 'public-test-fact');
  await fs.writeFile(path.join(temp, 'outside.md'), 'OUTSIDE_SENTINEL');
  const { createServer } = await import('../server.mjs');
  const server = createServer({ root, env, upstream });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await fs.rm(temp, { recursive: true, force: true });
  });
  return { base: `http://127.0.0.1:${server.address().port}`, temp, root, kb, env };
}

test('production serves health, actual static assets, HEAD and repo prompt without secrets', async t => {
  const { base } = await fixture(t, { DEEPSEEK_API_KEY: 'SERVER_SECRET_SENTINEL' });
  assert.deepEqual(await (await fetch(base + '/healthz')).json(), { status: 'ok' });
  const runtime = await (await fetch(base + '/api/runtime')).text();
  assert.equal(JSON.parse(runtime).modelConfigured, true);
  assert.doesNotMatch(runtime, /SERVER_SECRET_SENTINEL/);
  const home = await fetch(base + '/');
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type'), /text\/html/);
  const js = await fetch(base + '/assets/main.js');
  assert.match(js.headers.get('content-type'), /javascript/);
  assert.match(await js.text(), /console.log/);
  assert.equal(await (await fetch(base + '/assets/main.js', { method: 'HEAD' })).text(), '');
  for (const route of ['/api/prompt', '/@fs/system-prompt']) {
    const prompt = await fetch(base + route);
    assert.equal(prompt.status, 200);
    assert.match(await prompt.text(), /角色与任务/);
    assert.equal((await fetch(base + route, { method: 'POST' })).status, 405);
  }
  for (const route of ['/api/unknown', '/@fs/C:/Windows/win.ini']) {
    const result = await fetch(base + route);
    assert.equal(result.status, 404);
    assert.match(result.headers.get('content-type'), /application\/json/);
  }
  assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
});

test('knowledge is opt-in and confines reads including encoded traversal and symlink escape', async t => {
  const env = {};
  const f = await fixture(t, env);
  assert.equal((await fetch(f.base + '/api/knowledge?path=fact.md')).status, 404);
  env.KB_ROOT = f.kb;
  assert.equal(await (await fetch(f.base + '/api/knowledge?path=fact.md')).text(), 'public-test-fact');
  for (const value of ['../outside.md', path.join(f.temp, 'outside.md'), '..\\outside.md', 'fact.txt']) {
    const response = await fetch(f.base + '/api/knowledge?path=' + encodeURIComponent(value));
    assert.equal(response.status, 403, value);
    assert.doesNotMatch(await response.text(), /OUTSIDE_SENTINEL/);
  }
  await fs.symlink(f.temp, path.join(f.kb, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  const escaped = await fetch(f.base + '/api/knowledge?path=escape%2Foutside.md');
  assert.equal(escaped.status, 403);
  assert.doesNotMatch(await escaped.text(), /OUTSIDE_SENTINEL/);
  assert.equal((await fetch(f.base + '/api/knowledge?path=fact.md', { method: 'POST' })).status, 405);
});

test('proxy uses fixed upstream, secret precedence and sanitizes response/errors', async t => {
  const calls = [];
  const f = await fixture(t, { DEEPSEEK_API_KEY: 'SERVER_SECRET_SENTINEL' }, async (url, options) => {
    calls.push({ url, options });
    return Response.json({ choices: [{ message: { content: 'generated' } }], debug: 'SERVER_SECRET_SENTINEL' });
  });
  const route = f.base + '/api/deepseek/chat/completions';
  const response = await fetch(route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Model-Key': 'BROWSER_SENTINEL' }, body: JSON.stringify({ model: 'attacker-model', messages: [{ role: 'user', content: 'test' }], max_tokens: 999999, stream: true }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { choices: [{ message: { content: 'generated' } }] });
  assert.equal(calls[0].url, 'https://api.deepseek.com/chat/completions');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer SERVER_SECRET_SENTINEL');
  const sent = JSON.parse(calls[0].options.body);
  assert.equal(sent.model, 'deepseek-chat');
  assert.equal(sent.max_tokens, 4000);
  assert.equal(sent.stream, false);
  assert.equal((await fetch(route)).status, 405);
  assert.equal((await fetch(route, { method: 'POST', headers: { Origin: 'https://attacker.example' }, body: '{}' })).status, 403);
  assert.equal((await fetch(route, { method: 'POST', body: '{broken' })).status, 400);
  assert.equal((await fetch(route, { method: 'POST', body: JSON.stringify({ messages: [] }) + ' '.repeat(65536) })).status, 413);
});

test('proxy gates unconfigured model and accepts browser key without authorization header', async t => {
  let authorization;
  const f = await fixture(t, {}, async (_url, options) => {
    authorization = options.headers.Authorization;
    return Response.json({ choices: [{ message: { content: 'ok' } }] });
  });
  const route = f.base + '/api/deepseek/chat/completions';
  const body = JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] });
  assert.equal((await fetch(route, { method: 'POST', body })).status, 503);
  assert.equal((await fetch(route, { method: 'POST', headers: { 'X-Model-Key': 'TEST_BROWSER_KEY' }, body })).status, 200);
  assert.equal(authorization, 'Bearer TEST_BROWSER_KEY');
});

test('proxy masks upstream failures and malformed successful responses', async t => {
  for (const mode of ['http', 'throw', 'json', 'empty']) {
    const f = await fixture(t, { DEEPSEEK_API_KEY: 'SERVER_SECRET_SENTINEL' }, async () => {
      if (mode === 'http') return new Response('SERVER_SECRET_SENTINEL', { status: 401 });
      if (mode === 'throw') throw Error('SERVER_SECRET_SENTINEL');
      if (mode === 'json') return new Response('SERVER_SECRET_SENTINEL');
      return Response.json({ choices: [] });
    });
    const response = await fetch(f.base + '/api/deepseek/chat/completions', { method: 'POST', body: JSON.stringify({ messages: [] }) });
    assert.ok(response.status >= 400, mode);
    assert.doesNotMatch(await response.text(), /SERVER_SECRET_SENTINEL/);
  }
});
