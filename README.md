# Wilson Campos — site de campanha

Landing page + blog da campanha de **Wilson Campos** (José Wilson Campos), candidato a Deputado Estadual
por Minas Gerais pelo **Democrata 35**, em Itabira.

Stack: [Astro](https://astro.build) 5 (SSG) + Tailwind CSS 4, com blog em Markdown via content collections.

## Comandos

```bash
npm install      # instala dependências
npm run dev      # servidor de desenvolvimento em http://localhost:4321
npm run build    # gera o site estático em dist/
npm run preview  # serve o build de dist/
```

## Design system

A identidade visual está especificada em [`DESIGN.md`](./DESIGN.md) e implementada em
`src/styles/global.css`. Não há `tailwind.config.*`: o Tailwind 4 lê os tokens direto do CSS,
no bloco `@theme` (cores, espaçamentos, raios e famílias tipográficas). A tipografia composta
(tamanho/peso/entrelinha de cada estilo) fica em `:root`, com a escala editorial ampliada em
tablet e desktop.

| Token | Uso |
| --- | --- |
| `azul` `#0057B8` | cor primária — CTA, links, blocos de campanha |
| `azul-escuro` `#073B73` / `azul-profundo` `#06284D` | superfícies escuras e alto contraste |
| `azul-claro` `#DCEEFF` | fundos suaves, texto de apoio sobre escuro |
| `amarelo` `#F5C400` | destaque, detalhes e elementos decorativos |
| `off-white` `#F7F5EF` | fundo principal da página |
| **Inter** | display, títulos, navegação, botões e badges |
| **Rubik** | texto corrido |

A geometria segue o que o `DESIGN.md` define: faixas diagonais no hero e na seção de economia
(apenas em desktop — no mobile o hero empilha com sobreposição suave), cartões de canto arredondado,
sombras discretas e composição editorial densa.

## Estrutura

```
src/
  pages/
    index.astro              # home (hero, história, blog, propostas, apoie)
    404.astro
    robots.txt.ts            # robots.txt gerado, aponta para o sitemap
    blog/
      index.astro            # página 1 do arquivo do blog
      pagina/[page].astro    # páginas 2..N
      [...slug].astro        # post individual
  components/
    SiteHeader.astro         # header (modo "home" com nav âncora / modo "inner")
    SiteFooter.astro
    BlogCard.astro
    BlogArchivePage.astro    # arquivo do blog + busca client-side e paginação
    WhatsAppFloat.astro      # botão flutuante; reescreve todo [data-whatsapp]
  content/noticias/          # posts do blog (.md) — schema em src/content.config.ts
  layouts/Layout.astro       # <head>, SEO, Open Graph e JSON-LD
  lib/site.ts                # URL do site, contatos e redes sociais
  lib/blog.ts                # BLOG_PAGE_SIZE
  styles/global.css          # design system completo (tokens + componentes)
public/assets/               # imagens e vídeos da campanha
```

## Conteúdo do blog

Cada post é um `.md` em `src/content/noticias/`, validado pelo schema Zod em `src/content.config.ts`.
O slug da URL vem do nome do arquivo. Campos obrigatórios: `title`, `description`, `date`.
Use `draft: true` para esconder um post do site.

## Pendências

- **Domínio**: `SITE_URL` em `src/lib/site.ts` e `site` em `astro.config.mjs` estão com
  `https://wilsoncampos.com.br` como placeholder — ajustar quando o domínio for definido.
- **Facebook**: o perfil informado é "Wilson Campos", sem URL; por isso não há link no footer ainda.
- **Assets**: o hero e as seções reaproveitam o retrato e o card de campanha. Arte dedicada de hero
  (desktop/tablet/mobile) e um logo/wordmark próprio ainda não existem — o header usa wordmark em texto.
- **Conteúdo**: `src/content/noticias/` está vazio, então o build avisa que a coleção não existe.
  O aviso some assim que o primeiro post `.md` for adicionado.
