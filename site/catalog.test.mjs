import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { loadCatalog } from './content-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSite, validateCatalog, escape } from './render.mjs';
const catalog = await loadCatalog();

test('published source facts stay separate from missing photo credits and conflicting roles', () => {
  const event = catalog.events.find((e) => e.id === 'military-2026');
  assert.equal(event.teamSize, 7);
  assert.equal(event.contributions.length, 6);
  assert.match(event.contributions.find((c) => c.memberId === 'person-dwb').note, /正文/);
  assert.ok(
    catalog.media
      .filter((m) => m.kind === 'image' && m.sourceId !== 'source-photo-selection')
      .every((m) => m.photographer === null && m.capturedAt === null),
  );
  assert.deepEqual(catalog.works.find((w) => w.id === 'military-photos').authorIds, []);
  assert.match(catalog.works.find((w) => w.kind === 'replay').notice, /声音丢失/);
});

test('adding one event and contribution generates its page, list entry and existing member history in the active site', () => {
  const data = structuredClone(catalog);
  data.events.push({
    id: 'fixture-only',
    title: '仅用于测试的活动',
    fullTitle: '仅用于测试的活动',
    year: 2027,
    date: null,
    place: null,
    teamSize: null,
    cameraCount: null,
    coverId: 'article-08',
    groupId: null,
    galleryIds: ['article-08'],
    workIds: [],
    noteIds: [],
    sourceId: 'source-review',
    summary: '测试数据，不进入预览构建。',
    contributions: [{ memberId: 'person-jky', role: '测试职责', source: '隔离测试' }],
  });
  const pages = createSite(data);
  for (const skin of ['editorial']) {
    assert.match(pages.get(`/events/fixture-only/`), /仅用于测试的活动/);
    assert.ok(pages.get(`/events/`).includes(`/events/fixture-only/`));
    assert.ok(pages.get(`/people/person-jky/`).includes(`/events/fixture-only/`));
    assert.ok(pages.get(`/`).includes(`/events/fixture-only/`));
  }
  assert.ok(!catalog.events.some((ev) => ev.id === 'fixture-only'));
});

test('dangling content references and duplicate identities stop generation', () => {
  const missing = structuredClone(catalog);
  missing.events[0].contributions[0].memberId = 'missing-person';
  assert.throws(() => validateCatalog(missing), /Missing members/);
  const duplicate = structuredClone(catalog);
  duplicate.media.push(duplicate.media[0]);
  assert.throws(() => validateCatalog(duplicate), /duplicate/);
});

test('photo collections keep original metadata and management credits do not imply event attendance', () => {
  const pages = createSite(catalog);
  const photos = catalog.media.filter(m => m.sourceId === 'source-photo-selection');
  assert.equal(photos.length, 15);
  assert.ok(photos.every(m => m.exif && m.photographer === null && !('source' in m) && !('sha256' in m)));
  const collection = pages.get('/works/campus-photos/');
  assert.match(collection, /data-exif=/);
  assert.match(collection, /2025-07-06/);
  const member = pages.get('/people/person-wxn/');
  assert.match(member, /2025级 \/ 社长/);
  assert.ok(!member.includes('class="event-list"'));
  assert.ok(!member.includes('军训团队合影'));
  assert.match(pages.get('/notes/broadcast-guide/'), /制作资料 \/ 原文/);
});

test('all same-origin page links and fragment targets resolve in the generated site', () => {
  const pages = createSite(catalog);
  for (const [path, html] of pages) {
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1, path);
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      const href = match[1];
      if (!href.startsWith('/') && !href.startsWith('#')) continue;
      const resolved = new URL(href, 'http://localhost' + path);
      if (
        /^\/(media|promo|photos|fonts)\//.test(resolved.pathname) ||
        /\.(css|js)$/.test(resolved.pathname)
      )
        continue;
      assert.ok(pages.has(resolved.pathname), `${path} -> ${href}`);
      if (resolved.hash)
        assert.ok(
          pages.get(resolved.pathname).includes(`id="${resolved.hash.slice(1)}"`),
          `${path} missing ${href}`,
        );
    }
  }
});

