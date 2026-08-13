#!/usr/bin/env node
/**
 * Checks the caption parser against realistic captions.
 * Run with: npm run sync:test
 *
 * The parser is the risky part of the Instagram pipeline — a caption is prose
 * and the site wants structured fields. These cases pin down what it does.
 */

import assert from 'node:assert/strict';
import { parseCaption, looksLikeProduct, splitLanguages } from './lib/caption.mjs';

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL ${name}\n       ${err.message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------

console.log('\nbilingual garment post');
{
  const caption = `青い鳥のドレス

黒地の縮緬に、松に飛び鶴の文様。裾には宝尽くしが細かく描かれています。
一点物です。

Blue Bird Dress

Black chirimen silk, with cranes in flight over pine.
One of a kind.

#kimonolab #kimonolab_piece #着物リメイク #一点物`;

  const r = parseCaption(caption);
  check('name is the first line', () => assert.equal(r.name, '青い鳥のドレス'));
  check('japanese text captured', () => assert.match(r.ja, /縮緬/));
  check('english text captured', () => assert.match(r.en, /Blue Bird Dress/));
  check('japanese and english separated', () => assert.doesNotMatch(r.en, /縮緬/));
  check('hashtags stripped from prose', () => assert.doesNotMatch(r.ja, /#/));
  check('cloth detected as chirimen', () => assert.equal(r.provenance.clothKey, 'chirimen'));
  check('paired motif beats bare crane', () =>
    assert.equal(r.provenance.motifKey, 'tsuru-matsu'));
  check('tags collected', () => assert.ok(r.tags.includes('kimonolab_piece')));
  check('not marked sold', () => assert.equal(r.sold, false));
  check('era never inferred', () =>
    assert.ok(r.confidence.some((c) => /era and region never inferred/.test(c))));
}

console.log('\npop-up announcement must not become a product');
{
  const caption = `POPUP 6月 omotesando

表参道にてポップアップを開催します。ぜひお立ち寄りください。
#kimonolab`;
  check('filtered out', () => assert.equal(looksLikeProduct(caption), false));
}

console.log('\nsold post');
{
  const caption = `花車のドレス  SOLD OUT
正絹、花車に熨斗の文様。
#kimonolab_piece`;
  const r = parseCaption(caption);
  check('detected as sold', () => assert.equal(r.sold, true));
  check('cloth falls back to generic silk label', () =>
    assert.equal(r.provenance.clothKey, 'shoken'));
  check('flower cart motif detected', () =>
    assert.equal(r.provenance.motifKey, 'hanaguruma'));
}

console.log('\nbare caption with no useful keywords');
{
  const r = parseCaption('新作です✨\n#kimonolab');
  check('still yields a name', () => assert.equal(r.name, '新作です'));
  check('no provenance invented', () => assert.equal(r.provenance, null));
  check('caveat recorded for missing keywords', () =>
    assert.ok(r.confidence.some((c) => /no cloth or motif/.test(c))));
  check('monolingual caveat recorded', () =>
    assert.ok(r.confidence.some((c) => /one language/.test(c))));
}

console.log('\njapanese-only caption falls back for english pages');
{
  const s = splitLanguages('黒地の綸子に桜の文様。');
  check('english falls back to japanese', () => assert.equal(s.en, s.ja));
  check('flagged as monolingual', () => assert.equal(s.monolingual, true));
}

console.log('\nemoji and decoration stripped from the name');
{
  const r = parseCaption('◆ 鶴のドレス ✨\n正絹です');
  check('leading decoration removed', () => assert.equal(r.name, '鶴のドレス'));
}

// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
