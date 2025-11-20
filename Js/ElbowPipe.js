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
  ep:{ OD_mm:100, t_mm:5, CLR_mm:200, angle_deg:45, segs:96 },
  commercial:{ mix:'M30', steel:'mesh_std', inner:'none', outer:'acrylic' }
};

// Scene setup
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

const refs = {
  material: byId('material'), qty: byId('qty'),
  mix: byId('mix'), steelr: byId('steelr'), inner: byId('inner'), outer: byId('outer'),
  badge: byId('badgeMat'),
  showGrid: byId('showGrid'), showAxes: byId('showAxes'), wire: byId('wireframe'),
  lenOut: byId('ep-len')
};
function setBadge(){ 
  const matTxt = refs.material.options[refs.material.selectedIndex].textContent.split('(')[0].trim(); 
  refs.badge.textContent = `${matTxt} · ${state.units} · ${byId('mix').value}`; 
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
function metalMaterial(){ return new THREE.MeshPhysicalMaterial({ color:0x9cb7ff, metalness:0.9, roughness:0.25, clearcoat:0.7, clearcoatRoughness:0.28, envMapIntensity:1.2, wireframe: byId('wireframe').checked }); }
function capMaterial(){ return new THREE.MeshPhysicalMaterial({ color:0x9cb7ff, metalness:0.9, roughness:0.25, clearcoat:0.6, clearcoatRoughness:0.25, envMapIntensity:1.0 }); }

function raiseAboveSurface(clearanceMm = 2){
  const box = new THREE.Box3().setFromObject(modelGroup);
  if (!isFinite(box.min.y) || !isFinite(box.max.y)) return;
  const dy = Math.max(0, clearanceMm - box.min.y);
  if (dy > 0){
    modelGroup.position.y += dy;
    dimsGroup.position.y  += dy;
  }
}

class ArcCurve3D extends THREE.Curve{
  constructor(R, angleRad){ super(); this.R=R; this.angle=angleRad; }
  getPoint(t){ const th = t*this.angle; const x = this.R*Math.sin(th); const y = this.R*(1-Math.cos(th)); return new THREE.Vector3(x, y, 0); }
}

function makeRingCap(center, tangent, innerR, outerR){
  const geom = new THREE.RingGeometry(innerR, outerR, 96);
  const ring = new THREE.Mesh(geom, capMaterial()); ring.castShadow = true; ring.receiveShadow = true;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), tangent.clone().normalize());
  ring.quaternion.copy(q); ring.position.copy(center); return ring;
}

function buildElbow(){
  clearGroup(modelGroup); clearGroup(dimsGroup);
  modelGroup.position.set(0,0,0); dimsGroup.position.set(0,0,0);

  const OD = state.ep.OD_mm, t = state.ep.t_mm, R = state.ep.CLR_mm, ang = THREE.MathUtils.degToRad(state.ep.angle_deg);
  const outerR = OD/2; const innerR = Math.max(0.01, outerR - t);
  const curve = new ArcCurve3D(R, ang);
  const tubularSegs = state.ep.segs;

  const outerGeo = new THREE.TubeGeometry(curve, tubularSegs, outerR, 96, false);
  const innerGeo = new THREE.TubeGeometry(curve, tubularSegs, innerR, 96, false);
  const mat = metalMaterial(); const innerMat = mat.clone(); innerMat.side = THREE.BackSide;
  const outerMesh = new THREE.Mesh(outerGeo, mat); const innerMesh = new THREE.Mesh(innerGeo, innerMat);
  [outerMesh, innerMesh].forEach(m=>{m.castShadow=true; m.receiveShadow=true;});
  modelGroup.add(outerMesh, innerMesh);

  const start = curve.getPoint(0), end = curve.getPoint(1);
  const tan0 = curve.getTangent(0), tan1 = curve.getTangent(1);
  modelGroup.add(makeRingCap(start, tan0.clone().negate(), innerR, outerR));
  modelGroup.add(makeRingCap(end,   tan1, innerR, outerR));

  const clrLab = document.createElement('div'); clrLab.textContent=`CLR = ${fmt(fromMM(R))} ${state.units}`; styleTag(clrLab);
  const angLab = document.createElement('div'); angLab.textContent=`Angle = ${state.ep.angle_deg}°`; styleTag(angLab);
  const yofs = Math.max(outerR*1.2, 30);
  const mid = curve.getPoint(0.5);
  dimsGroup.add(new CSS2DObject(clrLab)).position.set(mid.x, mid.y + yofs, 0);
  dimsGroup.add(new CSS2DObject(angLab)).position.set(end.x, end.y + yofs, 0);

  const labOD = document.createElement('div'); labOD.textContent=`Dia = ${fmt(fromMM(OD))} ${state.units}`; styleTag(labOD);
  const labT  = document.createElement('div'); labT.textContent =`t = ${fmt(fromMM(t))} ${state.units}`;  styleTag(labT);
  dimsGroup.add(new CSS2DObject(labOD)).position.set(mid.x,      mid.y - yofs - 24, 0);
  dimsGroup.add(new CSS2DObject(labT)) .position.set(mid.x + 80, mid.y - yofs - 48, 0);

  raiseAboveSurface(2);
  fitView();
}

