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
    // The homepage reads like a film in three acts, not a directory: what we
    // can do (full-bleed live moment), how it feels (quiet asymmetric pair),
    // who we are (full-width group finale). The manifesto carries the creed.
    return `${hero}
    <section class="manifest section" id="manifest" data-reveal>
      <p class="manifest-line">拍下每一次热闹，</p>
      <p class="manifest-line manifest-indent">记住每一张脸。</p>
      <p class="manifest-caption">淮北一中 · 八维空间摄影社</p>
    </section>
    <section class="act act-stage" data-reveal>
      <a href="${url(skin, 'events', 'military-2026')}#watch">
        ${img('article-09', 'loading="lazy"')}
        <div class="act-copy">
          <p class="act-kicker">四机位直播 · 2026.08.24</p>
          <h2>军训总结大会</h2>
          <p>画面送往操场大屏、视频号与哔哩哔哩；机位、导播与字幕，全部由学生完成。</p>
          <span class="act-cta">进入这场直播的记录</span>
        </div>
      </a>
    </section>
    <section class="act act-quiet section" data-reveal>
      <div class="act-quiet-main">${photo('work-tripod')}</div>
      <div class="act-quiet-side">
        ${photo('see-campus')}
        <div class="act-quiet-copy">
          <h2>镜头前后，都有我们的身影。</h2>
          <p>拍摄现场、校园日常与每一场合影。</p>
          <a class="text-link" href="${url(skin, 'works')}?type=photos">看照片</a>
          <a class="text-link" href="${url(skin, 'works')}?type=film">看影片</a>
        </div>
      </div>
    </section>
    <section class="act act-finale" data-reveal>
      <a href="${url(skin, 'people')}">
        ${img('photo-cover-group', 'loading="lazy"')}
        <div class="act-copy">
          <p class="act-kicker">八维空间摄影社</p>
          <h2>收工前，总有一张合影。</h2>
          <span class="act-cta">认识镜头后的我们</span>
        </div>
      </a>
    </section>
    <nav class="home-trail" aria-label="网站入口" data-reveal>
      <a href="${url(skin, 'works')}">作品</a>
      <a href="${url(skin, 'events')}">活动</a>
      <a href="${url(skin, 'people')}">群像</a>
      <a href="${url(skin, 'about')}">关于</a>
      <a href="${url(skin, 'notes')}">资料</a>
    </nav>`;
  }
  function about(skin) {
    return `<section class="section about-intro"><div><p class="eyebrow">淮北一中</p><h1>八维空间摄影社</h1><p class="about-deck">照片、影片、直播。</p><p>拍摄校园里的活动，也记录我们的日常。</p><div class="action-row"><a class="text-link" href="${url(skin,'works')}">看作品</a><a class="text-link" href="${url(skin,'people')}">认识成员</a></div></div>${photo('cover-group','','about')}</section><section class="section about-life"><div><h2>在活动里，也在日常里</h2><p>运动会、汇演、社团课、采风。相机前后，都有我们的身影。</p></div><div class="about-pictures">${photo('work-screen','','about')}${photo('together-dinner','','about')}</div></section><section class="section"><div class="section-head"><h2>怎么开始？</h2></div><div class="about-links"><a href="${url(skin,'works')}?type=photos"><h3>先看照片</h3><p>校园、工作现场与合影。</p><span>打开照片选集</span></a><a href="${url(skin,'works','promo-2026')}"><h3>看一支片</h3><p>1分55秒的社团宣传片。</p><span>进入影片页</span></a><a href="${url(skin,'notes')}"><h3>准备下一次拍摄</h3><p>从机位、通话到完整活动的记录。</p><span>浏览制作资料</span></a></div></section>`;
  }
  function people(skin) {
    const management = `<section class="section management-section" id="management"><div class="section-head"><h2>历届管理层</h2><span>名单经社团确认</span></div>${creditsRoll(skin)}</section>`;

    return `<section class="section page-intro"><p class="eyebrow">成员</p><h1>镜头后的人</h1><p class="page-tagline">一年一年，快门不停。</p></section>${management}`;
  }
  function photos(work, skin) {
    return `<section class="section collection-intro"><p class="eyebrow">照片 / ${e(work.yearLabel || work.year)}</p><h1>${e(work.title)}</h1><p>${e(work.subtitle)} · ${work.galleryIds.length} 张</p>${work.eventId ? `<a class="text-link" href="${url(skin,'events',work.eventId)}">返回活动记录</a>` : ''}</section><section class="section collection-grid">${work.galleryIds.map((id,i)=>figure(id,`collection-photo item-${i}`,work.id)).join('')}</section><section class="section collection-end"><a class="text-link" href="${url(skin,'works')}?type=photos">返回照片选集</a><details><summary>照片来源与信息</summary><p>${work.sourceId === 'source-review' ? '来自本场公开复盘配图。来源未逐张标注摄影者或EXIF；不由人物岗位推断照片作者。' : '来自社团素材。拍摄时间与参数保留文件 EXIF 记录；摄影者尚未确认。'}</p></details></section>`;
  }
  function notes(skin) {
    return `<section class="section page-intro"><p class="eyebrow">制作资料</p><h1>拍摄前，翻一翻。</h1><p>制作指南、岗位参考与活动复盘。</p></section><section class="section"><div class="resource-grid">${noteLinks(skin)}</div></section>`;
  }
  return { home, about, people, photos, notes };
}