test('guide pages contain every imported paragraph and table, including unfinished original sections', () => {
  const pages = createSite(catalog);
  for (const doc of catalog.documents) {
    for (const skin of ['editorial']) {
      const note = catalog.notes.find(note => note.documentId === doc.id);
      const html = pages.get(`/notes/${note.id}/`);
      assert.ok(html.includes(escape(doc.dateLabel)));
      for (const block of doc.blocks) {
        assert.ok(html.includes(`data-source-index="${block.sourceIndex}"`));
        for (const text of block.type === 'table' ? block.rows.flat() : [block.text]) {
          assert.ok(html.includes(escape(text)), `${doc.id}: missing source paragraph ${block.sourceIndex}`);
        }
      }
      assert.ok(!html.includes('内容提要'));
    }
  }
  const broadcast = catalog.documents.find(doc => doc.id === 'broadcast-guide');
  assert.equal(broadcast.dateLabel, '2026.1.18');
  assert.equal(broadcast.sourceName, '如何完成一场活动直播？.md');
  assert.ok(broadcast.blocks.some(block => block.text?.includes('4.导播话术规范')));
  assert.ok(broadcast.blocks.some(block => block.text?.includes('i7-12700H+RTX 3060')));
  assert.ok(catalog.documents.find(doc => doc.id === 'full-review-guide').blocks.some(block => block.type === 'table'));
});

test('all pages expose every first and second level page in the footer and navigation links have no arrows', () => {
  const pages = createSite(catalog);
  for (const [path, html] of pages) {
    const footer = html.match(/<footer class="site-footer full-footer">([\s\S]*?)<\/footer>/)[1];
    for (const target of pages.keys()) {
      assert.ok(footer.includes(`href="${target}"`), `${path}: footer missing ${target}`);
    }
    for (const link of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)) {
      assert.ok(!/[↗↘↙↖→←↑↓➜➝➔➞⇒]/u.test(link[1].replace(/<[^>]*>/g, '')), `${path}: navigation arrow`);
    }
  }
});

test('video playback is an online bilibili embed and no local video files remain', () => {
  const pages = createSite(catalog);
  for (const [path, html] of pages) {
    assert.ok(!html.includes('<video'), path);
    assert.ok(!/\/promo\/(film|preview)\.mp4/.test(html), path);
    assert.ok(!html.includes('data-preview-toggle'), path);
  }
  for (const skin of ['editorial']) {
    const event = pages.get(`/events/military-2026/`);
    assert.ok(event.includes('player.bilibili.com/player.html?bvid=BV1pWhP6wE67'));
    const replay = pages.get(`/works/military-replay/`);
    assert.ok(replay.includes('player.bilibili.com/player.html?bvid=BV1pWhP6wE67'));
    assert.ok(replay.includes('声音丢失'));
    const promo = pages.get(`/works/promo-2026/`);
    assert.ok(promo.includes('player.bilibili.com/player.html?bvid=BV1xwKr6yE9G'));
  }
  const home = pages.get('/');
  assert.ok(home.includes('data-film'));
  assert.ok(home.includes('BV1xwKr6yE9G'));
  assert.ok(home.includes('hero-still'));
});

