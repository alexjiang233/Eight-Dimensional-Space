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

test('footer keeps compact work/member navigation and links have no arrows', () => {
  const pages = createSite(catalog);
  for (const [path, html] of pages) {
    const footer = html.match(/<footer class="site-footer full-footer">([\s\S]*?)<\/footer>/)[1];
    for (const target of pages.keys()) {
      if (/^\/(works|people)\/[^/]+\/$/.test(target)) {
        assert.ok(!footer.includes(`href="${target}"`), `${path}: footer must not list individual works or members`);
        continue;
      }
      assert.ok(footer.includes(`href="${target}"`), `${path}: footer missing ${target}`);
    }
    const groups = [...footer.matchAll(/<section><h2>[\s\S]*?<\/h2><ul>([\s\S]*?)<\/ul><\/section>/g)];
    assert.equal((groups[1][1].match(/<li>/g) || []).length, 4);
    assert.equal((groups[3][1].match(/<li>/g) || []).length, 2);
    for (const link of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)) {
      assert.ok(!/[↗↘↙↖→←↑↓➜➝➔➞⇒]/u.test(link[1].replace(/<[^>]*>/g, '')), `${path}: navigation arrow`);
    }
  }
});

test('full films use bilibili; only the home cover hosts a short silent loop', () => {
  const pages = createSite(catalog);
  for (const [path, html] of pages) {
    assert.equal((html.match(/<video\b/g) || []).length, path === '/' ? 1 : 0, path);
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
  assert.ok(home.includes('data-hero-video'));
  assert.ok(home.includes('muted loop playsinline preload="none"'));
  assert.ok(home.includes('data-hero-toggle'));
  const loop = catalog.media.find(m => m.id === catalog.site.heroVideoId);
  assert.equal(loop.duration, 18);
  assert.equal(loop.purpose, 'cover-loop');
});

test('a GitHub Pages sub-path base prefixes every emitted URL without changing logical routes', () => {
  const pages = createSite(catalog, { base: '/Eight-Dimensional-Space/' });
  assert.ok(pages.has('/'));
  const home = pages.get('/');
  assert.ok(home.includes('href="/Eight-Dimensional-Space/app.css"'));
  assert.ok(home.includes('src="/Eight-Dimensional-Space/app.js"'));
  assert.ok(home.includes('src="/Eight-Dimensional-Space/promo/poster.jpg"'));
  assert.ok(home.includes('data-src="/Eight-Dimensional-Space/promo/hero-loop.mp4"'));
  assert.ok(home.includes('poster="/Eight-Dimensional-Space/promo/poster.jpg"'));
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

test('bilibili import uses video ownership, excludes unrelated personal uploads and keeps existing works unique', () => {
  const imported = catalog.works.filter((work) => work.id.startsWith('bili-'));
  assert.equal(imported.length, 55);
  assert.equal(imported.filter((work) => work.sourceAccount === 'club').length, 40);
  assert.equal(imported.filter((work) => work.sourceAccount === 'personal').length, 15);
  for (const bvid of ['BV11AmZBpEWU', 'BV1XsSUY9E7b', 'BV1gs6JBuEav', 'BV18vNH64EnS', 'BV193dWBtEuN', 'BV15bfuBhErh', 'BV1GubDznET8', 'BV1b142197GN']) {
    assert.ok(!imported.some((work) => work.id.endsWith(bvid.toLowerCase())), bvid);
    assert.ok(!catalog.media.some((media) => media.bvid === bvid), bvid);
  }
  for (const bvid of ['BV1pWhP6wE67', 'BV1xwKr6yE9G']) {
    assert.equal(imported.filter((work) => catalog.media.find((m) => m.id === work.mediaId)?.bvid === bvid).length, 0, bvid);
  }
  for (const work of imported.filter((item) => item.sourceAccount === 'personal')) {
    assert.deepEqual(work.authorIds, ['person-jky'], work.id);
    assert.ok(work.credits.every((credit) => credit.role === '拍摄' && credit.memberId === 'person-jky'), work.id);
    assert.ok(work.publishedAt, work.id);
  }
  const clubWork = imported.find((work) => work.id.endsWith('bv1xz8u6jebc'));
  assert.equal(clubWork.sourceAccount, 'club');
  assert.deepEqual(clubWork.authorIds, []);
  assert.equal(clubWork.eventId, 'military-2026');
});

test('the personal review compilation is taken down without residue', () => {
  assert.ok(!catalog.works.some((work) => work.id === 'bili-personal-bv1bcqrbweqj'));
  assert.ok(!catalog.media.some((media) => media.bvid === 'BV1bcqrBWEQj'));
  assert.ok(!catalog.sources.some((source) => source.id === 'source-bili-bv1bcqrbweqj'));
  const pages = createSite(catalog);
  assert.ok(!pages.has('/works/bili-personal-bv1bcqrbweqj/'));
  for (const [path, html] of pages) assert.ok(!html.includes('BV1bcqrBWEQj'), path);
});

test('sports meeting videos merge into one work per year with real event pages', () => {
  const merged = catalog.works.find((work) => work.id === 'sports-2025-videos');
  assert.ok(merged);
  assert.equal(merged.eventId, 'sports-2025');
  assert.equal(merged.videos.length, 3);
  assert.deepEqual(
    merged.videos.map((video) => video.mediaId),
    ['embed-bili-bv1s3nkzqena', 'embed-bili-bv1sqntzwedv', 'embed-bili-bv1xsnyzqee8'],
  );
  for (const id of ['bili-club-bv1s3nkzqena', 'bili-personal-bv1sqntzwedv', 'bili-personal-bv1xsnyzqee8']) {
    assert.ok(!catalog.works.some((work) => work.id === id), id);
  }
  for (const mediaId of merged.videos.map((video) => video.mediaId)) {
    assert.ok(catalog.media.some((media) => media.id === mediaId), mediaId);
  }
  const cctv = catalog.works.find((work) => work.id === 'bili-club-bv1uoy8ypete');
  assert.equal(cctv.eventId, 'sports-2024');
  const pages = createSite(catalog);
  const work = pages.get('/works/sports-2025-videos/');
  for (const bvid of ['BV1S3nkzqEna', 'BV1sqntzWEDV', 'BV1xsnyzqEe8']) {
    assert.ok(work.includes(`bvid=${bvid}&`), bvid);
  }
  assert.ok(work.includes('收录视频'));
  assert.ok(work.includes('无体育，不淮一'));
  const event = pages.get('/events/sports-2025/');
  assert.ok(event.includes('2025年秋季运动会'));
  assert.ok(event.includes('第三十三届体育节'));
  assert.ok(event.includes('2025-09-29'));
  assert.ok(event.includes('/works/sports-2025-videos/'));
  assert.ok(event.includes('观看收录视频'));
  assert.ok(!event.includes('观看所在宣传片'));
  const event2024 = pages.get('/events/sports-2024/');
  assert.ok(event2024.includes('2024年校运会'));
  assert.ok(event2024.includes('/works/bili-club-bv1uoy8ypete/'));
  assert.ok(!event2024.includes('现场配图'));
  assert.ok(!event2024.includes('0 幅'));
  const home = pages.get('/');
  assert.ok(home.includes('收录视频 · 在线播放'));
  const person = pages.get('/people/person-wxn/');
  assert.ok(person.includes('/works/sports-2025-videos/'));
});

test('multi-line descriptions keep every cross-line credit and teachers do not become members', () => {
  const sports = catalog.works.find((item) => item.id === 'bili-club-bv1uoy8ypete');
  const roleNames = (role) => sports.credits.filter((credit) => credit.role === role).map((credit) => credit.name);
  assert.deepEqual(roleNames('拍摄'), ['张牧荑', '徐诺', '耿云帆', '纪宇彤']);
  assert.deepEqual(roleNames('航拍'), ['王子博', '郭铭珺']);
  assert.deepEqual(roleNames('稳定器'), ['郭歌', '范文', '李欣逾', '荣佳凝']);
  assert.ok(sports.credits.every((credit) => credit.sourceDescription && credit.sourceDescription.includes(credit.name)));
  const teacher = sports.credits.find((credit) => credit.name === '丁源老师');
  assert.ok(teacher);
  assert.equal(teacher.memberId, null);
  assert.ok(!catalog.members.some((member) => member.name === '丁源老师'));
  const newYear = catalog.works.find((item) => item.id === 'bili-club-bv1zd6vyvemj');
  assert.equal(newYear.credits.filter((credit) => credit.role === '拍摄').length, 8);
  assert.ok(newYear.credits.every((credit) => credit.sourceDescription.includes('拍摄组成员')));
});

test('work pages show real cover, upload date, expandable original description, parts and visible credits', () => {
  const pages = createSite(catalog);
  const html = pages.get('/works/bili-club-bv1uoy8ypete/');
  for (const text of ['B站封面', '/media/bili-BV1uoy8YpETE.jpg', '投稿日期', '2024-10-20', 'B站原简介', '制作署名', '张牧荑', '稳定器', '在哔哩哔哩打开']) {
    assert.ok(html.includes(text), text);
  }
  assert.ok(html.includes('player.bilibili.com/player.html?bvid=BV1uoy8YpETE&amp;page=1'));
  const replay = pages.get('/works/military-replay/');
  for (const name of ['蒋凯阳', '杜文博', '李牧耕', '苏明君', '郑钰涵', '王浩宇']) assert.ok(replay.includes(name), name);
  assert.ok(replay.includes('制作署名'));
  const teaser = pages.get('/works/bili-club-bv1xz8u6jebc/');
  assert.ok(!teaser.includes('<h2>制作署名</h2>'), 'event crew does not imply credits on its teaser');
  const person = pages.get('/people/person-lrh/');
  assert.ok(person.includes('/works/bili-club-bv1zd6vyvemj/'));
  assert.ok(person.includes('/works/bili-club-bv1uoy8ypete/') === false);
});

test('the work directory filters every imported film and replay without pushing the catalogue onto the home page', () => {
  const pages = createSite(catalog);
  const directory = pages.get('/works/');
  for (const kind of ['film', 'replay', 'photos']) {
    const count = catalog.works.filter((work) => work.kind === kind).length;
    assert.equal((directory.match(new RegExp(`data-kind="${kind}"`, 'g')) || []).length, count, kind);
    assert.ok(directory.includes(`data-filter="${kind}"`));
  }
  assert.ok(catalog.works.filter((work) => work.kind === 'replay' && work.id.startsWith('bili-')).length > 10);
  const home = pages.get('/');
  assert.ok(home.includes('2026 社团宣传片'));
  // The archive row may show an event cover whose alt names its video; what must
  // stay off the home page is the catalogue itself, i.e. work-page links.
  assert.ok(!home.includes('/works/bili-club-bv1uoy8ypete/'));
  assert.ok(!home.includes('初雪校园'));
});