function validateAndFix(){
  const density = parseFloat(byId('material').options[byId('material').selectedIndex].dataset.density||'2400');
  state.material = byId('material').value; state.density = density;
  state.qty = Math.max(1, parseInt(byId('qty').value||'1'));

  state.ep.OD_mm = THREE.MathUtils.clamp(toMM(parseFloat(byId('ep-od').value||'0')), 4, 5000);
  state.ep.t_mm  = THREE.MathUtils.clamp(toMM(parseFloat(byId('ep-t').value||'0')), 0, state.ep.OD_mm/2 - 0.2);
  state.ep.CLR_mm= THREE.MathUtils.clamp(toMM(parseFloat(byId('ep-r').value||'0')), 10, 20000);
  state.ep.angle_deg = parseInt(byId('ep-ang').value||'45');
  state.ep.segs = parseInt(byId('ep-seg').value||'96');
  if (state.ep.OD_mm - 2*state.ep.t_mm < 1){ state.ep.t_mm = (state.ep.OD_mm - 1)/2; }

  state.commercial.mix   = byId('mix').value;
  state.commercial.steel = byId('steelr').value;
  state.commercial.inner = byId('inner').value;
  state.commercial.outer = byId('outer').value;

  byId('steelr').disabled = (state.material==='frp');
}

function writeUnits(){ const u = state.units==='mm'?'mm':'in'; byId('ep-od-u').textContent=u; byId('ep-t-u').textContent=u; byId('ep-r-u').textContent=u; }
function writeInputs(){
  if (!editing.has('ep-od')) byId('ep-od').value = fmtInput(fromMM(state.ep.OD_mm));
  if (!editing.has('ep-t'))  byId('ep-t').value  = fmtInput(fromMM(state.ep.t_mm));
  if (!editing.has('ep-r'))  byId('ep-r').value  = fmtInput(fromMM(state.ep.CLR_mm));
  byId('ep-ang').value = String(state.ep.angle_deg);
  byId('ep-seg').value = String(state.ep.segs);
}

function arcLenM(){ return (Math.PI * (state.ep.CLR_mm/1000) * state.ep.angle_deg) / 180; }

function areasElbow(){
  const outerR = state.ep.OD_mm/2/1000;
  const innerR = Math.max(0.0005, outerR - state.ep.t_mm/1000);
  const Lm = arcLenM();
  const inner_m2 = 2*Math.PI*innerR*Lm;
  const outer_m2 = 2*Math.PI*outerR*Lm;
  return { inner_m2, outer_m2, Lm };
}

