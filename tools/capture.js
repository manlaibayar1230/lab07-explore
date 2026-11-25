// Bug report бүрийн алхмыг ШИНЭЭР АСААСАН апп дээр дахин гаргаж скриншот авна.
// Edge-ийг headless горимоор Chrome DevTools Protocol (CDP)-оор удирдана; Node 22+ (global WebSocket, fetch).
// Ажиллуулах (порт 3000 сул байх ёстой):  node tools/capture.js
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EDGE = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startApp() {
  const p = spawn(process.execPath, ['app.js'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { await fetch('http://localhost:3000/api/books'); return p; } catch { await sleep(100); }
  }
  throw new Error('app эхэлсэнгүй');
}
async function stopApp(p) {
  p.kill();
  for (let i = 0; i < 50; i++) {
    try { await fetch('http://localhost:3000/api/books'); await sleep(100); } catch { return; }
  }
}

class Page {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = [];
    ws.onmessage = (m) => { const d = JSON.parse(m.data);
      if (d.id && this.pending.has(d.id)) { this.pending.get(d.id)(d); this.pending.delete(d.id); return; }
      // confirm()/alert() цонх гарвал хэрэглэгч "OK" дарсантай адил зөвшөөрч, мессежийг нь хэвлэнэ
      if (d.method === 'Page.javascriptDialogOpening') {
        console.log(`  [dialog ${d.params.type}] "${d.params.message}" -> OK`);
        this.ws.send(JSON.stringify({ id: ++this.id, method: 'Page.handleJavaScriptDialog', params: { accept: true } }));
      }
      this.events.push(d); };
  }
  send(method, params = {}) { const id = ++this.id;
    return new Promise((res, rej) => { this.pending.set(id, (d) => d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result));
      this.ws.send(JSON.stringify({ id, method, params })); }); }
  async eval(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
  async goto(url) { await this.send('Page.navigate', { url }); await sleep(800); }
  async shot(file) { const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ROOT, 'screenshots', file), Buffer.from(data, 'base64')); console.log('  ->', 'screenshots/' + file); }
}

// UI-ийн үйлдлүүд (хэрэглэгч бичиж, товч дарахтай адил)
const ui = {
  fill: (t, a, y) => `(() => { const i = document.querySelectorAll('input');
    const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', {bubbles:true})); };
    set(i[0], ${JSON.stringify(t)}); set(i[1], ${JSON.stringify(a)}); set(i[2], ${JSON.stringify(y)}); })()`,
  click: (text) => `(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}); b.click(); })()`,
  clickNth: (text, n) => `(() => { const b = [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === ${JSON.stringify(text)}); b[${n}].click(); })()`,
  search: (q) => `(() => { const i = document.querySelectorAll('input')[3]; i.value = ${JSON.stringify(q)}; })()`,
  outline: (sel) => `(() => { document.querySelectorAll(${JSON.stringify(sel)}).forEach(e => e.style.outline = '3px solid #e53935'); })()`,
};

// Сценари бүр = нэг bug report-ийн "Дахин гаргах алхам"
const scenarios = {
  'bug-01.png': async (p) => { await p.goto('http://localhost:3000/'); await p.eval(ui.outline('td:nth-child(3)')); },
  'bug-02.png': async (p) => { await p.goto('http://localhost:3000/'); await p.eval(ui.outline('button.del')); },
  'bug-03.png': async (p) => { await p.goto('http://localhost:3000/'); await p.eval(ui.outline('table')); await p.eval(`(() => { const e=[...document.querySelectorAll('body *')].find(e=>e.children.length===0 && /Нийт ном/.test(e.textContent)); e.style.outline='3px solid #e53935'; })()`); },
  'bug-04.png': async (p) => { await p.goto('http://localhost:3000/'); await p.eval(ui.outline('button:first-of-type')); },
  'bug-05.png': async (p) => { await p.goto('http://localhost:3000/'); await p.eval(`document.querySelector('a[href="/old"]').click()`); await sleep(800); },
  'bug-06.png': async (p) => { await p.goto('http://localhost:3000/'); await p.eval(ui.click('Нэмэx')); await sleep(600); },
  'bug-07.png': async (p) => { await p.goto('http://localhost:3000/');
    for (const [t, a, y] of [['Он 999', 'Тест', '999'], ['Он abc', 'Тест', 'abc'], ['Он 2101', 'Тест', '2101']]) { await p.eval(ui.fill(t, a, y)); await p.eval(ui.click('Нэмэx')); await sleep(600); } },
  'bug-08.png': async (p) => { await p.goto('http://localhost:3000/'); await p.eval(ui.fill('Clean Code', 'Robert C. Martin', '2008')); await p.eval(ui.click('Нэмэx')); await sleep(600); },
  'bug-09.png': async (p) => { await p.goto('http://localhost:3000/'); await p.eval(ui.search('clean')); await p.eval(ui.click('Хайх')); await sleep(600); },
  'bug-10.png': async (p) => { await p.goto('http://localhost:3000/'); await p.eval(ui.clickNth('Устгах', 2)); await sleep(600); },
  'bug-11.png': async (p) => { await p.goto('http://localhost:3000/'); await p.eval(ui.fill('A'.repeat(200), 'Тест Зохиолч', '2000')); await p.eval(ui.click('Нэмэx')); await sleep(600); },
};

(async () => {
  const only = process.argv.slice(2);
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-cdp-'));
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch { await sleep(200); }
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  const page = new Page(ws);
  await page.send('Page.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 640, deviceScaleFactor: 1, mobile: false });
  for (const [file, run] of Object.entries(scenarios)) {
    if (only.length && !only.includes(file)) continue;
    const app = await startApp(); // шинээр асаасан апп (анхны 3 ном)
    try { await run(page); await page.shot(file); } finally { await stopApp(app); }
  }
  ws.close(); edge.kill();
})().catch((e) => { console.error(e); process.exit(1); });
