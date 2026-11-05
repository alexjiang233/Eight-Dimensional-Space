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
        return `<a class="roll-person" href="${url(skin, 'people', a.memberId)}">
          ${pm ? `<span class="roll-photo has-photo"><img src="${e(withBase(pm.src))}" width="${pm.width}" height="${pm.height}" alt="" loading="lazy"></span>` : `<span class="roll-photo" aria-hidden="true"></span>`}
          <strong>${e(m.name)}</strong>
          ${a.role ? `<span class="roll-role">${e(a.role)}</span>` : ''}
          ${specialties.length ? `<span class="roll-skills">${specialties.map((s) => e(s)).join(' · ')}</span>` : ''}
        </a>`;
      }).join('')}</div>
    </section>`).join('')}<p class="source-caption">名单经社团确认：2023级仅列当前仍活跃的成员，非完整名单；照片位待补。名单不用于推断合影中的人物位置。</p></div>`;
  };
  function home(hero, skin) {
    // Four acts: the work wall (three video forms plus a scattered photo
    // cluster), the tech creed with its whitepaper entries, the club's own
    // lessons (untitled for now), and the promo poster.
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
    // A scattered cluster, not a tidy grid: two rows filling all twelve
    // columns, alternating spans and downward offsets. The spans are written
    // for the current six campus picks; offset-* is a separate class so the
    // same span can sit at different depths in different rows.
    const photoSpans = [
      [1, 7, 0], [7, 9, 1], [9, 13, 2],
      [1, 4, 2], [4, 9, 0], [9, 13, 1],
    ];
    const photoCluster = photos.map((m, i) => {
      const [c, r, o] = photoSpans[i % photoSpans.length];
      return figure(m.id, `home-cluster-photo c${c}-${r} offset-${o}`, 'home-cluster');
    }).join('');
    const internal = data.site.homeInternal || [];
    const internalTitle = data.site.homeInternalTitle || '';
    const internalHead = internalTitle ? `<div class="section-head"><h2 id="home-internal-title">${e(internalTitle)}</h2></div>` : '';
    const internalCard = (f) => {
      const vw = f.videoWorkId ? work(f.videoWorkId) : null;
      const pm = f.photoMediaId ? get('media', f.photoMediaId) : null;
      const frame = pm
        ? `<span class="home-internal-photo">${img(pm.id, 'loading="lazy"')}</span>`
        : `<span class="home-internal-photo is-empty" aria-hidden="true"></span>`;
      const body = `<div class="home-internal-copy"><h3>${e(f.title)}</h3><p>${e(f.note)}</p>${vw ? `<a class="text-link" href="${url(skin, 'works', vw.id)}">看这节社团课</a>` : '<span class="home-internal-pending">照片整理中</span>'}</div>`;
      return vw
        ? `<a class="home-internal-card" href="${url(skin, 'works', vw.id)}">${frame}${body}</a>`
        : `<div class="home-internal-card">${frame}${body}</div>`;
    };
    const guides = ['broadcast-guide', 'full-review-guide'].map(id => get('notes', id));
    const promo = work('promo-2026');
    return `${hero}
    <section class="section home-selection" id="manifest" aria-labelledby="home-selection-title">
      <div class="section-head"><h2 id="home-selection-title">精选作品</h2><a class="text-link" href="${url(skin, 'works')}">全部作品</a></div>
      <div class="home-video-wall" data-reveal-stagger>${videos.map(item => { const c = cardOf(item); return `
        <a class="home-video-card" href="${e(c.href)}">
          ${img(c.cover, 'loading="lazy"')}
          <div class="home-video-caption"><span>${e(c.tag)}</span><h3>${e(c.title)}</h3></div>
        </a>`; }).join('')}
      </div>
      <div class="home-photo-cluster" data-reveal>${photoCluster}</div>
    </section>
    <section class="section home-tech" aria-labelledby="home-tech-title">
      <div class="home-tech-statement">
        <h2 id="home-tech-title" class="home-tech-title">技术为本</h2>
        <p class="home-tech-line">五个环节：拍摄、传输、切换、包装、推流。</p>
        <p class="home-tech-line home-tech-line-strong">每多一台相机，难度成倍增加。</p>
      </div>
      <div class="home-whitepapers" data-reveal-stagger>
        ${guides.map(note => `<a class="home-whitepaper" href="${url(skin, 'notes', note.id)}">
          <span class="paper-meta">${e(note.kind)}</span>
          <h3>《${e(note.title)}》</h3>
          <p>${e(note.subtitle)}</p>
          <span class="paper-cta">展开阅读</span>
        </a>`).join('')}
      </div>
    </section>
    <section class="section home-internal"${internalTitle ? ' aria-labelledby="home-internal-title"' : ' aria-label="社团内部活动"'}>
      ${internalHead}
      <div class="home-internal-grid" data-reveal-stagger>${internal.map(internalCard).join('')}</div>
    </section>
    <section class="home-promo" aria-label="宣传片">
      <a href="${url(skin, 'works', promo.id)}" data-film>
        <span class="home-promo-media">${img('promo-poster-official', 'loading="lazy"')}</span>}
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
    const featured = get('events', data.site.featuredEventId);
    // Roles as published in the featured live record; duties describe the
    // position, not a fixed assignment.
    const roleDuty = {
      '导播 / 策划': '看画面、排顺序，现场协调',
      '飞手': '航拍机位',
      '稳定器': '移动镜头',
      '掌机': '台上台下的固定机位',
    };
    const roles = [...new Set((featured?.contributions || []).map((item) => item.role))];
    // Recurring activities with more than one recorded year, ordered by how
    // many years exist. Links go to each year's real event page.
    const recurring = data.series
      .map((series) => ({ series, events: data.events.filter((event) => event.seriesId === series.id).sort((a, b) => a.year - b.year) }))
      .filter((entry) => new Set(entry.events.map((event) => event.year)).size > 1)
      .sort((a, b) => b.events.length - a.events.length)
      .slice(0, 4);
    const years = data.events.map((event) => event.year).filter(Boolean);
    const range = years.length ? `${Math.min(...years)}—${Math.max(...years)}` : '';
    const guideRow = (note) => `<a class="about-guide" href="${url(skin, 'notes', note.id)}"><span class="about-guide-meta">${e(note.kind)} · ${e(note.publishedAt)}</span><strong>${e(note.title)}</strong><span class="about-guide-deck">${e(note.subtitle)}</span></a>`;
    const guideIndex = `<div class="about-guide-index"><p class="about-label">制作资料</p>${guides.map(guideRow).join('')}</div>`;
    const rolesBlock = roles.length ? `<div class="about-roles"><p class="about-label">一场直播里的位置</p><div class="about-role-grid">${roles.map((role) => `<div><strong>${e(role)}</strong>${roleDuty[role] ? `<span>${e(roleDuty[role])}</span>` : ''}</div>`).join('')}</div><p class="about-note">以《${e(featured.title)}》直播的公开署名为例。</p><a class="text-link" href="${url(skin, 'events', featured.id)}#crew">看这场活动的参与者</a></div>` : '';
    const recurringBlock = recurring.length ? `<div class="about-recurring"><p class="about-label">一直在做的活动</p>${recurring.map(({ series, events }) => `<div class="about-recurring-row"><span class="about-recurring-name">${e(series.title)}</span><span class="about-recurring-years">${[...new Set(events.map((event) => event.year))].map((year) => `<a href="${url(skin, 'events', events.find((event) => event.year === year).id)}">${year}</a>`).join('')}</span></div>`).join('')}<p class="about-note">年份按站内已收录的活动记录列出。</p></div>` : '';
    return `<section class="section about-opening">
      <div class="about-kicker"><span>淮北一中</span><span>摄影社</span></div>
      <h1>八维空间摄影社</h1>
      <div class="about-opening-grid">
        <p class="about-lead">${e(copy.lead)}</p>
        <div class="about-opening-note"><p>${e(copy.intro)}</p><dl class="about-facts"><div><dt>日常</dt><dd>照片 · 影片 · 直播</dd></div><div><dt>留下</dt><dd>教程 · 复盘 · 作品</dd></div>${range ? `<div><dt>记录</dt><dd>${e(range)} 校园活动</dd></div>` : ''}</dl></div>
      </div>
    </section>
    <section class="section about-plate">${figure('photo-work-screen', 'about-plate-main', 'about')}${figure('photo-work-gear', 'about-plate-side', 'about')}</section>
    ${copy.sections.map((section, index) => {
      const body = section.paragraphs.map((p) => `<p>${e(p)}</p>`).join('');
      const extra = section.id === 'technique' ? guideIndex : section.id === 'continuity' ? recurringBlock : '';
      const main = section.id === 'companions'
        ? `${body}${rolesBlock}`
        : `${body}${extra}`;
      const link = section.id === 'technique'
        ? `<a class="text-link" href="${url(skin, 'notes')}">全部制作资料</a>`
        : section.id === 'continuity'
          ? `<a class="text-link" href="${url(skin, 'people')}">历届管理层</a>`
          : '';
      return `<section class="section about-chapter" id="${e(section.id)}" data-reveal><header class="about-chapter-head"><span class="about-chapter-no">${String(index + 1).padStart(2, '0')}</span><h2>${e(section.title)}</h2>${section.deck ? `<p class="about-chapter-deck">${e(section.deck)}</p>` : ''}</header><div class="about-chapter-main">${main}${link}</div></section>`;
    }).join('')}
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
