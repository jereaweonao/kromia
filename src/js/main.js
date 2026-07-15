let lang = 'es';
let colorNamesDB, i18n;
const t = (k) => i18n[lang][k] || k;

// --- ESTADO Y COLORES ---
let palette = [];
let activeEditor = null;
let currentMode = 'random';

function getHex(c) { return chroma(c.h, c.s, c.l, 'hsl').hex().toUpperCase(); }
function getContrast(c) { return chroma.contrast(getHex(c), '#000') > 4.5 ? '#000000' : '#FFFFFF'; }

function getColorName(c) {
  const hex = getHex(c);
  let minDist = Infinity;
  let closestName = 'Color';
  colorNamesDB[lang].forEach(entry => {
    const dist = chroma.distance(hex, entry.hex);
    if (dist < minDist) { minDist = dist; closestName = entry.name; }
  });
  return closestName;
}

// --- ALGORITMOS DE PALETAS COHERENTES ---
function randomHue() { return Math.floor(Math.random() * 360) }
function genColor(mode, baseHue) {
  switch (mode) {
    case 'analogous': {
      const h = (baseHue + Math.floor(Math.random() * 60 - 30) + 360) % 360;
      const s = 0.55 + Math.random() * 0.2;
      const l = 0.45 + Math.random() * 0.2;
      return { h, s, l };
    }
    case 'monochrome': {
      const h = baseHue;
      const s = 0.3 + Math.random() * 0.3;
      const l = 0.2 + Math.random() * 0.6;
      return { h, s, l };
    }
    case 'complementary': {
      const h = Math.random() < 0.5 ? baseHue : (baseHue + 180) % 360;
      const s = 0.5 + Math.random() * 0.3;
      const l = 0.4 + Math.random() * 0.2;
      return { h, s, l };
    }
    case 'pastel': {
      const h = randomHue();
      const s = 0.25 + Math.random() * 0.2;
      const l = 0.75 + Math.random() * 0.1;
      return { h, s, l };
    }
    case 'vivid': {
      const h = randomHue();
      const s = 0.85 + Math.random() * 0.15;
      const l = 0.45 + Math.random() * 0.1;
      return { h, s, l };
    }
    case 'expand': {
      const lockedColors = palette.filter(c => c.locked);
      const refColor = lockedColors.length > 0 ? lockedColors[Math.floor(Math.random() * lockedColors.length)] : (palette[0] || { h: randomHue(), s: 0.5, l: 0.5 });
      const h = (refColor.h + 30 + Math.random() * 120) % 360;
      const s = Math.max(0.1, Math.min(1, refColor.s + (Math.random() * 0.2 - 0.1)));
      const l = Math.max(0.1, Math.min(0.9, refColor.l + (Math.random() * 0.2 - 0.1)));
      return { h, s, l };
    }
    default: {
      const h = randomHue();
      const s = 0.4 + Math.random() * 0.4;
      const l = 0.4 + Math.random() * 0.3;
      return { h, s, l };
    }
  }
}
function genPalette() {
  const lockedC = palette.find(c => c.locked);
  const baseHue = lockedC ? lockedC.h : randomHue();
  palette = palette.map(c => c.locked ? c : genColor(currentMode, baseHue));
  updateStrips();
}

function addColor() {
  palette.push(genColor(currentMode, palette.length ? palette[0].h : randomHue()));
  const i = palette.length - 1;

  const prevAddBtnGroup = document.querySelector(`.color-strip[data-index="${i - 1}"] .btn-top .btn-subgroup.right`);
  if (prevAddBtnGroup) prevAddBtnGroup.remove();

  const el = createStrip(i, true);
  el.style.flexGrow = '0';
  el.style.opacity = '0';
  el.style.transform = 'scale(0.9)';

  $('#palette').appendChild(el);
  updateSingleStripUI(i);
  updateURL();

  void el.offsetWidth;
  requestAnimationFrame(() => {
    el.style.flexGrow = '1';
    el.style.opacity = '1';
    el.style.transform = 'scale(1)';
  });
}

function removeColor(i) {
  if (palette.length <= 2) { toast(t('minColors'), 'error'); return }
  if (activeEditor === i) closeEditor();

  const el = document.querySelector(`.color-strip[data-index="${i}"]`);
  if (el) {
    el.style.flexGrow = '0';
    el.style.flexBasis = '0';
    el.style.opacity = '0';
    el.style.transform = 'scale(0.9)';
    el.style.filter = 'blur(4px)';

    el.addEventListener('transitionend', function handler(e) {
      if (e.propertyName === 'opacity' || e.propertyName === 'transform') {
        el.removeEventListener('transitionend', handler);
        palette.splice(i, 1);
        buildPalette(true);
        updateURL();
      }
    });
  }
}

