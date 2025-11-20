import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { addToCart, isLoggedIn, requireLogin, updateHeader } from './app.js';

const byId = id => document.getElementById(id);
const mmPerIn = 25.4;
const fmt = (v, d=2)=> (Math.round(v*10**d)/10**d).toLocaleString(undefined, {maximumFractionDigits:d});
const round = (v, d=2)=> Math.round(v*10**d)/10**d;
const fmtInput = (v, d=2)=> String(round(v, d));
const editing = new Set();
function markEditing(id){ editing.add(id); }
function unmarkEditing(id){ editing.delete(id); }
function toMM(v){ return state.units==='mm' ? v : v*mmPerIn; }
function fromMM(mm){ return state.units==='mm' ? mm : (mm/mmPerIn); }

// ---------- State
const state = {
  units:'mm', material:'concrete', density:2400, qty:1,
  bc:{ Wi_mm:1500, Hi_mm:1200, t_mm:200, top_mm:200, bot_mm:250, L_mm:2000 },
  commercial:{ mix:'M30', steel:'mesh_std', inner:'none', outer:'acrylic' }
};

// ---------- Scene
const sceneEl = byId('scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f1d);
scene.fog = new THREE.Fog(0x0b0f1d, 800, 20000);

const renderer = new THREE.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
sceneEl.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(sceneEl.clientWidth, sceneEl.clientHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.inset = '0';
labelRenderer.domElement.style.pointerEvents='none';
sceneEl.appendChild(labelRenderer.domElement);

const camera = new THREE.PerspectiveCamera(55, 2, 0.1, 40000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.06;

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.1).texture;

scene.add(new THREE.HemisphereLight(0xffffff, 0x1b203a, 0.55));
const dir = new THREE.DirectionalLight(0xffffff, 1.1); dir.position.set(800, 900, -650);
dir.castShadow = true; dir.shadow.camera.far = 15000; dir.shadow.mapSize.set(2048,2048); scene.add(dir);

const groundMat = new THREE.MeshPhysicalMaterial({ color:0x0e1326, metalness:0.0, roughness:0.9 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(10000,10000), groundMat);
ground.receiveShadow = true; ground.rotation.x = -Math.PI/2; ground.position.y = -0.1; scene.add(ground);

const grid = new THREE.GridHelper(9000, 180, 0x4a5aa8, 0x1f274d); grid.material.transparent = true; grid.material.opacity = 0.25; scene.add(grid);
const axes = new THREE.AxesHelper(800); axes.visible = true; scene.add(axes);

let modelGroup = new THREE.Group(); scene.add(modelGroup);
let dimsGroup  = new THREE.Group(); scene.add(dimsGroup);

// ---------- Utils
function clearGroup(g){
  while(g.children.length){
    const c=g.children.pop();
    if (c instanceof CSS2DObject){ c.element?.remove?.(); }
    c.geometry?.dispose?.();
    const ms = Array.isArray(c.material)? c.material : [c.material];
    ms.forEach(m=> m && m.dispose && m.dispose());
  }
}
function fitView(){
  if (!modelGroup.children.length) return;
  const box = new THREE.Box3().setFromObject(modelGroup);
  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = maxDim * 1.2 + 300;
  controls.target.copy(center);
  camera.position.copy(center.clone().add(new THREE.Vector3(dist, dist*0.6, dist)));
  camera.near = Math.max(0.1, dist/400); camera.far = Math.max(3000, dist*6); camera.updateProjectionMatrix();
  controls.update();
}
function resize(){
  const w=sceneEl.clientWidth, h=sceneEl.clientHeight||420;
  renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
  labelRenderer.setSize(w,h);
}
window.addEventListener('resize', resize);
function tick(){ controls.update(); renderer.render(scene, camera); labelRenderer.render(scene, camera); requestAnimationFrame(tick); }

function styleTag(el){
  Object.assign(el.style, {
    padding: '2px 3px',
    borderRadius: '6px',
    background: 'rgba(0,0,0,.8)',
    border: '1px solid rgba(255,255,255,.18)',
    color: '#fff',
    fontSize: '11px',
    lineHeight: '1.3',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    pointerEvents: 'none'
  });
}
function setBadge(){
  const matTxt = byId('material').options[byId('material').selectedIndex].textContent.split('(')[0].trim();
  byId('badgeMat').textContent = `${matTxt} · ${state.units} · ${byId('mix').value}`;
}
function concreteMat(){
  return new THREE.MeshPhysicalMaterial({
    color:0xbfc4cf, metalness:0.0, roughness:0.95, envMapIntensity:0.5,
    wireframe: byId('wireframe').checked
  });
}
function raiseAboveSurface(clearanceMm = 2){
  const box = new THREE.Box3().setFromObject(modelGroup);
  if (!isFinite(box.min.y) || !isFinite(box.max.y)) return;
  const dy = Math.max(0, clearanceMm - box.min.y);
  if (dy > 0){ modelGroup.position.y += dy; dimsGroup.position.y += dy; }
}

// ---------- Build model
function buildBoxCulvert(){
  clearGroup(modelGroup); clearGroup(dimsGroup);
  modelGroup.position.set(0,0,0); dimsGroup.position.set(0,0,0);

  const Wi = state.bc.Wi_mm, Hi = state.bc.Hi_mm, t = state.bc.t_mm, top = state.bc.top_mm, bot = state.bc.bot_mm, L = state.bc.L_mm;
  const Wo = Wi + 2*t; const Ho = Hi + top + bot;
  const mat = concreteMat();

  // Floor slab
  const floor = new THREE.Mesh(new THREE.BoxGeometry(L, bot, Wo), mat);
  floor.position.set(L/2, -(Hi/2) - bot/2, 0); floor.castShadow = floor.receiveShadow = true; modelGroup.add(floor);

  // Roof slab
  const roof = new THREE.Mesh(new THREE.BoxGeometry(L, top, Wo), mat);
  roof.position.set(L/2,  (Hi/2) + top/2, 0); roof.castShadow = roof.receiveShadow = true; modelGroup.add(roof);

  // Side walls
  const left = new THREE.Mesh(new THREE.BoxGeometry(L, Hi, t), mat);
  left.position.set(L/2, 0, -(Wi/2) - t/2); left.castShadow = left.receiveShadow = true; modelGroup.add(left);

  const right = left.clone(); right.position.set(L/2, 0, (Wi/2) + t/2); modelGroup.add(right);

  // ---------- Dimensions + labels
  const dimMat = new THREE.LineBasicMaterial({ color:0x7aa2ff });
  const xMid = L/2;

  // Length (L)
  const yL = (Ho/2) + 35;
  const gL = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, yL, -Wo/2), new THREE.Vector3(L, yL, -Wo/2),
    new THREE.Vector3(0, yL+20, -Wo/2), new THREE.Vector3(0, yL-20, -Wo/2),
    new THREE.Vector3(L, yL+20, -Wo/2), new THREE.Vector3(L, yL-20, -Wo/2),
  ]);
  dimsGroup.add(new THREE.LineSegments(gL, dimMat));
  const labL = document.createElement('div'); labL.textContent = `L = ${fmt(fromMM(L))} ${state.units}`; styleTag(labL);
  dimsGroup.add(new CSS2DObject(labL)).position.set(xMid, yL+26, -Wo/2);

  // Inner width (Wi)
  const yWi = 0;
  const gWi = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(xMid, yWi, -Wi/2), new THREE.Vector3(xMid, yWi, Wi/2),
    new THREE.Vector3(xMid, yWi-18, -Wi/2), new THREE.Vector3(xMid+18, yWi-18, -Wi/2),
    new THREE.Vector3(xMid, yWi+18, -Wi/2), new THREE.Vector3(xMid+18, yWi+18, -Wi/2),

    new THREE.Vector3(xMid, yWi-18, Wi/2), new THREE.Vector3(xMid+18, yWi-18, Wi/2),
    new THREE.Vector3(xMid, yWi+18, Wi/2), new THREE.Vector3(xMid+18, yWi+18, Wi/2)
  ]);
  dimsGroup.add(new THREE.LineSegments(gWi, dimMat.clone()));
  const labWi = document.createElement('div'); labWi.textContent = `Wi = ${fmt(fromMM(Wi))} ${state.units}`; styleTag(labWi);
  dimsGroup.add(new CSS2DObject(labWi)).position.set(xMid, yWi+26, 0);

  // Inner height (Hi)
  const zHi = (Wi/2) + t + 28;
  const gHi = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(xMid, -Hi/2, zHi), new THREE.Vector3(xMid, Hi/2, zHi),
    new THREE.Vector3(xMid-18, -Hi/2, zHi), new THREE.Vector3(xMid+18, -Hi/2, zHi),
    new THREE.Vector3(xMid-18,  Hi/2, zHi), new THREE.Vector3(xMid+18,  Hi/2, zHi),
  ]);
  dimsGroup.add(new THREE.LineSegments(gHi, dimMat.clone()));
  const labHi = document.createElement('div'); labHi.textContent = `Hi = ${fmt(fromMM(Hi))} ${state.units}`; styleTag(labHi);
  dimsGroup.add(new CSS2DObject(labHi)).position.set(xMid + 26, 0, zHi);

  // Wall thickness (t)
  const yT = 0;
  const gT = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(xMid, yT,  Wi/2), new THREE.Vector3(xMid, yT,  Wi/2 + t),
    new THREE.Vector3(xMid-14, yT, Wi/2), new THREE.Vector3(xMid+14, yT, Wi/2),
    new THREE.Vector3(xMid-14, yT, Wi/2 + t), new THREE.Vector3(xMid+14, yT, Wi/2 + t),
  ]);
  dimsGroup.add(new THREE.LineSegments(gT, dimMat.clone()));
  const labT = document.createElement('div'); labT.textContent = `t = ${fmt(fromMM(t))} ${state.units}`; styleTag(labT);
  dimsGroup.add(new CSS2DObject(labT)).position.set(xMid + 40, yT, Wi/2 + t/2);

  // Top slab (top)
  const zTop = -Wo/2 - 26;
  const gTop = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(xMid,  Hi/2, zTop), new THREE.Vector3(xMid, Hi/2 + top, zTop),
    new THREE.Vector3(xMid-14, Hi/2, zTop), new THREE.Vector3(xMid+14, Hi/2, zTop),
    new THREE.Vector3(xMid-14, Hi/2 + top, zTop), new THREE.Vector3(xMid+14, Hi/2 + top, zTop),
  ]);
  dimsGroup.add(new THREE.LineSegments(gTop, dimMat.clone()));
  const labTop = document.createElement('div'); labTop.textContent = `top = ${fmt(fromMM(top))} ${state.units}`; styleTag(labTop);
  dimsGroup.add(new CSS2DObject(labTop)).position.set(xMid + 36, Hi/2 + top/2, zTop);

  // Bottom slab (bot)
  const gBot = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(xMid, -Hi/2 - bot, zTop), new THREE.Vector3(xMid, -Hi/2, zTop),
    new THREE.Vector3(xMid-14, -Hi/2 - bot, zTop), new THREE.Vector3(xMid+14, -Hi/2 - bot, zTop),
    new THREE.Vector3(xMid-14, -Hi/2, zTop), new THREE.Vector3(xMid+14, -Hi/2, zTop),
  ]);
  dimsGroup.add(new THREE.LineSegments(gBot, dimMat.clone()));
  const labBot = document.createElement('div'); labBot.textContent = `bot = ${fmt(fromMM(bot))} ${state.units}`; styleTag(labBot);
  dimsGroup.add(new CSS2DObject(labBot)).position.set(xMid + 36, -Hi/2 - bot/2, zTop);

  raiseAboveSurface(2);
  fitView();
}

