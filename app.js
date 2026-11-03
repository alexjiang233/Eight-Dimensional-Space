const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const filmDialog = $('.film-dialog');
const imageDialog = $('.image-dialog');
const filterDialog = $('.filter-dialog');
let imageLinks = [];
let imageIndex = 0;

// Online playback lives inside the dialog: the bilibili iframe is created only
// when the visitor asks for the film and removed on close so playback stops.
if (filmDialog) {
  const frame = filmDialog.querySelector('.film-frame');
  $$('[data-film]').forEach((link) =>
    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!frame || !frame.dataset.src) return;
      event.preventDefault();
      if (!frame.firstElementChild) {
        const player = document.createElement('iframe');
        player.src = frame.dataset.src;
        player.title = frame.dataset.title || '在线视频播放';
        player.setAttribute('allowfullscreen', '');
        player.setAttribute('scrolling', 'no');
        frame.append(player);
      }
      filmDialog.showModal();
    }),
  );
  filmDialog.addEventListener('close', () => frame.replaceChildren());
}
$$('[data-close-dialog]').forEach((button) =>
  button.addEventListener('click', () => button.closest('dialog').close()),
);
document.addEventListener(
  'keydown',
  (event) => {
    if (event.key === 'Escape') {
      const dialog = $('dialog[open]');
      if (dialog) {
        event.preventDefault();
        dialog.close();
      }
    }
    if (imageDialog.open && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      imageIndex =
        (imageIndex + (event.key === 'ArrowLeft' ? -1 : 1) + imageLinks.length) % imageLinks.length;
      showImage();
    }
  },
  { capture: true },
);

function showImage() {
  const link = imageLinks[imageIndex];
  const original = link.querySelector('img');
  const image = $('.large-image');
  image.src = link.href;
  image.alt = original.alt;
  $('[data-image-caption]').textContent = link.dataset.caption || original.alt;
  const metadata = $('.image-metadata');
  const fields = $('[data-image-exif]');
  const exif = link.dataset.exif ? JSON.parse(link.dataset.exif) : null;
  fields.replaceChildren();
  metadata.hidden = !exif;
  metadata.open = false;
  if (exif) {
    for (const [label, key] of [['机身','camera'],['镜头','lens'],['焦距','focal'],['快门','shutter'],['光圈','aperture'],['ISO','iso'],['文件拍摄时间','date']]) {
      if (!exif[key]) continue;
      const row = document.createElement('div');
      const term = document.createElement('dt');
      const value = document.createElement('dd');
      term.textContent = label;
      value.textContent = exif[key];
      row.append(term, value);
      fields.append(row);
    }
  }
  $('[data-image-count]').textContent = `${imageIndex + 1} / ${imageLinks.length}`;
  $('[data-image-prev]').disabled = imageLinks.length < 2;
  $('[data-image-next]').disabled = imageLinks.length < 2;
}
$$('[data-image]').forEach((link) =>
  link.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const group = link.dataset.gallery;
    const seen = new Set();
    imageLinks = $$('[data-image]').filter((l) => {
      if (l.dataset.gallery !== group || seen.has(l.href)) return false;
      seen.add(l.href);
      return true;
    });
    imageIndex = imageLinks.findIndex((l) => l.href === link.href);
    showImage();
    imageDialog.showModal();
  }),
);
$('[data-image-prev]').addEventListener('click', () => {
  imageIndex = (imageIndex - 1 + imageLinks.length) % imageLinks.length;
  showImage();
});
$('[data-image-next]').addEventListener('click', () => {
  imageIndex = (imageIndex + 1) % imageLinks.length;
  showImage();
});

