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
    'site.tagline': '一枚の着物から、一着のドレスへ',
    'nav.pieces': '作品',
    'nav.about': 'アトリエについて',
    'nav.contact': 'お問い合わせ',
    'home.hero.lead':
      '眠っていた着物に、もう一度着られる時間を。',
    'home.pieces.heading': '作品',
    'home.pieces.viewAll': 'すべての作品を見る',
    'home.about.heading': 'アトリエについて',
    'home.about.more': 'くわしく読む',
    'pieces.heading': '作品',
    'pieces.intro':
      'すべて一点物です。同じ着物は二つとないため、再制作はできません。',
    'piece.material': '生地',
    'piece.status.available': 'お問い合わせ受付中',
    'piece.status.sold': 'お仕立て済み',
    'piece.oneOfAKind': '一点物',
    'piece.inquire': 'この作品について問い合わせる',
    'piece.back': '作品一覧へ戻る',
    'contact.heading': 'お問い合わせ',
    'contact.intro':
      '作品のご相談、お持ちの着物のお仕立て直しについて、お気軽にご連絡ください。',
    'contact.name': 'お名前',
    'contact.email': 'メールアドレス',
    'contact.subject': '件名',
    'contact.message': 'ご相談内容',
    'contact.send': '送信する',
    'contact.required': '必須',
    'footer.rights': 'All rights reserved.',
    'lang.switch': 'Language',
    'skip': '本文へ移動',
  },
  en: {
    'site.tagline': 'One kimono, one dress',
    'nav.pieces': 'Pieces',
    'nav.about': 'The Atelier',
    'nav.contact': 'Contact',
    'home.hero.lead':
      'Giving a sleeping kimono somewhere to be worn again.',
    'home.pieces.heading': 'Pieces',
    'home.pieces.viewAll': 'View all pieces',
    'home.about.heading': 'The Atelier',
    'home.about.more': 'Read more',
    'pieces.heading': 'Pieces',
    'pieces.intro':
      'Every piece is one of a kind. No two kimono are alike, so nothing here can be remade.',
    'piece.material': 'Cloth',
    'piece.status.available': 'Available to enquire',
    'piece.status.sold': 'Already made up',
    'piece.oneOfAKind': 'One of a kind',
    'piece.inquire': 'Enquire about this piece',
    'piece.back': 'Back to all pieces',
    'contact.heading': 'Contact',
    'contact.intro':
      'For enquiries about a piece, or about remaking a kimono you already own, please do get in touch.',
    'contact.name': 'Name',
    'contact.email': 'Email',
    'contact.subject': 'Subject',
    'contact.message': 'Message',
    'contact.send': 'Send',
    'contact.required': 'required',
    'footer.rights': 'All rights reserved.',
    'lang.switch': '言語',
    'skip': 'Skip to content',
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
