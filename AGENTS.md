# KIMONO.LAB — agent context

Bilingual (JA/EN) showcase site for KIMONO.LAB, a Japanese atelier that remakes
vintage kimono into one-off dresses. Instagram: [@kimonolab_](https://www.instagram.com/kimonolab_/).
Stocked at 帝国ホテル and ホテルニューオータニ. Enquiries go by Instagram DM,
not through a form.

Read this before changing anything. Most of it is context that is **not**
recoverable from the code.

---

## Commands

```bash
npm run dev          # dev server on :4321
npm run build        # static build to dist/
npm run sync         # pull posts from Instagram into src/content/pieces/
npm run sync:test    # 42 assertions on the caption parser
npm run build:synced # sync then build (use this in CI)

node scripts/sync-instagram.e2e.mjs          # 27 end-to-end sync checks
node scripts/sync-instagram.e2e.mjs --keep    # ...leaving generated files behind
```

Run `npm run sync:test` and the e2e script after touching anything under
`scripts/`. They are fast and they catch real breakage.

---

## Where things live

- **Code**: `C:\Users\sayak\dev\kimono-lab` — deliberately **outside OneDrive**,
  because OneDrive sync corrupts `node_modules`.
- **Original assets**: `C:\Users\sayak\OneDrive - Stanford\Documents\KIMONO.LAB`
  — full-resolution photography, the Krita logo source, animation exports.
  Copies live in `src/assets/`; that folder is the OneDrive archive.
- **Never commit**: the two `販売委託契約書*.docx` consignment contracts. They are
  confidential business documents and must stay in OneDrive only.

## Stack

Astro 7 (static) + Tailwind **v4**. No UI framework, no client JS beyond what
Astro emits.

---

## Deployment

Live at <https://chiyonakatsuji.github.io/kimono-lab/>, published by
`.github/workflows/deploy.yml` on every push to `master`, on a daily
`schedule:` at 21:40 UTC (06:40 JST) so new Instagram posts appear on their own,
and on demand from the Actions tab.

`astro.config.mjs` reads `SITE_URL` and `BASE_PATH`, defaulting to that project
URL and the `/kimono-lab` base. The workflow leaves both unset on purpose. A
custom domain only needs those two variables, not code changes.

Instagram credentials reach the build as repository secrets — `BEHOLD_FEED_URL`,
or `IG_USER_ID` + `IG_ACCESS_TOKEN` — with `IG_REQUIRED_TAG` and `IG_MAX_POSTS`
as repository variables. Set them with `gh secret set NAME`, which reads the
value without printing it. The workflow only ever tests them for emptiness.

Three things keep a bad feed from taking the site down, and all three should
survive future edits:

1. no credentials → the sync step is skipped entirely;
2. a failing feed → `SYNC_ALLOW_FAILURE=1` makes it a warning;
3. synced content that will not build → the `ig-*.md` files are deleted and the
   build is retried with the curated pieces alone.

GitHub disables `schedule:` triggers after 60 days without repository activity.
One "Run workflow" click brings them back.

---

## Traps that have already caused bugs

**Tailwind is v4.** Design tokens and custom utilities live in
`src/styles/global.css` under `@theme` and `@utility`. There is **no
`tailwind.config.js` and you must not create one.**

**Content collections config is `src/content.config.ts`** (directly under `src/`,
not `src/content/config.ts`) and uses the `glob()` loader from `astro/loaders`.

**`mx-auto` on a child of a flex column cancels the default stretch.** `<body>`
is `flex flex-col`, so any full-width bar also needs `w-full`. This silently
collapsed the header to 490px and centred it.

**`.label` vs `.note`.** `.label` applies `uppercase` and `0.22em` tracking —
correct for two-word labels, wrong for sentences, and badly wrong for Japanese
prose. Use `.note` for muted sentences.

**`:lang(ja)` line-height sits inside `@layer base`** so Tailwind utilities can
still override it. Outside a layer it wins on source order and breaks tight
display headings.

**Images** must come from `src/assets/` and go through `<Image>` from
`astro:assets` with `widths` + `sizes`, so they get optimised to WebP. Files in
`public/` are served raw.

---

## Content rules

**Never invent facts about a garment.** Era (`時代`) and region (`産地`) cannot be
read off a photograph or a caption. Unknown values are written as `《要確認》` /
`(to confirm)` and the sync script refuses to infer them. Do not "tidy these up"
by substituting plausible text.

**Placeholder copy is marked in the file.** `《…》` in Japanese, parenthesised
italics in English. It is waiting on the atelier's own words — replace it with
theirs, not with yours.

**The tagline is the brand's own**: `Your Beauty, Your Story`, kept in English on
both language trees because that is what the brand does. Not a placeholder.

**Provenance is the organising idea** (borrowed from how SHIRO sorts by
ingredient origin): cloth, motif, era, region, meaning. Cloth and motif are
browsable facets at `/[lang]/pieces/cloth/[key]` and `/motif/[key]`.
`provenance` is **optional** — Instagram-synced pieces often have none.

**Design reference**: the shared ground between SHIRO (cleanliness) and Toraya
(simplicity). Space instead of border lines, few colours, two font families,
the garment supplies all the colour. Resist adding rules, badges and accents.

---

## Instagram sync contract

`scripts/sync-instagram.mjs` writes `src/content/pieces/ig-*.md` and downloads
images to `src/assets/instagram/`. Both are **gitignored** — they are generated,
not source.

- Generated entries carry `source: instagram` and are **overwritten on every
  run**. Hand edits are lost.
- To adopt an entry permanently, change `source` to `atelier`. The script then
  leaves it alone and stops deleting it.
- Feed source is auto-detected from `.env`: `BEHOLD_FEED_URL` (preferred — the
  service refreshes the Meta token, so the feed does not silently empty every
  60 days) or `IG_USER_ID` + `IG_ACCESS_TOKEN` for the Graph API directly.
- `IG_REQUIRED_TAG` limits syncing to posts carrying one hashtag. It is not
  currently set: the backstop filter is doing the job on its own, because a post
  has to *name a garment or a cloth* to be imported at all, not merely avoid the
  announcement keywords. Set the tag if that ever lets something through.
- With nothing configured the script exits 0 and changes nothing, so a deploy
  never fails because the feed is down. Keep that property.
- A feed that **is** configured but errors exits 1, so a hand-run `npm run sync`
  reports an expired token. `SYNC_ALLOW_FAILURE=1` downgrades that to a warning;
  only CI sets it, so the site keeps publishing through a dead feed.
- Caption parsing lives in `scripts/lib/caption.mjs`. The keyword tables have
  now been run against the real feed and tuned to her house style: she names the
  kimono type (`小紋`, `振袖`) rather than the weave, appends `Size Free S-XL` to
  the name line, and writes the Japanese and English names as adjacent lines
  rather than as separate paragraphs. Extend the tables as her vocabulary grows;
  the tests in `sync-instagram.test.mjs` cover each of those shapes.
- A reel's `mediaUrl` is an `.mp4`, so video posts sync from their poster frame,
  and `downloadImage` refuses anything that is not `image/*`. Without that a
  video lands as a `.jpg` and fails the **Astro build** rather than the sync,
  which is far harder to trace. Keep that guard.

---

## Open work

- [ ] The Behold free plan returns only the **6 most recent posts**, and three of
      those six were reels about the atelier rather than garments. A garment
      drops out of the feed as soon as six newer posts exist, and the sync then
      deletes its page. Adopt anything worth keeping by changing `source` to
      `atelier`, or move to a paid plan for a longer window.
- [ ] Two of her garment captions name no motif, so those pieces publish with a
      motif of `《要確認》` / `(to confirm)`. Fill them in by hand after adopting,
      or ask her to name the motif in the caption.
- [ ] Era and region for both pieces are `《要確認》`.
- [ ] All About-page copy and both piece stories are placeholders.
- [ ] `src/lib/site.ts` — `EMAIL` is `null`; hotel boutique names/floors unconfirmed.
- [ ] `src/assets` is **48.6 MB** in git and grows with each garment. Consider
      downscaling committed originals to ~1800px, keeping full-res in OneDrive.
- [ ] `src/assets/shirasagi.png` has a border baked in (looks like a screenshot
      export) and is currently unused. Re-export from `KIMONO.LAB.kra`.
- [ ] `src/pages/review.astro` is a development contact sheet — **delete before
      launch**.
- [ ] A Behold free feed only returns the 6 most recent posts, so the synced
      gallery cannot grow past six. To keep a piece permanently, rename its
      `ig-*.md` to a real slug and commit it — the gitignore only covers `ig-*`,
      and its images have to move out of `src/assets/instagram/` too.
- [ ] Two unused videos in `public/video/` — nobody has confirmed what they show.

---

## Documentation

- [Astro routing](https://docs.astro.build/en/guides/routing/)
- [Content collections](https://docs.astro.build/en/guides/content-collections/)
- [Astro i18n](https://docs.astro.build/en/guides/internationalization/)
- [Images](https://docs.astro.build/en/guides/images/)
- [Tailwind v4 theme variables](https://tailwindcss.com/docs/theme)
