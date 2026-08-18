import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { wordpressPosts } from './lib/wordpress';

/* Fonte do blog: com WP_URL definido, o conteúdo vem do WordPress headless;
   sem ela, dos arquivos .md em src/content/noticias. O schema e as páginas
   são os mesmos nos dois casos. */
const WP_URL = process.env.WP_URL ?? import.meta.env?.WP_URL;

const noticias = defineCollection({
  loader: WP_URL ? wordpressPosts(WP_URL) : glob({ pattern: '**/*.md', base: './src/content/noticias' }),
  schema: z.object({
    title: z.string(),
    seoTitle: z.string().optional(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    author: z.string().default('Wilson Campos'),
    section: z.string().default('Notícias'),
    keywords: z.array(z.string()).default([]),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    imageWidth: z.number().int().positive().optional(),
    imageHeight: z.number().int().positive().optional(),
    imagePosition: z.string().optional(),
    video: z
      .object({
        src: z.string(),
        poster: z.string(),
        title: z.string(),
        caption: z.string().optional(),
        duration: z.string(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { noticias };
