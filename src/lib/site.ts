import type { Lang } from '../i18n/ui';

/**
 * Facts about the brand that are not per-piece content.
 * Taken from the Instagram bio (@kimonolab_) — anything marked TO CONFIRM
 * needs checking with the atelier before launch.
 */
export const INSTAGRAM_HANDLE = 'kimonolab_';
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;

/** TO CONFIRM: the atelier's public email address, if it wants one at all. */
export const EMAIL: string | null = null;

export interface Stockist {
  name: Record<Lang, string>;
  /** TO CONFIRM: exact boutique name, floor and opening hours within the hotel. */
  detail?: Record<Lang, string>;
}

export const STOCKISTS: Stockist[] = [
  {
    name: { ja: '帝国ホテル', en: 'Imperial Hotel, Tokyo' },
  },
  {
    name: { ja: 'ホテルニューオータニ', en: 'Hotel New Otani' },
  },
];
