import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { addToCart, isLoggedIn, requireLogin, updateHeader } from './app.js';

const byId = id => document.getElementById(id);
const mmPerIn = 25.4;
const fmt = (v, d=2)=> (Math.round(v*10**d)/10**d).toLocaleString(undefined, {maximumFractionDigits:d});
const round = (v, d=2) => Math.round(v*10**d)/10**d;
const fmtInput = (v, d=2) => String(round(v, d));
const editing = new Set();
function markEditing(id){ editing.add(id); }
function unmarkEditing(id){ editing.delete(id); }
function toMM(v){ return state.units==='mm'? v : v*mmPerIn; }
function fromMM(mm){ return state.units==='mm'? mm : (mm/mmPerIn); }

const state = {
  units:'mm', material:'concrete', density:2400, qty:1,
  mh:{ ID_mm:800, t_mm:120, H_mm:1200, slab_mm:120, Do_mm:600 },
  commercial:{ mix:'M30', steel:'mesh_std', inner:'none', outer:'acrylic' }
};

// Scene
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
ground.receiveShadow = true;
ground.rotation.x = -Math.PI/2; ground.position.y = -0.1; scene.add(ground);

const grid = new THREE.GridHelper(9000, 180, 0x4a5aa8, 0x1f274d); grid.material.transparent = true; grid.material.opacity = 0.25; scene.add(grid);
const axes = new THREE.AxesHelper(800); axes.visible = true; scene.add(axes);

let modelGroup = new THREE.Group(); scene.add(modelGroup);
let dimsGroup = new THREE.Group(); scene.add(dimsGroup);

function clearGroup(g){ 
  while(g.children.length){ 
    const c=g.children.pop(); 
    if (c instanceof CSS2DObject){ c.element?.remove?.(); }
    c.geometry?.dispose?.(); 
    const ms=Array.isArray(c.material)?c.material:[c.material]; 
    ms.forEach(m=>m&&m.dispose&&m.dispose()); 
  } 
}
function fitView(){
  if (!modelGroup.children.length) return;
  const box = new THREE.Box3().setFromObject(modelGroup);
  const size = new THREE.Vector3(); box.getSize(size); const center = new THREE.Vector3(); box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = maxDim * 1.2 + 300;
  controls.target.copy(center);
  camera.position.copy(center.clone().add(new THREE.Vector3(dist, dist*0.6, dist)));
  camera.near = Math.max(0.1, dist/400); camera.far = Math.max(3000, dist*6); camera.updateProjectionMatrix();
  controls.update();
}
function resize(){ const w=sceneEl.clientWidth, h=sceneEl.clientHeight||420; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); labelRenderer.setSize(w,h); }
window.addEventListener('resize', resize);
function tick(){ controls.update(); renderer.render(scene, camera); labelRenderer.render(scene, camera); requestAnimationFrame(tick); }

