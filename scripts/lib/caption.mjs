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
  // Kimono types rather than weaves. She names the garment she cut up far more
  // often than the cloth it was woven from, and "a komon" says more about a
  // piece than "silk" does. Listed after the weaves, which are more specific.
  { key: 'komon', test: /小紋|こもん|komon/i, ja: '小紋（こもん）', en: 'Komon — small-pattern silk kimono' },
  { key: 'furisode', test: /振袖|ふりそで|furisode/i, ja: '振袖（ふりそで）', en: 'Furisode — long-sleeved formal silk' },
  { key: 'houmongi', test: /訪問着|houmongi|h(?:ō|o)mongi/i, ja: '訪問着', en: 'Hōmongi — formal visiting kimono' },
  { key: 'tomesode', test: /留袖|tomesode/i, ja: '留袖', en: 'Tomesode — crested formal kimono' },
  { key: 'obi', test: /(^|[^\w])帯([^\w]|$)|\bobi\b/i, ja: '帯', en: 'Obi — sash cloth' },
  { key: 'yukata', test: /浴衣|ゆかた|yukata/i, ja: '浴衣', en: 'Yukata — cotton' },
  // Deliberately last: the general term, used when nothing specific matched.
  { key: 'shoken', test: /正絹|絹|silk/i, ja: '正絹', en: 'Silk' },
];

/** Motifs. Sets are listed before singles so 松竹梅 beats a bare 松. */
const MOTIFS = [
  {
    key: 'shochikubai',
    test: /松竹梅|sh(?:ō|o)chikubai|pine.{0,24}bamboo.{0,24}plum/i,
    ja: '松竹梅',
    en: 'Shōchikubai — pine, bamboo and plum',
  },
  { key: 'tsuru-matsu', test: /(松.{0,4}鶴)|(鶴.{0,4}松)|crane.{0,12}pine|pine.{0,12}crane/i, ja: '松に鶴', en: 'Crane and pine' },
  { key: 'hanaguruma', test: /花車|hanaguruma|flower cart/i, ja: '花車', en: 'Flower cart' },
  { key: 'takara', test: /宝尽くし|宝尽し|takara/i, ja: '宝尽くし', en: 'Takara-zukushi — assembled treasures' },
  { key: 'goshoguruma', test: /御所車|goshoguruma/i, ja: '御所車', en: 'Imperial carriage' },
  { key: 'tsuru', test: /鶴|crane/i, ja: '鶴', en: 'Crane' },
  { key: 'matsu', test: /松|pine/i, ja: '松', en: 'Pine' },
  { key: 'take', test: /竹|bamboo/i, ja: '竹', en: 'Bamboo' },
  { key: 'sakura', test: /桜|さくら|cherry blossom|sakura/i, ja: '桜', en: 'Cherry blossom' },
  { key: 'botan', test: /牡丹|ぼたん|peony/i, ja: '牡丹', en: 'Peony' },
  { key: 'kiku', test: /菊|chrysanthemum/i, ja: '菊', en: 'Chrysanthemum' },
  { key: 'fuji', test: /藤|wisteria/i, ja: '藤', en: 'Wisteria' },
  { key: 'ume', test: /梅|plum blossom/i, ja: '梅', en: 'Plum blossom' },
  { key: 'kotobuki', test: /寿|kotobuki/i, ja: '寿', en: 'Kotobuki — longevity character' },
  { key: 'noshi', test: /熨斗|のし|noshi/i, ja: '熨斗', en: 'Noshi ribbons' },
  { key: 'ougi', test: /扇|扇面|fan motif/i, ja: '扇', en: 'Fan' },
  // A category, not a motif, so it is the last thing tried: any named motif
  // above tells the reader more than "auspicious" does.
  {
    key: 'kissho',
    test: /吉祥文様|吉祥柄|吉祥|auspicious/i,
    ja: '吉祥文様',
    en: 'Auspicious motifs',
  },
];

const SOLD = /sold\s*out|sold|売却|ご成約|完売|お買い上げ|受注済/i;

/**
 * Spec and status text appended to the name line — sizes, model height, price,
 * sold markers. Useful to a shopper, but none of it is part of a garment's name.
 */
const NAME_NOISE =
  /[\s　]*(?:[|｜/／][\s　]*)?(?:sizes?\b|sold\s*out\b|sold\b|model\s+\d|colors?\b|サイズ|完売|ご成約|受注済|価格|着丈|身丈|[¥￥]).*$/i;

/** Heading of a photo or model credit block. Never part of a garment's story. */
const CREDIT_HEADER =
  /^(?:thanks?\s+to\b|special\s+thanks|photo(?:graphy)?\s*(?:by\b|[:：])|camera\s*[:：]|model\s*[:：]|styling\s*[:：]|撮影|モデル\s*[:：]|協力)/i;

