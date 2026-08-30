#!/usr/bin/env node
/**
 * Pulls posts from Instagram and writes them into src/content/pieces/ as
 * auto-synced entries, downloading each image into src/assets/instagram/.
 *
 * Run with:  npm run sync
 *
 * Two feed sources are supported, auto-detected from the environment:
 *
 *   BEHOLD_FEED_URL   — a Behold.so JSON feed (recommended; it owns the Meta
 *                       app and refreshes the token, so nothing expires)
 *   IG_USER_ID + IG_ACCESS_TOKEN
 *                     — Instagram Graph API directly. Note the token expires
 *                       every 60 days and the feed goes silently empty when
 *                       it does.
 *
 * Design notes:
 *  - Entries are marked `source: instagram` and are REWRITTEN on every run.
 *    Hand edits to them are lost; edit the Instagram caption instead, or
 *    change `source` to `atelier` to adopt the entry and stop it being synced.
 *  - Instagram serves images at about 1080px. The site renders up to 1600px,
 *    so these will be softer than the atelier's own files. That is a known
 *    consequence of syncing, not a bug.
 *  - If nothing is configured the script exits successfully without changes,
 *    so a deploy never fails just because the feed is unavailable.
 *  - A feed that IS configured but errors exits 1, so running this by hand
 *    tells you the token has expired. Set SYNC_ALLOW_FAILURE=1 (CI does) to
 *    downgrade that to a warning and let the build publish what it already has.
 */

import { mkdir, writeFile, readdir, unlink, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseCaption, looksLikeProduct } from './lib/caption.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'src', 'content', 'pieces');
const IMAGE_DIR = path.join(ROOT, 'src', 'assets', 'instagram');

