import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from '../i18n/ui';

export type Piece = CollectionEntry<'pieces'>;

export type Facet = 'cloth' | 'motif';

export interface FacetGroup {
  /** URL slug, e.g. "chirimen" */
  key: string;
  /** Display label per language, taken from the first piece in the group. */
  label: Record<Lang, string>;
  pieces: Piece[];
}

/** All published pieces, in display order. */
export async function getPieces(): Promise<Piece[]> {
  const pieces = await getCollection('pieces', ({ data }) => !data.draft);
  return pieces.sort((a, b) => a.data.order - b.data.order);
}

function keyOf(piece: Piece, facet: Facet): string {
  return facet === 'cloth'
    ? piece.data.provenance.clothKey
    : piece.data.provenance.motifKey;
}

function labelOf(piece: Piece, facet: Facet): Record<Lang, string> {
  const value = facet === 'cloth' ? piece.data.provenance.cloth : piece.data.provenance.motif;
  return { ja: value.ja, en: value.en };
}

/**
 * Groups pieces by cloth or motif. Groups are ordered by size (largest first),
 * then alphabetically by key so the output is stable across builds.
 */
export function groupBy(pieces: Piece[], facet: Facet): FacetGroup[] {
  const groups = new Map<string, FacetGroup>();

  for (const piece of pieces) {
    const key = keyOf(piece, facet);
    const existing = groups.get(key);
    if (existing) {
      existing.pieces.push(piece);
    } else {
      groups.set(key, { key, label: labelOf(piece, facet), pieces: [piece] });
    }
  }

  return [...groups.values()].sort(
    (a, b) => b.pieces.length - a.pieces.length || a.key.localeCompare(b.key),
  );
}

/** Other pieces sharing this piece's cloth or motif. */
export function relatedTo(piece: Piece, pieces: Piece[], facet: Facet): Piece[] {
  const key = keyOf(piece, facet);
  return pieces.filter((p) => p.id !== piece.id && keyOf(p, facet) === key);
}
