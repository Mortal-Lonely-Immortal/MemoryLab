/* ================================================================
   ARCHIVE 3D — RhineLab-style memory archive
   Visual/interaction reference: RhineLabUI (MIT)
   https://github.com/LBEILC/RhineLabUI
   The GLB is from that repository; see NOTICE.
   ================================================================ */
import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from './vendor/three/examples/jsm/controls/OrbitControls.js';

const MODEL_URL = './assets/rhine/archive-cassette.glb';
const CASE_HEIGHT = 1.72;
const COL_GAP = 2.75;
const ROW_GAP = 1.42;
const COLS = 5;

const state = {
  container: null,
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  cases: [],
  caseMeshes: [],
  raycaster: null,
  pointer: null,
  hovered: null,
  selected: null,
  focus: null,
  resetPos: new THREE.Vector3(7.45, 3.55, 9.15),
  resetLook: new THREE.Vector3(0, 1.20, 0),
  raf: 0,
  disposed: false,
  options: null,
  resizeObserver: null,
  clock: null,
  focusTimer: null,
};

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function initShell(container, cards, decks) {
  container.innerHTML =
    '<div class="archive3d-shell">' +
      '<div class="archive3d-top">' +
        '<div><div class="archive3d-kicker">RHINE ARCHIVE / MEMORY LAB</div>' +
          '<div class="archive3d-title">ARCHIVE <em>3D</em></div></div>' +
        '<div class="archive3d-top-actions">' +
          '<button class="btn btn-sm" id="archive3d-reset">RESET VIEW</button>' +
          '<button class="btn btn-sm" id="archive3d-list">LIST 列表</button>' +
        '</div>' +
      '</div>' +
      '<div class="archive3d-stage">' +
        '<div class="archive3d-view" id="archive3d-view">' +
          '<div class="archive3d-loading" id="archive3d-loading">LOADING GLB · 正在装载档案盒</div>' +
          '<div class="archive3d-cols" id="archive3d-cols"></div>' +
          '<div class="archive3d-hint">DRAG 旋转 · WHEEL 缩放 · CLICK 档案盒读取 · ESC 关闭</div>' +
        '</div>' +
      '</div>' +
      '<div class="archive3d-foot"><span>5 COLUMNS / ' + cards.length + ' FILES</span><span>GLB · THREE.JS · RHINE VISUAL</span></div>' +
    '</div>';

  let detail = document.getElementById('archive3d-detail');
  if (detail) detail.remove();
  detail = document.createElement('div');
  detail.className = 'archive3d-detail';
  detail.id = 'archive3d-detail';
  document.body.appendChild(detail);

  const colBox = container.querySelector('#archive3d-cols');
  if (colBox) {
    const labels = [];
    for (let c = 0; c < COLS; c++) {
      const first = cards[c];
      const deck = first && decks ? decks.find(function (d) { return d.id === first.deckId; }) : null;
      labels.push('<span>' + esc(deck ? deck.name : ('COLUMN ' + String(c + 1).padStart(2, '0'))) + '</span>');
    }
    colBox.innerHTML = labels.join('');
  }
  container.querySelector('#archive3d-list').addEventListener('click', function () { close(); });
  container.querySelector('#archive3d-reset').addEventListener('click', resetView);
}

function makeLabelTexture(card) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(247,244,238,0.92)';
  ctx.fillRect(4, 4, 504, 120);
  ctx.strokeStyle = '#17130f'; ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, 504, 120);
  ctx.fillStyle = '#15110d';
  ctx.font = '700 24px "Arial Narrow", Arial, sans-serif';
  ctx.fillText('X-' + String(card.id).padStart(3, '0'), 20, 37);
  ctx.font = '600 16px Arial, sans-serif';
  const text = String(card.front || '').replace(/\s+/g, ' ').slice(0, 34);
  ctx.fillText(text, 20, 68);
  ctx.font = '12px Arial, sans-serif';
  ctx.fillStyle = '#6f665b';
  ctx.fillText('MEMORY ARCHIVE · FSRS', 20, 99);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function normalizeModel(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(); box.getSize(size);
  const scale = CASE_HEIGHT / Math.max(0.001, size.y);
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(root);
  root.position.x -= (b.min.x + b.max.x) / 2;
  root.position.y -= b.min.y;
  root.position.z -= (b.min.z + b.max.z) / 2;
  root.updateMatrixWorld(true);
  return root;
}

function addCase(template, card, col, row) {
  const group = new THREE.Group();
  const model = normalizeModel(template.clone(true));
  model.traverse(function (obj) {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (obj.material && 'envMapIntensity' in obj.material) obj.material.envMapIntensity = 1.2;
    }
  });
  group.add(model);

  const tex = makeLabelTexture(card);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.74, 0.44),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide })
  );
  label.position.set(0, 1.02, 0.20);
  group.add(label);

  const rows = Math.max(1, Math.ceil(state.options.cards.length / COLS));
  group.position.set((col - (COLS - 1) / 2) * COL_GAP, 0, (row - (rows - 1) / 2) * ROW_GAP);
  group.userData = { card: card, targetY: 0, hover: false, baseZ: group.position.z };
  state.scene.add(group);
  state.cases.push(group);
  group.traverse(function (obj) { if (obj.isMesh) { obj.userData.caseGroup = group; state.caseMeshes.push(obj); } });
}

