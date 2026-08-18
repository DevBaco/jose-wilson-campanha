import type { Loader } from 'astro/loaders';

/* Loader do blog a partir de um WordPress headless.
   O WP é só painel: o cliente escreve lá, o Astro lê a REST API no build e
   gera o HTML estático. O layout e o schema do site não mudam — o que chega
   daqui tem exatamente o mesmo formato do que vinha dos arquivos .md. */

interface WpRendered {
  rendered: string;
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
    'wp:featuredmedia'?: Array<{
      source_url?: string;
      alt_text?: string;
      media_details?: { width?: number; height?: number };
    }>;
    'wp:term'?: Array<Array<{ name?: string; taxonomy?: string }>>;
  };
}

/* O WP devolve título e resumo com HTML e entidades dentro. */
function toText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&#8230;|&hellip;/g, '…')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
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
        const media = post._embedded?.['wp:featuredmedia']?.[0];
        const categories = termsOf(post, 'category');
        const tags = termsOf(post, 'post_tag');

        const data = await parseData({
          id: post.slug,
          data: {
            title: toText(post.title.rendered),
            description: toText(post.excerpt.rendered),
            date: toIso(post.date_gmt),
            updated: toIso(post.modified_gmt),
            author: authorName(post._embedded?.author?.[0]?.name),
            section: categories[0] ?? 'Notícias',
            keywords: tags,
            image: media?.source_url,
            imageAlt: media?.alt_text || undefined,
            imageWidth: media?.media_details?.width,
            imageHeight: media?.media_details?.height,
            draft: false,
          },
        });

        /* o corpo já vem como HTML pronto do WP: entregando em `rendered` o
           render(post) das páginas continua funcionando sem alteração */
        store.set({
          id: post.slug,
          data,
          rendered: { html: post.content.rendered },
          digest: generateDigest(post),
        });
      }

      logger.info(`${collected.length} post(s) carregado(s) do WordPress`);
    },
  };
}