// ---------- Derived / KPIs
function computeDerived(){
  const { Wi_mm:Wi, Hi_mm:Hi, t_mm:t, top_mm:top, bot_mm:bot, L_mm:L } = state.bc;
  const Wo = Wi + 2*t;
  const Ho = Hi + top + bot;

  const outer_m3 = (L/1000)*(Wo/1000)*(Ho/1000);
  const inner_m3 = (L/1000)*(Wi/1000)*(Hi/1000);
  const vol_unit_m3 = Math.max(0, outer_m3 - inner_m3);
  const vol_m3 = vol_unit_m3 * state.qty;
  const totalKg = vol_m3 * state.density;

  const kg_per_m3_rebar = parseFloat(byId('steelr').options[byId('steelr').selectedIndex].dataset.kgm3||'0');
  const rebarKg = (state.material==='concrete') ? kg_per_m3_rebar * vol_m3 : 0;

  const inner_perim_m = 2*((Wi/1000)+(Hi/1000));
  const outer_perim_m = 2*(((Wi+2*t)/1000)+((Hi+top+bot)/1000));
  const inner_m2 = inner_perim_m * (L/1000) * state.qty;
  const outer_m2 = outer_perim_m * (L/1000) * state.qty;

  const rateInner = parseFloat(byId('inner').options[byId('inner').selectedIndex].dataset.rate||'0');
  const rateOuter = parseFloat(byId('outer').options[byId('outer').selectedIndex].dataset.rate||'0');
  const coatCost = inner_m2*rateInner + outer_m2*rateOuter;

  const mixFactor = parseFloat(byId('mix').options[byId('mix').selectedIndex].dataset.factor||'1');

  return {
    Wo_mm:Wo, Ho_mm:Ho,
    volume_m3: vol_m3,
    totalKg,
    openingArea_cm2: (Wi/10)*(Hi/10),
    rebarKg,
    inner_m2, outer_m2,
    coatCost,
    mixFactor
  };
}