async function changePicture(task) {
  if (!reduce.matches && document.startViewTransition) {
    try {
      const transition = document.startViewTransition(task);
      await transition.finished;
      return;
    } catch {}
  }
  task();
}
$$('[data-compare-choice]').forEach((button) =>
  button.addEventListener('click', () => {
    if (button.getAttribute('aria-pressed') === 'true') return;
    const container = button.closest('.compare-section');
    changePicture(() => {
      const image = container.querySelector('[data-compare-image]');
      const link = container.querySelector('[data-compare-link]');
      image.src = button.dataset.src;
      image.alt = button.dataset.alt;
      image.width = Number(button.dataset.width);
      image.height = Number(button.dataset.height);
      link.href = button.dataset.src;
      link.dataset.caption = button.dataset.caption;
      container.querySelector('[data-compare-caption]').textContent = button.dataset.label;
      container
        .querySelectorAll('[data-compare-choice]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    });
  }),
);
$$('[data-year]').forEach((button) =>
  button.addEventListener('click', () => {
    if (button.getAttribute('aria-pressed') === 'true') return;
    const container = button.closest('.timeline');
    changePicture(() => {
      const image = container.querySelector('[data-year-image]');
      const link = container.querySelector('[data-year-image-link]');
      image.src = button.dataset.src;
      image.alt = button.dataset.alt;
      image.width = Number(button.dataset.width);
      image.height = Number(button.dataset.height);
      link.href = button.dataset.src;
      link.dataset.caption = button.dataset.caption;
      container.querySelector('[data-year-title]').textContent = button.dataset.title;
      container.querySelector('[data-year-source]').textContent = button.dataset.sourceLabel;
      container.querySelector('[data-year-caption]').textContent = button.dataset.caption;
      container.querySelector('[data-year-link]').href = button.dataset.href;
      container
        .querySelectorAll('[data-year]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    });
  }),
);

const menu = $('.menu-toggle');
menu.hidden = false;
menu.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  $('#site-nav').classList.toggle('is-open', open);
  menu.textContent = open ? '收起' : '菜单';
});
if ($('.filter-bar')) {
  function applyFilter(kind) {
    const items = $$('.work-entry');
    let count = 0;
    items.forEach((item) => {
      item.hidden = kind !== 'all' && item.dataset.kind !== kind;
      if (!item.hidden) count++;
    });
    $$('[data-filter]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.filter === kind)),
    );
    $('[data-result-count]').textContent = `${count} 项作品`;
    $('.empty-results').hidden = count !== 0;
    const radio = filterDialog.querySelector(`input[value="${kind}"]`);
    if (radio) radio.checked = true;
    const u = new URL(location.href);
    if (kind === 'all') u.searchParams.delete('type');
    else u.searchParams.set('type', kind);
    history.replaceState(null, '', u);

  }
  const param = new URLSearchParams(location.search).get('type');
  applyFilter(['photos', 'film', 'replay'].includes(param) ? param : 'all');
  $$('[data-filter]').forEach((b) =>
    b.addEventListener('click', () => applyFilter(b.dataset.filter)),
  );
  $('[data-open-filter]').addEventListener('click', () => filterDialog.showModal());
  filterDialog.querySelector('form').addEventListener('submit', (event) => {
    event.preventDefault();
    applyFilter(new FormData(event.currentTarget).get('kind'));
    filterDialog.close();
  });
  filterDialog.querySelector('form').addEventListener('reset', () => {
    filterDialog.querySelector('input[value="all"]').checked = true;
  });
}
// Preserve scroll position when returning from a content detail. The browser owns Back.
document.documentElement.dataset.ready = 'true';

// Same-origin, read-only measurements for the isolated responsive QA wrapper.
if (window.parent !== window) {
  window.addEventListener('message', (event) => {
    if (
      event.origin !== location.origin ||
      event.source !== window.parent ||
      event.data !== 'fieldwork-measure'
    )
      return;
    window.parent.postMessage(
      {
        type: 'fieldwork-metrics',
        path: location.pathname,
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        brokenImages: [...document.images]
          .filter((i) => i.getAttribute('src') && i.complete && i.naturalWidth === 0)
          .map((i) => i.getAttribute('src')),
      },
      location.origin,
    );
  });
}