const $ = s => document.querySelector(s);

function buildPalette(silent = false) {
  const main = $('#palette');
  main.innerHTML = '';
  palette.forEach((_, i) => {
    const isLast = i === palette.length - 1;
    const el = createStrip(i, isLast);
    if (silent) {
      el.style.animation = 'none';
      el.style.opacity = '1';
      el.style.transform = 'scale(1)';
      el.style.filter = 'none';
    }
    main.appendChild(el);
  });
  updateStrips();
}

function createStrip(i, isLast) {
  const el = document.createElement('div');
  el.className = 'color-strip';
  el.dataset.index = i;
  el.style.animationDelay = (i * .04) + 's';

  let addButtonHtml = '';
  if (isLast) {
    addButtonHtml = `<button class="glass-btn btn-add no-drag" id="add-btn" title="Agregar color"><iconify-icon icon="lucide:plus" width="14" draggable="false"></iconify-icon></button>`;
  }

  el.innerHTML = `
    <div class="hex-label" id="hex-label-${i}">
      <span id="hex-${i}" class="hex-code no-drag"></span>
      <span class="color-name no-drag" id="name-${i}"></span>
    </div>
    <div class="btn-overlay">
      <div class="btn-top">
        <button class="glass-btn btn-delete no-drag" id="dbtn-${i}" title="${t('removeColor')}"><iconify-icon icon="lucide:x" width="14" draggable="false"></iconify-icon></button>
        ${addButtonHtml}
      </div>
      <div class="btn-bottom">
        <div class="btn-group-left no-drag">
          <button class="glass-btn no-drag" id="lbtn-${i}" title="Bloquear"><iconify-icon icon="lucide:lock-open" width="14" id="licon-${i}" draggable="false"></iconify-icon></button>
          <button class="glass-btn no-drag" id="cbtn-${i}" title="${t('copy')}"><iconify-icon icon="lucide:copy" width="14" draggable="false"></iconify-icon></button>
        </div>
        <button class="glass-btn no-drag" id="ebtn-${i}" title="${t('adjustColor')}"><iconify-icon icon="lucide:sliders-horizontal" width="14" draggable="false"></iconify-icon></button>
      </div>
    </div>
  `;

  el.querySelector(`#dbtn-${i}`).onclick = e => { e.stopPropagation(); removeColor(i) };
  el.querySelector(`#lbtn-${i}`).onclick = e => { e.stopPropagation(); toggleLock(i) };
  el.querySelector(`#cbtn-${i}`).onclick = e => { e.stopPropagation(); copyColor(i) };
  el.querySelector(`#ebtn-${i}`).onclick = e => { e.stopPropagation(); toggleEditor(i) };

  if (isLast) {
    el.querySelector('#add-btn').onclick = e => { e.stopPropagation(); addColor(); };
  }

  const hexSpan = el.querySelector(`#hex-${i}`);
  hexSpan.addEventListener('click', (ev) => {
    ev.stopPropagation();
    makeEditable(i);
  });

  return el;
}

function makeEditable(i) {
  const span = document.getElementById(`hex-${i}`);
  if (span.contentEditable === "true") return;

  span.contentEditable = "true";
  span.focus();

  const range = document.createRange();
  range.selectNodeContents(span);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  span.onkeydown = (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); span.blur(); }
    if (ev.key === 'Escape') { ev.preventDefault(); span.textContent = getHex(palette[i]); span.blur(); }
  };

  span.onblur = () => {
    span.contentEditable = "false";
    let val = span.innerText.trim().toUpperCase();
    updateColorFromHex(i, val);
    span.innerText = getHex(palette[i]);
  };
}

function updateSingleStripUI(i) {
  const c = palette[i];
  const hex = getHex(c);
  const strip = document.querySelector(`.color-strip[data-index="${i}"]`);
  if (strip) {
    strip.style.backgroundColor = hex;
    strip.style.color = getContrast(c);
    const hexSpan = document.getElementById(`hex-${i}`);
    if (hexSpan && hexSpan.contentEditable !== "true") {
      hexSpan.textContent = hex;
    }
    document.getElementById(`name-${i}`).textContent = getColorName(c);
    document.getElementById(`licon-${i}`).setAttribute('icon', c.locked ? 'lucide:lock' : 'lucide:lock-open');
  }
}

