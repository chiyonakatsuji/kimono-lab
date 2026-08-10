import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * One file per garment in src/content/pieces/.
 * Text is nested per language so a single file describes a piece in both
 * Japanese and English — this is the shape a CMS will later write to.
 */
const pieces = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pieces' }),
  schema: ({ image }) =>
    z.object({
      // Lower numbers appear first in the gallery.
      order: z.number().default(100),
      photo: image(),
      // Extra photographs (details, back, lining).
      gallery: z.array(image()).default([]),
      available: z.boolean().default(true),
      // Left out on purpose while the site is enquiry-only.
      price: z.number().optional(),
      // Hide from the site without deleting the file.
      draft: z.boolean().default(false),
      ja: z.object({
        name: z.string(),
        material: z.string(),
        story: z.string(),
        alt: z.string(),
      }),
      en: z.object({
        name: z.string(),
        material: z.string(),
        story: z.string(),
        alt: z.string(),
      }),
    }),
});

export const collections = { pieces };