/** Only sync posts carrying this hashtag. Empty means "sync everything". */
const REQUIRED_TAG = (process.env.IG_REQUIRED_TAG || '').replace(/^#/, '').toLowerCase();
const MAX_POSTS = Number(process.env.IG_MAX_POSTS || 24);

function log(...args) {
  console.log('[instagram]', ...args);
}

// ---------------------------------------------------------------- fetch feed

async function fetchFeed() {
  if (process.env.BEHOLD_FEED_URL) {
    log('source: Behold feed');
    const res = await fetch(process.env.BEHOLD_FEED_URL);
    if (!res.ok) throw new Error(`Behold feed returned ${res.status} ${res.statusText}`);
    return res.json();
  }

  if (process.env.IG_USER_ID && process.env.IG_ACCESS_TOKEN) {
    log('source: Instagram Graph API');
    const fields = [
      'id',
      'caption',
      'media_type',
      'media_url',
      'thumbnail_url',
      'permalink',
      'timestamp',
      'children{media_url,media_type}',
    ].join(',');
    const url =
      `https://graph.instagram.com/v25.0/${process.env.IG_USER_ID}/media` +
      `?fields=${fields}&limit=${MAX_POSTS}` +
      `&access_token=${process.env.IG_ACCESS_TOKEN}`;
    const res = await fetch(url);
    const body = await res.json();
    if (!res.ok) {
      const msg = body?.error?.message ?? `${res.status} ${res.statusText}`;
      throw new Error(`Graph API error: ${msg}`);
    }
    return body;
  }

  return null;
}

/** Both feed shapes, plus a bare array, reduced to one list of posts. */
function normalisePosts(feed) {
  const raw = Array.isArray(feed) ? feed : (feed.posts ?? feed.data ?? []);
  return raw.map((p) => {
    const images = [];
    const push = (u) => {
      if (typeof u === 'string' && u.startsWith('http') && !images.includes(u)) images.push(u);
    };

    // `mediaUrl` is the unoptimised original, so it carries the most detail.
    // Behold's `sizes.full` is capped at 2000px and is the fallback. Both are
    // still bounded by whatever Instagram stored on upload.
    const best = (node) => {
      const kind = String(node?.mediaType ?? node?.media_type ?? '').toUpperCase();
      // A reel's `mediaUrl` is an .mp4. Only its poster frame is an image, and
      // Behold's `sizes` are stills even for video.
      if (kind === 'VIDEO') {
        return (
          node?.thumbnailUrl ??
          node?.thumbnail_url ??
          node?.sizes?.full?.mediaUrl ??
          node?.sizes?.large?.mediaUrl
        );
      }
      return node?.mediaUrl ?? node?.media_url ?? node?.sizes?.full?.mediaUrl ?? node?.sizes?.large?.mediaUrl;
    };

    // A carousel's own `mediaUrl` repeats its first child under a differently
    // signed URL, which the dedupe above cannot see, so the lead photo would
    // appear again in the gallery. Prefer the children when there are any.
    const children = p.children?.data ?? p.children ?? [];
    if (children.length) for (const child of children) push(best(child));
    if (!images.length) push(best(p));
    if (!images.length) push(p.thumbnailUrl ?? p.thumbnail_url);

    return {
      id: String(p.id ?? p.mediaId ?? ''),
      caption: p.caption ?? p.prunedCaption ?? '',
      permalink: p.permalink ?? p.url ?? null,
      mediaType: (p.mediaType ?? p.media_type ?? 'IMAGE').toUpperCase(),
      timestamp: p.timestamp ?? p.takenAt ?? null,
      // Instagram's own alt text, when the feed provides it — better than
      // truncating the caption, which is what we fall back to.
      altText: typeof p.altText === 'string' && p.altText.trim() ? p.altText.trim() : null,
      // Behold extracts hashtags for us; the parser does it too as a fallback.
      hashtags: Array.isArray(p.hashtags) ? p.hashtags.map((h) => String(h).replace(/^#/, '')) : null,
      images,
    };
  });
}

// ------------------------------------------------------------------- helpers

/** Stable, readable slug: the permalink shortcode if we have one, else the id. */
function slugFor(post) {
  const code = post.permalink?.match(/\/(?:p|reel)\/([A-Za-z0-9_-]+)/)?.[1];
  return `ig-${(code ?? post.id).toLowerCase()}`;
}

async function downloadImage(url, destNoExt) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image download failed: ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  // Saving a video as .jpg fails the Astro build rather than the sync, which is
  // a far harder failure to trace back to here. Refuse anything but an image.
  if (!type.startsWith('image/')) throw new Error(`not an image (${type || 'no content-type'})`);
  const ext = type.includes('png') ? '.png' : type.includes('webp') ? '.webp' : '.jpg';
  const dest = destNoExt + ext;
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return path.basename(dest);
}

/** YAML block scalar, indented, so captions with any punctuation stay safe. */
function yamlBlock(text, indent = 4) {
  const pad = ' '.repeat(indent);
  const body = (text || '')
    .split('\n')
    .map((line) => (line.trim() ? pad + line.trimEnd() : ''))
    .join('\n');
  return `|\n${body}`;
}

function quote(s) {
  return JSON.stringify(String(s ?? ''));
}

function buildMarkdown(post, parsed, files, order) {
  const name = parsed.name || 'Untitled';
  const alt = post.altText || parsed.ja?.split('\n')[0]?.slice(0, 140) || name;

  const lines = [
    '---',
    '# AUTO-SYNCED FROM INSTAGRAM — do not edit by hand.',
    '# scripts/sync-instagram.mjs rewrites this file on every run.',
    '# To take ownership of it, change `source` to `atelier`.',
    `# Inference notes: ${parsed.confidence.join('; ')}`,
    'source: instagram',
    `order: ${order}`,
    `photo: ../../assets/instagram/${files[0]}`,
  ];

  if (files.length > 1) {
    lines.push('gallery:');
    for (const f of files.slice(1)) lines.push(`  - ../../assets/instagram/${f}`);
  }

  lines.push(`available: ${!parsed.sold}`);
  if (post.permalink) lines.push(`permalink: ${quote(post.permalink)}`);

  if (parsed.provenance) {
    const p = parsed.provenance;
    lines.push(
      'provenance:',
      `  clothKey: ${p.clothKey}`,
      `  motifKey: ${p.motifKey}`,
      '  cloth:',
      `    ja: ${quote(p.cloth.ja)}`,
      `    en: ${quote(p.cloth.en)}`,
      '  motif:',
      `    ja: ${quote(p.motif.ja)}`,
      `    en: ${quote(p.motif.en)}`,
    );
  }

  for (const lang of ['ja', 'en']) {
    lines.push(
      `${lang}:`,
      `  name: ${quote(parsed.names?.[lang] || name)}`,
      `  alt: ${quote(alt)}`,
      `  story: ${yamlBlock(parsed[lang])}`,
    );
  }

  lines.push('---', '');
  return lines.join('\n');
}

// ---------------------------------------------------------------------- main

async function main() {
  const feed = await fetchFeed();
  if (!feed) {
    log('no feed configured (BEHOLD_FEED_URL or IG_USER_ID + IG_ACCESS_TOKEN).');
    log('skipping sync; existing content left untouched.');
    return;
  }

  await mkdir(IMAGE_DIR, { recursive: true });
  await mkdir(CONTENT_DIR, { recursive: true });

  const posts = normalisePosts(feed)
    .filter((p) => p.id && p.images.length)
    .filter((p) => p.mediaType !== 'VIDEO' || p.images.length > 0)
    .sort((a, b) => String(b.timestamp ?? '').localeCompare(String(a.timestamp ?? '')))
    .slice(0, MAX_POSTS);

  log(`${posts.length} post(s) in feed`);

  const kept = new Set();
  const skipped = [];
  let order = 100;

  for (const post of posts) {
    const slug = slugFor(post);

    if (REQUIRED_TAG) {
      // Use the feed's own extracted hashtags when present, else parse them.
      const tags = (post.hashtags ?? parseCaption(post.caption).tags).map((t) =>
        t.toLowerCase(),
      );
      if (!tags.includes(REQUIRED_TAG)) {
        skipped.push(`${slug}: missing #${REQUIRED_TAG}`);
        continue;
      }
    }

    if (!looksLikeProduct(post.caption)) {
      skipped.push(`${slug}: reads as an announcement, not a garment`);
      continue;
    }

    const parsed = parseCaption(post.caption);

    // Carousels: first image leads, the rest become the gallery (cap at 4).
    const files = [];
    for (const [i, url] of post.images.slice(0, 4).entries()) {
      try {
        files.push(await downloadImage(url, path.join(IMAGE_DIR, `${slug}-${i + 1}`)));
      } catch (err) {
        log(`WARN ${slug} image ${i + 1}: ${err.message}`);
      }
    }
    if (!files.length) {
      skipped.push(`${slug}: no image could be downloaded`);
      continue;
    }

    order += 1;
    await writeFile(
      path.join(CONTENT_DIR, `${slug}.md`),
      buildMarkdown(post, parsed, files, order),
      'utf8',
    );
    kept.add(slug);
    log(`wrote ${slug}.md  (${parsed.confidence.length} caveat(s))`);
  }

  // Remove auto-synced entries whose post has gone from the feed. Entries
  // adopted by changing `source` to `atelier` are left alone.
  for (const file of await readdir(CONTENT_DIR)) {
    if (!file.startsWith('ig-') || !file.endsWith('.md')) continue;
    const slug = file.replace(/\.md$/, '');
    if (kept.has(slug)) continue;
    const body = await readFile(path.join(CONTENT_DIR, file), 'utf8');
    if (!/^source:\s*instagram\s*$/m.test(body)) {
      log(`keeping ${file} — adopted as an atelier entry`);
      continue;
    }
    await unlink(path.join(CONTENT_DIR, file));
    log(`removed ${file} — no longer in the feed`);
  }

  if (skipped.length) {
    log(`skipped ${skipped.length}:`);
    for (const s of skipped) log('  -', s);
  }
  log('done.');
}

/** CI sets this; a hand-run sync stays strict so real errors are visible. */
const ALLOW_FAILURE = /^(1|true|yes|on)$/i.test(process.env.SYNC_ALLOW_FAILURE ?? '');

main().catch((err) => {
  console.error('[instagram] FAILED:', err.message);
  if (!ALLOW_FAILURE) {
    process.exitCode = 1;
    return;
  }
  // A dead or expired feed must not take a published site down: leave whatever
  // content is already on disk in place and let the build carry on.
  console.error('[instagram] SYNC_ALLOW_FAILURE is set, so this is a warning, not an error.');
  console.error('[instagram] building with the pieces already in src/content/pieces/.');
});