function updateStrips() {
  palette.forEach((c, i) => updateSingleStripUI(i));
  updateURL();
}

function toggleLock(i) { palette[i].locked = !palette[i].locked; updateSingleStripUI(i) }
function copyColor(i) { navigator.clipboard.writeText(getHex(palette[i])).then(() => toast(t('copied'))) }

function toggleEditor(i) {
  if (activeEditor === i) { closeEditor(); return }
  if (activeEditor !== null) document.querySelector(`.color-strip[data-index="${activeEditor}"]`)?.classList.remove('editing');
  activeEditor = i;
  document.querySelector(`.color-strip[data-index="${i}"]`).classList.add('editing');
  populateEditor(i);
  $('#global-edit-panel').classList.add('open');
}
function closeEditor() {
  if (activeEditor === null) return;
  document.querySelector(`.color-strip[data-index="${activeEditor}"]`)?.classList.remove('editing');
  $('#global-edit-panel').classList.remove('open');
  activeEditor = null;
}

function handleCopyClick(i, btn) {
  const hex = getHex(palette[i]);
  navigator.clipboard.writeText(hex).then(() => {
    const originalHtml = `<iconify-icon icon="lucide:copy" width="14" draggable="false"></iconify-icon> ${t('copy')}`;
    btn.innerHTML = `<iconify-icon icon="lucide:check" width="14" draggable="false"></iconify-icon> ${t('copied')}`;
    btn.style.color = 'var(--accent)';
    btn.style.borderColor = 'var(--accent)';
    setTimeout(() => {
      btn.innerHTML = originalHtml;
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 1500);
  });
}

function populateEditor(i) {
  const c = palette[i];
  const hex = getHex(c);
  const panel = $('#global-edit-panel');
  const lts = [0.95, 0.85, 0.72, 0.6, 0.5, 0.4, 0.28, 0.18, 0.1];

  panel.innerHTML = `
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-lg font-bold" style="color:var(--text)">${t('adjustColor')}</h3>
      <button class="pill-btn" style="width:32px;height:32px" onclick="closeEditor()">
        <iconify-icon icon="lucide:x" width="16" draggable="false"></iconify-icon>
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6 items-center w-full">
      <div class="flex items-center gap-4 w-full">
        <div class="preview-box" style="height:80px;width:80px;border-radius:16px;background:${hex};box-shadow:0 4px 12px rgba(0,0,0,0.1);flex-shrink:0"></div>
        <div class="flex-1 w-full">
          <input type="text" class="hex-input" value="${hex}" oninput="updateColorFromHex(${i}, this.value)" maxlength="7">
          <div class="flex gap-2 mt-2">
            <button class="val-chip flex-1 justify-center" onclick="handleCopyClick(${i}, this)"><iconify-icon icon="lucide:copy" width="14" draggable="false"></iconify-icon> ${t('copy')}</button>
            ${palette.length > 2 ? `<button class="val-chip justify-center" style="color:#ef4444;border-color:rgba(239,68,68,.3);flex:1" onclick="removeColor(${i})"><iconify-icon icon="lucide:trash-2" width="14" draggable="false"></iconify-icon></button>` : ''}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
        <div>
          <label style="font-size:11px;color:var(--ui-text);margin-bottom:8px;display:flex;justify-content:space-between"><span>${t('tone')}</span> <span id="lbl-h">${Math.round(c.h)}°</span></label>
          <div id="slider-h"></div>
        </div>
        <div>
          <label style="font-size:11px;color:var(--ui-text);margin-bottom:8px;display:flex;justify-content:space-between"><span>${t('sat')}</span> <span id="lbl-s">${Math.round(c.s * 100)}%</span></label>
          <div id="slider-s"></div>
        </div>
        <div>
          <label style="font-size:11px;color:var(--ui-text);margin-bottom:8px;display:flex;justify-content:space-between"><span>${t('light')}</span> <span id="lbl-l">${Math.round(c.l * 100)}%</span></label>
          <div id="slider-l"></div>
        </div>
      </div>
    </div>

    <div class="mt-5">
      <label style="font-size:11px;color:var(--ui-text);display:block;margin-bottom:8px">${t('shades')}</label>
      <div style="display:grid;grid-template-columns:repeat(9, 1fr);gap:8px" id="swatches-grid">
        ${lts.map((ll, idx) => `<div class="shade-swatch" data-idx="${idx}" style="background:${getHex({ ...c, l: ll })};color:${getContrast({ ...c, l: ll })}" onclick="pickShade(${i},${ll})"></div>`).join('')}
      </div>
    </div>
  `;

  const sliderH = document.getElementById('slider-h');
  noUiSlider.create(sliderH, { start: c.h, range: { 'min': 0, 'max': 360 }, step: 1 });
  sliderH.noUiSlider.on('slide', v => onSlider(i, 'h', v[0]));

  const sliderS = document.getElementById('slider-s');
  noUiSlider.create(sliderS, { start: c.s * 100, range: { 'min': 0, 'max': 100 }, step: 1 });
  sliderS.style.background = `linear-gradient(to right, hsl(${c.h},0%,${c.l * 100}%), hsl(${c.h},100%,${c.l * 100}%))`;
  sliderS.noUiSlider.on('slide', v => onSlider(i, 's', v[0]));

  const sliderL = document.getElementById('slider-l');
  noUiSlider.create(sliderL, { start: c.l * 100, range: { 'min': 0, 'max': 100 }, step: 1 });
  sliderL.style.background = `linear-gradient(to right, #000, hsl(${c.h},${c.s * 100}%,50%), #fff)`;
  sliderL.noUiSlider.on('slide', v => onSlider(i, 'l', v[0]));
}

function onSlider(i, prop, val) {
  val = parseFloat(val);
  if (prop === 'h') palette[i].h = val;
  else if (prop === 's') palette[i].s = val / 100;
  else if (prop === 'l') palette[i].l = val / 100;

  const c = palette[i];
  const hex = getHex(c);
  const panel = $('#global-edit-panel');

  updateSingleStripUI(i);

  if (panel) {
    const lblH = panel.querySelector('#lbl-h'); if (lblH) lblH.textContent = Math.round(c.h) + '°';
    const lblS = panel.querySelector('#lbl-s'); if (lblS) lblS.textContent = Math.round(c.s * 100) + '%';
    const lblL = panel.querySelector('#lbl-l'); if (lblL) lblL.textContent = Math.round(c.l * 100) + '%';

    const sliderS = document.getElementById('slider-s');
    if (sliderS && prop !== 's') sliderS.style.background = `linear-gradient(to right, hsl(${c.h},0%,${c.l * 100}%), hsl(${c.h},100%,${c.l * 100}%))`;

    const sliderL = document.getElementById('slider-l');
    if (sliderL && prop !== 'l') sliderL.style.background = `linear-gradient(to right, #000, hsl(${c.h},${c.s * 100}%,50%), #fff)`;

    const hexInput = panel.querySelector('.hex-input');
    if (hexInput && document.activeElement !== hexInput) hexInput.value = hex;

    const previewBox = panel.querySelector('.preview-box');
    if (previewBox) previewBox.style.background = hex;

    const lts = [0.95, 0.85, 0.72, 0.6, 0.5, 0.4, 0.28, 0.18, 0.1];
    const swatches = panel.querySelectorAll('.shade-swatch');
    swatches.forEach((sw, idx) => {
      const ll = lts[idx];
      const shex = getHex({ ...c, l: ll });
      sw.style.background = shex;
      sw.style.color = getContrast({ ...c, l: ll });
    });
  }
  updateURL();
}

function updateColorFromHex(i, val) {
  val = val.trim().replace(/[^#0-9a-fA-F]/g, '');
  if (/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)) {
    if (val.length === 3 || val.length === 4) {
      val = val.replace(/^#?([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/, '#$1$1$2$2$3$3');
    }
    val = val.startsWith('#') ? val : '#' + val;
    const newCol = chroma(val).hsl();
    if (!isNaN(newCol[0])) {
      palette[i] = { h: newCol[0], s: newCol[1], l: newCol[2], locked: palette[i].locked };
      updateSingleStripUI(i);
      if (activeEditor === i) {
        const c = palette[i];
        const panel = $('#global-edit-panel');
        if (panel) {
          const sliderH = document.getElementById('slider-h'); if (sliderH && sliderH.noUiSlider) sliderH.noUiSlider.set(c.h);
          const sliderS = document.getElementById('slider-s'); if (sliderS && sliderS.noUiSlider) sliderS.noUiSlider.set(c.s * 100);
          const sliderL = document.getElementById('slider-l'); if (sliderL && sliderL.noUiSlider) sliderL.noUiSlider.set(c.l * 100);
          onSlider(i, 'h', c.h);
        }
      }
    }
  }
}

function pickShade(i, l) {
  palette[i].l = l;
  updateSingleStripUI(i);
  if (activeEditor === i) {
    const panel = $('#global-edit-panel');
    if (panel) {
      const sliderL = document.getElementById('slider-l');
      if (sliderL && sliderL.noUiSlider) sliderL.noUiSlider.set(l * 100);
      onSlider(i, 'l', l * 100);
    }
  }
}

// --- EXPORTAR ---
function toggleExport() {
  const menu = $('#export-menu');
  const isCurrentlyOpen = menu.classList.contains('open');
  closeAllDropdowns();
  if (!isCurrentlyOpen) {
    menu.innerHTML = `
      <div class="dropdown-item" onclick="exportCSS()"><iconify-icon icon="lucide:code-2" draggable="false"></iconify-icon><span>${t('exportCss')}</span></div>
      <div class="dropdown-item" onclick="exportJSON()"><iconify-icon icon="lucide:braces" draggable="false"></iconify-icon><span>${t('exportJson')}</span></div>
      <div class="dropdown-item" onclick="exportURL()"><iconify-icon icon="lucide:link" draggable="false"></iconify-icon><span>${t('exportUrl')}</span></div>
      <div class="dropdown-item" onclick="exportPNG()"><iconify-icon icon="lucide:image" draggable="false"></iconify-icon><span>${t('exportPng')}</span></div>
    `;
    menu.classList.add('open');
  }
}
function exportCSS() { const css = ':root {\n' + palette.map((c, i) => `  --color-${i + 1}: ${getHex(c)};`).join('\n') + '\n}'; navigator.clipboard.writeText(css).then(() => toast(t('cssOk'))); closeAllDropdowns(); }
function exportJSON() { const json = JSON.stringify(palette.map(c => getHex(c)), null, 2); navigator.clipboard.writeText(json).then(() => toast(t('jsonOk'))); closeAllDropdowns(); }
function exportURL() { navigator.clipboard.writeText(location.href).then(() => toast(t('urlOk'))); closeAllDropdowns(); }
function exportPNG() {
  const w = 1200, h = 400, n = palette.length, cw = w / n;
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  palette.forEach((c, i) => { const hex = getHex(c); ctx.fillStyle = hex; ctx.fillRect(i * cw, 0, cw, h); ctx.fillStyle = getContrast(c); ctx.font = '600 16px Inter,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(hex, i * cw + cw / 2, h - 30) });
  canvas.toBlob(blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'kromia-palette.png'; a.click(); URL.revokeObjectURL(url) });
  toast(t('pngOk')); closeAllDropdowns();
}

// --- UI HELPERS ---
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = 'toast-item';
  if (type === 'error') {
    el.style.background = 'var(--accent)';
    el.style.color = '#000';
    el.style.borderColor = 'var(--accent)';
    el.innerHTML = `<iconify-icon icon="lucide:x" width="18" style="color:#000"></iconify-icon><span>${msg}</span>`;
  } else {
    el.innerHTML = `<iconify-icon icon="lucide:check-circle" width="18" style="color:var(--accent)"></iconify-icon><span>${msg}</span>`;
  }
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function updateURL() { history.replaceState(null, '', '#' + palette.map(c => getHex(c).slice(1)).join('-')) }
function initFromURL() { const hash = location.hash.slice(1); if (!hash) return false; const parts = hash.split('-').filter(Boolean); if (parts.length >= 2 && parts.every(p => /^[0-9a-fA-F]{6}$/.test(p))) { palette = parts.map(hex => { const c = chroma('#' + hex).hsl(); return { h: isNaN(c[0]) ? 0 : c[0], s: c[1], l: c[2], locked: false } }); return true } return false }

// --- MODAL Y INDICADOR ---
function moveTabIndicator(activeBtn) {
  const indicator = document.querySelector('.tab-indicator');
  if (indicator && activeBtn) {
    indicator.style.left = activeBtn.offsetLeft + 'px';
    indicator.style.width = activeBtn.offsetWidth + 'px';
  }
}

function openModal(tab) {
  switchTab(tab);
  $('#info-modal').classList.remove('hidden');
  setTimeout(() => {
    const activeBtn = document.querySelector('.tab-btn.active');
    moveTabIndicator(activeBtn);
  }, 50);
}
function closeModal() {
  $('#info-modal').classList.add('hidden');
}

function switchTab(tab) {
  const activeBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  moveTabIndicator(activeBtn);

  ['why', 'donate', 'credits'].forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (t === tab) {
      el.classList.remove('hidden');
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = 'tabFadeIn 0.3s ease';
    } else {
      el.classList.add('hidden');
    }
  });
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (i18n[lang][key]) el.textContent = i18n[lang][key];
  });
  document.getElementById('why-points').innerHTML = i18n[lang].whyPoints.map(p => `<li>${p}</li>`).join('');

  const modeMap = { random: 'modeRandom', analogous: 'modeAnalogous', monochrome: 'modeMono', complementary: 'modeComplement', pastel: 'modePastel', vivid: 'modeVivid', expand: 'modeExpand' };
  const activeMode = document.querySelector('#mode-menu .dropdown-item.active');
  if (activeMode) {
    const modeKey = modeMap[activeMode.dataset.mode];
    document.getElementById('mode-text').textContent = t(modeKey);
    document.querySelectorAll('#mode-menu .dropdown-item').forEach(o => {
      const k = modeMap[o.dataset.mode];
      o.textContent = t(k);
    });
  }

  palette.forEach((c, i) => updateSingleStripUI(i));
}

