const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
// JS is on: reveal styling may hide sections until they scroll into view.
// Without JS everything stays visible (progressive enhancement).
document.documentElement.dataset.js = '';
const filmDialog = $('.film-dialog');
const imageDialog = $('.image-dialog');
const filterDialog = $('.filter-dialog');
// Keep real Bilibili links as a no-JS fallback; ordinary clicks select the part
// in this page's player, without starting playback automatically.
$$('[data-embed-part]').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const scope = link.closest('.work-video-item') || document.querySelector('.work-view');
    const player = scope?.querySelector('.embed-player iframe');
    if (!player) return;
    event.preventDefault();
    const src = new URL(player.src);
    src.searchParams.set('page', link.dataset.embedPart);
    src.searchParams.set('autoplay', '0');
    player.src = src.href;
    link.closest('.work-parts').querySelectorAll('[data-embed-part]').forEach((item) => {
      if (item === link) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    });
    player.scrollIntoView({ block: 'center', behavior: reduce.matches ? 'instant' : 'smooth' });
  });
});
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

// Lightweight local cover loop. The file is referenced only through data-src so
// reduced-motion and data-saver visitors download nothing until they ask to play.
const heroVideo = $('video[data-hero-video]');
const heroToggle = $('button[data-hero-toggle]');
if (heroVideo && heroToggle) {
  const connection = navigator.connection;
  const autoBlocked = () => reduce.matches || Boolean(connection && connection.saveData);
  let manualPause = false;
  let inView = !('IntersectionObserver' in window);
  let loaded = false;

  heroVideo.muted = true;
  heroVideo.loop = true;
  heroToggle.hidden = false;

  const sync = (playing) => {
    heroToggle.textContent = playing ? '暂停封面' : '播放封面';
    heroToggle.setAttribute('aria-pressed', String(playing));
  };
  const load = () => {
    if (loaded) return;
    loaded = true;
    heroVideo.src = heroVideo.dataset.src;
  };
  const start = () => {
    if (!heroVideo.paused) return;
    load();
    heroVideo.play().catch(() => sync(false));
  };
  const resume = () => {
    if (manualPause || autoBlocked() || document.hidden || !inView) return;
    start();
  };

  sync(false);
  heroVideo.addEventListener('play', () => sync(true));
  heroVideo.addEventListener('pause', () => sync(false));

  heroToggle.addEventListener('click', () => {
    if (heroVideo.paused) {
      manualPause = false;
      start();
    } else {
      manualPause = true;
      heroVideo.pause();
    }
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) resume();
      else heroVideo.pause();
    }).observe(heroVideo);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) heroVideo.pause();
    else resume();
  });

  reduce.addEventListener('change', () => {
    if (reduce.matches) heroVideo.pause();
    else resume();
  });

  resume();
}

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

// A year may contain several events. Without JS every record remains visible.
$$('.series-block').forEach(block => {
  const buttons = [...block.querySelectorAll('[data-series-year]')];
  const panels = [...block.querySelectorAll('[data-series-panel]')];
  const selectYear = year => {
    panels.forEach(panel => { panel.hidden = panel.dataset.year !== year; });
    buttons.forEach(button => button.setAttribute('aria-current', String(button.dataset.year === year)));
  };
  if (!buttons.length) return;
  selectYear(buttons[0].dataset.year);
  block.classList.add('series-enhanced');
  buttons.forEach(button => button.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (button.getAttribute('aria-current') === 'true') return;
    selectYear(button.dataset.year);
  }));
});

// Scroll reveal: marked blocks rise when they enter the viewport and reset
// once they leave below, so scrolling back replays them (single-direction
// reversible). Leaving through the top keeps them settled. Stagger containers
// hold the mark for their children instead of the block itself, and split
// titles play their characters one by one on the same signal.
if ('IntersectionObserver' in window) {
  const reveal = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
        else if (entry.boundingClientRect.top > 0) entry.target.classList.remove('is-visible');
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  $$('[data-reveal], [data-reveal-stagger], [data-split]').forEach((el) => reveal.observe(el));
} else {
  $$('[data-reveal], [data-reveal-stagger], [data-split]').forEach((el) => el.classList.add('is-visible'));
}

// ===== Interaction pass: split titles, finder loupe and count-up stats. Desktop-fine-pointer extras skip touch devices
// and reduced-motion users; every piece degrades to the plain site. =====

// Split titles: characters become individually animated spans; the readable
// text stays on aria-label. Runs before the observer so titles animate.
$$('[data-split]').forEach((el) => {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.textContent = '';
  [...text].forEach((ch, i) => {
    const s = document.createElement('span');
    s.className = 'split-ch';
    s.textContent = ch;
    s.setAttribute('aria-hidden', 'true');
    s.style.setProperty('--ch-i', String(i));
    el.append(s);
  });
});

// Finder loupe: a small frame trails the pointer across the photo wall.
const photoWall = $('.home-photo-cluster');
if (photoWall && matchMedia('(pointer: fine)').matches && !reduce.matches) {
  const loupe = document.createElement('div');
  loupe.className = 'finder-loupe';
  loupe.setAttribute('aria-hidden', 'true');
  photoWall.append(loupe);
  let x = 0;
  let y = 0;
  let cx = 0;
  let cy = 0;
  let running = false;
  let raf = 0;
  const loop = () => {
    cx += (x - cx) * 0.18;
    cy += (y - cy) * 0.18;
    loupe.style.transform = `translate(${cx}px, ${cy}px)`;
    raf = running ? requestAnimationFrame(loop) : 0;
  };
  photoWall.addEventListener('pointermove', (event) => {
    const rect = photoWall.getBoundingClientRect();
    x = event.clientX - rect.left;
    y = event.clientY - rect.top;
    if (!running) {
      running = true;
      cx = x;
      cy = y;
      loupe.classList.add('is-on');
      raf = requestAnimationFrame(loop);
    }
  });
  photoWall.addEventListener('pointerleave', () => {
    running = false;
    loupe.classList.remove('is-on');
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  });
}

// Stats count up once, from zero, when the row scrolls into view.
$$('[data-count]').forEach((el) => {
  const end = Number(el.dataset.count);
  if (!Number.isFinite(end) || reduce.matches || !('IntersectionObserver' in window)) return;
  el.textContent = '0';
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    const start = performance.now();
    const duration = 1400;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(end * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { rootMargin: '0px 0px -10% 0px' });
  io.observe(el);
});

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
    // A year group with no visible entries hides its marker too.
    $$('.works-year-group').forEach((group) => {
      group.hidden =
        kind !== 'all' && ![...group.querySelectorAll('.work-entry')].some((item) => !item.hidden);
    });
    $$('[data-filter]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.filter === kind)),
    );
    $('[data-result-count]').textContent = `${count} 项作品`;
    $('.empty-results').hidden = count !== 0;
    // The album shelf is a photo entry, so it steps aside for film/replay views.
    const shelf = $('[data-photo-sets]');
    if (shelf) shelf.hidden = !(kind === 'all' || kind === 'photos');
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
