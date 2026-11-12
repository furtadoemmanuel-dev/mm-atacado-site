let catalog = [];
let categories = [];
let catalogTokens = new Map();
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const stopWords = new Set('a ao as com da das de do dos e em eu me minha meu na no o os ou para pra por que um uma quero preciso gostaria pode tem preciso preciso buscar encontrar comprar compra montar montar ver mostre mostrar mix produtos produto loja lojas revenda revender atacado lojista'.split(' '));
const normalize = text => text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
const tokenize = text => normalize(text).match(/[a-z0-9]+/g) ?? [];
const icon = name => '<svg aria-hidden="true"><use href="#i-' + name + '"/></svg>';
const photo = product => product.image.startsWith('uploads/') ? product.image : 'assets/' + product.image + '.webp';
const productLabel = product => product.brand + ' ' + product.name;
const byId = id => catalog.find(product => product.id === id);

function searchCatalog(query, category) {
  const terms = [...new Set(tokenize(query).filter(term => !stopWords.has(term)))];
  const candidates = catalog.filter(product => category === 'Todos' || product.category === category);
  if (!terms.length) return query.trim() ? [] : candidates;
  return candidates.map(product => ({
    product,
    score: terms.reduce((score, term) => score + Number(catalogTokens.get(product.id).has(term)), 0),
  })).filter(result => result.score > 0).sort((a, b) => b.score - a.score).map(result => result.product);
}

