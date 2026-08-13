import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/** A value that has to be written once per language. */
const bilingual = z.object({ ja: z.string(), en: z.string() });

/**
 * One file per garment in src/content/pieces/.
 *
 * `provenance` is the organising idea of the site, borrowed from how SHIRO
 * sorts by ingredient origin: where the cloth came from is the story. The
 * `clothKey` / `motifKey` slugs are what make pieces browsable by cloth and
 * by motif — they must be lowercase ASCII with hyphens, since they become URLs.
 */
const pieces = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pieces' }),
  schema: ({ image }) =>
    z.object({
      order: z.number().default(100),
      photo: image(),
      gallery: z.array(image()).default([]),
      available: z.boolean().default(true),
      draft: z.boolean().default(false),

      provenance: z.object({
        // Slugs used for grouping and URLs.
        clothKey: z
          .string()
          .regex(/^[a-z0-9-]+$/, 'clothKey must be lowercase letters, numbers and hyphens'),
        motifKey: z
          .string()
          .regex(/^[a-z0-9-]+$/, 'motifKey must be lowercase letters, numbers and hyphens'),
        // Displayed text.
        cloth: bilingual,
        motif: bilingual,
        era: bilingual,
        region: bilingual,
        /** What the motif traditionally signifies. Optional. */
        meaning: bilingual.optional(),
      }),

      ja: z.object({ name: z.string(), story: z.string(), alt: z.string() }),
      en: z.object({ name: z.string(), story: z.string(), alt: z.string() }),
    }),
});

export const collections = { pieces };