function concreteMaterial(){ return new THREE.MeshPhysicalMaterial({ color:0xbfc4cf, metalness:0.0, roughness:0.95, envMapIntensity:0.5, wireframe: byId('wireframe').checked }); }
function setBadge(){ 
  const matTxt = byId('material').options[byId('material').selectedIndex].textContent.split('(')[0].trim(); 
  const mixTxt = byId('mix').value;
  byId('badgeMat').textContent = `${matTxt} · ${state.units} · ${mixTxt}`; 
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
function raiseAboveSurface(clearanceMm = 2){
  const box = new THREE.Box3().setFromObject(modelGroup);
  if (!isFinite(box.min.y) || !isFinite(box.max.y)) return;
  const dy = Math.max(0, clearanceMm - box.min.y);
  if (dy > 0){ modelGroup.position.y += dy; dimsGroup.position.y  += dy; }
}

function buildManhole(){
  clearGroup(modelGroup); clearGroup(dimsGroup);
  modelGroup.position.set(0,0,0);
  dimsGroup.position.set(0,0,0);

  const ID = state.mh.ID_mm, t = state.mh.t_mm, H = state.mh.H_mm, slab = state.mh.slab_mm, Do = state.mh.Do_mm;
  const OD = ID + 2*t; const ro = OD/2; const ri = ID/2;

  const segsCirc = 96; const segsH = Math.max(1, Math.floor(H/200));
  const outer = new THREE.CylinderGeometry(ro, ro, H, segsCirc, segsH, true);
  const inner = new THREE.CylinderGeometry(ri, ri, H+0.5, segsCirc, segsH, true);
  const mat = concreteMaterial(); const innerMat = mat.clone(); innerMat.side = THREE.BackSide;
  const outerMesh = new THREE.Mesh(outer, mat); const innerMesh = new THREE.Mesh(inner, innerMat);
  [outerMesh, innerMesh].forEach(m=>{m.castShadow=true; m.receiveShadow=true;});
  modelGroup.add(outerMesh, innerMesh);

  const base = new THREE.CylinderGeometry(ro, ro, Math.max(60, t), segsCirc, 1, false);
  const baseMesh = new THREE.Mesh(base, mat); baseMesh.position.y = -H/2 - Math.max(60,t)/2; baseMesh.castShadow=true; baseMesh.receiveShadow=true; modelGroup.add(baseMesh);

  // Top slab with opening
  const shape = new THREE.Shape(); shape.absarc(0, 0, ro, 0, Math.PI*2, false);
  if (Do > 0){
    const hole = new THREE.Path(); hole.absarc(0, 0, Do/2, 0, Math.PI*2, true); shape.holes.push(hole);
  }
  const topGeom = new THREE.ExtrudeGeometry(shape, { depth: slab, bevelEnabled:false, curveSegments: segsCirc });
  const topMesh = new THREE.Mesh(topGeom, mat);
  topMesh.rotation.x = -Math.PI/2; topMesh.position.y = H/2; topMesh.castShadow = topMesh.receiveShadow = true;
  modelGroup.add(topMesh);

  const ringMat = new THREE.MeshPhysicalMaterial({color:0x8f96a3, metalness:.2, roughness:.8, wireframe: byId('wireframe').checked});
  const ringG = new THREE.RingGeometry(Do/2*0.85, Do/2*1.05, segsCirc);
  const ring = new THREE.Mesh(ringG, ringMat);
  ring.rotation.x = -Math.PI/2; ring.position.y = H/2 + slab + 1; modelGroup.add(ring);

  // Labels
  const labOD = document.createElement('div'); labOD.textContent=`OD = ${fmt(fromMM(OD))} ${state.units}`; styleTag(labOD);
  const labH  = document.createElement('div'); labH .textContent=`H = ${fmt(fromMM(H))} ${state.units}`; styleTag(labH);
  const labT  = document.createElement('div'); labT .textContent=`t = ${fmt(fromMM(t))} ${state.units}`; styleTag(labT);
  const labSl = document.createElement('div'); labSl.textContent=`slab = ${fmt(fromMM(slab))} ${state.units}`; styleTag(labSl);
  const labDo = document.createElement('div'); labDo.textContent=`Do = ${fmt(fromMM(Do))} ${state.units}`; styleTag(labDo);

  dimsGroup.add(new CSS2DObject(labOD)).position.set(ro+60, 0, 0);
  dimsGroup.add(new CSS2DObject(labH )) .position.set(0, H/2 + 60, 0);
  dimsGroup.add(new CSS2DObject(labT )) .position.set(ro + 60, -H/3, 0);
  dimsGroup.add(new CSS2DObject(labSl)).position.set(0, H/2 + slab + 36, 0);
  dimsGroup.add(new CSS2DObject(labDo)).position.set(0, H/2 + slab + 60, Do/2 + 4);

  raiseAboveSurface(2);
  fitView();
}

function validateAndFix(){
  const density = parseFloat(byId('material').options[byId('material').selectedIndex].dataset.density||'2400');
  state.material = byId('material').value; state.density = density;
  state.qty = Math.max(1, parseInt(byId('qty').value||'1'));

  state.mh.ID_mm   = THREE.MathUtils.clamp(toMM(parseFloat(byId('mh-id').value||'0')), 300, 5000);
  state.mh.t_mm    = THREE.MathUtils.clamp(toMM(parseFloat(byId('mh-t').value||'0')), 20, 1000);
  state.mh.H_mm    = THREE.MathUtils.clamp(toMM(parseFloat(byId('mh-h').value||'0')), 300, 10000);
  state.mh.slab_mm = THREE.MathUtils.clamp(toMM(parseFloat(byId('mh-slab').value||'0')), 30, 1000);
  const maxDo = Math.max(100, state.mh.ID_mm - 20);
  state.mh.Do_mm  = THREE.MathUtils.clamp(toMM(parseFloat(byId('mh-open').value||'0')), 200, maxDo);

  state.commercial.mix   = byId('mix').value;
  state.commercial.steel = byId('steelr').value;
  state.commercial.inner = byId('inner').value;
  state.commercial.outer = byId('outer').value;

  // disable steelR when FRP
  byId('steelr').disabled = (state.material==='frp');
}

function writeUnits(){ 
  const u = state.units==='mm'?'mm':'in'; 
  byId('mh-id-u').textContent=u; byId('mh-t-u').textContent=u; byId('mh-h-u').textContent=u; 
  byId('mh-slab-u').textContent=u; byId('mh-open-u').textContent=u;
}
function writeInputs(){
  if (!editing.has('mh-id'))    byId('mh-id').value    = fmtInput(fromMM(state.mh.ID_mm));
  if (!editing.has('mh-t'))     byId('mh-t').value     = fmtInput(fromMM(state.mh.t_mm));
  if (!editing.has('mh-h'))     byId('mh-h').value     = fmtInput(fromMM(state.mh.H_mm));
  if (!editing.has('mh-slab'))  byId('mh-slab').value  = fmtInput(fromMM(state.mh.slab_mm));
  if (!editing.has('mh-open'))  byId('mh-open').value  = fmtInput(fromMM(state.mh.Do_mm));
}

function areasManhole(){
  const { ID_mm:ID, t_mm:t, H_mm:H, slab_mm:slab, Do_mm:Do } = state.mh;
  const OD = ID + 2*t;
  const inner_m2 = 2*Math.PI*(ID/2000)*(H/1000); // side inner
  const outer_m2 = 2*Math.PI*(OD/2000)*(H/1000) + (Math.PI*((OD/1000)**2 - (Do/1000)**2))/4; // side outer + top ring
  return { inner_m2, outer_m2 };
}

function computeDerived(){
  const { ID_mm:ID, t_mm:t, H_mm:H, slab_mm:slab, Do_mm:Do } = state.mh;
  const OD = ID + 2*t;
  const ro = OD/2/1000, ri = ID/2/1000;
  const wallVol = (Math.PI*(ro*ro - ri*ri)) * (H/1000);
  const baseVol = Math.PI*(ro*ro) * Math.max(0.06, t/1000);
  const slabVol = Math.PI*(ro*ro - Math.pow((Do/2)/1000, 2)) * (slab/1000);
  const totalVol = (wallVol + baseVol + slabVol) * state.qty;
  const totalKg = totalVol * state.density;

  const kg_per_m3_rebar = parseFloat(byId('steelr').options[byId('steelr').selectedIndex].dataset.kgm3||'0');
  const rebarKg = (state.material==='concrete') ? kg_per_m3_rebar * totalVol : 0;

  const {inner_m2, outer_m2} = areasManhole();
  const rateInner = parseFloat(byId('inner').options[byId('inner').selectedIndex].dataset.rate||'0');
  const rateOuter = parseFloat(byId('outer').options[byId('outer').selectedIndex].dataset.rate||'0');
  const coatCost = inner_m2*rateInner + outer_m2*rateOuter;

  const mixFactor = parseFloat(byId('mix').options[byId('mix').selectedIndex].dataset.factor||'1');

  return { OD_mm: OD, volume_m3: totalVol, totalKg, Do_mm: Do, rebarKg, inner_m2, outer_m2, coatCost, mixFactor };
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
    {label:'Outer diameter (OD)', value:fmt(fromMM(d.OD_mm)), unit:state.units},
    {label:'Top opening (Do)',    value:fmt(fromMM(d.Do_mm)), unit:state.units},
    {label:'Concrete volume',     value:fmt(d.volume_m3,3),   unit:'m³'},
    {label:'Order weight',        value:fmt(d.totalKg + d.rebarKg,1),     unit:'kg'}
  ]);
}