function buildDetail(card) {
  const detail = document.getElementById('archive3d-detail');
  if (!detail) return;
  detail.innerHTML =
    '<div class="archive3d-detail-head"><span>FILE X-' + String(card.id).padStart(3, '0') + '</span><button class="archive3d-close" id="archive3d-close">×</button></div>' +
    '<div class="archive3d-detail-body">' +
      '<div class="archive3d-detail-label">QUESTION 问题</div>' +
      '<h2>' + esc(card.front) + '</h2>' +
      '<div class="archive3d-detail-label">ANSWER 答案</div>' +
      '<p>' + esc(card.back || '—') + '</p>' +
      (card.extra ? '<div class="archive3d-detail-extra">' + esc(card.extra) + '</div>' : '') +
    '</div>' +
    '<div class="archive3d-detail-foot">' +
      '<span>#' + card.id + ' · ' + (card.suspended ? 'SUSPENDED' : 'ACTIVE') + '</span>' +
      '<button class="btn btn-sm btn-primary" id="archive3d-edit">EDIT CARD</button>' +
    '</div>';
  detail.classList.add('is-on');
  const closeBtn = detail.querySelector('#archive3d-close');
  if (closeBtn) closeBtn.addEventListener('click', function (e) { e.stopPropagation(); resetView(); });
  const editBtn = detail.querySelector('#archive3d-edit');
  if (editBtn) editBtn.addEventListener('click', function () {
    const id = card.id;
    close();
    if (typeof window.openCardModal === 'function') window.openCardModal(id);
  });
}

function freezeViewWithSnapshot() {
  if (!state.renderer || !state.container) return;
  try {
    const url = state.renderer.domElement.toDataURL('image/png');
    const view = state.container.querySelector('#archive3d-view');
    if (view) {
      view.style.backgroundImage = 'url(' + url + ')';
      view.style.backgroundSize = 'cover';
      view.style.backgroundPosition = 'center';
      view.style.backgroundColor = '#f1eee6';
    }
    state.renderer.domElement.style.visibility = 'hidden';
  } catch (e) {
    // If the driver refuses toDataURL, keep the live canvas.
  }
}

function unfreezeView() {
  if (!state.container) return;
  const view = state.container.querySelector('#archive3d-view');
  if (view) { view.style.backgroundImage = ''; view.style.backgroundSize = ''; view.style.backgroundPosition = ''; }
  if (state.renderer) state.renderer.domElement.style.visibility = 'visible';
}

function selectCase(group) {
  if (!group) return;
  state.selected = group;
  state.focus = {
    camPos: new THREE.Vector3(group.position.x + 1.95, 2.15, group.position.z + 4.45),
    look: new THREE.Vector3(group.position.x, 1.12, group.position.z),
  };
  group.userData.targetY = 0.62;
  if (state.controls) state.controls.enabled = false;
  buildDetail(group.userData.card);
  if (state.focusTimer) clearTimeout(state.focusTimer);
  state.focusTimer = setTimeout(freezeViewWithSnapshot, 620);
}

function resetView() {
  state.selected = null;
  state.focus = null;
  state.cases.forEach(function (g) { g.userData.targetY = g === state.hovered ? 0.10 : 0; });
  if (state.controls) state.controls.enabled = true;
  const detail = state.container && state.container.querySelector('#archive3d-detail');
  if (detail) detail.classList.remove('is-on');
  if (state.focusTimer) { clearTimeout(state.focusTimer); state.focusTimer = null; }
  unfreezeView();
  if (state.camera) state.camera.position.copy(state.resetPos);
  if (state.controls) { state.controls.target.copy(state.resetLook); state.controls.update(); }
}

function onPointerMove(ev) {
  if (!state.camera || state.focus) return;
  const rect = state.renderer.domElement.getBoundingClientRect();
  state.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  state.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  state.raycaster.setFromCamera(state.pointer, state.camera);
  const hits = state.raycaster.intersectObjects(state.caseMeshes, false);
  let group = hits.length ? hits[0].object.userData.caseGroup : null;
  if (group === state.hovered) return;
  if (state.hovered) { state.hovered.userData.targetY = 0; state.hovered.userData.hover = false; }
  state.hovered = group || null;
  if (state.hovered) { state.hovered.userData.targetY = 0.10; state.hovered.userData.hover = true; }
  state.renderer.domElement.style.cursor = group ? 'pointer' : 'grab';
}

function onClick(ev) {
  if (!state.camera || state.focus) return;
  onPointerMove(ev);
  if (state.hovered) selectCase(state.hovered);
}