function setKPIs(items){
  const wrap = byId('kpi-wrap'); wrap.innerHTML = '';
  for (const it of items){
    const div = document.createElement('div'); div.className='kpi';
    div.innerHTML = `<div class="label">${it.label}</div><b>${it.value}</b><div class="units">${it.unit||''}</div>`;
    wrap.appendChild(div);
  }
}
function updateKPIs(){
  const d = computeDerived();
  setKPIs([
    {label:'Outer width (Wo)',  value:fmt(fromMM(d.Wo_mm)), unit:state.units},
    {label:'Outer height (Ho)', value:fmt(fromMM(d.Ho_mm)), unit:state.units},
    {label:'Opening area',      value:fmt(d.openingArea_cm2,2), unit:'cm²'},
    {label:'Order weight',      value:fmt(d.totalKg + d.rebarKg,1), unit:'kg'},
  ]);
}

// ---------- Validation & Inputs
function showMsg(t){
  const el=byId('msg'); el.style.display = t ? 'block' : 'none'; el.textContent = t||'';
}
function validateAndFix(){
  showMsg('');
  const density = parseFloat(byId('material').options[byId('material').selectedIndex].dataset.density||'2400');
  state.material = byId('material').value; state.density = density;
  state.qty = Math.max(1, parseInt(byId('qty').value||'1'));

  const minWi = 100, minHi=100, minL=200;
  state.bc.Wi_mm = THREE.MathUtils.clamp(toMM(parseFloat(byId('bc-wi').value||'0')), minWi, 10000);
  state.bc.Hi_mm = THREE.MathUtils.clamp(toMM(parseFloat(byId('bc-hi').value||'0')), minHi, 10000);
  state.bc.t_mm  = THREE.MathUtils.clamp(toMM(parseFloat(byId('bc-t').value||'0')), 20, 2000);
  state.bc.top_mm= THREE.MathUtils.clamp(toMM(parseFloat(byId('bc-top').value||'0')), 20, 2000);
  state.bc.bot_mm= THREE.MathUtils.clamp(toMM(parseFloat(byId('bc-bot').value||'0')), 20, 2000);
  state.bc.L_mm  = THREE.MathUtils.clamp(toMM(parseFloat(byId('bc-l').value||'0')), minL, 40000);

  if (state.bc.Wi_mm <= 0 || state.bc.Hi_mm <= 0){
    showMsg('Opening must be positive.');
  }

  state.commercial.mix   = byId('mix').value;
  state.commercial.steel = byId('steelr').value;
  state.commercial.inner = byId('inner').value;
  state.commercial.outer = byId('outer').value;

  byId('steelr').disabled = (state.material==='frp');
}
function writeUnits(){
  const u = state.units==='mm'?'mm':'in';
  byId('bc-wi-u').textContent=u; byId('bc-hi-u').textContent=u; byId('bc-t-u').textContent=u;
  byId('bc-top-u').textContent=u; byId('bc-bot-u').textContent=u; byId('bc-l-u').textContent=u;
}
function writeInputs(){
  if (!editing.has('bc-wi'))  byId('bc-wi').value  = fmtInput(fromMM(state.bc.Wi_mm));
  if (!editing.has('bc-hi'))  byId('bc-hi').value  = fmtInput(fromMM(state.bc.Hi_mm));
  if (!editing.has('bc-t'))   byId('bc-t').value   = fmtInput(fromMM(state.bc.t_mm));
  if (!editing.has('bc-top')) byId('bc-top').value = fmtInput(fromMM(state.bc.top_mm));
  if (!editing.has('bc-bot')) byId('bc-bot').value = fmtInput(fromMM(state.bc.bot_mm));
  if (!editing.has('bc-l'))   byId('bc-l').value   = fmtInput(fromMM(state.bc.L_mm));
}