function loadSelection() {
  try {
    const saved = JSON.parse(localStorage.getItem('mm-atacado-selection') ?? '[]');
    return new Set(Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

const selection = loadSelection();
let category = 'Todos';
let query = '';
const input = document.querySelector('#query');
const filters = document.querySelector('#filters');
const departmentTiles = document.querySelector('#department-tiles');
const products = document.querySelector('#products');
const showcase = document.querySelector('#destaques');
const showcaseTrack = document.querySelector('#showcase-track');
const showcasePrev = showcase.querySelector('.showcase-prev');
const showcaseNext = showcase.querySelector('.showcase-next');
const results = document.querySelector('#results');
const reset = document.querySelector('#reset');
const dialog = document.querySelector('#dialog');
const dialogContent = document.querySelector('#dialog-content');
const listButton = document.querySelector('.list-open');
const count = document.querySelector('.list-count');
let dialogProduct = null;

function productCard(product) {
  return `<article class="product">
    <button class="product-media" type="button" data-detail="${escapeHtml(product.id)}" aria-label="Ver detalhes de ${escapeHtml(productLabel(product))}"><img src="${escapeHtml(photo(product))}" alt="" loading="lazy"></button>
    <div class="product-info"><div><small>${escapeHtml(product.brand)}</small><h3><button type="button" data-detail="${escapeHtml(product.id)}">${escapeHtml(product.name)}</button></h3><span class="product-code">Cód. ${escapeHtml(product.id)}</span></div>
      <button class="icon-button" type="button" data-select="${escapeHtml(product.id)}" aria-label="Selecionar ${escapeHtml(productLabel(product))}" aria-pressed="false">${icon('plus')}</button>
    </div>
  </article>`;
}

function syncSelection() {
  count.hidden = selection.size === 0;
  count.textContent = selection.size;
  listButton.setAttribute('aria-label', 'Minha seleção (' + selection.size + ')');
  document.querySelectorAll('.product [data-select]').forEach(button => {
    const selected = selection.has(button.dataset.select);
    const label = productLabel(byId(button.dataset.select));
    button.setAttribute('aria-pressed', selected);
    button.setAttribute('aria-label', (selected ? 'Remover ' : 'Selecionar ') + label);
    button.innerHTML = icon(selected ? 'check' : 'plus');
  });
}

function renderCatalog() {
  const visible = searchCatalog(query, category);
  filters.querySelectorAll('[data-category]').forEach(button =>
    button.setAttribute('aria-pressed', categories[Number(button.dataset.category)] === category)
  );
  reset.hidden = !query;
  products.getAnimations().forEach(animation => animation.cancel());
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    products.animate([{ opacity: .3, transform: 'translateY(9px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 280, easing: 'cubic-bezier(.22,1,.36,1)' });
  }
  results.textContent = visible.length + (visible.length === 1 ? ' produto' : ' produtos') +
    (query ? ' para “' + query + '”' : '');
  products.innerHTML = visible.length ? visible.map(productCard).join('') :
    '<div class="empty"><h3>Nenhum produto encontrado</h3><p>Tente buscar por categoria, marca, código ou modelo.</p><button type="button" class="button dark" data-reset>Ver todos os produtos</button></div>';
  syncSelection();
}

function showResults() {
  document.querySelector('#catalogo').scrollIntoView({ block: 'start' });
}

function submitQuery(value) {
  query = value.trim();
  category = 'Todos';
  input.value = query;
  renderCatalog();
  showResults();
}

function resetQuery(clearCategory = false) {
  query = '';
  input.value = '';
  if (clearCategory) category = 'Todos';
  renderCatalog();
  filters.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
}

function quoteLink(items) {
  const list = items.map(product => '- ' + productLabel(product) + ' (cód. ' + product.id + ')').join('\n');
  const subject = encodeURIComponent('Consulta comercial | MM Atacado');
  const body = encodeURIComponent('Olá, equipe MM Atacado! Gostaria de consultar preços, estoque e condições para os itens abaixo.\n\n' + list + '\n\nObrigado!');
  return 'mailto:atacado@mmatacado.com.br?subject=' + subject + '&body=' + body;
}

function renderDialog() {
  if (dialogProduct) {
    const product = dialogProduct;
    const selected = selection.has(product.id);
    dialogContent.innerHTML = `<div class="dialog-product"><img class="dialog-photo" src="${escapeHtml(photo(product))}" alt="${escapeHtml(productLabel(product))}">
      <div><h2 id="dialog-title">${escapeHtml(productLabel(product))}</h2><p>Modelo ${escapeHtml(product.model)} · Cód. ${escapeHtml(product.id)}</p><p>Consulte estoque, preço e condições com o time comercial.</p>
      <div class="dialog-actions"><button type="button" class="button red" data-select="${escapeHtml(product.id)}">${icon(selected ? 'check' : 'plus')} ${selected ? 'Remover da seleção' : 'Adicionar à seleção'}</button><a class="button dark" href="${quoteLink([product])}">Consultar produto</a></div></div></div>`;
    return;
  }
  const items = [...selection].map(byId).filter(Boolean);
  dialogContent.innerHTML = '<h2 id="dialog-title">Minha seleção</h2>' + (items.length
    ? '<p>Revise sua lista e abra um e-mail com os itens para o time comercial.</p><ul class="selection">' +
      items.map(product => `<li><span><strong>${escapeHtml(productLabel(product))}</strong><br>Cód. ${escapeHtml(product.id)}</span><button type="button" class="plain" data-select="${escapeHtml(product.id)}" aria-label="Remover ${escapeHtml(productLabel(product))}">Remover</button></li>`).join('') +
      '</ul><div class="dialog-actions"><a class="button red" href="' + quoteLink(items) + '">Consultar seleção ' + icon('arrow') + '</a></div>'
    : '<p>Adicione produtos à sua seleção usando o botão + na vitrine.</p>');
}

function openDialog(product = null) {
  dialogProduct = product;
  renderDialog();
  dialog.showModal();
}

function toggleSelection(id) {
  const product = byId(id);
  if (!product) return;
  const selected = !selection.delete(id);
  if (selected) selection.add(id);
  try {
    localStorage.setItem('mm-atacado-selection', JSON.stringify([...selection]));
  } catch {
    // The selection remains available in this tab.
  }
  syncSelection();
  document.querySelector('#selection-status').textContent = productLabel(product) +
    (selected ? ' adicionado à seleção.' : ' removido da seleção.');
  if (dialog.open) {
    renderDialog();
    (dialog.querySelector('[data-select]') ?? dialog.querySelector('.close')).focus();
  }
}

document.querySelector('#search-form').addEventListener('submit', event => {
  event.preventDefault();
  submitQuery(input.value);
});
document.querySelectorAll('[data-query]').forEach(button =>
  button.addEventListener('click', () => submitQuery(button.dataset.query))
);
filters.addEventListener('click', event => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  category = categories[Number(button.dataset.category)];
  renderCatalog();
});
departmentTiles.addEventListener('click', event => {
  const tile = event.target.closest('[data-category]');
  if (!tile) return;
  query = '';
  input.value = '';
  category = categories[Number(tile.dataset.category)];
  renderCatalog();
  showResults();
  filters.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
});
function handleProductClick(event) {
  const detail = event.target.closest('[data-detail]');
  const select = event.target.closest('[data-select]');
  if (detail) openDialog(byId(detail.dataset.detail));
  if (select) toggleSelection(select.dataset.select);
  if (event.target.closest('[data-reset]')) resetQuery(true);
}

products.addEventListener('click', handleProductClick);
showcaseTrack.addEventListener('click', handleProductClick);
reset.addEventListener('click', () => resetQuery());
document.querySelector('#full-catalog').addEventListener('click', () => resetQuery(true));
listButton.addEventListener('click', () => openDialog());
dialog.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
  const button = event.target.closest('[data-select]');
  if (button) toggleSelection(button.dataset.select);
});
function focusSearch() {
  document.querySelector('#busca').scrollIntoView({ block: 'start' });
  input.focus({ preventScroll: true });
}

document.querySelector('#mobile-search').addEventListener('click', focusSearch);
document.querySelector('.header-search').addEventListener('click', event => {
  event.preventDefault();
  focusSearch();
});

const departmentMenu = document.querySelector('#department-menu');
const menuContent = document.querySelector('#department-menu-content');
const heroProducts = document.querySelector('#hero-products');

function renderCommercialNavigation() {
  const grouped = new Map();
  for (const product of catalog) {
    if (!grouped.has(product.category)) grouped.set(product.category, []);
    grouped.get(product.category).push(product);
  }

  menuContent.innerHTML = [...grouped].map(([category, items]) => `
    <section class="menu-category">
      <button type="button" data-category="${categories.indexOf(category)}">${escapeHtml(category)}</button>
      ${items.slice(0, 4).map(product => `<button type="button" data-detail="${escapeHtml(product.id)}">${escapeHtml(product.name)}</button>`).join('')}
    </section>`).join('') + '<a href="#departamentos">Ver todos os departamentos</a>';

  const featured = [...grouped.values()].slice(0, 3).map(items => items[0]);
  heroProducts.innerHTML = featured.map(product => `
    <button type="button" data-detail="${escapeHtml(product.id)}">
      <img src="${escapeHtml(photo(product))}" alt="">
      <span>${escapeHtml(product.name)}</span>
    </button>`).join('');
}

let menuCloseTimer;
let openedByHover = false;

departmentMenu.addEventListener('pointerenter', event => {
  if (event.pointerType !== 'mouse') return;
  clearTimeout(menuCloseTimer);
  if (!departmentMenu.open) {
    departmentMenu.open = true;
    openedByHover = true;
  }
});

departmentMenu.addEventListener('pointerleave', event => {
  if (event.pointerType !== 'mouse' || !openedByHover) return;
  menuCloseTimer = setTimeout(() => {
    if (!departmentMenu.matches(':focus-within')) departmentMenu.open = false;
  }, 180);
});

departmentMenu.querySelector('summary').addEventListener('click', () => {
  openedByHover = false;
  clearTimeout(menuCloseTimer);
});

menuContent.addEventListener('click', event => {
  const categoryButton = event.target.closest('[data-category]');
  const detail = event.target.closest('[data-detail]');
  if (!categoryButton && !detail && !event.target.closest('a')) return;
  departmentMenu.open = false;
  if (detail) {
    departmentMenu.querySelector('summary').focus();
    openDialog(byId(detail.dataset.detail));
  }
  if (categoryButton) {
    resetQuery(true);
    category = categories[Number(categoryButton.dataset.category)];
    renderCatalog();
    showResults();
    filters.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
  }
});

document.addEventListener('click', event => {
  if (!departmentMenu.contains(event.target)) departmentMenu.open = false;
});
departmentMenu.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !departmentMenu.open) return;
  departmentMenu.open = false;
  departmentMenu.querySelector('summary').focus();
});
heroProducts.addEventListener('click', handleProductClick);

