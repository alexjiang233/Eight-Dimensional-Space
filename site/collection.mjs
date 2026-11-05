// Editorial compositions share the site's content graph and existing media viewer.
export function collectionPages({ data, get, img, figure, url, e, workEntry, sourceLink }) {
  const work = (id) => get('works', id);
  const photo = (id, cls = '', group = 'selection') => figure(`photo-${id}`, cls, group);
  const noteLinks = (skin) => data.notes.filter((n) => !n.unlisted).map((n) => `<a href="${url(skin, 'notes', n.id)}"><span>${e(n.kind)}</span><h3>${e(n.title)}</h3><p>${e(n.subtitle)}</p><span class="resource-date">${e(n.publishedAt || '岗位参考')}</span></a>`).join('');
  // Management roster: one block per cohort, each member a person card with
  // a reserved portrait slot (photos arrive later). Reads like a gallery
  // wall, not a table.
  const creditsRoll = (skin) => {
    const cohorts = [...new Set((data.appointments || []).map((a) => a.cohortLabel))].sort();
    // Cohort = the year they took office (2024级 = took over 2024, graduated 2026).
    const graduateOf = (cohort) => Number(cohort.slice(0, 4)) + 2;
    return `<div class="credits-roll">${cohorts.map((cohort) => `<section class="roll-row">
      <div class="roll-cohort"><span class="roll-year">${e(cohort)}</span><span class="roll-grade">${graduateOf(cohort)}年毕业</span></div>
      <div class="roll-names">${data.appointments.filter((a) => a.cohortLabel === cohort).map((a) => {
        const m = get('members', a.memberId);
        const specialties = (m.specialties || []).filter(Boolean);
        return `<a class="roll-person" href="${url(skin, 'people', a.memberId)}">
          <span class="roll-photo" aria-hidden="true"></span>
          <strong>${e(m.name)}</strong>
          ${a.role ? `<span class="roll-role">${e(a.role)}</span>` : ''}
          ${specialties.length ? `<span class="roll-skills">${specialties.map((s) => e(s)).join(' · ')}</span>` : ''}
        </a>`;
      }).join('')}</div>
    </section>`).join('')}<p class="source-caption">名单经社团确认：2023级仅列当前仍活跃的成员，非完整名单；照片位待补。名单不用于推断合影中的人物位置。</p></div>`;
  };
  function home(hero, skin) {
    const [lead, ...side] = data.site.homeSelection.map(id => work(id));
    const guides = ['broadcast-guide', 'full-review-guide'].map(id => get('notes', id));
    const live = get('stories', 'military-2026');
    const cut = live.execution.find(item => item.title === '在不同画面之间衔接');
    const selected = (item, primary = false) => {
      const label = item.kind === 'photos' ? `照片 · ${item.galleryIds.length} 张` : item.kind === 'replay' ? item.formatLabel || '回放' : '影片';
      const caption = `<div class="home-selection-caption"><span>${e(label)}</span><h3>${e(item.title)}</h3></div>`;
      const cover = img(item.coverId, 'loading="lazy"');
      const href = url(skin, 'works', item.id);
      if (!primary) return `<a class="home-selection-item" href="${href}">${cover}${caption}</a>`;
      const companion = item.galleryIds?.find(id => id === 'photo-see-track');
      return `<a class="home-selection-item home-selection-lead" href="${href}">${cover}<div class="home-selection-album">${caption}${companion ? `<div class="home-selection-companion">${img(companion, 'loading="lazy"')}</div>` : ''}</div></a>`;
    };
    return `${hero}
    <section class="section home-selection" id="manifest" aria-labelledby="home-selection-title">
      <div class="section-head"><h2 id="home-selection-title">精选作品</h2><a class="text-link" href="${url(skin, 'works')}">全部作品</a></div>
      <div class="home-selection-grid">${selected(lead, true)}<div class="home-selection-side">${side.map(item => selected(item)).join('')}</div></div>
    </section>
    <section class="section home-tech" aria-labelledby="home-tech-title">
      <div class="section-head"><h2 id="home-tech-title">技术为本</h2><a class="text-link" href="${url(skin, 'notes')}">全部制作资料</a></div>
      <div class="home-tech-grid">
        ${figure(live.media.desk, 'home-tech-photo', 'home-tech')}
        <div class="home-tech-excerpt"><p class="home-tech-source">2026军训汇演 · 复盘节选</p><h3>${e(cut.title)}</h3><p>${e(cut.text)}</p><a class="text-link" href="${url(skin, 'events', 'military-2026')}#execution">看现场切换与通话</a></div>
      </div>
      <div class="home-guides">${guides.map(note => `<a class="home-guide" href="${url(skin, 'notes', note.id)}"><span class="guide-meta">${e(note.kind)}</span><h3>${e(note.title)}</h3><p>${e(note.subtitle)}</p></a>`).join('')}</div>
    </section>
    <nav class="home-trail" aria-label="网站入口" data-reveal>
      ${[
        ['works', '作品', '照片、影片与回放'],
        ['events', '活动', '按系列与年份'],
        ['people', '群像', '历届管理层'],
        ['notes', '资料', '教程与复盘'],
        ['about', '关于', '我们怎么做事'],
      ].map(([key, label, note]) => `<a href="${url(skin, key)}"><strong>${label}</strong><small>${note}</small></a>`).join('')}
    </nav>`;
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

    return `<section class="section page-intro"><p class="eyebrow">成员</p><h1>一年一年</h1></section>${management}`;
  }
  function photos(work, skin) {
    return `<section class="section collection-intro"><p class="eyebrow">照片 / ${e(work.yearLabel || work.year)}</p><h1>${e(work.title)}</h1><p>${e(work.subtitle)} · ${work.galleryIds.length} 张</p>${work.eventId ? `<a class="text-link" href="${url(skin,'events',work.eventId)}">返回活动记录</a>` : ''}</section><section class="section collection-grid">${work.galleryIds.map((id,i)=>figure(id,`collection-photo item-${i}`,work.id)).join('')}</section><section class="section collection-end"><a class="text-link" href="${url(skin,'works')}?type=photos">返回照片选集</a><details><summary>照片来源与信息</summary><p>${work.sourceId === 'source-review' ? '来自本场公开复盘配图。来源未逐张标注摄影者或EXIF；不由人物岗位推断照片作者。' : '来自社团素材。拍摄时间与参数保留文件 EXIF 记录；摄影者尚未确认。'}</p></details></section>`;
  }
  function notes(skin) {
    return `<section class="section page-intro"><p class="eyebrow">制作资料</p><h1>拍摄前，翻一翻。</h1><p>制作指南、岗位参考与活动复盘。</p></section><section class="section"><div class="resource-grid">${noteLinks(skin)}</div></section>`;
  }
  return { home, about, people, photos, notes };
}
