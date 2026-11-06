import chapters from './content/updates.json' with { type: 'json' };

export function renderUpdates(e) {
  const entries = (chapter) => `<ol class="update-entries">${chapter.entries.map(entry => `
    <li>
      <div class="update-meta">
        <time datetime="${entry.time.replace(' ', 'T')}+08:00">${entry.time}</time>
        <span class="update-state" data-state="${e(entry.status)}">${e(entry.status)}</span>
      </div>
      <h3>${e(entry.title)}</h3>
      <p>${e(entry.description)}</p>
      ${entry.commit ? `<a class="update-commit" href="https://github.com/alexjiang233/Eight-Dimensional-Space/commit/${entry.commit}">发布提交 <code>${entry.commit}</code></a>` : ''}
    </li>`).join('')}</ol>`;

  return `<div class="section updates-shell">
    <header class="updates-intro">
      <div><h1>更新日志</h1><p>八维空间摄影社网站的上线、改版与试作记录。</p></div>
      <div class="updates-period"><span>记录始于</span><time datetime="2026-10-29">2026.10.29</time></div>
    </header>
    <div class="updates-layout">
      <nav class="updates-index" aria-label="更新日志目录">
        <p>按阶段查看</p>
        ${chapters.map(chapter => `<a href="#${chapter.id}"><span>${e(chapter.label)}</span>${e(chapter.title)}</a>`).join('')}
      </nav>
      <div>
        <p class="updates-key">北京时间，最近的记录在前。「上线」为已公开发布，「试作」包含后来撤回的预览，「开发」为有记录的改动。时间按提交或开发记录标注。</p>
        ${chapters.map((chapter, index) => `<section class="update-chapter" id="${chapter.id}" aria-labelledby="updates-${chapter.id}">
          <p class="update-chapter-date">${e(chapter.label)}</p>
          <h2 id="updates-${chapter.id}">${e(chapter.title)}</h2>
          ${index === 0 ? entries(chapter) : `<details><summary>查看本阶段的 ${chapter.entries.length} 条记录</summary>${entries(chapter)}</details>`}
        </section>`).join('')}
      </div>
    </div>
  </div>`;
}
