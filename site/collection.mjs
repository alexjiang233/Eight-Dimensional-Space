// Editorial compositions share the site's content graph and existing media viewer.
export function collectionPages({ data, get, img, figure, url, e, workEntry, sourceLink, withBase }) {
  const work = (id) => get('works', id);
  const photo = (id, cls = '', group = 'selection') => figure(`photo-${id}`, cls, group);
  const noteLinks = (skin) => data.notes.filter((n) => !n.unlisted).map((n) => `<a href="${url(skin, 'notes', n.id)}"><span>${e(n.kind)}</span><h3>${e(n.title)}</h3><p>${e(n.subtitle)}</p><span class="resource-date">${e(n.publishedAt || '岗位参考')}</span></a>`).join('');
  // Management roster: one block per cohort, each member a person card with
  // a reserved portrait slot; members with a confirmed photo show it, the
  // rest keep the placeholder.
  const creditsRoll = (skin) => {
    const cohorts = [...new Set((data.appointments || []).map((a) => a.cohortLabel))].sort();
    // Cohort = the year they took office (2024级 = took over 2024, graduated 2026).
    const graduateOf = (cohort) => Number(cohort.slice(0, 4)) + 2;
    return `<div class="credits-roll">${cohorts.map((cohort) => `<section class="roll-row">
      <div class="roll-cohort"><span class="roll-year">${e(cohort)}</span><span class="roll-grade">${graduateOf(cohort)}年毕业</span></div>
      <div class="roll-names">${data.appointments.filter((a) => a.cohortLabel === cohort).map((a) => {
        const m = get('members', a.memberId);
        const pm = a.photoMediaId ? get('media', a.photoMediaId) : null;
        const specialties = (m.specialties || []).filter(Boolean);
        return `<a class="roll-person" href="${url(skin, 'people', m.slug)}">
          ${pm ? `<span class="roll-photo has-photo"><img src="${e(withBase(pm.src))}" width="${pm.width}" height="${pm.height}" alt="" loading="lazy"></span>` : `<span class="roll-photo" aria-hidden="true"></span>`}
          <strong>${e(m.name)}</strong>
          ${a.role ? `<span class="roll-role">${e(a.role)}</span>` : ''}
          ${specialties.length ? `<span class="roll-skills">${specialties.map((s) => e(s)).join(' · ')}</span>` : ''}
        </a>`;
      }).join('')}</div>
    </section>`).join('')}<p class="source-caption">名单经社团确认：2023级仅列当前仍活跃的成员，非完整名单；照片位待补。名单不用于推断合影中的人物位置。</p></div>`;
  };
  function home(hero, skin) {
    const meta = data.site.homeSelectionMeta || {};
    const cardOf = (item) => {
      const m = meta[item.id] || {};
      const cover = m.coverId || item.coverId;
      const title = m.title || item.title;
      const tag = m.tag || item.formatLabel || '作品';
      const href = m.href ? withBase(m.href) : url(skin, 'works', item.id);
      return { cover, title, tag, href };
    };
    const videos = data.site.homeSelection.map(id => work(id));
    const photos = data.site.homePhotoIds.map(id => get('media', id));
    // A scattered wall of matted prints: one wide lead frame, five scattered
    // prints, each in a white mat with a tinted block slipping out behind.
    // Capture dates run vertically beside the mat (二〇二五年三月).
    const hanDate = (iso) => {
      if (!iso) return '';
      const digits = '〇一二三四五六七八九';
      const [y, mo] = iso.split('-');
      if (!y || !mo) return '';
      const months = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
      return `${[...y].map(d => digits[+d]).join('')}年 · ${months[+mo - 1] || ''}月`;
    };
    const photoSpans = [
      [1, 13, 0],
      [1, 3, 1], [3, 5, 2], [5, 8, 0], [8, 10, 1], [10, 13, 2],
    ];
    const photoCluster = photos.map((m, i) => {
      const [c, r, o] = photoSpans[i % photoSpans.length];
      const date = hanDate(m.capturedAt);
      return `<figure class="home-cluster-photo c${c}-${r} offset-${o}">
        <span class="print"><a href="${e(withBase(m.src))}" data-image data-gallery="home-cluster" data-caption="${e(m.caption)}" data-exif="${e(m.exif ? JSON.stringify(m.exif) : '')}"><img src="${e(withBase(m.src))}" width="${m.width}" height="${m.height}" alt="${e(m.alt || m.caption)}" loading="lazy"></a></span>
        ${date ? `<span class="print-date">${e(date)}</span>` : ''}
        <figcaption>${e(m.caption)}<span>${(m.capturedAt || '').slice(0, 10)}</span></figcaption>
      </figure>`;
    }).join('');
    const internal = data.site.homeInternal || [];
    const internalCard = (entry) => {
      const video = entry.videoWorkId ? work(entry.videoWorkId) : null;
      return `<article class="home-lesson${entry.photoMediaId ? ' has-photo' : ''}">
        ${entry.photoMediaId ? figure(entry.photoMediaId, 'home-lesson-photo', 'home-lessons') : ''}
        <div><h3>${e(entry.title)}</h3><p>${e(entry.note)}</p>
          ${video ? `<a class="text-link" href="${url(skin, 'works', video.id)}">看这节社团课</a>` : ''}
        </div>
      </article>`;
    };
    const military = get('events', data.site.featuredEventId);
    const militaryUrl = url(skin, 'events', military.id);
    const guides = ['broadcast-guide', 'full-review-guide'].map(id => get('notes', id));
    const promo = work('promo-2026');
    const stats = [
      [data.works.length, '收录作品'],
      [data.events.length, '活动记录'],
      [(data.appointments || []).length, '管理层成员'],
    ];
    return `${hero}
    <section class="section home-selection" id="manifest" aria-labelledby="home-selection-title">
      <div class="section-head"><span class="gallery-no" aria-hidden="true">01</span><h2 id="home-selection-title">精选作品</h2><a class="text-link" href="${url(skin, 'works')}">全部作品</a></div>
      <div class="home-video-wall" data-reveal-stagger>${videos.map(item => { const c = cardOf(item); return `
        <a class="home-video-card" href="${e(c.href)}">
          ${img(c.cover, 'loading="lazy"')}
          <div class="home-video-caption"><span>${e(c.tag)}</span><h3>${e(c.title)}</h3></div>
        </a>`; }).join('')}
      </div>
    </section>
    <section class="section home-photos" aria-label="照片墙">${photoCluster ? `<div class="home-photo-cluster" data-reveal>${photoCluster}</div>` : ''}</section>
    <section class="section home-tech" id="fieldwork" aria-labelledby="home-tech-title">
      <div class="home-tech-intro">
        <h2 id="home-tech-title" class="home-tech-title">技术为本</h2>
        <p>${e(military.title)} · ${e(military.date)}</p>
      </div>
      <div class="home-tech-spread">
        <div class="home-tech-frames">
          ${figure('article-08', '', 'home-fieldwork')}
          ${figure('article-06', '', 'home-fieldwork')}
        </div>
        <div class="home-tech-copy">
          <h3>什么时候切下一机位？</h3>
          <p>分列式上，一个班走过主席台，下一个班已经在准备。导播要同时看各机位拍到了什么，既不能漏掉交接，也要避免几路画面都对着同一个班。</p>
          <div class="home-tech-links">
            <a class="text-link" href="${militaryUrl}#execution">看现场怎么切</a>
            <a class="text-link" href="${militaryUrl}#watch">看完整回放</a>
          </div>
        </div>
      </div>
      <div class="home-whitepapers" aria-label="制作指南">
        ${guides.map(note => `<a class="home-whitepaper" href="${url(skin, 'notes', note.id)}">
          <span>${e(note.kind)}</span><strong>${e(note.title)}</strong>
        </a>`).join('')}
      </div>
    </section>
    ${internal.length ? `<section class="section home-internal" aria-labelledby="home-internal-title">
      <div class="section-head"><h2 id="home-internal-title">社团课与日常</h2></div>
      <div class="home-internal-grid">${internal.filter(entry => entry.photoMediaId).map(internalCard).join('')}</div>
      ${internal.some(entry => !entry.photoMediaId) ? `<div class="home-lesson-list">${internal.filter(entry => !entry.photoMediaId).map(internalCard).join('')}</div>` : ''}
    </section>` : ''}
    <section class="home-stats" aria-label="站点数据"><div class="home-stats-row">${stats.map(([n, label]) => `<div class="home-stat"><strong data-count="${n}">${n}</strong><span>${label}</span></div>`).join('')}</div></section>
    <section class="home-promo" aria-label="宣传片">
      <a href="${url(skin, 'works', promo.id)}" data-film>
        <span class="home-promo-media">${img('promo-poster-official', 'loading="lazy"')}</span>
        <div class="home-promo-copy">
          <span class="home-promo-play" aria-hidden="true">▷</span>
          <h2>摄影社宣传片</h2>
          <p>1分55秒 · 我们怎么拍、怎么一起干活</p>
        </div>
      </a>
    </section>`;
  }
  function about(skin) {
    const copy = data.site.introduction.about;
    const guides = ['broadcast-guide', 'full-review-guide'].map(id => get('notes', id));
    // 关于 answers one question only: who this club is. The old creed
    // paragraphs (technique / companions / continuity) lived here after being
    // retired from the homepage — gone for good; the page now stays with
    // real material: a plain introduction, working photos, the actual roster
    // and the collected lessons.
    const internal = data.site.homeInternal || [];
    const guideRow = (note) => `<a class="about-guide" href="${url(skin, 'notes', note.id)}"><span class="about-guide-meta">${e(note.kind)} · ${e(note.publishedAt)}</span><strong>${e(note.title)}</strong><span class="about-guide-deck">${e(note.subtitle)}</span></a>`;
    const guideIndex = `<div class="about-guide-index"><p class="about-label">制作资料</p>${guides.map(guideRow).join('')}</div>`;
    const rosterRows = [...new Set((data.appointments || []).map((a) => a.cohortLabel))].sort().map((cohort) => {
      const people = (data.appointments || []).filter((a) => a.cohortLabel === cohort);
      return `<div class="about-roster-row"><span class="about-roster-cohort">${e(cohort)}</span><span class="about-roster-names">${people.map((a) => {
        const m = get('members', a.memberId);
        return `<a href="${url(skin, 'people', m.slug)}">${e(m.name)}${a.role ? `<em>${e(a.role)}</em>` : ''}</a>`;
      }).join('')}</span></div>`;
    }).join('');
    const lessons = internal.map((f) => {
      const vw = f.videoWorkId ? work(f.videoWorkId) : null;
      return vw
        ? `<a class="about-lesson" href="${url(skin, 'works', vw.id)}"><strong>${e(f.title)}</strong><span>看这节社团课</span></a>`
        : `<div class="about-lesson"><strong>${e(f.title)}</strong><span>资料整理中</span></div>`;
    }).join('');
    return `<section class="section about-opening">
      <div class="about-kicker"><span>淮北一中</span><span>摄影社</span></div>
      <h1 data-split>八维空间摄影社</h1>
      <div class="about-opening-grid">
        <p class="about-lead">${e(copy.lead)}</p>
        <div class="about-opening-note"><p>${e(copy.intro)}</p><dl class="about-facts"><div><dt>日常</dt><dd>照片 · 影片 · 直播</dd></div><div><dt>留下</dt><dd>教程 · 复盘 · 作品</dd></div><div><dt>收录</dt><dd>${data.works.length} 项作品 · ${data.events.length} 场活动</dd></div></dl></div>
      </div>
    </section>
    <section class="section about-plate">${figure('photo-work-gear', 'about-plate-main', 'about')}${figure('photo-work-screen', 'about-plate-side', 'about')}</section>
    <section class="section about-roster"><div class="section-head"><h2>谁在这里</h2><a class="text-link" href="${url(skin, 'people')}">全部成员</a></div><div class="about-roster-grid">${rosterRows}</div><p class="about-note">名单经社团确认：2023 级仅列当前仍活跃的成员，非完整名单。</p></section>
    <section class="section about-join"><div class="section-head"><h2>怎么参与</h2></div><div class="about-lessons">${lessons}</div><a class="watch-link" href="${url(skin, 'works', 'promo-2026')}" data-film><span class="play-shape" aria-hidden="true">▷</span>观看宣传片<span>在线播放 · 1分55秒</span></a></section>
    ${guideIndex}
    `;
  }
  function people(skin) {
    const management = `<section class="section management-section" id="management"><div class="section-head"><h2>历届管理层</h2><span>名单经社团确认</span></div>${creditsRoll(skin)}</section>`;
    // Group photos of the club itself, in capture order; a gallery-wall block
    // under the roster so faces come back to the years they belong to.
    const groupPhotoIds = data.site.peopleGroupPhotoIds || [];
    const groupWall = groupPhotoIds.length ? `<section class="section people-groups" id="group-photos"><div class="section-head"><h2>历届合影</h2><span>按拍摄时间排列</span></div><div class="people-group-grid">${groupPhotoIds.map((id) => figure(id, 'people-group-photo', 'people-groups')).join('')}</div><p class="source-caption">合影按拍摄时间排列。名单与照片不用于推断人物位置。</p></section>` : '';

    return `<section class="section page-intro"><p class="eyebrow">成员</p><h1>一年一年</h1></section>${management}${groupWall}`;
  }
  function photos(work, skin) {
    return `<section class="section collection-intro"><p class="eyebrow">照片 / ${e(work.yearLabel || work.year)}</p><h1>${e(work.title)}</h1><p>${e(work.subtitle)} · ${work.galleryIds.length} 张</p>${work.eventId ? `<a class="text-link" href="${url(skin,'events',work.eventId)}">返回活动记录</a>` : ''}</section><section class="section collection-grid">${work.galleryIds.map((id,i)=>figure(id,`collection-photo item-${i}`,work.id)).join('')}</section><section class="section collection-end"><a class="text-link" href="${url(skin,'works')}?type=photos">返回照片选集</a><details><summary>照片来源与信息</summary><p>${work.sourceId === 'source-review' ? '来自本场公开复盘配图。来源未逐张标注摄影者或EXIF；不由人物岗位推断照片作者。' : '来自社团素材。拍摄时间与参数保留文件 EXIF 记录；摄影者尚未确认。'}</p></details></section>`;
  }
  function notes(skin) {
    return `<section class="section page-intro"><p class="eyebrow">制作资料</p><h1>拍摄前，翻一翻。</h1><p>制作指南、岗位参考与活动复盘。</p></section><section class="section"><div class="resource-grid">${noteLinks(skin)}</div></section>`;
  }
  return { home, about, people, photos, notes };
}