/** @handles, which read as noise in prose the way hashtags do. */
const MENTION = /[@＠][A-Za-z0-9._]+/g;

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
  // Reels about the atelier: model interviews and behind-the-scenes clips.
  /interview/i,
  /インタビュー/,
  /special thanks/i,
  /behind the scenes/i,
  /密着|撮影風景/,
];

/**
 * What the post is selling. A garment listing names the garment; a reel about
 * the atelier names nothing wearable, and no blacklist of announcement phrases
 * ever keeps up with a person's posting habits. Requiring this instead means an
 * unrecognised kind of post is skipped rather than published as a dress.
 */
const GARMENT =
  /ドレス|dress|ワンピース|スカート|skirt|ブラウス|blouse|コート\b|coat\b|ジャケット|jacket|ネクタイ|necktie|バッグ|bag\b|ストール|stole|shawl|キャミソール|camisole|羽織|haori|パンツ|trousers/i;

export function stripHashtags(text) {
  return text.replace(/[#＃][^\s#＃]+/g, ' ').replace(/[ \t]{2,}/g, ' ');
}

export function hashtags(text) {
  return [...text.matchAll(/[#＃]([^\s#＃]+)/g)].map((m) => m[1]);
}

export function stripMentions(text) {
  return text.replace(MENTION, ' ').replace(/[ \t]{2,}/g, ' ');
}

function isJapanese(line) {
  return HAS_JAPANESE.test(line);
}

/**
 * A line that is only a spec — a size code or a model's height. There is
 * nowhere on the site to put it and it reads badly as a garment's story.
 * Bounded by length so a real sentence opening "Model 160cm wears…" survives.
 */
function isSpecOnly(line) {
  return (
    line.length <= 40 &&
    /^(?:(?:sizes?|model|height)\b|サイズ|着丈|身丈)[\s:：]*[\p{L}\p{N}\-–.,()/ 　]*$/iu.test(line)
  );
}

function isCredit(para) {
  const lines = para
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return false;
  if (CREDIT_HEADER.test(lines[0])) return true;
  // A block of mostly @handles is a credit list however it is headed.
  return lines.filter((l) => /^[@＠]/.test(l)).length * 2 >= lines.length;
}

/**
 * Splits a caption into Japanese and English halves by classifying each
 * paragraph. Many Japanese brands write both, separated by a blank line.
 * If only one language is present, both sides get the same text — the site
 * will show Japanese on the English pages rather than showing nothing.
 */
export function splitLanguages(caption) {
  const paras = stripHashtags(caption)
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !isCredit(p));

  const ja = [];
  const en = [];

  for (const para of paras) {
    const lines = para
      .split('\n')
      .map((l) => stripMentions(l).trim())
      .filter((l) => l && !isSpecOnly(l));

    // Group runs of same-language lines, because she also writes the two
    // languages as adjacent lines rather than as separate paragraphs. A
    // paragraph of prose in one language still comes through as one block.
    let run = null;
    for (const line of lines) {
      const target = isJapanese(line) ? ja : en;
      if (run?.target !== target) {
        run = { target, lines: [] };
        target.push(run.lines);
      }
      run.lines.push(line);
    }
  }

  const join = (groups) => groups.map((g) => g.join('\n')).join('\n\n');
  const jaText = join(ja);
  const enText = join(en);

  return {
    ja: jaText || enText,
    en: enText || jaText,
    // True when only one language was found, so the site can flag it.
    monolingual: !jaText || !enText,
  };
}

/** First meaningful line, cleaned up, used as the piece name. */
export function extractName(caption) {
  const first = stripMentions(stripHashtags(caption))
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)[0];
  if (!first) return null;
  return (
    first
      // Drop leading decoration and emoji.
      .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s◆■●○▼▽・\-–—]+/u, '')
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]+/gu, '')
      .replace(NAME_NOISE, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 60) || null
  );
}

/**
 * Her name lines read `小紋ドレス KOMON Dress` — one garment named twice, on one
 * line. Split it so each language page shows its own name. Only splits when
 * both halves stand on their own, so a name in a single language is left alone.
 */
export function splitName(name) {
  if (!name) return { ja: name, en: name };
  const parts = name.split(/[\s　]+/).filter(Boolean);

  // Walk back over the trailing Latin-only tokens.
  let i = parts.length;
  while (i > 0 && !HAS_JAPANESE.test(parts[i - 1]) && /[A-Za-z]/.test(parts[i - 1])) i--;

  const ja = parts.slice(0, i).join(' ');
  const en = parts.slice(i).join(' ');
  if (!ja || !en || !HAS_JAPANESE.test(ja) || en.length < 4) return { ja: name, en: name };
  return { ja, en };
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
  if (NOT_A_PRODUCT.some((re) => re.test(caption))) return false;
  // Positive evidence, not merely the absence of announcement words.
  return GARMENT.test(caption) || findFirst(CLOTHS, caption) !== null;
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
    names: splitName(name),
    ja: text.ja,
    en: text.en,
    provenance: prov?.provenance ?? null,
    sold: looksSold(caption),
    tags: hashtags(caption),
    confidence,
  };
}