function closeAllDropdowns() {
  document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
}
function toggleMenu(id) {
  const menu = document.getElementById(id);
  const isOpen = menu.classList.contains('open');
  closeAllDropdowns();
  if (!isOpen) menu.classList.add('open');
}
function changeLang(l) {
  lang = l;
  const codes = { es: 'ES', en: 'EN', pt: 'PT', fr: 'FR', de: 'DE' };
  document.getElementById('lang-text').textContent = codes[l];
  document.querySelectorAll('#lang-menu .dropdown-item').forEach(o => o.classList.toggle('active', o.dataset.lang === l));
  applyTranslations();
  toggleMenu('lang-menu');
}
function changeMode(m) {
  currentMode = m;
  document.querySelectorAll('#mode-menu .dropdown-item').forEach(o => o.classList.toggle('active', o.dataset.mode === m));
  applyTranslations();
  toggleMenu('mode-menu');
}

// --- EVENT LISTENERS ---
document.addEventListener('keydown', e => {
  const isTyping = e.target.matches('input,select,textarea,[contenteditable]');
  if (e.code === 'Space' && !isTyping) { e.preventDefault(); genPalette() }
  if (e.key === 'Escape') { closeEditor(); closeModal(); closeAllDropdowns(); }
});

$('#gen-bar').onclick = () => genPalette();
$('#export-btn').onclick = e => { e.stopPropagation(); toggleExport() };
$('#theme-toggle').onclick = () => {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  $('#theme-icon').setAttribute('icon', isDark ? 'lucide:sun' : 'lucide:moon');

  if (!$('#info-modal').classList.contains('hidden')) {
    moveTabIndicator(document.querySelector('.tab-btn.active'));
  }
};

