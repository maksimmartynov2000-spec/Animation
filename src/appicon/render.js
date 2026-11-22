// иконка: SVG → PNG нужных размеров + превью с маской iOS
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const svg = fs.readFileSync(__dirname + '/icon.svg', 'utf8');
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 1 });
  for (const n of [180, 512, 1024]) {
    await p.setViewportSize({ width: n, height: n });
    await p.setContent(`<html><body style="margin:0;background:#000">${svg.replace('width="180" height="180"', `width="${n}" height="${n}"`)}</body></html>`);
    await p.waitForTimeout(150);
    await p.screenshot({ path: `${__dirname}/icon-${n}.png`, clip: { x: 0, y: 0, width: n, height: n }, omitBackground: false });
  }
  // превью: как на экране «Домой» (маска со скруглением ~22%) на двух обоях
  const data = fs.readFileSync(`${__dirname}/icon-180.png`).toString('base64');
  const tile = (bg) => `<div style="background:${bg};padding:28px;display:flex;gap:26px;align-items:flex-start">${[0, 1, 2].map(k => `<div style="width:76px;text-align:center;font:12px -apple-system,system-ui;color:#fff">${k === 1 ? `<img src="data:image/png;base64,${data}" style="width:76px;height:76px;border-radius:17px;display:block">` : `<div style="width:76px;height:76px;border-radius:17px;background:rgba(255,255,255,.18)"></div>`}<div style="margin-top:6px">${k === 1 ? 'Претенденты' : '&nbsp;'}</div></div>`).join('')}</div>`;
  await p.setViewportSize({ width: 340, height: 300 });
  await p.setContent(`<html><body style="margin:0">${tile('linear-gradient(135deg,#3b6ea8,#9b5aa6)')}${tile('linear-gradient(135deg,#e9e2d6,#c8bfae)')}</body></html>`);
  await p.waitForTimeout(150);
  await p.screenshot({ path: `${__dirname}/preview.png`, fullPage: true });
  await b.close();
  console.log('ok', fs.statSync(`${__dirname}/icon-180.png`).size, 'bytes (180)');
})();
