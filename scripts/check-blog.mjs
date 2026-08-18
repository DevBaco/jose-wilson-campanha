#!/usr/bin/env node
/**
 * Verificador do blog: compara o WordPress com o site publicado e aponta
 * o que quebra na prática. Roda sem dependência nenhuma.
 *
 *   node scripts/check-blog.mjs
 *   node scripts/check-blog.mjs --site http://localhost:4321
 *
 * Sai com código 1 se houver ERRO (algo quebrado para o visitante).
 * AVISO é coisa que funciona mas vai doer: imagem pesada, alt vazio.
 */

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const SITE = flag('site', 'https://wilsoncamposoficial.com.br').replace(/\/+$/, '');
const WP = flag('wp', 'https://blog.wilsoncamposoficial.com.br').replace(/\/+$/, '');
const PAGE_SIZE = 6; // precisa acompanhar BLOG_PAGE_SIZE em src/lib/blog.ts
const IMG_AVISO_KB = 300; // acima disso a foto atrasa o carregamento no 4G

const erros = [];
const avisos = [];
const erro = (msg) => erros.push(msg);
const aviso = (msg) => avisos.push(msg);

async function pegar(url, opcoes = {}) {
  const res = await fetch(url, opcoes);
  return { ok: res.ok, status: res.status, res };
}

async function texto(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.text();
}

const contar = (html, regex) => (html.match(regex) ?? []).length;
const extrair = (html, regex) => (html.match(regex) ?? [])[1] ?? null;

/* ------------------------------------------------------------------ */

console.log(`\nSite: ${SITE}\nWordPress: ${WP}\n${'─'.repeat(60)}`);

