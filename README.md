<<<<<<< HEAD
# jose-wilson-campanha
=======
# Wilson Campos — site de campanha

Landing page + blog da campanha de **Wilson Campos** (José Wilson Campos), candidato a Deputado Estadual
por Minas Gerais pelo **Democrata 35**, em Itabira.

Stack: [Astro](https://astro.build) 5 (SSG) + Tailwind CSS 3, com blog em Markdown via content collections.

## Comandos

```bash
npm install      # instala dependências
npm run dev      # servidor de desenvolvimento em http://localhost:4321
npm run build    # gera o site estático em dist/
npm run preview  # serve o build de dist/
```

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
>>>>>>> 7f58510 (feat: add Tailwind CSS configuration and TypeScript configuration file)
