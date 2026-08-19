#!/usr/bin/env node
/**
 * Testa o formulário de apoio no navegador, contra um WordPress falso.
 *
 *   npm run build && node scripts/test-form.mjs
 *
 * Sobe um endpoint de mentira que imita as respostas do plugin apoios.php,
 * serve o dist/, emula um iPhone e dirige a página de verdade: digita,
 * envia, confere a tela de obrigado, o erro do servidor e o honeypot.
 *
 * Sai com código 1 se algum caso falhar.
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const PORTA_SITE = 8811;
const PORTA_API = 8812;
const ENDPOINT_REAL = 'https://blog.wilsoncamposoficial.com.br/wp-json/wilson/v1/apoio';
const ENDPOINT_FALSO = `http://localhost:${PORTA_API}/apoio`;

let modo = 'sucesso';
const recebidos = [];

/* ---------------- WordPress de mentira ---------------- */
const api = createServer(async (req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();

  const corpo = await new Promise((r) => {
    let d = '';
    req.on('data', (c) => (d += c));
    req.on('end', () => r(d));
  });
  const dados = JSON.parse(corpo || '{}');
  recebidos.push(dados);

  if (String(dados.apelido || '').trim()) return res.writeHead(200, cors).end('{"ok":true}');
  if (modo === 'erro') {
    return res.writeHead(400, cors).end(JSON.stringify({ ok: false, erro: 'Informe nome e um e-mail válido.' }));
  }
  if (modo === 'limite') {
    return res.writeHead(429, cors).end(JSON.stringify({ ok: false, erro: 'Muitos envios seguidos. Tente novamente mais tarde.' }));
  }
  return res.writeHead(201, cors).end('{"ok":true}');
});

/* ---------------- serve o dist/, trocando o endpoint ---------------- */
const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.xml': 'application/xml', '.txt': 'text/plain' };

const site = createServer(async (req, res) => {
  let caminho = normalize(decodeURIComponent(req.url.split('?')[0]));
  if (caminho.endsWith('/')) caminho += 'index.html';
  try {
    const arquivo = join(process.cwd(), 'dist', caminho);
    let conteudo = await readFile(arquivo);
    if (extname(arquivo) === '.html') {
      conteudo = Buffer.from(conteudo.toString('utf8').replaceAll(ENDPOINT_REAL, ENDPOINT_FALSO));
    }
    res.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] ?? 'application/octet-stream' }).end(conteudo);
  } catch {
    res.writeHead(404).end('nao encontrado');
  }
});

await new Promise((r) => api.listen(PORTA_API, r));
await new Promise((r) => site.listen(PORTA_SITE, r));

/* ---------------- navegador ---------------- */
const perfil = mkdtempSync(join(tmpdir(), 'teste-form-'));
const chrome = spawn(
  'google-chrome',
  ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=9477', `--user-data-dir=${perfil}`, 'about:blank'],
  { stdio: 'ignore' },
);

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 40; i += 1) {
  try {
    const abas = await (await fetch('http://127.0.0.1:9477/json/list')).json();
    const aba = abas.find((t) => t.type === 'page');
    if (aba) {
      wsUrl = aba.webSocketDebuggerUrl;
      break;
    }
  } catch {
    /* subindo */
  }
  await dormir(250);
}

const sock = new WebSocket(wsUrl);
const pendentes = new Map();
let id = 0;
const errosConsole = [];
sock.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pendentes.has(m.id)) {
    pendentes.get(m.id)(m.result);
    pendentes.delete(m.id);
  } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
    /* o Chrome loga 400/429 como erro de rede; aqui só interessa exceção
       de JavaScript, senão os casos de erro do servidor acusam sozinhos */
    if (!/Failed to load resource/.test(m.params.entry.text)) errosConsole.push(m.params.entry.text);
  } else if (m.method === 'Runtime.exceptionThrown') {
    errosConsole.push(m.params.exceptionDetails.text || 'exceção');
  }
});
await new Promise((r) => sock.addEventListener('open', r));
const cdp = (method, params = {}) =>
  new Promise((res) => {
    id += 1;
    pendentes.set(id, res);
    sock.send(JSON.stringify({ id, method, params }));
  });
const avaliar = async (expr) => {
  const { result } = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return result.value;
};

await cdp('Page.enable');
await cdp('Log.enable');
await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

const falhas = [];
const conferir = (nome, condicao, detalhe = '') => {
  console.log(`  ${condicao ? '✔' : '✖'} ${nome}${condicao ? '' : `  →  ${detalhe}`}`);
  if (!condicao) falhas.push(nome);
};

const abrir = async () => {
  await cdp('Page.navigate', { url: `http://localhost:${PORTA_SITE}/` });
  await dormir(2200);
};

const preencher = (extra = '') => avaliar(`(() => {
  const f = document.querySelector('[data-support-form]');
  f.querySelector('[name=nome]').value = 'Maria Aparecida de Souza';
  f.querySelector('[name=email]').value = 'maria@exemplo.com';
  f.querySelector('[name=cidade]').value = 'Itabira';
  f.querySelector('[name=consentimento_lgpd]').checked = true;
  ${extra}
  return 1;
})()`);