// ---------- Rebuild
function rebuildAll(commit=false){
  state.units = byId('units').value; writeUnits(); setBadge();
  validateAndFix();
  if (commit || editing.size===0) writeInputs();
  updateKPIs();
  grid.visible = byId('showGrid').checked; axes.visible = byId('showAxes').checked;
  modelGroup.traverse(o=>{ if(o.material && 'wireframe' in o.material){ o.material.wireframe = byId('wireframe').checked; }});
  buildBoxCulvert();
}

const debounced = (fn, d=100)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), d); } };
const onChange = debounced(()=> rebuildAll(false), 80);

document.querySelectorAll('input[type="number"]').forEach(el=>{
  el.setAttribute('inputmode','decimal'); el.setAttribute('autocomplete','off');
});

;['bc-wi','bc-hi','bc-t','bc-top','bc-bot','bc-l'].forEach(id=>{
  const el = byId(id);
  el.addEventListener('focus', ()=> markEditing(id));
  el.addEventListener('blur',  ()=> { unmarkEditing(id); rebuildAll(true); });
  el.addEventListener('input', onChange);
});

;['input','change'].forEach(ev=>{
  [byId('units'), byId('material'), byId('qty'),
   byId('showGrid'), byId('showAxes'), byId('wireframe'),
   byId('mix'), byId('steelr'), byId('inner'), byId('outer')]
    .forEach(el=> el.addEventListener(ev, onChange));
});