window.addEventListener('resize', () => {
  if (!$('#info-modal').classList.contains('hidden')) {
    moveTabIndicator(document.querySelector('.tab-btn.active'));
  }
});

document.addEventListener('click', e => {
  if (!e.target.closest('.custom-select')) closeAllDropdowns();
  if (activeEditor !== null && !e.target.closest('#global-edit-panel') && !e.target.closest('.color-strip')) closeEditor();
});

// --- INIT ---
(async () => {
  const [colorsRes, translationsRes] = await Promise.all([
    fetch('./json/colors.json'),
    fetch('./json/translations.json')
  ]);
  colorNamesDB = await colorsRes.json();
  i18n = await translationsRes.json();

  if (!initFromURL()) palette = Array.from({ length: 5 }, () => genColor('random', randomHue()));
  buildPalette();
  applyTranslations();

  Sortable.create($('#palette'), {
    animation: 150,
    ghostClass: 'sortable-ghost',
    filter: function(evt) {
      return evt.target.closest('.no-drag') !== null;
    },
    preventOnFilter: false,
    touchStartThreshold: 10,
    onEnd: function(evt) {
      const movedItem = palette.splice(evt.oldIndex, 1)[0];
      palette.splice(evt.newIndex, 0, movedItem);
      buildPalette(true);
      updateURL();
    }
  });
})();

