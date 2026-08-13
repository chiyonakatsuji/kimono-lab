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
      sizes: { full: { mediaUrl: `http://127.0.0.1:${PORT}/img/a.jpg` } },
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
      sizes: { full: { mediaUrl: `http://127.0.0.1:${PORT}/img/c1.jpg` } },
      children: [{ mediaUrl: `http://127.0.0.1:${PORT}/img/c2.jpg` }],
    },
    {
      id: '444',
      permalink: 'https://www.instagram.com/p/NoTag55/',
      mediaType: 'IMAGE',
      timestamp: '2026-07-01T10:00:00+0000',
      caption: `試作中のドレス\n#kimonolab`,
      sizes: { full: { mediaUrl: `http://127.0.0.1:${PORT}/img/d.jpg` } },
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
}

if (files.includes('ig-carousel77.md')) {
  const md = await readFile(path.join(CONTENT_DIR, 'ig-carousel77.md'), 'utf8');
  check('sold post marked unavailable', /^available: false$/m.test(md));
  check('carousel second image became gallery', /^gallery:$/m.test(md));
}

check('images downloaded', images.length >= 3, `saw ${images.length}: ${images.join(', ')}`);
if (images.length) {
  const s = await stat(path.join(IMAGE_DIR, images[0]));
  check('downloaded image is non-trivial', s.size > 10000, `${s.size} bytes`);
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