function renderDepartments() {
  const featured = ['Eletrodomésticos', 'Móveis', 'TV e áudio'];
  const departments = [...new Set([...featured, ...categories.slice(1)])]
    .map(name => catalog.find(product => product.category === name))
    .filter(Boolean);
  departmentTiles.innerHTML = departments.map(product => `<button type="button" class="department-tile" data-category="${categories.indexOf(product.category)}">
    <img src="${escapeHtml(photo(product))}" alt="" loading="lazy">
    <span><strong>${escapeHtml(product.category)}</strong><span class="tile-arrow">${icon('arrow')}</span></span>
  </button>`).join('');
}

async function loadCatalog() {
  try {
    const response = await fetch('data/catalog.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Catálogo indisponível');
    catalog = await response.json();
    categories = ['Todos', ...new Set(catalog.map(product => product.category))];
    catalogTokens = new Map(catalog.map(product => [product.id, new Set(tokenize(
      [product.id, product.brand, product.name, product.model, product.category, product.tags].join(' ')
    ))]));
    for (const id of selection) {
      if (!byId(id)) selection.delete(id);
    }
    filters.innerHTML = categories.map((item, index) =>
      '<button type="button" class="filter" data-category="' + index + '" aria-pressed="' + (index === 0) + '">' +
      (index === 0 ? icon('grid') : '') + escapeHtml(item) + '</button>'
    ).join('');
    renderDepartments();
    renderCommercialNavigation();
    showcaseTrack.innerHTML = catalog.map(productCard).join('');
    showcase.hidden = catalog.length === 0;
    renderCatalog();
  } catch {
    results.textContent = 'O catálogo não carregou. Recarregue a página ou fale com o time comercial.';
  }
}