// 1. WordPress responde?
let wpPosts = [];
try {
  const res = await fetch(`${WP}/wp-json/wp/v2/posts?per_page=100&_embed=1`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  wpPosts = await res.json();
} catch (e) {
  erro(`WordPress inacessível (${e.message}). Nenhum build novo vai funcionar.`);
  console.log(`\n✖ ${erros[0]}\n`);
  process.exit(1);
}
console.log(`WordPress: ${wpPosts.length} post(s) publicado(s)`);

// 2. Todo post do WP virou página no site?
const publicados = [];
for (const post of wpPosts) {
  const url = `${SITE}/blog/${post.slug}/`;
  const { ok, status } = await pegar(url, { method: 'HEAD' });
  if (!ok) {
    erro(`"${post.slug}" existe no WP mas o site devolve ${status} em /blog/${post.slug} — build atrasado ou falhou.`);
    continue;
  }
  publicados.push(post);
}
console.log(`Site: ${publicados.length} post(s) no ar`);

// 3. Cada página de post
for (const post of publicados) {
  const slug = post.slug;
  const html = await texto(`${SITE}/blog/${slug}/`);
  if (!html) continue;

  const titulo = extrair(html, /<title>([^<]*)<\/title>/);
  if (!titulo || titulo.trim() === '| Wilson Campos') erro(`${slug}: <title> vazio.`);

  const h1s = contar(html, /<h1[\s>]/g);
  if (h1s === 0) erro(`${slug}: página sem <h1>.`);
  if (h1s > 1) erro(`${slug}: ${h1s} <h1> na mesma página — provavelmente há um Título 1 dentro do texto do post.`);

  if (!/<link rel="canonical"/.test(html)) erro(`${slug}: sem canonical.`);
  if (/@[a-z0-9.-]+\.(com|com\.br|net|org)/i.test(html.match(/<p class="post-meta">[\s\S]*?<\/p>/)?.[0] ?? '')) {
    erro(`${slug}: e-mail aparecendo como autor. Ajuste "Exibir nome publicamente como" no perfil do WordPress.`);
  }

  const corpo = html.match(/<div class="post-content">([\s\S]*?)<\/div>\s*<aside/)?.[1] ?? '';
  if (corpo.trim().length < 40) erro(`${slug}: corpo do post vazio ou quase.`);

  // tags que o WordPress produz e o site não estiliza
  for (const [tag, regex] of [
    ['iframe (vídeo/mapa incorporado)', /<iframe/i],
    ['table (tabela)', /<table/i],
    ['h4 ou menor', /<h[4-6][\s>]/i],
    ['style inline vindo do editor', /<(p|div|figure)[^>]+style=/i],
  ]) {
    if (regex.test(corpo)) aviso(`${slug}: contém ${tag} — confira visualmente, não há estilo previsto para isso.`);
  }

  // imagens dentro do corpo apontando para fora
  for (const m of corpo.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/g)) {
    const tag = m[0];
    const src = m[1];
    if (!/width=/.test(tag) || !/height=/.test(tag)) {
      aviso(`${slug}: imagem no corpo sem width/height (${src.slice(-40)}) — a página "pula" enquanto carrega.`);
    }
    if (!/alt="[^"]+"/.test(tag)) aviso(`${slug}: imagem no corpo sem texto alternativo.`);
  }

  // links internos quebrados
  for (const m of corpo.matchAll(/href="(\/[^"#]*)"/g)) {
    const { ok, status } = await pegar(`${SITE}${m[1]}`, { method: 'HEAD' });
    if (!ok) erro(`${slug}: link interno quebrado para ${m[1]} (${status}).`);
  }

  // imagem destacada
  const media = post._embedded?.['wp:featuredmedia']?.[0];
  if (!media?.source_url) {
    aviso(`${slug}: sem imagem destacada — o card do blog fica só com texto e o compartilhamento usa a arte padrão.`);
  } else {
    if (!media.alt_text) aviso(`${slug}: imagem destacada sem texto alternativo (campo "Texto alternativo" no WordPress).`);
    const { res, ok, status } = await pegar(media.source_url);
    if (!ok) {
      erro(`${slug}: imagem destacada não carrega (${status}) — ${media.source_url}`);
    } else {
      const kb = Math.round(Number(res.headers.get('content-length') ?? 0) / 1024);
      if (kb > IMG_AVISO_KB) {
        aviso(`${slug}: imagem destacada com ${kb}KB (limite saudável ${IMG_AVISO_KB}KB) — redimensione antes de subir no WordPress.`);
      }
      const w = media.media_details?.width;
      const h = media.media_details?.height;
      if (!w || !h) aviso(`${slug}: WordPress não informou dimensões da imagem — o layout "pula" durante o carregamento.`);
      else if (w < 1200) aviso(`${slug}: imagem destacada com ${w}px de largura; abaixo de 1200px ela fica borrada no card e no compartilhamento.`);
    }
  }
}

// 4. Paginação
const totalPaginas = Math.max(1, Math.ceil(publicados.length / PAGE_SIZE));
const listagem = await texto(`${SITE}/blog/`);
if (!listagem) {
  erro('/blog não carrega.');
} else {
  const cards = contar(listagem, /class="blog-card"/g);
  const esperado = Math.min(PAGE_SIZE, publicados.length);
  // o <template> de busca repete todos os cards, por isso a comparação é >=
  if (cards < esperado) erro(`/blog mostra ${cards} card(s), esperado ao menos ${esperado}.`);

  const indice = contar(listagem, /data-search="/g);
  if (publicados.length && indice !== publicados.length) {
    erro(`índice de busca com ${indice} post(s) e o site tem ${publicados.length} — a busca não vai achar tudo.`);
  }

  for (let p = 2; p <= totalPaginas; p += 1) {
    const { ok, status } = await pegar(`${SITE}/blog/pagina/${p}/`, { method: 'HEAD' });
    if (!ok) erro(`/blog/pagina/${p} devolve ${status}.`);
  }
  const alem = await pegar(`${SITE}/blog/pagina/${totalPaginas + 1}/`, { method: 'HEAD' });
  if (alem.ok) aviso(`/blog/pagina/${totalPaginas + 1} existe mas não deveria (página vazia indexável).`);
}
console.log(`Paginação: ${totalPaginas} página(s) de ${PAGE_SIZE}`);

// 5. Busca cobre o que o visitante espera?
if (publicados.length) {
  const semResumo = publicados.filter((p) => !p.excerpt?.rendered?.replace(/<[^>]*>/g, '').trim());
  for (const p of semResumo) aviso(`${p.slug}: sem resumo — o card fica sem chamada e a busca perde esse texto.`);
  const semCategoria = publicados.filter((p) => !(p._embedded?.['wp:term']?.flat() ?? []).some((t) => t?.taxonomy === 'category' && t.name !== 'Sem categoria'));
  for (const p of semCategoria) aviso(`${p.slug}: sem categoria definida — cai em "Notícias" por padrão.`);
}

/* ------------------------------------------------------------------ */

console.log(`${'─'.repeat(60)}`);
if (avisos.length) {
  console.log(`\n⚠ ${avisos.length} aviso(s):`);
  avisos.forEach((a) => console.log(`  • ${a}`));
}
if (erros.length) {
  console.log(`\n✖ ${erros.length} erro(s):`);
  erros.forEach((e) => console.log(`  • ${e}`));
  console.log('');
  process.exit(1);
}
console.log(`\n✔ Blog íntegro: ${publicados.length} post(s), ${totalPaginas} página(s), sem erros.\n`);
