import * as THREE from 'three';

/**
 * Card thumbnails for 3D models, drawn once with a single shared offscreen renderer.
 * Returns a JPEG data URL or null. Loaders are imported on demand.
 */

const W = 420;
const H = 315;

let renderer: THREE.WebGLRenderer | null = null;

function getRenderer(): THREE.WebGLRenderer | null {
  if (renderer) return renderer;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setSize(W, H, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
  } catch {
    renderer = null;
  }
  return renderer;
}

async function loadModel(url: string, ext: string): Promise<THREE.Object3D | null> {
  const plain = () =>
    new THREE.MeshStandardMaterial({ color: 0x94bce3, metalness: 0.25, roughness: 0.4 });

  switch (ext) {
    case 'glb':
    case 'gltf':
    case 'vrm': {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js');
      const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
      const loader = new GLTFLoader();
      loader.setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/'));
      loader.setMeshoptDecoder(MeshoptDecoder);
      const gltf = await loader.loadAsync(url);
      return gltf.scene;
    }
    case 'obj': {
      const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
      const obj = await new OBJLoader().loadAsync(url);
      obj.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.computeVertexNormals();
          m.material = plain();
        }
      });
      return obj;
    }
    case 'stl': {
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
      const geom = await new STLLoader().loadAsync(url);
      geom.computeVertexNormals();
      return new THREE.Mesh(geom, plain());
    }
    case 'ply': {
      const { PLYLoader } = await import('three/examples/jsm/loaders/PLYLoader.js');
      const geom = await new PLYLoader().loadAsync(url);
      geom.computeVertexNormals();
      const colored = Boolean(geom.getAttribute('color'));
      return new THREE.Mesh(
        geom,
        colored ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }) : plain()
      );
    }
    case 'fbx': {
      const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
      return await new FBXLoader().loadAsync(url);
    }
    case 'dae': {
      const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js');
      const dae = await new ColladaLoader().loadAsync(url);
      return dae ? dae.scene : null;
    }
    case '3mf': {
      const { ThreeMFLoader } = await import('three/examples/jsm/loaders/3MFLoader.js');
      return await new ThreeMFLoader().loadAsync(url);
    }
    default:
      return null;
  }
}

export const MODEL_THUMB_EXTS = new Set(['glb', 'gltf', 'vrm', 'obj', 'stl', 'ply', 'fbx', 'dae', '3mf']);

/** Draws the model from a pleasant three-quarter angle, framed to fit. */
export async function renderModelThumbnail(url: string, ext: string): Promise<string | null> {
  const r = getRenderer();
  if (!r) return null;

  let model: THREE.Object3D | null = null;
  try {
    model = await loadModel(url, ext);
    if (!model) return null;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x10161d);
    scene.add(model);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 5, 4);
    scene.add(key);

    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return null;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;

    const camera = new THREE.PerspectiveCamera(35, W / H, radius / 100, radius * 100);
    const dist = radius / Math.sin((camera.fov * Math.PI) / 360) * 1.05;
    camera.position.copy(center).add(new THREE.Vector3(0.9, 0.55, 1).normalize().multiplyScalar(dist));
    camera.lookAt(center);

    r.render(scene, camera);
    return r.domElement.toDataURL('image/jpeg', 0.88);
  } catch {
    return null;
  } finally {
    if (model) {
      model.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mat) => mat?.dispose());
        }
      });
    }
  }
}