test('a GitHub Pages sub-path base prefixes every emitted URL without changing logical routes', () => {
  const pages = createSite(catalog, { base: '/Eight-Dimensional-Space/' });
  assert.ok(pages.has('/'));
  const home = pages.get('/');
  assert.ok(home.includes('href="/Eight-Dimensional-Space/app.css"'));
  assert.ok(home.includes('src="/Eight-Dimensional-Space/app.js"'));
  assert.ok(home.includes('src="/Eight-Dimensional-Space/promo/poster.jpg"'));
  assert.ok(home.includes('href="/Eight-Dimensional-Space/works/promo-2026/"'));
  assert.ok(!home.includes('href="/app.css"'));
  const event = pages.get('/events/military-2026/');
  assert.ok(event.includes('src="/Eight-Dimensional-Space/media/'));
  assert.ok(event.includes('player.bilibili.com'));
  assert.ok(event.includes('href="/Eight-Dimensional-Space/notes/military-review/"'));
  const people = pages.get('/people/');
  assert.ok(people.includes('href="/Eight-Dimensional-Space/people/'));
});

test('military event is a substantive connected record, with facts and unresolved problems rather than a repeated gallery', () => {
  const pages = createSite(catalog);
  const story = catalog.stories.find(item => item.id === 'military-2026');
  assert.equal(story.costs.reduce((total, item) => total + item.amount, 0), 1500);
  for (const skin of ['editorial']) {
    const html = pages.get(`/events/military-2026/`);
    for (const id of ['watch','preparation','positions','execution','review','crew']) assert.ok(html.includes(`id="${id}"`));
    for (const detail of ['少算了一根','实时语音字幕','原因尚未确定','没有制作横版海报','1500元']) assert.ok(html.includes(detail));
    assert.ok(html.includes(`/notes/military-review/`));
    assert.ok(!html.includes('class="compare-choices"'));
    assert.ok(!html.includes('data-film'));
    assert.ok(html.includes('mp.weixin.qq.com/s/CjHsHVzWDHz_vD516HBFyA'));
    assert.ok(html.includes('https://www.bilibili.com/video/BV1pWhP6wE67/'));
    assert.ok(html.includes('1:53:06'));
    assert.ok(!html.includes('打开原文内回放'));
    const review = pages.get(`/notes/military-review/`);
    assert.ok(review.includes('1.1 方案'));
    assert.ok(review.includes('总花费1500元'));
    assert.ok(review.includes('撞上树桩的猪-杂谈随笔'));
  }
});


test('font and responsive QA URLs resolve inside both root and project mounts', async () => {
  const css = await readFile(new URL('./app.css', import.meta.url), 'utf8');
  const wrapper = await readFile(new URL('./responsive.html', import.meta.url), 'utf8');
  const script = wrapper.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const mount of ['/', '/Eight-Dimensional-Space/']) {
    for (const [, asset] of css.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)) {
      const resolved = new URL(asset, 'http://localhost' + mount + 'app.css');
      assert.ok(resolved.pathname.startsWith(mount + 'fonts/'), resolved.href);
    }
    const elements = new Map();
    const element = selector => {
      if (!elements.has(selector)) elements.set(selector, { style: {}, addEventListener() {} });
      return elements.get(selector);
    };
    runInNewContext(script, {
      URL, URLSearchParams,
      location: { pathname: mount + 'responsive.html', search: '?page=events/military-2026/', href: 'http://localhost' + mount + 'responsive.html', origin: 'http://localhost' },
      document: { querySelector: element }, window: { addEventListener() {} }, history: { replaceState() {} },
    });
    assert.equal(element('iframe').src, mount + 'events/military-2026/');
  }
});


test('the root serves a real home page with no theme prefix, redirect or alternate routes', () => {
  const pages = createSite(catalog);
  assert.ok(pages.get('/').includes('class="hero hero-editorial"'));
  assert.ok(!/http-equiv="refresh"|进入八维空间/.test(pages.get('/')));
  assert.equal(pages.size, 6 + catalog.events.length + catalog.works.length + catalog.members.length + catalog.notes.length);
  for (const [path, html] of pages) {
    assert.ok(!path.startsWith('/editorial/'));
    assert.ok(!/industrial|工业版|工业试作|skin-link|data-skin-switch|monitor-wall|\/editorial\//.test(html), path);
  }
});
