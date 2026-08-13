export const languages = {
  ja: '日本語',
  en: 'English',
} as const;

export type Lang = keyof typeof languages;

export const defaultLang: Lang = 'ja';

export function isLang(value: string | undefined): value is Lang {
  return value === 'ja' || value === 'en';
}

/**
 * Every visible string on the site lives here, once per language.
 * Product text is not here — that comes from src/content/pieces/ so it can
 * later be edited through a CMS.
 */
export const ui = {
  ja: {
    // The brand's own tagline, from its Instagram bio. Kept in English in both
    // languages, as the brand itself does.
    'site.tagline': 'Your Beauty, Your Story',
    'site.oneOfAKind': '全て一点物',
    'nav.pieces': '作品',
    'nav.about': 'アトリエ',
    'nav.stockists': '取扱店',
    'nav.contact': 'お問い合わせ',
    'home.hero.lead': '眠っていた着物に、もう一度着られる時間を。',
    'home.pieces.viewAll': '作品を見る',
    'home.about.heading': 'アトリエ',
    'home.about.more': '読む',
    'pieces.heading': '作品',
    'pieces.intro': 'すべて一点物です。同じ着物は二つとなく、再制作はできません。',
    'pieces.byCloth': '生地から',
    'pieces.byMotif': '文様から',
    'pieces.all': 'すべて',
    'pieces.count': '点',
    'piece.provenance': '出自',
    'piece.cloth': '生地',
    'piece.motif': '文様',
    'piece.era': '時代',
    'piece.region': '産地',
    'piece.meaning': '意味',
    'piece.status.available': 'お問い合わせ受付中',
    'piece.status.sold': 'お仕立て済み',
    'piece.oneOfAKind': '一点物',
    'piece.inquire': 'この作品について問い合わせる',
    'piece.back': '作品一覧へ',
    'piece.seeAlsoCloth': '同じ生地の作品',
    'piece.seeAlsoMotif': '同じ文様の作品',
    'piece.viewOnInstagram': 'Instagramの投稿を見る',
    'contact.heading': 'お問い合わせ',
    'contact.intro':
      '作品のご相談、お持ちの着物のお仕立て直しについて、お気軽にご連絡ください。',
    'contact.dm': 'InstagramのDMより承ります',
    'contact.dmDetail': '試着・購入・取り置き',
    'contact.instagram': 'Instagram',
    'stockists.heading': '取扱店',
    'stockists.intro': '下記のホテル内店舗にてお取り扱いいただいております。',
    'stockists.shipping': '国内・海外への発送に対応しています。',
    'contact.name': 'お名前',
    'contact.email': 'メールアドレス',
    'contact.subject': '件名',
    'contact.message': 'ご相談内容',
    'contact.send': '送信',
    'footer.rights': 'All rights reserved.',
    skip: '本文へ移動',
  },
  en: {
    'site.tagline': 'Your Beauty, Your Story',
    'site.oneOfAKind': 'All one of a kind',
    'nav.pieces': 'Pieces',
    'nav.about': 'Atelier',
    'nav.stockists': 'Stockists',
    'nav.contact': 'Contact',
    'home.hero.lead': 'Giving a sleeping kimono somewhere to be worn again.',
    'home.pieces.viewAll': 'View pieces',
    'home.about.heading': 'Atelier',
    'home.about.more': 'Read',
    'pieces.heading': 'Pieces',
    'pieces.intro':
      'Every piece is one of a kind. No two kimono are alike, so nothing here can be remade.',
    'pieces.byCloth': 'By cloth',
    'pieces.byMotif': 'By motif',
    'pieces.all': 'All',
    'pieces.count': 'pieces',
    'piece.provenance': 'Provenance',
    'piece.cloth': 'Cloth',
    'piece.motif': 'Motif',
    'piece.era': 'Era',
    'piece.region': 'Region',
    'piece.meaning': 'Meaning',
    'piece.status.available': 'Available to enquire',
    'piece.status.sold': 'Already made up',
    'piece.oneOfAKind': 'One of a kind',
    'piece.inquire': 'Enquire about this piece',
    'piece.back': 'All pieces',
    'piece.seeAlsoCloth': 'Same cloth',
    'piece.seeAlsoMotif': 'Same motif',
    'piece.viewOnInstagram': 'View the original post',
    'contact.heading': 'Contact',
    'contact.intro':
      'For enquiries about a piece, or about remaking a kimono you already own, please do get in touch.',
    'contact.dm': 'Enquiries by Instagram direct message',
    'contact.dmDetail': 'Fittings, purchases and reservations',
    'contact.instagram': 'Instagram',
    'stockists.heading': 'Stockists',
    'stockists.intro': 'Pieces are carried at the following hotel boutiques.',
    'stockists.shipping': 'Shipping is available within Japan and internationally.',
    'contact.name': 'Name',
    'contact.email': 'Email',
    'contact.subject': 'Subject',
    'contact.message': 'Message',
    'contact.send': 'Send',
    'footer.rights': 'All rights reserved.',
    skip: 'Skip to content',
  },
} as const satisfies Record<Lang, Record<string, string>>;

export type UIKey = keyof (typeof ui)['ja'];

export function useTranslations(lang: Lang) {
  return function t(key: UIKey): string {
    return ui[lang][key] ?? ui[defaultLang][key];
  };
}

/** Builds a locale-prefixed path, e.g. path('ja', 'pieces') -> '/ja/pieces' */
export function path(lang: Lang, ...segments: string[]): string {
  const tail = segments.filter(Boolean).join('/');
  return tail ? `/${lang}/${tail}` : `/${lang}/`;
}
