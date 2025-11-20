import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { addToCart, isLoggedIn, requireLogin, updateHeader } from './app.js';

const $$ = s => document.querySelector(s);
const byId = id => document.getElementById(id);
const mmPerIn = 25.4;
const fmt = (v, d=2)=> (Math.round(v*10**d)/10**d).toLocaleString(undefined, {maximumFractionDigits:d});
const round = (v, d=2) => Math.round(v*10**d)/10**d;
const fmtInput = (v, d=2) => String(round(v, d));
const editing = new Set();
function markEditing(id){ editing.add(id); }
function unmarkEditing(id){ editing.delete(id); }
function toMM(v){ return state.units==='mm' ? v : v*mmPerIn; }
function fromMM(mm){ return state.units==='mm' ? mm : (mm/mmPerIn); }

// ----- State
const state = {
  units:'mm', material:'concrete', density:2400, qty:1,
  sp:{ OD_mm:100, t_mm:5, L_mm:1000 },
  commercial:{ mix:'M30', steel:'mesh_std', inner:'none', outer:'acrylic' }
};

// ----- Scene -----
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

const hemi = new THREE.HemisphereLight(0xffffff, 0x1b203a, 0.55); scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 1.1); dir.position.set(800, 900, -650);
dir.castShadow = true; dir.shadow.camera.far = 15000; dir.shadow.mapSize.set(2048,2048); scene.add(dir);