const motion = matchMedia('(prefers-reduced-motion: no-preference)');

function updateShowcaseControls() {
  const remaining = showcaseTrack.scrollWidth - showcaseTrack.clientWidth - showcaseTrack.scrollLeft;
  showcasePrev.setAttribute('aria-disabled', showcaseTrack.scrollLeft < 1);
  showcaseNext.setAttribute('aria-disabled', remaining < 1);
}

for (const [button, direction] of [[showcasePrev, -1], [showcaseNext, 1]]) {
  button.addEventListener('click', () => {
    if (button.getAttribute('aria-disabled') === 'true') return;
    const [first, second] = showcaseTrack.children;
    if (!second) return;
    const step = second.offsetLeft - first.offsetLeft;
    showcaseTrack.scrollBy({ left: direction * step, behavior: motion.matches ? 'smooth' : 'instant' });
  });
}
showcaseTrack.addEventListener('scroll', updateShowcaseControls, { passive: true });
new ResizeObserver(updateShowcaseControls).observe(showcaseTrack);
loadCatalog();
const navigationLinks = [...document.querySelectorAll('.desktop-nav a, .mobile-nav a[href^="#"]')];
const sections = [...document.querySelectorAll([...new Set(navigationLinks.map(link => link.hash))].join(','))];
let scrollFrame = 0;

function markCurrentSection() {
  const current = sections.findLast(section => section.getBoundingClientRect().top <= 130);
  navigationLinks.forEach(link => {
    if (link.hash === '#' + current?.id) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  scrollFrame = 0;
}

window.addEventListener('scroll', () => {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(markCurrentSection);
}, { passive: true });
markCurrentSection();

const sectionReveal = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    if (motion.matches) entry.target.animate(
      [{ opacity: .55, transform: 'translateY(22px)' }, { opacity: 1, transform: 'none' }],
      { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' }
    );
    sectionReveal.unobserve(entry.target);
  }
}, { threshold: .17 });

document.querySelectorAll('.product-showcase, .manifesto-inner, .team').forEach(section => sectionReveal.observe(section));

const storyTrack = document.querySelector('#story-track');
const storySlides = [...storyTrack.querySelectorAll('.story-slide')];
const storyDots = [...document.querySelectorAll('[data-story]')];
let currentStory = 0;
storySlides[0].classList.add('story-active');

