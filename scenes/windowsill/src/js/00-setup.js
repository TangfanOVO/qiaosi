import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* 单位：1 = 10 厘米。桌面在 y = 0，墙面在 z = -3.3，玻璃在 z = -4.85；窗外地面在 y = -37（二楼） */
const WALL_Z = -3.3, WALL_T = 1.8, GLASS_Z = -4.85;
const WIN = {x0: -.4, x1: 10.4, y0: 2.4, y1: 23};
const SILL_Y = 2.65, GROUND_Y = -37;

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let rnd = (a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(20261001);
const mkRng = seed => (a => () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(seed);   // 新加的东西用自己的随机数，不打乱别的摆件
const HAND_FONT = '"Kaiti SC","STKaiti","KaiTi","BiauKai","Xingkai SC","Noto Serif CJK SC","Noto Serif CJK TC",serif';
const UP = new THREE.Vector3(0, 1, 0);

/* ── 画面尺寸：手机上是整屏；电脑宽窗口里是一只 440 × 956 的“手机” ── */
const APP = document.getElementById('app'), SIDE = document.getElementById('side'), CTL = document.getElementById('ctl');
let framed = false, frameS = 1;
const VW = () => framed ? 440 : innerWidth, VH = () => framed ? 956 : innerHeight;
const layoutFrame = () => {
  const want = innerWidth / innerHeight > .8 && innerWidth >= 720;
  if (want !== framed){ framed = want; document.body.classList.toggle('framed', framed); (framed ? SIDE : APP).appendChild(CTL); }   // 电脑上：按钮和拉杆放在手机外面右边，一直摊开着，不挡画面
  if (!framed){ APP.style.transform = ''; return; }
  const sideW = 320, gap = 44, pad = 28;
  frameS = Math.min((innerHeight - pad * 2) / 956, (innerWidth - sideW - gap - pad * 2) / 440, 1.2);
  const pw = 440 * frameS, total = pw + gap + sideW, x0 = Math.max(pad, (innerWidth - total) / 2), y0 = (innerHeight - 956 * frameS) / 2;
  APP.style.transform = `translate(${x0}px, ${y0}px) scale(${frameS})`;
  SIDE.style.left = (x0 + pw + gap) + 'px'; SIDE.style.top = Math.max(pad, y0 + 120) + 'px';
};
layoutFrame();
const local = e => { if (!framed) return [e.clientX, e.clientY]; const r = APP.getBoundingClientRect(); return [(e.clientX - r.left) / frameS, (e.clientY - r.top) / frameS]; };

const canvas = document.getElementById('c');
let renderer;
try { renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'}); }
catch (e){ document.getElementById('err').style.display = 'flex'; throw e; }
const DPR = Math.min(window.devicePixelRatio || 1, framed ? 2 : 1.6);
renderer.setPixelRatio(DPR);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
RectAreaLightUniformsLib.init();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, VW() / VH(), .3, 1200);
camera.layers.enable(1);          // 第 1 层：玻璃、雪 —— 画出来，但不进景深的深度图
const depthCam = camera.clone();

/* 环境反射：窗那边一大块亮的天光，脚下一点木头暖色 */
const pmrem = new THREE.PMREMGenerator(renderer);
{
  const env = new THREE.Scene(); env.background = new THREE.Color('#2a2a2a');
  const panel = (w, h, pos, col, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide})); m.position.copy(pos); m.lookAt(0, 0, 0); env.add(m); };
  panel(8, 12, new THREE.Vector3(0, 6, -10), '#e8f0f6', 4);
  panel(30, 30, new THREE.Vector3(0, 14, 0), '#ece8e1', .7);
  panel(30, 30, new THREE.Vector3(0, -9, 0), '#8a7458', .5);
  panel(12, 8, new THREE.Vector3(10, 4, 8), '#f3eee6', 1);
  scene.environment = pmrem.fromScene(env, .02).texture;
}

