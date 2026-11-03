export function renderDocument(document, skin, { e, url }) {
  const chapters = document.blocks.filter(block => block.type === 'heading' && block.text !== '目录');
  const toc = `<nav aria-label="文章章节">${chapters.map(block => `<a class="toc-level-${block.level}" href="#${block.anchor}">${e((block.prefix || '') + block.text)}</a>`).join('')}</nav>`;
  const originalToc = document.blocks.findIndex(block => block.type === 'heading' && block.text === '目录');
  let tocEnd = originalToc;
  while (originalToc >= 0 && document.blocks[tocEnd + 1]?.type === 'toc-link') tocEnd += 1;
  const body = document.blocks.map((block, index) => {
    if (originalToc >= 0 && index === originalToc) {
      return `<details class="document-source-toc"><summary id="${block.anchor}" data-source-index="${block.sourceIndex}">${e(block.text)}</summary><nav aria-label="原文目录">${document.blocks.slice(originalToc + 1, tocEnd + 1).map(item => `<p class="original-toc-line" data-source-index="${item.sourceIndex}"><a href="#${item.target}">${e(item.text)}</a></p>`).join('')}</nav></details>`;
    }
    if (originalToc >= 0 && index > originalToc && index <= tocEnd) return '';
    if (block.type === 'table') {
      return `<div class="document-table" data-source-index="${block.sourceIndex}"><table><thead><tr>${block.rows[0].map(cell => `<th scope="col">${e(cell)}</th>`).join('')}</tr></thead><tbody>${block.rows.slice(1).map(row => `<tr>${row.map(cell => `<td>${e(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    const text = e((block.prefix || '') + block.text);
    const source = `data-source-index="${block.sourceIndex}"`;
    if (block.type === 'heading') return `<h${block.level} id="${block.anchor}" ${source}>${text}</h${block.level}>`;
    if (block.type === 'toc-link') return `<p class="original-toc-line" ${source}><a href="#${block.target}">${text}</a></p>`;
    return `<p ${source}>${text}</p>`;
  }).join('');
  return `<header class="section document-intro"><p class="eyebrow">制作资料 / 原文</p><h1>${e(document.title)}</h1><p><time>${e(document.dateLabel)}</time>${document.authorLabel ? ` / ${e(document.authorLabel)}` : ''}</p>${document.sourceUrl ? `<a href="${e(document.sourceUrl)}" target="_blank" rel="noreferrer">公开原文</a>` : ''}</header><div class="section document-layout"><aside class="document-sidebar"><p>章节目录</p>${toc}</aside>${originalToc >= 0 ? '' : `<details class="document-mobile-toc"><summary>章节目录</summary>${toc}</details>`}<article class="document-body" aria-label="${e(document.title)}正文">${body}</article></div><nav class="section document-bottom" aria-label="文章导航"><a href="${url(skin, 'notes')}">返回制作资料</a><a href="#main">回到文章开头</a></nav>`;
}