const groundMat = new THREE.MeshPhysicalMaterial({ color:0x0e1326, metalness:0.0, roughness:0.9 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(10000,10000), groundMat);
ground.receiveShadow = true; ground.rotation.x = -Math.PI/2; ground.position.y = -0.1; scene.add(ground);

const grid = new THREE.GridHelper(9000, 180, 0x4a5aa8, 0x1f274d);
grid.material.transparent = true; grid.material.opacity = 0.25; scene.add(grid);
const axes = new THREE.AxesHelper(800); axes.visible = true; scene.add(axes);

let modelGroup = new THREE.Group(); scene.add(modelGroup);
let dimsGroup = new THREE.Group(); scene.add(dimsGroup);

function clearGroup(g){
  while(g.children.length){
    const c=g.children.pop();
    if (c instanceof CSS2DObject){ c.element?.remove?.(); }
    c.geometry?.dispose?.();
    const mats = Array.isArray(c.material) ? c.material : [c.material];
    mats.forEach(m=> m && m.dispose && m.dispose());
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
  const w = sceneEl.clientWidth; const h = sceneEl.clientHeight || 420;
  renderer.setSize(w, h, false); camera.aspect = w/h; camera.updateProjectionMatrix(); labelRenderer.setSize(w,h);
}
window.addEventListener('resize', resize);
function tick(){ controls.update(); renderer.render(scene, camera); labelRenderer.render(scene, camera); requestAnimationFrame(tick); }

// ----- UI refs
const refs = {
  material: byId('material'), qty: byId('qty'),
  mix: byId('mix'), steelr: byId('steelr'), inner: byId('inner'), outer: byId('outer'),
  badge: byId('badgeMat'), msg: byId('msg'),
  showGrid: byId('showGrid'), showAxes: byId('showAxes'), wire: byId('wireframe')
};
function setBadge(){
  const matTxt = refs.material.options[refs.material.selectedIndex].textContent.split('(')[0].trim();
  const mixTxt = refs.mix.options[refs.mix.selectedIndex].value;
  refs.badge.textContent = `${matTxt} · ${state.units} · ${mixTxt}`;
}
function showMsg(t){
  refs.msg.style.display = t ? 'block' : 'none';
  refs.msg.textContent = t || '';
}
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

function metalMaterial(){
  return new THREE.MeshPhysicalMaterial({
    color:0x9cb7ff, metalness:0.9, roughness:0.25,
    clearcoat:0.7, clearcoatRoughness:0.28,
    envMapIntensity:1.2,
    wireframe: byId('wireframe').checked
  });
}
function capMaterial(){
  return new THREE.MeshPhysicalMaterial({
    color:0x9cb7ff, metalness:0.9, roughness:0.25,
    clearcoat:0.6, clearcoatRoughness:0.25,
    envMapIntensity:1.0
  });
}

function raiseAboveSurface(clearanceMm = 2){
  const box = new THREE.Box3().setFromObject(modelGroup);
  if (!isFinite(box.min.y) || !isFinite(box.max.y)) return;
  const dy = Math.max(0, clearanceMm - box.min.y);
  if (dy > 0){ modelGroup.position.y += dy; dimsGroup.position.y  += dy; }
}

// ----- Build straight
function buildStraight(){
  clearGroup(modelGroup); clearGroup(dimsGroup);
  modelGroup.position.set(0,0,0); dimsGroup.position.set(0,0,0);

  const OD = state.sp.OD_mm, t = state.sp.t_mm, L = state.sp.L_mm;
  const outerR = OD/2; const innerR = Math.max(0.01, outerR - t);
  const radialSegs = 96; const heightSegs = Math.max(1, Math.floor(L/200));

  const outer = new THREE.CylinderGeometry(outerR, outerR, L, radialSegs, heightSegs, true); outer.rotateZ(Math.PI/2);
  const inner = new THREE.CylinderGeometry(innerR, innerR, L+0.5, radialSegs, heightSegs, true); inner.rotateZ(Math.PI/2);
  const mat = metalMaterial(); const innerMat = mat.clone(); innerMat.side = THREE.BackSide;
  const outerMesh = new THREE.Mesh(outer, mat); const innerMesh = new THREE.Mesh(inner, innerMat);
  [outerMesh, innerMesh].forEach(m=>{m.castShadow=true; m.receiveShadow=true; m.position.x = L/2;});
  modelGroup.add(outerMesh, innerMesh);

  // Caps
  const cap0 = new THREE.Mesh(new THREE.RingGeometry(innerR, outerR, 96), capMaterial()); cap0.rotation.y = Math.PI/2; cap0.position.set(0,0,0);
  const cap1 = cap0.clone(); cap1.position.set(L,0,0);
  modelGroup.add(cap0, cap1);

  // Dimensions visuals/labels
  const dimY = Math.max(outerR*1.5, 40);
  const dimMat = new THREE.LineBasicMaterial({ color:0x7aa2ff });

  const gL = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, dimY, 0), new THREE.Vector3(L, dimY, 0),
    new THREE.Vector3(0, dimY+20, 0), new THREE.Vector3(0, dimY-20, 0),
    new THREE.Vector3(L, dimY+20, 0), new THREE.Vector3(L, dimY-20, 0)
  ]);
  dimsGroup.add(new THREE.LineSegments(gL, dimMat));
  const labL = document.createElement('div'); labL.textContent = `L = ${fmt(fromMM(L))} ${state.units}`; styleTag(labL);
  dimsGroup.add(new CSS2DObject(labL)).position.set(L/2, dimY+26, 0);

  const gOD = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(L/2, -outerR, 0), new THREE.Vector3(L/2, outerR, 0),
    new THREE.Vector3(L/2-18, -outerR, 0), new THREE.Vector3(L/2+18, -outerR, 0),
    new THREE.Vector3(L/2-18,  outerR, 0), new THREE.Vector3(L/2+18,  outerR, 0),
  ]);
  dimsGroup.add(new THREE.LineSegments(gOD, dimMat.clone()));
  const labOD = document.createElement('div'); labOD.textContent = `Dia = ${fmt(fromMM(OD))} ${state.units}`; styleTag(labOD);
  dimsGroup.add(new CSS2DObject(labOD)).position.set(L/2 + outerR + 50, 0, 0);

  const gT = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(L, innerR, 0), new THREE.Vector3(L, outerR, 0),
    new THREE.Vector3(L-12, innerR, 0), new THREE.Vector3(L+12, innerR, 0),
    new THREE.Vector3(L-12, outerR, 0), new THREE.Vector3(L+12, outerR, 0),
  ]);
  dimsGroup.add(new THREE.LineSegments(gT, dimMat.clone()));
  const labT = document.createElement('div'); labT.textContent = `t = ${fmt(fromMM(t))} ${state.units}`; styleTag(labT);
  dimsGroup.add(new CSS2DObject(labT)).position.set(L + outerR + 40, (innerR+outerR)/2, 0);

  raiseAboveSurface(2);
  fitView();
}