// ---------- Actions
byId('reset').addEventListener('click', ()=> fitView());
byId('shot').addEventListener('click', ()=>{
  const url = renderer.domElement.toDataURL('image/png');
  const a=Object.assign(document.createElement('a'),{href:url,download:`boxCulvert.png`}); a.click();
});

// ADD TO CART (بدون سعر)
byId('addToCart').addEventListener('click', async ()=>{
  if (!isLoggedIn()) return requireLogin();

  const d = computeDerived();
  const selText = (el) => el.options[el.selectedIndex].textContent.trim();

  const item = {
    id: `culvert:${Date.now()}`,
    product: 'Box Culvert',
    type: 'culvert',
    params: {
      units: state.units,
      material: byId('material').value,
      qty: parseInt(byId('qty').value||'1',10),
      mix: byId('mix').value,
      steelr: byId('steelr').value,
      inner: byId('inner').value,
      outer: byId('outer').value
    },
    dims: {
      Wi:  fmt(fromMM(state.bc.Wi_mm)),
      Hi:  fmt(fromMM(state.bc.Hi_mm)),
      t:   fmt(fromMM(state.bc.t_mm)),
      top: fmt(fromMM(state.bc.top_mm)),
      bot: fmt(fromMM(state.bc.bot_mm)),
      L:   fmt(fromMM(state.bc.L_mm))
    },
    derived: d,
    summaryHTML: `
      <div>Wi=<b>${fmt(fromMM(state.bc.Wi_mm))} ${state.units}</b></div>
      <div>Hi=<b>${fmt(fromMM(state.bc.Hi_mm))} ${state.units}</b></div>
      <div>t=<b>${fmt(fromMM(state.bc.t_mm))} ${state.units}</b></div>
      <div>top=<b>${fmt(fromMM(state.bc.top_mm))} ${state.units}</b></div>
      <div>bot=<b>${fmt(fromMM(state.bc.bot_mm))} ${state.units}</b></div>
      <div>L=<b>${fmt(fromMM(state.bc.L_mm))} ${state.units}</b></div>
    `,
    summaryHTML2: `
      <div>SteelR=<b>${selText(byId('steelr'))}</b></div>
      <div>Inner lining=<b>${selText(byId('inner'))}</b></div>
      <div>Outer coat=<b>${selText(byId('outer'))}</b></div>
    `,
  };

  await addToCart(item);
});

function init(){ updateHeader(); resize(); requestAnimationFrame(tick); rebuildAll(true); }
init();
