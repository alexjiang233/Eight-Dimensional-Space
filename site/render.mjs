import { renderEventRecord } from './event-record.mjs';
import { renderDocument } from './document.mjs';
import { renderFooter } from './footer.mjs';
import { collectionPages } from './collection.mjs';
// One editorial site, driven by the shared content graph.
export const skins = ['editorial'];
export const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const e = escape;
const kinds = { film: '影片', replay: '直播回放', photos: '照片' };

export function validateCatalog(data) {
  const collections = ['sources', 'media', 'members', 'events', 'works', 'notes', 'documents', 'stories'];
  const indexes = {};
  for (const name of collections) {
    indexes[name] = new Map();
    for (const item of data[name] || []) {
      if (!/^[a-z0-9-]+$/.test(item.id) || indexes[name].has(item.id))
        throw new Error(`Invalid/duplicate ${name} ID: ${item.id}`);
      indexes[name].set(item.id, item);
    }
  }
  const ref = (name, id) => {
    if (id && !indexes[name].has(id)) throw new Error(`Missing ${name}: ${id}`);
  };
  for (const appointment of data.appointments || []) {
    ref('members', appointment.memberId);
    ref('sources', appointment.sourceId);
  }
  for (const asset of data.media) {
    if (asset.kind === 'embed') {
      if (asset.platform !== 'bilibili' || !/^BV[0-9A-Za-z]{10}$/.test(asset.bvid))
        throw new Error(`Invalid embed media: ${asset.id}`);
      ref('sources', asset.sourceId);
      continue;
    }
    if (asset.kind === 'video' && (asset.id !== data.site.heroVideoId || asset.purpose !== 'cover-loop' || asset.duration > 30))
      throw new Error(`Only a short cover loop may be hosted locally: ${asset.id}`);
    if (!asset.src.startsWith('/media/') && !asset.src.startsWith('/promo/') && !asset.src.startsWith('/photos/'))
      throw new Error(`Invalid media path: ${asset.id}`);
    if (asset.width <= 0 || asset.height <= 0) throw new Error(`Invalid dimensions: ${asset.id}`);
    ref('sources', asset.sourceId);
  }
  for (const event of data.events) {
    ref('stories', event.storyId);
    ref('media', event.coverId);
    ref('media', event.groupId);
    ref('sources', event.sourceId);
    for (const id of event.galleryIds) ref('media', id);
    for (const id of event.workIds) ref('works', id);
    for (const id of event.noteIds) ref('notes', id);
    ref('media', event.secondaryCoverId);
    for (const id of event.featuredGalleryIds || []) ref('media', id);
    for (const view of event.viewpoints || []) ref('media', view.mediaId);
    for (const camera of event.cameras || []) ref('media', camera.imageId);
    for (const contribution of event.contributions) ref('members', contribution.memberId);
  }
  for (const story of data.stories || []) {
    ref('sources', story.sourceId);
    ref('sources', story.replaySourceId);
    if (story.replayMediaId && indexes.media.get(story.replayMediaId)?.kind !== 'embed')
      throw new Error(`Replay media is not an online embed: ${story.replayMediaId}`);
    ref('notes', story.reviewNoteId);
    ref('works', story.photoWorkId);
    for (const id of story.guideIds) ref('notes', id);
    for (const id of Object.values(story.media)) ref('media', id);
    for (const camera of story.cameras) ref('media', camera.mediaId);
  }
  for (const work of data.works) {
    ref('media', work.coverId);
    ref('media', work.mediaId);
    ref('events', work.eventId);
    ref('sources', work.sourceId);
    for (const id of [...work.authorIds, ...work.creditMemberIds]) ref('members', id);
    for (const id of work.galleryIds || []) ref('media', id);
  }
  for (const note of data.notes) {
    ref('documents', note.documentId);
    ref('events', note.eventId);
    ref('sources', note.sourceId);
    for (const section of note.sections) ref('media', section.imageId);
  }
  ref('events', data.site.featuredEventId);
  ref('works', data.site.promoWorkId);
  ref('media', data.site.heroStillId);
  ref('media', data.site.heroVideoId);
  if (indexes.media.get(data.site.heroVideoId)?.kind !== 'video') throw new Error('Hero loop must be video');
  return indexes;
}