function rebuildAll(commit=false){
  state.units = byId('units').value; writeUnits(); setBadge();
  validateAndFix(); 
  if (commit || editing.size===0) writeInputs();
  updateKPIs();
  grid.visible = byId('showGrid').checked; axes.visible = byId('showAxes').checked;
  const wf = byId('wireframe').checked;
  modelGroup.traverse(o=>{ if(o.material && 'wireframe' in o.material){ o.material.wireframe = wf; }});
  buildManhole();
}

const debounced = (fn, d=100)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), d); } };
const onChange = debounced(()=> rebuildAll(false), 80);

document.querySelectorAll('input[type="number"]').forEach(el=>{
  el.setAttribute('inputmode','decimal'); el.setAttribute('autocomplete','off');
});

;['mh-id','mh-t','mh-h','mh-slab','mh-open'].forEach(id=>{
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

// Actions
byId('reset').addEventListener('click', ()=> fitView());
byId('shot').addEventListener('click', ()=>{
  const url = renderer.domElement.toDataURL('image/png');
  const a=Object.assign(document.createElement('a'),{href:url,download:`manhole.png`}); a.click();
});

// ADD TO CART (بدون سعر)
byId('addToCart').addEventListener('click', async ()=>{
  if (!isLoggedIn()) return requireLogin();

  const d = computeDerived();
  const selText = (el) => el.options[el.selectedIndex].textContent.trim();

  const item = {
    id: `manhole:${Date.now()}`,
    product: 'Manhole (Cylindrical)',
    type: 'manhole',
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
      ID:   fmt(fromMM(state.mh.ID_mm)),
      t:    fmt(fromMM(state.mh.t_mm)),
      H:    fmt(fromMM(state.mh.H_mm)),
      slab: fmt(fromMM(state.mh.slab_mm)),
      Do:   fmt(fromMM(state.mh.Do_mm))
    },
    derived: d,
    summaryHTML: `
      <div>ID=<b>${fmt(fromMM(state.mh.ID_mm))} ${state.units}</b></div>
      <div>t=<b>${fmt(fromMM(state.mh.t_mm))} ${state.units}</b></div>
      <div>H=<b>${fmt(fromMM(state.mh.H_mm))} ${state.units}</b></div>
      <div>slab=<b>${fmt(fromMM(state.mh.slab_mm))} ${state.units}</b></div>
      <div>Do=<b>${fmt(fromMM(state.mh.Do_mm))} ${state.units}</b></div>
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