function storyOffset(slide) {
  return slide.offsetLeft - storySlides[0].offsetLeft;
}

function showStory(index) {
  elapsedStoryTime = 0;
  const target = (index + storySlides.length) % storySlides.length;
  storyTrack.scrollTo({ left: storyOffset(storySlides[target]), behavior: motion.matches ? 'smooth' : 'instant' });
}

storyTrack.addEventListener('scroll', () => {
  const index = storySlides.findLastIndex((slide, position) => storyTrack.scrollLeft >= (storyOffset(slide) + storyOffset(storySlides[Math.max(0, position - 1)])) / 2);
  if (index < 0 || index === currentStory) return;
  storySlides[currentStory].classList.remove('story-active');
  currentStory = index;
  storySlides[currentStory].classList.add('story-active');
  elapsedStoryTime = 0;
  storyDots.forEach((dot, position) => {
    if (position === currentStory) dot.setAttribute('aria-current', 'true');
    else dot.removeAttribute('aria-current');
  });
}, { passive: true });
document.querySelector('.story-prev').addEventListener('click', () => showStory(currentStory - 1));
document.querySelector('.story-next').addEventListener('click', () => showStory(currentStory + 1));
storyDots.forEach((dot, index) => dot.addEventListener('click', () => showStory(index)));

const heroCarousel = storyTrack.closest('.corporate-hero');
const storyPause = heroCarousel.querySelector('.story-pause');
let autoplayPaused = false;

function updateAutoplayControl() {
  storyPause.hidden = !motion.matches;
  storyPause.textContent = autoplayPaused ? '▶' : 'Ⅱ';
  storyPause.setAttribute('aria-label', autoplayPaused ? 'Retomar slides' : 'Pausar slides');
}

storyPause.addEventListener('click', () => {
  autoplayPaused = !autoplayPaused;
  updateAutoplayControl();
});
motion.addEventListener('change', updateAutoplayControl);
updateAutoplayControl();

const storyTimer = heroCarousel.querySelector('.story-timer span');
const storyDuration = 7000;
let elapsedStoryTime = 0;
let lastFrame;

function updateStoryTimer(now) {
  const elapsed = lastFrame === undefined ? 0 : Math.min(now - lastFrame, 100);
  lastFrame = now;
  const bounds = heroCarousel.getBoundingClientRect();
  const focused = heroCarousel.contains(document.activeElement) && document.activeElement !== storyPause;
  const hovered = matchMedia('(hover: hover)').matches && heroCarousel.matches(':hover');
  if (!autoplayPaused && motion.matches && !document.hidden && !focused && !hovered &&
      bounds.bottom > 135 && bounds.top < window.innerHeight) {
    elapsedStoryTime += elapsed;
    if (elapsedStoryTime >= storyDuration) showStory(currentStory + 1);
  }
  storyTimer.style.transform = 'scaleX(' + elapsedStoryTime / storyDuration + ')';
  requestAnimationFrame(updateStoryTimer);
}
requestAnimationFrame(updateStoryTimer);

const leadForm = document.querySelector('#lead-form');
const leadStatus = document.querySelector('#lead-status');

leadForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = leadForm.querySelector('button[type="submit"]');
  const payload = Object.fromEntries(new FormData(leadForm));
  submit.disabled = true;
  leadStatus.textContent = 'Enviando cadastro…';
  try {
    const response = await fetch(leadForm.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      leadStatus.textContent = result.error || 'Não foi possível enviar o cadastro.';
      return;
    }
    leadForm.reset();
    leadStatus.textContent = 'Cadastro recebido. Obrigado pelo interesse no MM Atacado.';
  } catch {
    leadStatus.textContent = 'Não foi possível enviar. Confira a conexão e tente novamente.';
  } finally {
    submit.disabled = false;
  }
});

document.querySelectorAll('[data-open-dialog]').forEach(button => {
  const panel = document.getElementById(button.dataset.openDialog);
  button.addEventListener('click', () => panel.showModal());
  panel.addEventListener('click', event => {
    if (event.target === panel) panel.close();
  });
});
