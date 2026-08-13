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

      /**
       * Where this entry came from. Entries written by scripts/sync-instagram.mjs
       * are marked `instagram` and are overwritten on the next sync — edit those
       * by hand and your changes are lost. Curated entries are `atelier`.
       */
      source: z.enum(['atelier', 'instagram']).default('atelier'),
      /** Link back to the original post, for instagram-sourced entries. */
      permalink: z.string().url().optional(),

      /**
       * Optional, because Instagram captions do not carry structured
       * provenance. Auto-synced entries have whatever could be inferred from
       * the caption, or nothing at all.
       */
      provenance: z
        .object({
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
          era: bilingual.optional(),
          region: bilingual.optional(),
          /** What the motif traditionally signifies. Optional. */
          meaning: bilingual.optional(),
        })
        .optional(),

      ja: z.object({ name: z.string(), story: z.string(), alt: z.string() }),
      en: z.object({ name: z.string(), story: z.string(), alt: z.string() }),
    }),
});

export const collections = { pieces };