// ----- Derived / validation
function validateAndFix(){
  showMsg('');
  const density = parseFloat(refs.material.options[refs.material.selectedIndex].dataset.density||'2400');
  state.material = refs.material.value; state.density = density;
  state.qty = Math.max(1, parseInt(refs.qty.value||'1'));

  state.sp.OD_mm = THREE.MathUtils.clamp(toMM(parseFloat(byId('sp-od').value||'0')), 4, 5000);
  state.sp.t_mm  = THREE.MathUtils.clamp(toMM(parseFloat(byId('sp-t').value||'0')), 0, state.sp.OD_mm/2 - 0.2);
  state.sp.L_mm  = THREE.MathUtils.clamp(toMM(parseFloat(byId('sp-l').value||'0')), 10, 40000);

  state.commercial.mix   = refs.mix.value;
  state.commercial.steel = refs.steelr.value;
  state.commercial.inner = refs.inner.value;
  state.commercial.outer = refs.outer.value;

  if (state.sp.OD_mm - 2*state.sp.t_mm < 1){
    state.sp.t_mm = (state.sp.OD_mm - 1)/2;
    showMsg('Wall auto-adjusted to keep ID ≥ 1 mm.');
  }

  // disable steelR when FRP
  refs.steelr.disabled = (state.material === 'frp');
}

function writeUnits(){
  const u = state.units==='mm'?'mm':'in';
  byId('sp-od-u').textContent=u; byId('sp-t-u').textContent=u; byId('sp-l-u').textContent=u;
}
function writeInputs(){
  if (!editing.has('sp-od')) byId('sp-od').value = fmtInput(fromMM(state.sp.OD_mm));
  if (!editing.has('sp-t'))  byId('sp-t').value  = fmtInput(fromMM(state.sp.t_mm));
  if (!editing.has('sp-l'))  byId('sp-l').value  = fmtInput(fromMM(state.sp.L_mm), state.units==='mm'?0:2);
}

function areasStraight(){
  const OD = state.sp.OD_mm, t = state.sp.t_mm, L = state.sp.L_mm;
  const ID = Math.max(0.01, OD - 2*t);
  const inner_m2 = Math.PI * (ID/1000) * (L/1000);
  const outer_m2 = Math.PI * (OD/1000) * (L/1000);
  return { inner_m2, outer_m2 };
}

function computeDerived(){
  const OD = state.sp.OD_mm, t = state.sp.t_mm, L = state.sp.L_mm;
  const ro = OD/2/1000, ri = Math.max(0.0005, ro - t/1000);
  const area_m2 = Math.PI*(ro*ro - ri*ri);
  const kg_per_m = area_m2 * state.density;
  const totalKg = kg_per_m * (L/1000) * state.qty;
  const ID_mm = OD - 2*t;

  // rebar weight (if concrete)
  const kg_per_m3_rebar = parseFloat(refs.steelr.options[refs.steelr.selectedIndex].dataset.kgm3||'0');
  const vol_m3 = area_m2 * (L/1000) * state.qty;
  const rebarKg = (state.material==='concrete') ? kg_per_m3_rebar * vol_m3 : 0;

  // coatings area
  const {inner_m2, outer_m2} = areasStraight();
  // still compute, maybe useful later (not shown)
  const rateInner = parseFloat(refs.inner.options[refs.inner.selectedIndex].dataset.rate||'0');
  const rateOuter = parseFloat(refs.outer.options[refs.outer.selectedIndex].dataset.rate||'0');
  const coatCost = inner_m2*rateInner + outer_m2*rateOuter;

  // mix factor
  const mixFactor = parseFloat(refs.mix.options[refs.mix.selectedIndex].dataset.factor||'1');

  return { ID_mm, area_cm2: area_m2*1e4, kg_per_m, totalKg, vol_m3, rebarKg, inner_m2, outer_m2, coatCost, mixFactor };
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
    {label:'Inner diameter (ID)', value:fmt(fromMM(d.ID_mm)), unit:state.units},
    {label:'Cross-sectional area', value:fmt(d.area_cm2,2), unit:'cm²'},
    {label:'Weight per meter', value:fmt(d.kg_per_m,3), unit:'kg/m'},
    {label:'Order weight', value:fmt(d.totalKg + d.rebarKg,2), unit:'kg'}
  ]);
}

