#!/usr/bin/env node
/**
 * Auditoria de celular de verdade: emula um iPhone via CDP (o Chrome no Linux
 * trava a janela em 500px, então --window-size não serve para medir).
 *
 *   node scripts/audit-mobile.mjs                      # site local em dist/
 *   node scripts/audit-mobile.mjs --site https://...   # site publicado
 *   node scripts/audit-mobile.mjs --shot pagina.png    # salva screenshot
 *
 * Aponta: rolagem horizontal, elemento estourando a largura, alvo de toque
 * pequeno demais para o dedo, texto miúdo e imagem sem dimensão declarada.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const SITE = flag('site', 'http://localhost:8765').replace(/\/+$/, '');
const CAMINHOS = flag('paths', '/,/blog/,/politica-de-privacidade/').split(',');
const LARGURA = Number(flag('width', 390));
const ALTURA = Number(flag('height', 844));

const perfil = mkdtempSync(join(tmpdir(), 'audit-'));
const chrome = spawn(
  'google-chrome',
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9333',
    `--user-data-dir=${perfil}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function alvo() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch('http://127.0.0.1:9333/json/list');
      const abas = await res.json();
      const page = abas.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* o Chrome ainda está subindo */
    }
    await dormir(250);
  }
  throw new Error('Chrome não respondeu na porta de depuração');
}

function conectar(url) {
  const ws = new WebSocket(url);
  const pendentes = new Map();
  let id = 0;
  const eventos = new Map();

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pendentes.has(msg.id)) {
      const { resolve, reject } = pendentes.get(msg.id);
      pendentes.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      eventos.get(msg.method)?.forEach((fn) => fn(msg.params));
    }
  });

  const pronto = new Promise((r) => ws.addEventListener('open', r));
  const enviar = (method, params = {}) =>
    new Promise((resolve, reject) => {
      id += 1;
      pendentes.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const ouvir = (method, fn) => {
    if (!eventos.has(method)) eventos.set(method, []);
    eventos.get(method).push(fn);
  };
  return { pronto, enviar, ouvir, fechar: () => ws.close() };
}

/* roda dentro da página */
const MEDIR = `(() => {
  const doc = document.documentElement;
  const vw = doc.clientWidth;
  const problemas = { estouro: [], toque: [], texto: [], imagens: [] };

  const seletor = (el) => {
    const classes = typeof el.className === 'string' && el.className
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.')
      : '';
    return el.tagName.toLowerCase() + classes;
  };

  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;

    if (r.right > vw + 1 || r.left < -1) {
      /* elemento dentro de um contêiner que corta (marquee, carrossel, tabela
         com rolagem própria) não estoura a página: é recorte intencional */
      let cortado = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p);
        if (/hidden|clip|auto|scroll/.test(o.overflowX + o.overflow)) { cortado = true; break; }
      }
      const pai = el.parentElement;
      const paiEstoura = pai && pai.getBoundingClientRect().right > vw + 1;
      if (!cortado && !paiEstoura) {
        problemas.estouro.push(seletor(el) + ' → ' + Math.round(r.width) + 'px (tela ' + vw + 'px)');
      }
    }

    if (el.matches('a, button, input[type=submit], [role=button]')) {
      /* padrão "link esticado": um ::after absoluto cobre o cartão inteiro,
         então a área de toque real é muito maior que a caixa do texto */
      const depois = getComputedStyle(el, '::after');
      const esticado = depois.content !== 'none' && depois.position === 'absolute';
      const area = Math.min(r.width, r.height);
      if (!esticado && area > 0 && area < 40 && el.offsetParent !== null) {
        problemas.toque.push(seletor(el) + ' → ' + Math.round(r.width) + 'x' + Math.round(r.height));
      }
    }

    if (el.children.length === 0 && el.textContent.trim().length > 3) {
      const tamanho = parseFloat(cs.fontSize);
      if (tamanho && tamanho < 11) problemas.texto.push(seletor(el) + ' → ' + tamanho + 'px: "' + el.textContent.trim().slice(0, 30) + '"');
    }

    if (el.tagName === 'IMG' && (!el.getAttribute('width') || !el.getAttribute('height'))) {
      problemas.imagens.push(seletor(el) + ' → ' + (el.currentSrc || el.src).split('/').pop());
    }
  }

  return JSON.stringify({
    vw,
    altura: doc.scrollHeight,
    rolagemHorizontal: doc.scrollWidth > vw,
    ...problemas,
  });
})()`;

const url = await alvo();
const cdp = conectar(url);
await cdp.pronto;
await cdp.enviar('Page.enable');
await cdp.enviar('Emulation.setDeviceMetricsOverride', {
  width: LARGURA,
  height: ALTURA,
  deviceScaleFactor: 3,
  mobile: true,
});
await cdp.enviar('Emulation.setUserAgentOverride', {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});

let totalProblemas = 0;
console.log(`\nEmulando ${LARGURA}x${ALTURA} (iPhone)\n${'─'.repeat(64)}`);

for (const caminho of CAMINHOS) {
  await cdp.enviar('Page.navigate', { url: SITE + caminho });
  await dormir(2500);
  const { result } = await cdp.enviar('Runtime.evaluate', { expression: MEDIR, returnByValue: true });
  const r = JSON.parse(result.value);

  console.log(`\n${caminho}  (${r.vw}px de largura, ${r.altura}px de altura)`);
  const secoes = [
    ['ROLAGEM HORIZONTAL', r.rolagemHorizontal ? ['a página inteira rola de lado'] : []],
    ['ESTOURANDO A TELA', r.estouro],
    ['ALVO DE TOQUE PEQUENO (< 40px)', r.toque],
    ['TEXTO MIÚDO (< 11px)', r.texto],
    ['IMAGEM SEM width/height', r.imagens],
  ];
  let limpo = true;
  for (const [titulo, itens] of secoes) {
    const unicos = [...new Set(itens)];
    if (!unicos.length) continue;
    limpo = false;
    totalProblemas += unicos.length;
    console.log(`  ${titulo}:`);
    unicos.slice(0, 8).forEach((i) => console.log(`    • ${i}`));
    if (unicos.length > 8) console.log(`    … e mais ${unicos.length - 8}`);
  }
  if (limpo) console.log('  ✔ nada a apontar');
}

const shot = flag('shot', null);
if (shot) {
  const { data } = await cdp.enviar('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(shot, Buffer.from(data, 'base64'));
  console.log(`\nscreenshot: ${shot}`);
}

console.log(`\n${'─'.repeat(64)}\n${totalProblemas} ponto(s) para revisar\n`);
cdp.fechar();
chrome.kill();
/* o Chrome ainda está encerrando: apagar o perfil na hora dá ENOTEMPTY */
setTimeout(() => {
  try {
    rmSync(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    /* o /tmp limpa depois */
  }
  process.exit(totalProblemas ? 0 : 0);
}, 500);