function computeDerived(){
  const OD = state.ep.OD_mm, t = state.ep.t_mm;
  const ro = OD/2/1000, ri = Math.max(0.0005, ro - t/1000);
  const area_m2 = Math.PI*(ro*ro - ri*ri);
  const Lm = arcLenM();
  const kg = area_m2 * state.density * Lm * state.qty;

  const kg_per_m3_rebar = parseFloat(byId('steelr').options[byId('steelr').selectedIndex].dataset.kgm3||'0');
  const vol_m3 = area_m2 * Lm * state.qty;
  const rebarKg = (state.material==='concrete') ? kg_per_m3_rebar * vol_m3 : 0;

  const {inner_m2, outer_m2} = areasElbow();
  const rateInner = parseFloat(byId('inner').options[byId('inner').selectedIndex].dataset.rate||'0');
  const rateOuter = parseFloat(byId('outer').options[byId('outer').selectedIndex].dataset.rate||'0');
  const coatCost = inner_m2*rateInner + outer_m2*rateOuter;

  const mixFactor = parseFloat(byId('mix').options[byId('mix').selectedIndex].dataset.factor||'1');

  return { ID_mm: OD - 2*t, CLR_mm:state.ep.CLR_mm, angle_deg:state.ep.angle_deg, arcLen_m: Lm, totalKg: kg, kg_per_m: area_m2*state.density, rebarKg, inner_m2, outer_m2, coatCost, mixFactor };
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
    {label:'Centerline radius', value:fmt(fromMM(d.CLR_mm)), unit:state.units},
    {label:'Arc length', value:fmt(d.arcLen_m,3), unit:'m'},
    {label:'Order weight', value:fmt(d.totalKg + d.rebarKg,2), unit:'kg'}
  ]);
  // output arc length
  byId('ep-len').value = fmt(d.arcLen_m,3);
}

function rebuildAll(commit=false){
  state.units = byId('units').value; writeUnits(); setBadge();
  validateAndFix();
  if (commit || editing.size===0) writeInputs();
  updateKPIs();
  grid.visible = byId('showGrid').checked; axes.visible = byId('showAxes').checked;
  modelGroup.traverse(o=>{ if(o.material && 'wireframe' in o.material){ o.material.wireframe = byId('wireframe').checked; }});
  buildElbow();
}

const debounced = (fn, d=100)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), d); } };
const onChange = debounced(()=> rebuildAll(false), 80);

document.querySelectorAll('input[type="number"]').forEach(el=>{
  el.setAttribute('inputmode','decimal');
  el.setAttribute('autocomplete','off');
});

;['ep-od','ep-t','ep-r'].forEach(id=>{
  const el = byId(id);
  el.addEventListener('focus', ()=> markEditing(id));
  el.addEventListener('blur',  ()=> { unmarkEditing(id); rebuildAll(true); });
  el.addEventListener('input', onChange);
});

;['input','change'].forEach(ev=>{
  [byId('units'), byId('material'), byId('qty'),
   byId('showGrid'), byId('showAxes'), byId('wireframe'),
   byId('ep-ang'), byId('ep-seg'), byId('mix'), byId('steelr'), byId('inner'), byId('outer')]
    .forEach(el=> el.addEventListener(ev, onChange));
});

// Actions
byId('reset').addEventListener('click', ()=> fitView());
byId('shot').addEventListener('click', ()=>{
  const url = renderer.domElement.toDataURL('image/png');
  const a=Object.assign(document.createElement('a'),{href:url,download:`elbowPipe.png`}); a.click();
});

// ADD TO CART (بدون سعر)
byId('addToCart').addEventListener('click', async ()=>{
  if (!isLoggedIn()) return requireLogin();

  const d = computeDerived();
  const selText = (el) => el.options[el.selectedIndex].textContent.trim();

  const item = {
    id: `elbow:${Date.now()}`,
    product: 'Elbow Pipe',
    type: 'elbow',
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
      Dia: fmt(fromMM(state.ep.OD_mm)),
      t: fmt(fromMM(state.ep.t_mm)),
      CLR: fmt(fromMM(state.ep.CLR_mm)),
      angle: state.ep.angle_deg
    },
    derived: d,
    summaryHTML: `
      <div>Dia=<b>${fmt(fromMM(state.ep.OD_mm))} ${state.units}</b></div>
      <div>t=<b>${fmt(fromMM(state.ep.t_mm))} ${state.units}</b></div>
      <div>CLR=<b>${fmt(fromMM(state.ep.CLR_mm))} ${state.units}</b></div>
      <div>Angle=<b>${state.ep.angle_deg}°</b></div>
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
