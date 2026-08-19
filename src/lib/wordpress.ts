import type { Loader } from 'astro/loaders';

/* Loader do blog a partir de um WordPress headless.
   O WP é só painel: o cliente escreve lá, o Astro lê a REST API no build e
   gera o HTML estático. O layout e o schema do site não mudam — o que chega
   daqui tem exatamente o mesmo formato do que vinha dos arquivos .md. */

interface WpRendered {
  rendered: string;
}

interface WpImageSize {
  source_url?: string;
  width?: number;
  height?: number;
}

interface WpMedia {
  source_url?: string;
  alt_text?: string;
  media_details?: {
    width?: number;
    height?: number;
    sizes?: Record<string, WpImageSize>;
  };
}

interface WpPost {
  slug: string;
  date_gmt: string;
  modified_gmt: string;
  title: WpRendered;
  content: WpRendered;
  excerpt: WpRendered;
  _embedded?: {
    author?: Array<{ name?: string }>;
    'wp:featuredmedia'?: WpMedia[];
    'wp:term'?: Array<Array<{ name?: string; taxonomy?: string }>>;
  };
}

const ENTIDADES: Record<string, string> = {
  nbsp: ' ',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
  ndash: '–',
  mdash: '—',
  laquo: '«',
  raquo: '»',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  amp: '&',
};

/* O WP devolve título e resumo com HTML e entidades dentro — nomeadas
   (&amp;) e numéricas (&#231;, &#x27;). Sem decodificar as numéricas, o
   Astro reescapa o & e o título vai para a aba do navegador como
   "Educa&amp;#231;&amp;#227;o". O &amp; é resolvido por último: fazer
   antes transformaria "&amp;#231;" em "ç" indevidamente. */
function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTIDADES[name.toLowerCase()] ?? match);
}

function toText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/* date_gmt vem sem fuso ("2026-08-13T16:29:42"): sem o Z o JS interpreta como
   horário local e a data do post anda algumas horas. */
function toIso(gmt: string): string {
  return gmt.endsWith('Z') ? gmt : `${gmt}Z`;
}

/* O nome público do WordPress começa igual ao login: se ninguém preencheu o
   "exibir nome publicamente como", o e-mail de quem instalou vazaria como
   autor em todo post do site. */
function authorName(raw: string | undefined): string {
  const name = (raw ?? '').trim();
  if (!name || name.includes('@')) return 'Wilson Campos';
  return name;
}

/* O WordPress corta o resumo automático com "[…]" quando ninguém preenche o
   campo Resumo. Isso é ruído no card e na meta description. */
function cleanExcerpt(text: string): string {
  return text.replace(/\s*\[(…|\.\.\.)\]\s*$/, '').replace(/\s*(…|\.\.\.)$/, '').trim();
}

/* Um "Título 1" digitado dentro do post viraria um segundo <h1> na página,
   competindo com o título do post. Rebaixa para <h2>. */
function demoteHeadings(html: string): string {
  return html.replace(/<(\/?)h1(\s|>)/gi, '<$1h2$2');
}

/* O `source_url` é sempre o arquivo original — se o Wilson subir uma foto de
   4MB do celular, é ela que iria para o card. O WordPress já gera versões
   menores; usamos elas via srcset e deixamos o navegador escolher.
   Só entram tamanhos com a MESMA proporção do original: os recortes
   quadrados (thumbnail) e os do tema mostrariam outro enquadramento. */
function pickImage(media: WpMedia | undefined) {
  const url = media?.source_url;
  const width = media?.media_details?.width;
  const height = media?.media_details?.height;
  if (!url || !width || !height) return undefined;

  const ratio = width / height;
  const candidates = [
    ...Object.values(media?.media_details?.sizes ?? {})
      .filter(
        (size): size is Required<WpImageSize> =>
          Boolean(size.source_url && size.width && size.height) &&
          Math.abs(size.width! / size.height! - ratio) < 0.02,
      )
      .map((size) => ({ url: size.source_url, width: size.width, height: size.height })),
    { url, width, height },
  ]
    .filter((c, i, all) => all.findIndex((o) => o.width === c.width) === i)
    .sort((a, b) => a.width - b.width);

  /* fallback do src: o menor que ainda serve numa tela retina do celular */
  const display = candidates.find((c) => c.width >= 1200) ?? candidates[candidates.length - 1];

  return {
    src: display.url,
    width: display.width,
    height: display.height,
    srcset: candidates.length > 1 ? candidates.map((c) => `${c.url} ${c.width}w`).join(', ') : undefined,
    alt: media?.alt_text || undefined,
  };
}

function termsOf(post: WpPost, taxonomy: string): string[] {
  const groups = post._embedded?.['wp:term'] ?? [];
  return groups
    .flat()
    .filter((term) => term?.taxonomy === taxonomy && term.name)
    .map((term) => term.name as string);
}

export function wordpressPosts(endpoint: string): Loader {
  const base = endpoint.replace(/\/+$/, '');

  return {
    name: 'wordpress-posts',
    async load({ store, logger, parseData, generateDigest }) {
      const collected: WpPost[] = [];
      let page = 1;
      let totalPages = 1;

      /* paginado: sem isso o blog para silenciosamente no 100º post */
      do {
        const url = `${base}/wp-json/wp/v2/posts?per_page=100&page=${page}&_embed=1`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`WordPress respondeu ${response.status} em ${url}`);
        }

        totalPages = Number(response.headers.get('x-wp-totalpages') ?? '1') || 1;
        collected.push(...((await response.json()) as WpPost[]));
        page += 1;
      } while (page <= totalPages);

      store.clear();

      for (const post of collected) {
        const image = pickImage(post._embedded?.['wp:featuredmedia']?.[0]);
        const categories = termsOf(post, 'category');
        const tags = termsOf(post, 'post_tag');
        const html = demoteHeadings(post.content.rendered);

        const data = await parseData({
          id: post.slug,
          data: {
            title: toText(post.title.rendered),
            description: cleanExcerpt(toText(post.excerpt.rendered)),
            date: toIso(post.date_gmt),
            updated: toIso(post.modified_gmt),
            author: authorName(post._embedded?.author?.[0]?.name),
            section: categories[0] ?? 'Notícias',
            keywords: tags,
            image: image?.src,
            imageSrcset: image?.srcset,
            imageAlt: image?.alt,
            imageWidth: image?.width,
            imageHeight: image?.height,
            /* a busca da listagem cobre só os metadados; sem isto, procurar
               por uma palavra que está no meio do texto não acha nada */
            searchText: toText(html).slice(0, 1000),
            draft: false,
          },
        });

        /* o corpo já vem como HTML pronto do WP: entregando em `rendered` o
           render(post) das páginas continua funcionando sem alteração */
        store.set({
          id: post.slug,
          data,
          rendered: { html },
          digest: generateDigest(post),
        });
      }

      logger.info(`${collected.length} post(s) carregado(s) do WordPress`);
    },
  };
}
