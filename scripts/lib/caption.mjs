/**
 * Turns an Instagram caption into the fields a piece entry needs.
 *
 * This is inherently lossy. A caption is one blob of prose; the site wants a
 * name, a Japanese and an English description, and structured provenance.
 * Everything here is a heuristic, and every heuristic is wrong sometimes —
 * `confidence` reports what was actually found so low-quality entries can be
 * spotted rather than silently published.
 */

const HAS_JAPANESE = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/;

/** Cloth types, longest match first so 縮緬 wins over 絹. */
const CLOTHS = [
  { key: 'chirimen', test: /縮緬|ちりめん|クレープ|crepe|crêpe/i, ja: '縮緬（ちりめん）', en: 'Chirimen — silk crêpe' },
  { key: 'rinzu', test: /綸子|りんず|rinzu/i, ja: '綸子（りんず）', en: 'Rinzu — figured silk satin' },
  { key: 'tsumugi', test: /紬|つむぎ|tsumugi/i, ja: '紬（つむぎ）', en: 'Tsumugi — slub silk' },
  { key: 'ro', test: /(^|[^\w])絽([^\w]|$)|\bro silk\b/i, ja: '絽（ろ）', en: 'Ro — open-weave silk' },
  { key: 'shibori', test: /絞り|しぼり|shibori/i, ja: '絞り', en: 'Shibori' },
  { key: 'kinran', test: /金襴|きんらん|kinran/i, ja: '金襴', en: 'Kinran — gold brocade' },
  // Deliberately last: the general term, used when nothing specific matched.
  { key: 'shoken', test: /正絹|絹|silk/i, ja: '正絹', en: 'Silk' },
];

/** Motifs. Pairs are listed before singles so 松に鶴 beats a bare 鶴. */
const MOTIFS = [
  { key: 'tsuru-matsu', test: /(松.{0,4}鶴)|(鶴.{0,4}松)|crane.{0,12}pine|pine.{0,12}crane/i, ja: '松に鶴', en: 'Crane and pine' },
  { key: 'hanaguruma', test: /花車|hanaguruma|flower cart/i, ja: '花車', en: 'Flower cart' },
  { key: 'takara', test: /宝尽くし|宝尽し|takara/i, ja: '宝尽くし', en: 'Takara-zukushi — assembled treasures' },
  { key: 'goshoguruma', test: /御所車|goshoguruma/i, ja: '御所車', en: 'Imperial carriage' },
  { key: 'tsuru', test: /鶴|crane/i, ja: '鶴', en: 'Crane' },
  { key: 'matsu', test: /松|pine/i, ja: '松', en: 'Pine' },
  { key: 'sakura', test: /桜|さくら|cherry blossom|sakura/i, ja: '桜', en: 'Cherry blossom' },
  { key: 'botan', test: /牡丹|ぼたん|peony/i, ja: '牡丹', en: 'Peony' },
  { key: 'kiku', test: /菊|chrysanthemum/i, ja: '菊', en: 'Chrysanthemum' },
  { key: 'fuji', test: /藤|wisteria/i, ja: '藤', en: 'Wisteria' },
  { key: 'ume', test: /梅|plum blossom/i, ja: '梅', en: 'Plum blossom' },
  { key: 'kotobuki', test: /寿|kotobuki/i, ja: '寿', en: 'Kotobuki — longevity character' },
  { key: 'noshi', test: /熨斗|のし|noshi/i, ja: '熨斗', en: 'Noshi ribbons' },
  { key: 'ougi', test: /扇|扇面|fan motif/i, ja: '扇', en: 'Fan' },
];

const SOLD = /sold\s*out|sold|売却|ご成約|完売|お買い上げ|受注済/i;

/**
 * Posts that are plainly not a garment listing. Without this the gallery fills
 * with pop-up announcements. Extend this list as her posting habits change.
 */
const NOT_A_PRODUCT = [
  /pop\s*-?\s*up/i,
  /ポップアップ/,
  /イベント/,
  /出店/,
  /開催/,
  /予約受付/,
  /お知らせ/,
  /thank you for/i,
  /あけまして|今年もよろしく|ご挨拶/,
];

export function stripHashtags(text) {
  return text.replace(/[#＃][^\s#＃]+/g, ' ').replace(/[ \t]{2,}/g, ' ');
}

export function hashtags(text) {
  return [...text.matchAll(/[#＃]([^\s#＃]+)/g)].map((m) => m[1]);
}

function isJapanese(line) {
  return HAS_JAPANESE.test(line);
}

/**
 * Splits a caption into Japanese and English halves by classifying each
 * paragraph. Many Japanese brands write both, separated by a blank line.
 * If only one language is present, both sides get the same text — the site
 * will show Japanese on the English pages rather than showing nothing.
 */
export function splitLanguages(caption) {
  const clean = stripHashtags(caption).trim();
  const paras = clean
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const ja = paras.filter(isJapanese);
  const en = paras.filter((p) => !isJapanese(p));

  const jaText = ja.join('\n\n');
  const enText = en.join('\n\n');

  return {
    ja: jaText || enText,
    en: enText || jaText,
    // True when only one language was found, so the site can flag it.
    monolingual: !jaText || !enText,
  };
}

/** First meaningful line, cleaned up, used as the piece name. */
export function extractName(caption) {
  const first = stripHashtags(caption)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)[0];
  if (!first) return null;
  return (
    first
      // Drop leading decoration and emoji.
      .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s◆■●○▼▽・\-–—]+/u, '')
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]+/gu, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 60) || null
  );
}

function findFirst(list, text) {
  return list.find((entry) => entry.test.test(text)) ?? null;
}

/**
 * Best-effort provenance. Era and region are never inferred — they are facts
 * about a specific garment that no caption keyword can establish.
 */
export function extractProvenance(caption) {
  const text = caption;
  const cloth = findFirst(CLOTHS, text);
  const motif = findFirst(MOTIFS, text);
  if (!cloth && !motif) return null;

  // The schema needs both keys if provenance is present at all, so fall back
  // to the general silk term and an explicit "unspecified" motif.
  const c = cloth ?? { key: 'shoken', ja: '正絹', en: 'Silk' };
  const m = motif ?? { key: 'unspecified', ja: '《要確認》', en: '(to confirm)' };

  return {
    provenance: {
      clothKey: c.key,
      motifKey: m.key,
      cloth: { ja: c.ja, en: c.en },
      motif: { ja: m.ja, en: m.en },
    },
    inferred: { cloth: Boolean(cloth), motif: Boolean(motif) },
  };
}

export function looksSold(caption) {
  return SOLD.test(caption);
}

export function looksLikeProduct(caption) {
  if (!caption || !caption.trim()) return false;
  return !NOT_A_PRODUCT.some((re) => re.test(caption));
}

/** Everything the sync script needs, plus a note on how much was guessed. */
export function parseCaption(caption) {
  const name = extractName(caption);
  const text = splitLanguages(caption);
  const prov = extractProvenance(caption);

  const confidence = [];
  if (!name) confidence.push('no name found');
  if (text.monolingual) confidence.push('only one language in caption');
  if (!prov) confidence.push('no cloth or motif keywords');
  else {
    if (!prov.inferred.cloth) confidence.push('cloth guessed as generic silk');
    if (!prov.inferred.motif) confidence.push('motif not identified');
  }
  confidence.push('era and region never inferred');

  return {
    name,
    ja: text.ja,
    en: text.en,
    provenance: prov?.provenance ?? null,
    sold: looksSold(caption),
    tags: hashtags(caption),
    confidence,
  };
}