const enviar = async () => {
  await avaliar(`document.querySelector('[data-support-form]').requestSubmit()`);
  await dormir(1200);
};

const estado = async () =>
  JSON.parse(await avaliar(`(() => {
    const f = document.querySelector('[data-support-form]');
    const s = document.querySelector('[data-support-status]');
    const o = document.querySelector('[data-support-done]');
    return JSON.stringify({
      formVisivel: !f.hidden,
      obrigadoVisivel: !o.hidden,
      tituloObrigado: o.querySelector('[data-support-done-title]').textContent,
      status: s.hidden ? '' : s.textContent,
      tipo: s.dataset.tipo || '',
      nomePreenchido: f.querySelector('[name=nome]').value,
      botao: f.querySelector('[data-support-submit]').textContent,
      focoNoTitulo: document.activeElement === o.querySelector('[data-support-done-title]'),
    });
  })()`));

console.log('\nMÁSCARA DE TELEFONE');
await abrir();
for (const [digitado, esperado] of [
  ['31999637470', '(31) 99963-7470'],
  ['3134567890', '(31) 3456-7890'],
  ['31', '(31'],
  ['3', '(3'],
  ['', ''],
  ['(31) 9 9963-7470', '(31) 99963-7470'],
  ['abc31999xyz637470', '(31) 99963-7470'],
]) {
  const saiu = await avaliar(`(() => {
    const t = document.querySelector('[name=telefone]');
    t.value = ${JSON.stringify(digitado)};
    t.dispatchEvent(new Event('input', { bubbles: true }));
    return t.value;
  })()`);
  conferir(`"${digitado}" → "${esperado}"`, saiu === esperado, `saiu "${saiu}"`);
}

console.log('\nENVIO VÁLIDO → TELA DE OBRIGADO');
modo = 'sucesso';
await abrir();
await preencher();
await enviar();
{
  const e = await estado();
  conferir('formulário sai da tela', !e.formVisivel, `formVisivel=${e.formVisivel}`);
  conferir('tela de obrigado aparece', e.obrigadoVisivel);
  conferir('usa o primeiro nome', e.tituloObrigado === 'Obrigado, Maria!', `veio "${e.tituloObrigado}"`);
  conferir('foco vai para a tela nova', e.focoNoTitulo);
}

console.log('\n"CADASTRAR OUTRA PESSOA"');
await avaliar(`document.querySelector('[data-support-again]').click()`);
await dormir(400);
{
  const e = await estado();
  conferir('volta o formulário', e.formVisivel && !e.obrigadoVisivel);
  conferir('campos limpos', e.nomePreenchido === '', `nome="${e.nomePreenchido}"`);
}

console.log('\nSERVIDOR RECUSA (400)');
modo = 'erro';
await abrir();
await preencher();
await enviar();
{
  const e = await estado();
  conferir('continua no formulário', e.formVisivel && !e.obrigadoVisivel);
  conferir('mostra o motivo', e.status.includes('e-mail válido'), `status="${e.status}"`);
  conferir('não apaga o que a pessoa digitou', e.nomePreenchido !== '', 'formulário foi limpo');
  conferir('botão volta a funcionar', e.botao === 'Enviar meu apoio', `botão="${e.botao}"`);
}

console.log('\nLIMITE POR IP (429)');
modo = 'limite';
await abrir();
await preencher();
await enviar();
{
  const e = await estado();
  conferir('avisa sobre o limite', e.status.includes('Muitos envios'), `status="${e.status}"`);
  conferir('tipo do aviso é erro', e.tipo === 'erro', `tipo="${e.tipo}"`);
}

console.log('\nROBÔ NO HONEYPOT');
modo = 'sucesso';
await abrir();
await preencher(`f.querySelector('[name=apelido]').value = 'spam';`);
await enviar();
{
  const e = await estado();
  const ultimo = recebidos[recebidos.length - 1];
  conferir('robô vê a tela de obrigado (não desconfia)', e.obrigadoVisivel);
  conferir('campo isca chega ao servidor para ser descartado', ultimo.apelido === 'spam', `apelido="${ultimo.apelido}"`);
}

console.log('\nCAMPOS OBRIGATÓRIOS');
await abrir();
await avaliar(`(() => {
  const f = document.querySelector('[data-support-form]');
  f.querySelector('[name=nome]').value = 'Sem consentimento';
  f.querySelector('[name=email]').value = 'sem@exemplo.com';
  return 1;
})()`);
const antes = recebidos.length;
await enviar();
conferir('navegador barra envio sem o consentimento', recebidos.length === antes, 'o envio passou');

console.log('\nCONSOLE');
conferir('nenhum erro de JavaScript', errosConsole.length === 0, errosConsole.slice(0, 2).join(' | '));

sock.close();
chrome.kill();
api.close();
site.close();
setTimeout(() => {
  try {
    rmSync(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    /* o /tmp limpa depois */
  }
  console.log(`\n${'─'.repeat(52)}`);
  console.log(falhas.length ? `✖ ${falhas.length} falha(s): ${falhas.join(', ')}\n` : '✔ todos os casos passaram\n');
  process.exit(falhas.length ? 1 : 0);
}, 400);