function rebuildAll(commit=false){
  state.units = byId('units').value; writeUnits(); setBadge();
  validateAndFix();
  if (commit || editing.size===0) writeInputs();
  updateKPIs();
  grid.visible = byId('showGrid').checked; axes.visible = byId('showAxes').checked;
  buildStraight();
}

const debounced = (fn, d=100)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), d); } };
const onChange = debounced(()=> rebuildAll(false), 80);

// Improve numeric inputs typing
document.querySelectorAll('input[type="number"]').forEach(el=>{
  el.setAttribute('inputmode','decimal');
  el.setAttribute('autocomplete','off');
});

// lock while user types
;['sp-od','sp-t','sp-l'].forEach(id=>{
  const el = byId(id);
  el.addEventListener('focus', ()=> markEditing(id));
  el.addEventListener('blur',  ()=> { unmarkEditing(id); rebuildAll(true); });
  el.addEventListener('input', onChange);
});

// chips for quick length
document.querySelectorAll('.chip[data-l]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    byId('sp-l').value = btn.dataset.l;
    rebuildAll(true);
  });
});

// tie events
;['input','change'].forEach(ev=>{
  [byId('units'), byId('material'), byId('qty'),
   byId('showGrid'), byId('showAxes'), byId('wireframe'),
   byId('mix'), byId('steelr'), byId('inner'), byId('outer')]
    .forEach(el=> el.addEventListener(ev, onChange));
});

// Actions
byId('reset').addEventListener('click', ()=> fitView());
byId('shot').addEventListener('click', ()=>{
  const url = renderer.domElement.toDataURL('image/png');
  const a=Object.assign(document.createElement('a'),{href:url,download:`straightPipe.png`}); a.click();
});

// ADD TO CART (بدون سعر)
byId('addToCart').addEventListener('click', async ()=>{
  if (!isLoggedIn()) return requireLogin();

  const d = computeDerived();

  // helper to read visible label from selects
  const selText = (el) => el.options[el.selectedIndex].textContent.trim();

  const item = {
    id: `straight:${Date.now()}`,
    product: 'Straight Pipe',
    type: 'straight',
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
      Dia: fmt(fromMM(state.sp.OD_mm)),
      t: fmt(fromMM(state.sp.t_mm)),
      L: fmt(fromMM(state.sp.L_mm))
    },
    derived: d,
    summaryHTML: `
      <div>Dia=<b>${fmt(fromMM(state.sp.OD_mm))} ${state.units}</b></div>
      <div>t=<b>${fmt(fromMM(state.sp.t_mm))} ${state.units}</b></div>
      <div>L=<b>${fmt(fromMM(state.sp.L_mm))} ${state.units}</b></div>
    `,
    summaryHTML2: `
      <div>SteelR=<b>${selText(byId('steelr'))}</b></div>
      <div>Inner lining=<b>${selText(byId('inner'))}</b></div>
      <div>Outer coat=<b>${selText(byId('outer'))}</b></div>
    `,
  };

  await addToCart(item);
});

function init(){ updateHeader(); resize(); tick(); rebuildAll(true); }
init();
