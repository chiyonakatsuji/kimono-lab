#!/usr/bin/env node
/**
 * End-to-end check of the Instagram sync, against a fake feed served locally.
 * Proves feed normalisation, filtering, image download and YAML generation —
 * not just the caption parser.
 *
 * Run with: node scripts/sync-instagram.e2e.mjs
 * Generated files are removed at the end unless --keep is passed.
 */

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, readdir, unlink, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'src', 'content', 'pieces');
const IMAGE_DIR = path.join(ROOT, 'src', 'assets', 'instagram');
const PORT = 4399;
const KEEP = process.argv.includes('--keep');

// A real JPEG to serve, so the download path is genuinely exercised.
const SAMPLE = path.join(ROOT, 'src', 'assets', 'lookbook', '1.jpg');

const FEED = {
  posts: [
    {
      id: '111',
      permalink: 'https://www.instagram.com/p/AbCdEfG123/',
      mediaType: 'IMAGE',
      timestamp: '2026-08-01T10:00:00+0000',
      caption: `青い鳥のドレス\n\n黒地の縮緬に、松に飛び鶴の文様。\n\nBlue Bird Dress\n\nBlack chirimen silk, cranes over pine.\n\n#kimonolab_piece`,
      // Behold's real shape: an unoptimised original plus sized variants,
      // extracted hashtags, and Instagram's alt text.
      mediaUrl: `http://127.0.0.1:${PORT}/img/a.jpg`,
      sizes: { full: { mediaUrl: `http://127.0.0.1:${PORT}/img/a-full.jpg` } },
      hashtags: ['kimonolab_piece'],
      altText: '黒い縮緬のワンショルダードレスを着たモデル',
    },
    {
      id: '222',
      permalink: 'https://www.instagram.com/p/PopUp999/',
      mediaType: 'IMAGE',
      timestamp: '2026-07-20T10:00:00+0000',
      caption: `POPUP 6月 omotesando\n\n表参道にてポップアップを開催します。\n#kimonolab_piece`,
      sizes: { full: { mediaUrl: `http://127.0.0.1:${PORT}/img/b.jpg` } },
    },
    {
      id: '333',
      permalink: 'https://www.instagram.com/p/Carousel77/',
      mediaType: 'CAROUSEL_ALBUM',
      timestamp: '2026-07-10T10:00:00+0000',
      caption: `花車のドレス SOLD\n\n正絹、花車に熨斗。\n#kimonolab_piece`,
      // Behold lists every slide in `children` and repeats the first one as the
      // album's own `mediaUrl`, under a differently signed URL. Deduping by URL
      // cannot see that, so the lead photo must come from the children.
      mediaUrl: `http://127.0.0.1:${PORT}/img/c1.jpg?sig=album`,
      children: [
        { mediaType: 'IMAGE', mediaUrl: `http://127.0.0.1:${PORT}/img/c1.jpg?sig=slide1` },
        { mediaType: 'IMAGE', mediaUrl: `http://127.0.0.1:${PORT}/img/c2.jpg` },
      ],
    },
    {
      id: '444',
      permalink: 'https://www.instagram.com/p/NoTag55/',
      mediaType: 'IMAGE',
      timestamp: '2026-07-01T10:00:00+0000',
      caption: `試作中のドレス\n#kimonolab`,
      sizes: { full: { mediaUrl: `http://127.0.0.1:${PORT}/img/d.jpg` } },
    },
    {
      id: '555',
      permalink: 'https://www.instagram.com/reel/Reel42/',
      mediaType: 'VIDEO',
      timestamp: '2026-06-20T10:00:00+0000',
      caption: `小紋キャミソールドレス Size XS-M\nKOMON Camisole Dress\n#kimonolab_piece`,
      // A reel's `mediaUrl` is an .mp4. Only the poster frame is usable.
      mediaUrl: `http://127.0.0.1:${PORT}/video/e.mp4`,
      thumbnailUrl: `http://127.0.0.1:${PORT}/img/e.jpg`,
      sizes: { full: { mediaUrl: `http://127.0.0.1:${PORT}/img/e-full.jpg` } },
    },
  ],
};

const jpeg = await readFile(SAMPLE);

const server = createServer((req, res) => {
  if (req.url === '/feed') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(FEED));
  } else if (req.url.startsWith('/img/')) {
    res.writeHead(200, { 'content-type': 'image/jpeg' });
    res.end(jpeg);
  } else if (req.url.startsWith('/video/')) {
    // Deliberately real-looking: the sync must refuse it rather than save it
    // under a .jpg name and fail the Astro build instead.
    res.writeHead(200, { 'content-type': 'video/mp4' });
    res.end(Buffer.from('000000206674797069736f6d', 'hex'));
  } else {
    res.writeHead(404);
    res.end();
  }
});