export function createSite(data, { base = '/' } = {}) {
  const ix = validateCatalog(data);
  const get = (name, id) => ix[name].get(id);
  // A GitHub Pages project site deploys under a sub-path (e.g. /Eight-Dimensional-Space/).
  // Logical routes stay stable; only emitted URLs carry the mount prefix.
  const mount = base === '/' ? '' : base.endsWith('/') ? base.slice(0, -1) : base;
  const withBase = (path) => mount + path;
  const img = (id, extra = '') => {
    const m = get('media', id);
    return `<img src="${e(withBase(m.src))}" width="${m.width}" height="${m.height}" alt="${e(m.alt || m.caption)}" ${extra}>`;
  };
  const figure = (id, cls = '', group = 'page') => {
    const m = get('media', id);
    return `<figure class="${cls}"><a href="${e(withBase(m.src))}" data-image data-gallery="${group}" data-caption="${e(m.caption)}" data-exif="${e(m.exif ? JSON.stringify(m.exif) : '') }">${img(id, ['event-cover', 'record-cover'].includes(cls) ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"')}</a><figcaption>${e(m.caption)}<span>${m.sourceId === 'source-promo' ? '宣传片静帧' : m.sourceId === 'source-photo-selection' ? (m.capturedAt || '').slice(0,10) : '原文配图'}</span></figcaption></figure>`;
  };
  const url = (skin, kind = '', id = '') =>
    withBase(`/${kind ? `${kind}/` : ''}${id ? `${id}/` : ''}`);
  // Page registry keys and the route manifest stay logical (unprefixed) so the
  // test suite and the preview server keep one stable route space.
  const route = (skin, kind = '', id = '') =>
    `/${kind ? `${kind}/` : ''}${id ? `${id}/` : ''}`;
  const featured = get('events', data.site.featuredEventId);
  const promoWork = get('works', data.site.promoWorkId);
  const promoEmbed = promoWork.mediaId ? get('media', promoWork.mediaId) : null;
  const embedSrc = (m) =>
    `https://player.bilibili.com/player.html?bvid=${m.bvid}&page=${m.page || 1}&high_quality=1&danmaku=0&autoplay=0`;
  const embedPlayer = (m, cls = 'embed-player') =>
    `<div class="${cls}"><iframe src="${e(embedSrc(m))}" title="${e(m.title)}" scrolling="no" frameborder="0" allowfullscreen loading="lazy"></iframe></div>`;
  const sourceLink = (id, label = '查看原文') => {
    const s = get('sources', id);
    return s.url
      ? `<a href="${e(s.url)}" target="_blank" rel="noreferrer">${e(label)}</a>`
      : `<span>${e(s.title)}</span>`;
  };
  const facts = (event) => {
    const items = [
      [event.cameraCount ? `${event.cameraCount} 机位` : null, '本场直播'],
      [event.teamSize ? `${event.teamSize} 人` : null, '团队规模'],
    ].filter(([value]) => value);
    return items.length
      ? `<dl class="facts">${items.map(([value, label]) => `<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>`
      : '';
  };
  const infoStrip = (work, skin) => {
    const media = work.mediaId ? get('media', work.mediaId) : null;
    return `<div class="media-strip"><span>${e(kinds[work.kind])}</span><strong>${e(work.title)}</strong><span>${e(work.yearLabel || work.year)}</span>${media?.durationLabel ? `<span>${e(media.durationLabel)}</span>` : ''}${work.eventId ? `<a href="${url(skin, 'events', work.eventId)}">活动专题</a>` : ''}</div>`;
  };
  const roster = (event, skin) =>
    `<div class="roster">${event.contributions
      .map((c) => {
        const m = get('members', c.memberId);
        return `<a href="${url(skin, 'people', m.id)}"><span class="person-name">${e(m.name)}</span><span>${e(c.role)}</span></a>`;
      })
      .join('')}</div>`;
  const workTarget = (work, skin) =>
    work.kind === 'replay' && get('events', work.eventId)?.storyId
      ? url(skin, 'events', work.eventId) + '#watch'
      : url(skin, 'works', work.id);
  const workEntry = (work, skin) => {
    const media = work.mediaId ? get('media', work.mediaId) : null;
    const duration = media?.durationLabel ? ` · ${e(media.durationLabel)}` : '';
    return `<article class="work-entry" data-kind="${work.kind}"><a class="work-image" href="${workTarget(work, skin)}">${img(work.coverId, 'loading="lazy"')}<span class="type-label">${kinds[work.kind]}</span></a><div class="work-description"><h3><a href="${workTarget(work, skin)}">${e(work.title)}</a></h3><p>${e(work.subtitle)}</p><span>${e(work.yearLabel || work.year)}${duration}</span></div></article>`;
  };
  const compare = (event, skin) => {
    const choices = (event.viewpoints || []).map((v) => [v.mediaId, v.label]);
    if (!choices.length) return '';

    return `<section class="compare-section section" id="process"><div class="section-head"><h2>这场直播的现场</h2><p>现场与制作，放在一起看。</p></div><div class="compare-layout"><div class="compare-focus"><a href="${e(withBase(get('media', choices[0][0]).src))}" data-image data-gallery="compare" data-caption="${e(get('media', choices[0][0]).caption)}" data-compare-link>${img(choices[0][0], 'loading="lazy" data-compare-image')}</a><div class="monitor-strip"><strong data-compare-caption>现场效果</strong><span>2026.08.24</span><span>原文配图 / 非实时机位信号</span></div><div class="frame-corner top-left" aria-hidden="true"></div><div class="frame-corner bottom-right" aria-hidden="true"></div></div><div class="compare-choices">${choices
      .map(([id, label], i) => {
        const m = get('media', id);
        return `<button type="button" data-compare-choice aria-pressed="${i === 0}" data-src="${e(withBase(m.src))}" data-alt="${e(m.alt)}" data-width="${m.width}" data-height="${m.height}" data-caption="${e(m.caption)}" data-label="${label}">${img(id, 'loading="lazy"')}<span>${label}</span><span class="selected-word">已选画面</span></button>`;
      })
      .join(
        '',
      )}</div></div><details class="parallel-view"><summary>并排看现场与工作台</summary><div class="paired-pictures">${figure('article-08', '', 'paired')}${figure('article-06', '', 'paired')}</div></details></section>`;
  };
  const gallery = (event) => {
    const first = event.featuredGalleryIds || event.galleryIds.slice(0, 6);
    const rest = event.galleryIds.filter((id) => !first.includes(id));
    return `<section class="gallery-section section" id="photos"><div class="section-head"><h2>现场配图</h2><p>${event.galleryIds.length} 幅 · 保留原画幅</p></div><div class="photo-layout">${first.map((id) => figure(id, get('media', id).height > get('media', id).width ? 'portrait' : 'landscape', 'event')).join('')}</div>${rest.length ? `<details class="more-pictures"><summary>展开其余 ${rest.length} 幅配图</summary><div class="photo-layout">${rest.map((id) => figure(id, get('media', id).height > get('media', id).width ? 'portrait' : 'landscape', 'event')).join('')}</div></details>` : ''}<p class="source-caption">图源：${e(get('sources', event.sourceId).title)}。照片署名与拍摄参数未逐张列出，当前不补写。</p></section>`;
  };
  const notesPreview = (skin, event) =>
    event.noteIds.length
      ? `<section class="notes-preview section"><div><h2>经验留给下一次</h2><p>彩排、通话、画面链路与现场协作。</p></div><a class="note-link" href="${url(skin, 'notes', event.noteIds[0])}"><span>制作复盘</span><strong>${e(get('notes', event.noteIds[0]).title)}</strong><span>阅读索引</span></a></section>`
      : '';
  const filmButton = (skin) => `<a class="watch-link" href="${url(skin, 'works', 'promo-2026')}" data-film><span class="play-shape" aria-hidden="true">▷</span>观看宣传片<span>在线播放 · 1分55秒</span></a>`;
  function home(skin) {
    const stillMedia = get('media', data.site.heroStillId);
    const still = `<img class="hero-still" src="${e(withBase(stillMedia.src))}" width="${stillMedia.width}" height="${stillMedia.height}" alt="${e(stillMedia.alt)}" loading="eager" fetchpriority="high">`;
    const loopMedia = get('media', data.site.heroVideoId);
    const video = `<video class="hero-video" data-hero-video data-src="${e(withBase(loopMedia.src))}" poster="${e(withBase(stillMedia.src))}" width="${loopMedia.width}" height="${loopMedia.height}" muted loop playsinline preload="none" aria-hidden="true" tabindex="-1"></video>`;
    const identity = `<h1><span>八维空间</span><span class="club-name">摄影社</span></h1><p class="brand-english" lang="en">Eight-Dimensional-Space</p>${filmButton(skin)}`;
    const hero = `<section class="hero hero-editorial">${still}${video}<div class="hero-identity">${identity}</div><div class="hero-bottom"><a href="#selection">看作品与活动</a><button type="button" data-hero-toggle aria-pressed="false" hidden>播放封面</button></div></section>`;
    return collection.home(hero, skin);
  }

  function eventPage(event, skin) {
    if (event.storyId) return renderEventRecord(event, get('stories', event.storyId), skin, { e, url, figure, get, sourceLink, embedPlayer });
    return `<section class="event-intro section"><div class="event-title"><p class="date-line">${e(event.date || event.year)}${event.place ? ` · ${e(event.place)}` : ''}</p><h1>${e(event.title)}</h1><p class="lead-copy">${e(event.summary)}</p>${facts(event)}<div class="action-row">${event.id === 'military-2026' ? `<a class="button" href="${url(skin, 'works', 'military-replay')}">观看回放</a><a href="#process">看制作现场</a>` : `<a class="button" href="${url(skin, 'works', 'promo-2026')}">观看所在宣传片</a>`}</div></div>${figure(event.coverId, 'event-cover', 'hero')}</section>${event.id === 'military-2026' ? `<div class="event-nav"><a href="#process">制作现场</a><a href="#cameras">四个机位</a><a href="#photos">现场配图</a><a href="#crew">参与者</a><a href="${url(skin, 'notes', 'military-review')}">制作复盘</a></div>${compare(event, skin)}<section class="camera-section section" id="cameras"><div class="section-head"><h2>四个机位，各有位置</h2><p>设备信息按复盘正文保留。</p></div><div class="camera-list">${(event.cameras || []).map((c) => `<article>${c.imageId ? figure(c.imageId, '', 'cameras') : `<div class="camera-equipment"><span>机位资料</span><strong>${e(c.label)}</strong><span>${e(c.equipment)}</span></div>`}<h3>${e(c.label)}</h3><p>${e(c.equipment)}</p></article>`).join('')}</div></section>` : ''}${gallery(event)}${event.contributions.length ? `<section class="people-section section" id="crew"><div class="section-head"><h2>本场参与者</h2><span>公开回放署名</span></div>${event.groupId ? figure(event.groupId, 'crew-photo', 'crew') : ''}${roster(event, skin)}<p class="source-caption">${e(event.creditsNote || '参与记录按实际来源列出。')} 名单不用于推断照片中的人物位置。</p></section>` : ''}${notesPreview(skin, event)}<section class="source-section section"><h2>来源与记录</h2><p>${e(get('sources', event.sourceId).title)}</p>${event.timeNote ? `<details><summary>活动时段的来源说明</summary><p>${e(event.timeLabel)}；${e(event.timeNote)}</p></details>` : ''}${sourceLink(event.sourceId)}</section>`;
  }
  function worksPage(skin) {
    return `<section class="page-intro section"><h1>作品与记录</h1><p>照片、影片，以及完整直播的回放入口。</p></section><section class="works-directory section"><div class="filter-bar" role="group" aria-label="按作品类型筛选">${[
      ['all', '全部'],
      ['photos', '照片'],
      ['film', '影片'],
      ['replay', '直播回放'],
    ]
      .map(
        ([kind, label]) =>
          `<button type="button" data-filter="${kind}" aria-pressed="${kind === 'all'}">${label}</button>`,
      )
      .join(
        '',
      )}<button type="button" class="mobile-filter" data-open-filter>筛选作品</button><span data-result-count>${data.works.length} 项作品</span></div><div class="work-list directory">${data.works.map((w) => workEntry(w, skin)).join('')}</div><p class="empty-results" hidden>当前分类没有作品。</p></section>`;
  }
  function workPage(work, skin) {
    if (work.kind === 'photos' && work.galleryIds) return collection.photos(work, skin);
    const media = work.mediaId ? get('media', work.mediaId) : null;
    const online = media?.kind === 'embed';
    const view = online ? embedPlayer(media) : figure(work.coverId, 'work-cover', 'work');
    const playbackNote = online && work.notice ? `<p class="replay-notice">${e(work.notice)}</p>` : '';
    const playbackLink = online ? `<p class="embed-source">${sourceLink(work.sourceId, '在哔哩哔哩打开')}</p>` : '';
    return `<section class="work-intro section"><h1>${e(work.title)}</h1><p>${e(work.subtitle)}</p></section><section class="work-view section">${view}${playbackNote}${infoStrip(work, skin)}<p class="work-summary">${e(work.description)}</p>${playbackLink}${work.eventId ? `<a class="text-link" href="${url(skin, 'events', work.eventId)}">进入活动专题</a>` : ''}</section>${work.kind === 'photos' ? gallery(get('events', work.eventId)) : ''}${work.creditMemberIds.length ? `<section class="section"><div class="section-head"><h2>制作署名</h2></div>${roster(get('events', work.eventId), skin)}</section>` : ''}`;
  }
  function peoplePage(skin) {
    return collection.people(skin, roster, featured);
  }
  function personPage(member, skin) {
    const events = data.events.filter(ev => ev.contributions.some(c => c.memberId === member.id));
    const works = data.works.filter(w => w.authorIds.includes(member.id) || w.creditMemberIds.includes(member.id));
    const appointments = (data.appointments || []).filter(a => a.memberId === member.id);
    const history = events.map(ev => {
      const c = ev.contributions.find(c => c.memberId === member.id);
      return `<article><p>${e(ev.date || ev.year)}</p><h3><a href="${url(skin, 'events', ev.id)}">${e(ev.title)}</a></h3><p>${e(c.role)} · ${e(c.source)}</p>${c.detail ? `<p>${e(c.detail)}</p>` : ''}${c.note ? `<details><summary>职责来源说明</summary><p>${e(c.note)}</p></details>` : ''}</article>`;
    }).join('');
    return `<section class="person-intro section"><div><p class="date-line">成员</p><h1>${e(member.name)}</h1>${appointments.map(a => `<p>${e(a.cohortLabel)} / ${e(a.role)} · 宣传片署名</p>`).join('')}<div class="specialties">${member.specialties.map(s => `<span>${e(s)}</span>`).join('')}</div></div>${events.length ? figure(featured.groupId, 'person-context', 'person') + '<p class="source-caption">军训团队合影</p>' : ''}</section>${history ? `<section class="section"><div class="section-head"><h2>参与过的现场</h2></div><div class="event-list">${history}</div></section>` : ''}${works.length ? `<section class="section"><div class="section-head"><h2>相关制作</h2></div><div class="work-list">${works.map(w => workEntry(w, skin)).join('')}</div></section>` : ''}`;
  }

  function notePage(note, skin) {
    if (note.documentId) return renderDocument(get('documents', note.documentId), skin, { e, url });
    const source = get('sources', note.sourceId);
    return `<section class="note-intro section"><p class="date-line">${e(note.kind)}${note.publishedAt ? ` / ${e(note.publishedAt)}` : ''}</p><h1>${e(note.title)}</h1><p class="lead-copy">${e(note.subtitle)}</p>${note.authorLabel ? `<p>${e(note.authorLabel)}</p>` : ''}<p class="note-disclaimer">${note.editorialSummary ? `依据《${e(source.title)}》整理的内容提要。` : '复盘阅读提要；完整内容见原文。'}</p><div class="action-row">${source.url ? sourceLink(note.sourceId, '阅读原文') : ''}${note.eventId ? `<a href="${url(skin, 'events', note.eventId)}">活动记录</a>` : ''}</div></section><div class="reading-layout section"><nav class="reading-nav" aria-label="阅读章节">${note.sections.map((section, i) => `<a href="#chapter-${i}">${e(section.title)}</a>`).join('')}</nav><article class="reading-article">${note.sections.map((section, i) => `<section id="chapter-${i}"><h2>${e(section.title)}</h2><p>${e(section.text)}</p>${section.imageId ? figure(section.imageId, '', 'note') : ''}</section>`).join('')}<a class="text-link" href="${url(skin,'notes')}">返回资料目录</a></article></div>`;
  }
  function layout(skin, page, title, content) {
    const nav = [
      ['works', '作品'],
      ['events', '活动'],
      ['people', '成员'],
      ['notes', '资料'],
      ['about', '关于'],
    ];
    return `<!doctype html><html lang="zh-CN" class="skin-${skin}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="view-transition" content="same-origin"><title>${e(title)} · 八维空间</title><link rel="stylesheet" href="${withBase('/app.css')}"><link rel="stylesheet" href="${withBase(`/${skin}.css`)}"><script type="module" src="${withBase('/app.js')}"></script><noscript><style>.site-nav{display:flex!important;flex-wrap:wrap}.compare-choices,.year-buttons,.filter-bar button{display:none!important}</style></noscript></head><body class="page-${page.type}"><a class="skip" href="#main">跳到正文</a><header class="site-header"><a class="brand" href="${url(skin)}"><span>八维空间</span><small>淮北一中摄影社</small></a><nav class="site-nav" id="site-nav" aria-label="主导航">${nav.map(([key, label]) => `<a href="${url(skin, key)}" ${page.type === key ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav><button type="button" class="menu-toggle" aria-expanded="false" aria-controls="site-nav" hidden>菜单</button></header><main id="main">${content}</main>${renderFooter(data, skin, { url, e })}<dialog class="image-dialog" aria-label="查看完整图片"><header><p data-image-caption></p><button type="button" data-close-dialog>关闭 ×</button></header><img class="large-image" alt=""><details class="image-metadata" hidden><summary>拍摄信息</summary><dl data-image-exif></dl></details><footer><button type="button" data-image-prev>上一幅</button><span data-image-count></span><button type="button" data-image-next>下一幅</button></footer></dialog><dialog class="film-dialog" aria-labelledby="film-title"><header><h2 id="film-title">摄影社宣传片</h2><button type="button" data-close-dialog>关闭 ×</button></header><div class="embed-player film-frame" data-src="${e(embedSrc(promoEmbed))}" data-title="${e(promoEmbed.title)}"></div><p class="embed-source">${sourceLink(promoWork.sourceId, "在哔哩哔哩打开")}</p></dialog><dialog class="filter-dialog" aria-labelledby="filter-title"><header><h2 id="filter-title">筛选作品</h2><button type="button" data-close-dialog>关闭 ×</button></header><form><fieldset><legend>作品类型</legend>${[
      ['all', '全部'],
      ['photos', '照片'],
      ['film', '影片'],
      ['replay', '直播回放'],
    ]
      .map(
        ([value, label]) =>
          `<label><input type="radio" name="kind" value="${value}" ${value === 'all' ? 'checked' : ''}>${label}</label>`,
      )
      .join(
        '',
      )}</fieldset><div class="filter-actions"><button type="reset">重置</button><button class="button" type="submit">确认筛选</button></div></form></dialog></body></html>`;
  }
  const collection = collectionPages({ data, get, img, figure, url, e, workEntry, sourceLink });
  const pages = new Map();
  for (const skin of skins) {
    const add = (path, type, title, content) =>
      pages.set(path, layout(skin, { path, type }, title, content));
    add(route(skin), 'home', '首页', home(skin));
    add(route(skin, 'about'), 'about', '关于社团', collection.about(skin));
    add(route(skin, 'works'), 'works', '作品与记录', worksPage(skin));
    add(
      route(skin, 'events'),
      'events',
      '活动',
      `<section class="page-intro section"><h1>活动现场</h1><p>运动会、汇演与拍摄现场。</p></section><section class="section event-directory">${[
        ...data.events,
      ]
        .sort((a, b) => b.year - a.year)
        .map(
          (ev) =>
            `<article><a href="${url(skin, 'events', ev.id)}">${img(ev.coverId, 'loading="lazy"')}</a><div><p>${e(ev.date || ev.year)}</p><h2><a href="${url(skin, 'events', ev.id)}">${e(ev.title)}</a></h2><p>${e(ev.summary)}</p></div></article>`,
        )
        .join('')}</section>`,
    );
    add(route(skin, 'people'), 'people', '在现场的人', peoplePage(skin));
    add(
      route(skin, 'notes'),
      'notes',
      '制作资料',
      collection.notes(skin),
    );
    for (const ev of data.events)
      add(route(skin, 'events', ev.id), 'events', ev.title, eventPage(ev, skin));
    for (const w of data.works) add(route(skin, 'works', w.id), 'works', w.title, workPage(w, skin));
    for (const m of data.members)
      add(route(skin, 'people', m.id), 'people', m.name, personPage(m, skin));
    for (const n of data.notes) add(route(skin, 'notes', n.id), 'notes', n.title, notePage(n, skin));
  }
  return pages;
}
