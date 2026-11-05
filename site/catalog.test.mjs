import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { loadCatalog } from './content-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSite, validateCatalog, escape } from './render.mjs';
import { planBilibiliImport, appendImportedContent } from './bilibili-import-policy.mjs';
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
  assert.equal(photos.length, 11);
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

test('footer stays compact with section entries only', () => {
  const pages = createSite(catalog);
  for (const [path, html] of pages) {
    const footer = html.match(/<footer class="site-footer full-footer">([\s\S]*?)<\/footer>/)[1];
    // No per-item listings: events, works, notes and members link to their index.
    for (const target of pages.keys()) {
      if (/^\/(works|people|events|notes)\/[^/]+\/$/.test(target)) {
        assert.ok(!footer.includes(`href="${target}"`), `${path}: footer must not list individual pages (${target})`);
      }
    }
    for (const target of ['/', '/about/', '/works/', '/events/', '/people/', '/notes/']) {
      assert.ok(footer.includes(`href="${target}"`), `${path}: footer missing ${target}`);
    }
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
  assert.equal(pages.size, 6 + catalog.events.length + catalog.works.length + new Set(catalog.appointments.map(a => a.memberId)).size + catalog.notes.length);
  for (const [path, html] of pages) {
    assert.ok(!path.startsWith('/editorial/'));
    assert.ok(!/industrial|工业版|工业试作|skin-link|data-skin-switch|monitor-wall|\/editorial\//.test(html), path);
  }
});

test('bilibili import uses video ownership, excludes unrelated personal uploads and keeps existing works unique', () => {
  const imported = catalog.works.filter((work) => work.id.startsWith('bili-'));
  assert.equal(imported.length, 26);
  assert.equal(imported.filter((work) => work.sourceAccount === 'club').length, 18);
  assert.equal(imported.filter((work) => work.sourceAccount === 'personal').length, 8);
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
  const eventsIndex = pages.get('/events/');
  assert.ok(eventsIndex.includes('id="series-sports"'));
  const person = pages.get('/people/person-wxn/');
  assert.ok(person.includes('/works/sports-2025-videos/'));
});

test('recurring activities group into series with merged recordings and year switchers', () => {
  const pages = createSite(catalog);
  // Nine series cover the recurring activities; standalone records stay out.
  assert.equal(catalog.series.length, 8);
  const seriesEvents = catalog.events.filter((ev) => ev.seriesId);
  assert.equal(seriesEvents.length, 23);
  for (const s of catalog.series) assert.ok(seriesEvents.some((ev) => ev.seriesId === s.id), s.id);
  // Merged recordings: chorus per festival, plaza 2025, football league, debate.
  const merged = [
    ['chorus-2024-videos', 'chorus-2024', 2],
    ['chorus-2025-videos', 'chorus-2025', 2],
    ['plaza-2025-videos', 'plaza-2025', 2],
    ['football-2025-videos', 'football-2025', 4],
    ['debate-videos', 'debate-2026', 2],
  ];
  for (const [id, eventId, count] of merged) {
    const work = catalog.works.find((w) => w.id === id);
    assert.ok(work, id);
    assert.equal(work.eventId, eventId);
    assert.equal(work.videos.length, count);
    const html = pages.get(`/works/${id}/`);
    assert.ok(html.includes('收录视频'), id);
    for (const v of work.videos) {
      const media = catalog.media.find((m) => m.id === v.mediaId);
      assert.ok(html.includes(`bvid=${media.bvid}&`), `${id}/${media.bvid}`);
    }
  }
  // Single-video works attach to their new event pages.
  for (const [workId, eventId] of [
    ['bili-club-bv1aqtue6erh', 'sinoaus-2024'],
    ['bili-club-bv1tpak62eqg', 'sinoaus-2026'],
    ['bili-club-bv1k9iiyuewn', 'random-dance-2024'],
    ['bili-club-bv1p4omy2eux', 'random-dance-2025'],
    ['bili-club-bv1osgu6yexd', 'random-dance-2026'],
    ['bili-club-bv127421f7kq', 'classroom-drama-2024'],
    ['bili-club-bv1cogtzwet1', 'classroom-drama-2025'],
    ['bili-club-bv1zurdbbe42', 'classroom-drama-2026'],
    ['bili-club-bv1ge4m1r7gj', 'music-fest-2024'],
    ['bili-club-bv1wnqwbuevt', 'music-fest-2026'],
    ['bili-club-bv1pjrrb8emf', 'plaza-2026'],
  ]) {
    assert.equal(catalog.works.find((w) => w.id === workId).eventId, eventId, workId);
    assert.ok(pages.has(`/events/${eventId}/`), eventId);
  }
  // Dissolved standalones are gone; their players live in merged pages.
  for (const id of ['bili-club-bv1bt421w7yy', 'bili-club-bv1yx4y1a7bx', 'bili-club-bv1xnbyb3eu1', 'bili-club-bv1hkbtbhela', 'bili-club-bv1ivxyy4evj', 'bili-club-bv1eel2zdeti', 'bili-club-bv1exebzleby', 'bili-personal-bv1z4lxz9ewy', 'bili-personal-bv1rvekzjed9', 'bili-personal-bv1yfeqzxe7z', 'bili-club-bv1lnm2bgetb', 'bili-club-bv1njqpb8ems']) {
    assert.ok(!catalog.works.some((w) => w.id === id), id);
    assert.ok(!pages.has(`/works/${id}/`), id);
  }
  // The events index reads as series blocks with year switchers, plus standalone records.
  const index = pages.get('/events/');
  for (const s of catalog.series) assert.ok(index.includes(`id="series-${s.id}"`), s.id);
  assert.ok(index.includes('data-series-year'));
  assert.ok(index.includes('其他现场'));
  // Event pages carry same-series year navigation with the current year marked.
  const gala2025 = pages.get('/events/gala-2025/');
  assert.ok(gala2025.includes('event-series-years'));
  assert.ok(gala2025.includes('is-current'));
  assert.ok(gala2025.includes('/events/gala-2024/') && gala2025.includes('/events/gala-2026/'));
  // Merged chorus keeps both shows; football keeps personal-channel notes.
  const chorus = pages.get('/works/chorus-2025-videos/');
  assert.ok(chorus.includes('高一场') && chorus.includes('高二场'));
  const football = pages.get('/works/football-2025-videos/');
  assert.ok(football.includes('个人频道'));
  assert.ok(football.includes('12班-15班'));
});

test('annual signature events merge per year with real event pages', () => {
  const mergedIds = [
    'psychodrama-2026-videos', 'psychodrama-2025-videos', 'psychodrama-2024-videos',
    'gala-2026-videos', 'gala-2025-videos', 'gala-2024-videos',
    'morning-run-2024',
  ];
  const pages = createSite(catalog);
  for (const id of mergedIds) {
    const work = catalog.works.find((item) => item.id === id);
    assert.ok(work, id);
    assert.ok(work.videos.length >= 2, id);
    for (const video of work.videos) assert.ok(catalog.media.some((m) => m.id === video.mediaId), `${id}/${video.mediaId}`);
    const html = pages.get(`/works/${work.id}/`);
    assert.ok(html.includes('收录视频'), id);
    for (const video of work.videos) {
      const media = catalog.media.find((m) => m.id === video.mediaId);
      assert.ok(html.includes(`bvid=${media.bvid}&`), `${id}/${media.bvid}`);
    }
  }
  // Dissolved standalones are gone; their players only live in merged pages.
  for (const id of ['bili-club-bv1qdev6neqz', 'bili-club-bv1jivubdepi', 'bili-club-bv1zd6vyvemj', 'bili-club-bv1qx4yeeek5', 'bili-personal-bv1bni3bnenc', 'bili-personal-bv1rnqzbyent']) {
    assert.ok(!catalog.works.some((work) => work.id === id), id);
    assert.ok(!pages.has(`/works/${id}/`), id);
  }
  // Event pages per year.
  const checks = [
    ['gala-2026', '2026年元旦文艺汇演', '2025-12-30', 'gala-2026-videos'],
    ['gala-2025', '2025年元旦文艺汇演', '2024-12-30', 'gala-2025-videos'],
    ['gala-2024', '2024年元旦文艺汇演', '2023-12-29', 'gala-2024-videos'],
    ['psychodrama-2026', '第十二届校园心理剧大赛', '2026-04-22', 'psychodrama-2026-videos'],
    ['psychodrama-2025', '第十一届校园心理剧大赛', '2025-04-09', 'psychodrama-2025-videos'],
    ['psychodrama-2024', '第十届校园心理剧大赛', '2024-04-10', 'psychodrama-2024-videos'],
  ];
  for (const [eventId, title, date, workId] of checks) {
    const event = catalog.events.find((ev) => ev.id === eventId);
    assert.ok(event, eventId);
    assert.equal(event.title, title);
    assert.equal(event.date, date);
    assert.deepEqual(event.workIds, [workId]);
    const html = pages.get(`/events/${eventId}/`);
    assert.ok(html.includes(title));
    assert.ok(html.includes(`/works/${workId}/`));
    assert.ok(html.includes('观看收录视频'));
    assert.ok(html.includes('收录作品'));
    assert.ok(!html.includes('现场配图'));
  }
  // The run merge stays a standalone work labelled 2024, without an event page.
  const run = catalog.works.find((work) => work.id === 'morning-run-2024');
  assert.equal(run.eventId, null);
  assert.equal(run.year, 2024);
  assert.equal(run.title, '2024年跑操');
  // The 2026 gala keeps the full crew credits from the live shows plus the personal shorts.
  const gala26 = catalog.works.find((work) => work.id === 'gala-2026-videos');
  assert.ok(gala26.credits.some((credit) => credit.name === '王小诺' && credit.role === '社长'));
  assert.ok(gala26.credits.some((credit) => credit.name === '蒋凯阳' && credit.role === '拍摄'));
  // The 2025 gala keeps its eight-person camera team as credits.
  const gala25 = catalog.works.find((work) => work.id === 'gala-2025-videos');
  assert.equal(gala25.credits.filter((credit) => credit.role === '拍摄').length, 8);
  assert.ok(gala25.credits.every((credit) => credit.sourceDescription.includes('拍摄组成员')));
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
  const gala26 = catalog.works.find((item) => item.id === 'gala-2026-videos');
  const teacher26 = gala26.credits.find((credit) => credit.name === '丁老师');
  assert.ok(teacher26);
  assert.equal(teacher26.memberId, null);
});

test('work pages show the player, upload facts, expandable original description, parts and visible credits', () => {
  const pages = createSite(catalog);
  const html = pages.get('/works/bili-club-bv1uoy8ypete/');
  // The redundant small cover is gone — the player is the image.
  assert.ok(!html.includes('work-cover-small'));
  for (const text of ['投稿日期', '2024-10-20', 'B站原简介', '制作署名', '张牧荑', '稳定器', '在哔哩哔哩打开']) {
    assert.ok(html.includes(text), text);
  }
  assert.ok(html.includes('player.bilibili.com/player.html?bvid=BV1uoy8YpETE&amp;page=1'));
  const replay = pages.get('/works/military-replay/');
  for (const name of ['蒋凯阳', '杜文博', '李牧耕', '苏明君', '郑钰涵', '王浩宇']) assert.ok(replay.includes(name), name);
  assert.ok(replay.includes('制作署名'));
  const teaser = pages.get('/works/bili-club-bv1xz8u6jebc/');
  assert.ok(!teaser.includes('<h2>制作署名</h2>'), 'event crew does not imply credits on its teaser');
  // Only management members keep personal pages; others are plain names.
  const gala = pages.get('/works/gala-2025-videos/');
  assert.ok(gala.includes('郭歌'));
  assert.ok(!gala.includes('href="/people/person-gg/"'));
  assert.ok(!pages.has('/people/person-gg/'));
  // The user-confirmed roster: 李若浩/郭铭珺/郑钰涵/彭锦添 joined the management.
  for (const id of ['person-lrh', 'person-gmj', 'person-zyh', 'person-pjt']) assert.ok(pages.has(`/people/${id}/`), id);
  assert.ok(gala.includes('href="/people/person-lrh/"'));
});

test('the management roster matches the club-confirmed list with roles and graduation years', () => {
  const pages = createSite(catalog);
  assert.equal(catalog.appointments.length, 9);
  const byCohort = catalog.appointments.reduce((acc, a) => ({ ...acc, [a.cohortLabel]: (acc[a.cohortLabel] || 0) + 1 }), {});
  assert.deepEqual(byCohort, { '2023级': 1, '2024级': 2, '2025级': 2, '2026级': 4 });
  // Presidents: 蒋凯阳/王小诺/杜文博; every other member is 副社长.
  const presidents = new Set(['person-jky', 'person-wxn', 'person-dwb']);
  for (const a of catalog.appointments) {
    assert.equal(a.role, presidents.has(a.memberId) ? '社长' : '副社长', a.memberId);
  }
  const people = pages.get('/people/');
  // The 2023 cohort is openly incomplete; photos slots are reserved.
  assert.ok(people.includes('2023级仅列当前仍活跃的成员'));
  // Cohort = year they took office (2024级 → 2026年毕业, office year + 2).
  for (const year of ['2025年毕业', '2026年毕业', '2027年毕业', '2028年毕业']) assert.ok(people.includes(year), year);
  assert.ok(!people.includes('2029年毕业'), 'graduation must follow office-year + 2, not + 3');
  assert.ok(!people.includes('届毕业'));
  const zyh = pages.get('/people/person-zyh/');
  assert.ok(zyh.includes('2026级 / 副社长 · 管理层'));
  const wxn = pages.get('/people/person-wxn/');
  assert.ok(wxn.includes('2025级 / 社长'));
});

test('the work directory filters every imported film and replay without pushing the catalogue onto the home page', () => {
  const pages = createSite(catalog);
  const directory = pages.get('/works/');
  for (const kind of ['film', 'replay', 'photos']) {
    const count = catalog.works.filter((work) => work.kind === kind).length;
    assert.equal((directory.match(new RegExp(`data-kind="${kind}"`, 'g')) || []).length, count, kind);
    assert.ok(directory.includes(`data-filter="${kind}"`));
  }
  // The directory is grouped by year markers.
  assert.ok(directory.includes('works-year-group'));
  for (const year of ['2026', '2025', '2024']) assert.ok(directory.includes(`<p class="works-year">${year}</p>`), year);
  assert.ok(catalog.works.filter((work) => work.kind === 'replay' && work.id.startsWith('bili-')).length > 10);
  const home = pages.get('/');
  // Featured works come before the real production excerpt and full guides.
  for (const title of ['技术为本', '精选作品', '全程回顾制作指南', '如何完成一场活动直播？']) assert.ok(home.includes(title), title);
  for (const target of ['/notes/broadcast-guide/', '/notes/full-review-guide/', '/events/military-2026/#execution', '/people/']) assert.ok(home.includes(target), target);
  assert.ok(!home.includes('现场用什么'));
  assert.ok(!home.includes('home-together'));
  assert.ok(!home.includes('photo-together-stand'));
  assert.ok(!home.includes('photo-cover-group'));
  assert.ok(!home.includes('索尼 a7m5'));
  assert.ok(home.includes('/media/article-06.jpg'));
  assert.ok(!home.includes('也是朋友'));
  assert.ok(!home.includes('home-culture'));
  assert.ok(!home.includes('craft-chain'));
  assert.ok(home.indexOf('home-selection-grid') < home.indexOf('home-tech-grid'));
  for (const id of catalog.site.homeSelection) assert.ok(home.includes(`/works/${id}/`));
  assert.ok(home.includes(catalog.stories.find(s => s.id === 'military-2026').execution[1].text));
  assert.ok(!home.includes('culture-lines'));
  assert.equal((home.match(/class="home-guide"/g) || []).length, 2);
  for (const old of ['act-stage', 'act-quiet', 'act-finale']) assert.ok(!home.includes(old));
  assert.ok(!home.includes('一年一年'));
  assert.ok(home.includes('home-trail'));
  assert.ok(home.includes('观看宣传片'));
  assert.ok(!home.includes('slate-no'));
  assert.ok(!home.includes('doorway'));
  assert.ok(!home.includes('brand-english'));
  assert.ok(!home.includes('Eight-Dimensional-Space'));
  assert.ok(!home.includes('credits-roll'));
  assert.ok(!home.includes('/works/bili-club-bv1uoy8ypete/'));
  assert.ok(!home.includes('初雪校园'));
  // Management renders as the end-credits roll on the people page.
  const people = pages.get('/people/');
  assert.ok(people.includes('credits-roll'));
  assert.ok(people.includes('roll-year'));
  assert.ok(!people.includes('management-grid'));
  // The featured-event team section, the participation archive and the name
  // wall are gone; the people page is intro plus the management roll.
  assert.ok(!people.includes('本场制作团队'));
  assert.ok(!people.includes('参与制作'));
  assert.ok(!people.includes('name-wall'));
  // The 传承 tagline lives here; the rejected 做事有章法 line never returns.
  assert.ok(people.includes('<h1>一年一年</h1>'));
  assert.ok(!people.includes('镜头后的人'));
  assert.ok(!people.includes('做事有章法'));
  assert.ok(people.includes('李若浩'));
  for (const m of catalog.members) {
    const hasPage = catalog.appointments.some(a => a.memberId === m.id);
    assert.equal(pages.has(`/people/${m.id}/`), hasPage, m.id);
  }
});

test('the notes library keeps general guides only; the military review lives on its event page', () => {
  const pages = createSite(catalog);
  // The director-talk note is deleted outright.
  assert.ok(!catalog.notes.some(n => n.id === 'camera-communication'));
  assert.ok(!pages.has('/notes/camera-communication/'));
  assert.ok(![...pages.values()].some(html => html.includes('导播话术与沟通')));
  // The military review keeps its page and its event entry, but leaves the listing.
  const review = catalog.notes.find(n => n.id === 'military-review');
  assert.ok(review.unlisted);
  assert.ok(pages.has('/notes/military-review/'));
  const notesIndex = pages.get('/notes/');
  assert.ok(!notesIndex.includes('军训直播复盘'));
  for (const n of catalog.notes.filter(n => !n.unlisted)) {
    assert.ok(notesIndex.includes(`href="/notes/${n.id}/"`), n.id);
  }
  const event = pages.get('/events/military-2026/');
  assert.ok(event.includes('/notes/military-review/'));
});

test('repeat import preserves edited collections and retired uploads; new personal uploads require review', async () => {
  const policy = JSON.parse(await readFile(new URL('./content/bilibili-import-policy.json', import.meta.url), 'utf8'));
  const currentUploads = catalog.media.filter((m) => m.kind === 'embed').map((m) => ({ bvid: m.bvid, owner: { mid: policy.clubMid } }));
  const plan = planBilibiliImport(catalog, [...currentUploads, { bvid: 'BV1bcqrBWEQj' }, { bvid: 'BV1234567890', owner: { mid: policy.personalMid } }], policy);
  assert.deepEqual(plan.pending, []);
  assert.equal(plan.skipped.find((v) => v.bvid === 'BV1bcqrBWEQj').reason, policy.excluded.BV1bcqrBWEQj);
  assert.deepEqual(appendImportedContent(catalog, { works: [], media: [], sources: [] }), catalog);
  const fresh = { bvid: 'BV1234567891', owner: { mid: policy.clubMid } };
  assert.equal(planBilibiliImport(catalog, [fresh, fresh], policy).pending.length, 1);
  const corrupt = structuredClone(catalog);
  corrupt.works = corrupt.works.filter((w) => w.id !== 'psychodrama-2026-videos');
  assert.throws(() => planBilibiliImport(corrupt, [], policy), /policy\/catalog disagree/);
});

test('merged video sources retain their own parts, players and original fallback links', () => {
  const work = catalog.works.find((w) => w.id === 'psychodrama-2026-videos');
  assert.deepEqual(work.videos.map((v) => v.parts.length), [13, 8]);
  const html = createSite(catalog).get('/works/psychodrama-2026-videos/');
  const blocks = html.split('<div class="work-video-item">').slice(1);
  assert.equal(blocks.length, 2);
  assert.equal((blocks[0].match(/data-embed-part=/g) || []).length, 13);
  assert.equal((blocks[1].match(/data-embed-part=/g) || []).length, 8);
  assert.ok(blocks[1].includes('https://www.bilibili.com/video/BV1fUEV6QEan/?p=2'));
  assert.ok(blocks[1].includes('https://www.bilibili.com/video/BV1fUEV6QEan/'));
  const facts = html.match(/<dl class="work-facts">([\s\S]*?)<\/dl>/)[1];
  assert.ok(!facts.includes('<dt>时长</dt>'), 'one source duration must not describe a merged collection');
  const bad = structuredClone(catalog);
  const parts = bad.works.find((w) => w.id === work.id).videos[1].parts;
  parts.push({ ...parts[0] });
  assert.throws(() => validateCatalog(bad), /Invalid part/);
});

test('series years have real fallback links, including the 2026 sports opening', () => {
  const pages = createSite(catalog);
  const html = pages.get('/events/');
  assert.match(html, /href="\/events\/gala-2024\/" data-series-year/);
  assert.match(html, /href="\/events\/sports-2026\/" data-series-year/);
  assert.ok(!html.includes('.series-years button{display:none'));
  const event = catalog.events.find((ev) => ev.id === 'sports-2026');
  assert.equal(event.seriesId, 'sports');
  assert.equal(event.date, null);
  assert.ok(pages.get('/events/sports-2026/').includes('BV1jEap63Enq') || pages.get('/events/sports-2026/').includes(event.workIds[0]));
});

test('multi-session dates and management confirmation retain their own factual sources', () => {
  const pages = createSite(catalog);
  for (const [id, dates] of [['plaza-2025', ['2025-03-21', '2025-04-28']], ['debate-2026', ['2025-12-12', '2026-04-15']], ['psychodrama-2026', ['2026-04-22', '2026-04-23']]]) {
    const event = catalog.events.find((ev) => ev.id === id);
    assert.deepEqual(event.dates, dates);
    assert.ok(pages.get(`/events/${id}/`).includes(dates.join('、')));
  }
  assert.ok(catalog.appointments.every((a) => a.sourceId === 'source-club-management-confirmation'));
  assert.equal(catalog.sources.find((s) => s.id === 'source-club-management-confirmation').publishedAt, '2026-11-04');
});


test('music series keeps all four events and both 2026 records in the same year panel', () => {
  const events = catalog.events.filter(ev => ev.seriesId === 'music-festival');
  assert.deepEqual(events.map(ev => ev.id).sort(), ['music-fest-2024', 'music-fest-2026', 'plaza-2025', 'plaza-2026']);
  assert.ok(!catalog.series.some(s => s.id === 'plaza-concert'));
  const pages = createSite(catalog);
  const block = pages.get('/events/').split('id="series-music-festival"')[1].split('</section>')[0];
  assert.equal((block.match(/data-series-year data-year="2026"/g) || []).length, 1);
  const panel = block.split('id="music-festival-2026"')[1].split('id="music-festival-2025"')[0];
  for (const id of ['plaza-2026', 'music-fest-2026']) {
    assert.ok(panel.includes(`/events/${id}/`));
    assert.ok(pages.has(`/events/${id}/`));
  }
  assert.ok(!panel.includes(' hidden'), 'all events remain reachable without JavaScript');
  for (const id of ['plaza-2026', 'music-fest-2026']) {
    const html = pages.get(`/events/${id}/`);
    assert.ok(html.includes('2026 · 2026年学科节·广场音乐会'));
    assert.ok(html.includes('2026 · 2026年音乐节'));
  }
});


test('activity categories define a complete stable series order without changing event years', () => {
  assert.deepEqual(catalog.eventGroups.map(g => g.seriesIds), [['sports','gala'],['psychodrama','classroom-drama'],['music-festival','random-dance','chorus','sinoaus-concert']]);
  const html = createSite(catalog).get('/events/');
  const markers = catalog.eventGroups.flatMap(g => [`id="group-${g.id}"`, ...g.seriesIds.map(id => `id="series-${id}"`)]);
  for (let i = 1; i < markers.length; i++) assert.ok(html.indexOf(markers[i]) > html.indexOf(markers[i - 1]), markers[i]);
  const bad = structuredClone(catalog);
  bad.eventGroups[0].seriesIds.push('psychodrama');
  assert.throws(() => validateCatalog(bad), /Duplicate grouped series/);
  const missing = structuredClone(catalog);
  missing.eventGroups[0].seriesIds.pop();
  assert.throws(() => validateCatalog(missing), /Ungrouped series/);
});

test('about introduces technique, relationships and continuity without old onboarding or photos', () => {
  const html = createSite(catalog).get('/about/');
  for (const section of catalog.site.introduction.about.sections) {
    assert.ok(html.includes(`id="${section.id}"`));
    for (const p of section.paragraphs) assert.ok(html.includes(p));
  }
  // Real guides, work photos and the collaboration record carry the page.
  for (const target of ['/notes/broadcast-guide/', '/notes/full-review-guide/', '/events/military-2026/#crew']) assert.ok(html.includes(target), target);
  for (const asset of ['work-screen.jpg', 'work-gear.jpg']) assert.ok(html.includes(asset), asset);
  assert.ok(html.includes('about-role-grid'));
  assert.ok(html.includes('about-recurring'));
  assert.ok(!html.includes('怎么开始'));
  assert.ok(!html.includes('一年一年'));
  assert.ok(!html.includes('photo-cover-group'));
});


test('withdrawn monochrome photos leave every page and collection', () => {
  const names = ['work-tripod','work-edit','work-camera','work-review'];
  for (const name of names) assert.ok(!catalog.media.some(m => m.id === `photo-${name}`));
  assert.deepEqual(catalog.works.find(w => w.id === 'working-photos').galleryIds, ['photo-work-gear','photo-work-screen']);
  for (const [route, html] of createSite(catalog)) for (const name of names) assert.ok(!html.includes(`${name}.jpg`), `${route}: ${name}`);
});