await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'sync-instagram.mjs')], {
  env: {
    ...process.env,
    BEHOLD_FEED_URL: `http://127.0.0.1:${PORT}/feed`,
    IG_REQUIRED_TAG: 'kimonolab_piece',
  },
  stdio: 'inherit',
});
const code = await new Promise((r) => child.on('close', r));
server.close();

console.log(`\nsync exited ${code}\n`);

// ------------------------------------------------------------------- asserts

let failed = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  ok   ${name}`);
  else {
    console.log(`  FAIL ${name}${detail ? '\n       ' + detail : ''}`);
    failed++;
  }
}

const files = (await readdir(CONTENT_DIR)).filter((f) => f.startsWith('ig-'));
const images = (await readdir(IMAGE_DIR).catch(() => [])).filter((f) => f.startsWith('ig-'));

check('product post written', files.includes('ig-abcdefg123.md'), `saw: ${files.join(', ')}`);
check('pop-up post skipped', !files.includes('ig-popup999.md'));
check('post without required tag skipped', !files.includes('ig-notag55.md'));
check('carousel post written', files.includes('ig-carousel77.md'));

if (files.includes('ig-abcdefg123.md')) {
  const md = await readFile(path.join(CONTENT_DIR, 'ig-abcdefg123.md'), 'utf8');
  check('marked as instagram-sourced', /^source: instagram$/m.test(md));
  check('name parsed into frontmatter', /name: "青い鳥のドレス"/.test(md));
  check('cloth inferred', /clothKey: chirimen/.test(md));
  check('motif inferred', /motifKey: tsuru-matsu/.test(md));
  check('permalink recorded', /permalink: "https:\/\/www\.instagram\.com\/p\/AbCdEfG123\/"/.test(md));
  check('available true when not sold', /^available: true$/m.test(md));
  check('english story separated', /Black chirimen silk/.test(md));
  check('inference caveats recorded in a comment', /# Inference notes:/.test(md));
  check("instagram's alt text preferred over caption", /alt: "黒い縮緬のワンショルダードレスを着たモデル"/.test(md));
  check('unoptimised original preferred over sizes.full', /photo: \.\.\/\.\.\/assets\/instagram\/ig-abcdefg123-1\./.test(md));
}

if (files.includes('ig-carousel77.md')) {
  const md = await readFile(path.join(CONTENT_DIR, 'ig-carousel77.md'), 'utf8');
  check('sold post marked unavailable', /^available: false$/m.test(md));
  check('carousel second image became gallery', /^gallery:$/m.test(md));
  check(
    'album mediaUrl not repeated as a gallery image',
    (md.match(/assets\/instagram\/ig-carousel77-/g) ?? []).length === 2,
    md.split('\n').filter((l) => l.includes('ig-carousel77-')).join(' | '),
  );
}

check('video post written from its poster frame', files.includes('ig-reel42.md'), `saw: ${files.join(', ')}`);
if (files.includes('ig-reel42.md')) {
  const md = await readFile(path.join(CONTENT_DIR, 'ig-reel42.md'), 'utf8');
  check('bilingual name split per language', /ja:\n  name: "小紋キャミソールドレス"/.test(md));
  check('english line pulled out of the japanese paragraph', /story: \|\n {4}KOMON Camisole Dress/.test(md));
  check('kimono type read as the cloth', /clothKey: komon/.test(md));
}

check('images downloaded', images.length >= 4, `saw ${images.length}: ${images.join(', ')}`);
check('no video saved as an image', !images.some((f) => f.startsWith('ig-reel42-2')));
for (const f of images) {
  const s = await stat(path.join(IMAGE_DIR, f));
  check(`${f} is a non-trivial image`, s.size > 10000, `${s.size} bytes`);
}

// ------------------------------------------------------------------- cleanup

if (!KEEP) {
  for (const f of files) await unlink(path.join(CONTENT_DIR, f));
  for (const f of images) await unlink(path.join(IMAGE_DIR, f));
  console.log('\ncleaned up generated files');
} else {
  console.log('\n--keep: generated files left in place');
}

console.log(failed ? `\n${failed} check(s) failed\n` : '\nall checks passed\n');
process.exit(failed ? 1 : 0);