function animate() {
  if (state.disposed) return;
  state.raf = requestAnimationFrame(animate);
  const k = 0.12;
  state.cases.forEach(function (g) {
    g.position.y += (g.userData.targetY - g.position.y) * k;
    const targetScale = g === state.selected ? 1.075 : 1;
    g.scale.x += (targetScale - g.scale.x) * 0.10;
    g.scale.y = g.scale.x;
    g.scale.z = g.scale.x;
  });
  if (state.focus) {
    state.camera.position.lerp(state.focus.camPos, 0.085);
    state.controls.target.lerp(state.focus.look, 0.085);
    state.camera.lookAt(state.controls.target);
  } else if (state.controls) {
    state.controls.update();
  }
  state.renderer.render(state.scene, state.camera);
}

function onResize() {
  if (!state.renderer || !state.camera || !state.container) return;
  const view = state.container.querySelector('#archive3d-view');
  if (!view) return;
  const w = view.clientWidth, h = view.clientHeight;
  if (!w || !h) return;
  state.camera.aspect = w / h;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(w, h, false);
}

async function open(options) {
  close();
  state.disposed = false;
  document.body.classList.add('archive3d-open');
  state.options = options;
  state.container = options.container;
  state.cases = []; state.caseMeshes = []; state.hovered = null; state.selected = null; state.focus = null;
  initShell(options.container, options.cards, options.decks);
  const view = options.container.querySelector('#archive3d-view');
  const loading = options.container.querySelector('#archive3d-loading');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf1eee6);
  scene.fog = new THREE.Fog(0xf1eee6, 13, 30);
  state.scene = scene;

  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 80);
  camera.position.copy(state.resetPos);
  camera.lookAt(state.resetLook);
  state.camera = camera;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.domElement.className = 'archive3d-canvas';
  view.insertBefore(renderer.domElement, loading);
  state.renderer = renderer;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(state.resetLook);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.minDistance = 4.2;
  controls.maxDistance = 18;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minPolarAngle = Math.PI * 0.16;
  controls.enablePan = false;
  controls.update();
  state.controls = controls;

  scene.add(new THREE.HemisphereLight(0xfffdf8, 0xcfc8bb, 1.35));
  const key = new THREE.DirectionalLight(0xfff4e3, 3.1);
  key.position.set(5, 10, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -14; key.shadow.camera.right = 14;
  key.shadow.camera.top = 14; key.shadow.camera.bottom = -14;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 1.4);
  fill.position.set(-7, 5, 5);
  scene.add(fill);
  const rim = new THREE.PointLight(0xffd9a6, 2.3, 18);
  rim.position.set(0, 5, 2);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 70),
    new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.94, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.012;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(36, 36, 0xd6d0c4, 0xe2dcd0);
  grid.position.y = 0.002;
  grid.material.transparent = true;
  grid.material.opacity = 0.32;
  scene.add(grid);

  state.raycaster = new THREE.Raycaster();
  state.pointer = new THREE.Vector2();
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('click', onClick);
  renderer.domElement.addEventListener('pointerleave', function () {
    if (state.hovered) { state.hovered.userData.targetY = 0; state.hovered = null; }
  });

  onResize();
  state.resizeObserver = new ResizeObserver(onResize);
  state.resizeObserver.observe(view);

  state.clock = new THREE.Clock();
  animate();

  try {
    const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
    if (state.disposed) return;
    const template = gltf.scene;
    // Each clone is normalized independently so the shared template stays
    // untouched.
    options.cards.forEach(function (card, i) {
      addCase(template, card, i % COLS, Math.floor(i / COLS));
    });
    if (loading) loading.classList.add('is-done');
    state.container.querySelector('.archive3d-view').classList.add('is-ready');
  } catch (err) {
    if (loading) loading.textContent = 'GLB 加载失败：' + (err && err.message ? err.message : err);
    console.error('[Archive3D] GLB load failed', err);
  }
}

function close() {
  if (state.disposed) return;
  state.disposed = true;
  cancelAnimationFrame(state.raf);
  if (state.focusTimer) { clearTimeout(state.focusTimer); state.focusTimer = null; }
  if (state.resizeObserver) { state.resizeObserver.disconnect(); state.resizeObserver = null; }
  if (state.renderer) {
    state.renderer.domElement.remove();
    state.renderer.dispose();
    state.renderer = null;
  }
  if (state.scene) {
    state.scene.traverse(function (obj) {
      if (obj.isMesh) {
        if (obj.geometry) obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(function (m) {
          if (!m) return;
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
    state.scene = null;
  }
  if (state.controls) { state.controls.dispose(); state.controls = null; }
  state.cases = []; state.caseMeshes = []; state.container = null; state.camera = null;
  document.body.classList.remove('archive3d-open');
  const detail = document.getElementById('archive3d-detail');
  if (detail) detail.remove();
  const onClose = state.options && state.options.onClose;
  state.options = null;
  if (typeof onClose === 'function') onClose();
}

window.Archive3D = {
  open: open,
  close: close,
  reset: resetView,
};
