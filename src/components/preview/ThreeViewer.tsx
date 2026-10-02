import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import {
  getVRMSettings,
  saveVRMSettings,
  setCustomVRMMannequin,
  resetVRMMannequinToDefault,
  DEFAULT_AVATAR_URL,
  DEFAULT_AVATAR_NAME,
  VRMSettings,
  MannequinType
} from '../../services/vrmSettings';
import { build12PointMannequin } from '../../services/vrmMannequin';
import { ThemeMode } from '../../types';

// Module-level cache for default AAA avatar GLTF so it is fetched/parsed only once per session
let cachedDefaultAvatarGltf: any = null;

interface ThreeViewerProps {
  src?: string;
  name: string;
  ext?: string;
  theme?: ThemeMode;
}

export const ThreeViewer: React.FC<ThreeViewerProps> = ({
  src,
  name,
  ext = '',
  theme = 'dark'
}) => {
  const isLight = theme === 'light';
  const isBlack = theme === 'black';

  const mountRef = useRef<HTMLDivElement>(null);
  const [vrmSettings, setVrmSettings] = useState<VRMSettings>(getVRMSettings);
  const [wireframe, setWireframe] = useState(() => getVRMSettings().wireframe);
  const [autoRotate, setAutoRotate] = useState(() => getVRMSettings().autoRotate);
  const [showGrid, setShowGrid] = useState(() => getVRMSettings().showGrid);
  const [springBones, setSpringBones] = useState(() => getVRMSettings().springBones);
  const [stats, setStats] = useState({ vertices: 0, faces: 0, meshes: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Smoothly fade out the blank black curtain overlay once model loading completes and camera settles
  useEffect(() => {
    if (isLoading || loadError) {
      setOverlayVisible(true);
      setOverlayOpacity(1);
    } else {
      let timeoutId: any;
      let raf2: number;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setOverlayOpacity(0);
          timeoutId = setTimeout(() => {
            setOverlayVisible(false);
          }, 450);
        });
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
        clearTimeout(timeoutId);
      };
    }
  }, [isLoading, loadError]);

  // Procedural Fallback Shapes (if no file src)
  const [proceduralShape, setProceduralShape] = useState<'knot' | 'ico' | 'cube' | 'torus'>('knot');

  // Animation Playback State
  const [isPlaying, setIsPlaying] = useState(true);
  const [animDuration, setAnimDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(() => getVRMSettings().playbackSpeed || 1);
  const [availableAnimations, setAvailableAnimations] = useState<string[]>([]);
  const [selectedAnimationIndex, setSelectedAnimationIndex] = useState(0);

  // Animation Scrubber DOM Refs (Eliminates 60fps React re-renders during playback)
  const timeSliderRef = useRef<HTMLInputElement>(null);
  const timeDisplayRef = useRef<HTMLSpanElement>(null);
  const isScrubbingRef = useRef<boolean>(false);
  const animDurationRef = useRef<number>(0);
  animDurationRef.current = animDuration;

  // VRM Expression State
  const [availableExpressions, setAvailableExpressions] = useState<string[]>([]);
  const [activeExpression, setActiveExpression] = useState<string>('neutral');

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const loadedObjectRef = useRef<THREE.Object3D | null>(null);
  const currentVrmRef = useRef<VRM | null>(null);
  const currentMannequinKeyRef = useRef<string | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const playbackSpeedRef = useRef(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;

  // Listen to VRM Settings Changes
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<VRMSettings>;
      const next = customEvent.detail || getVRMSettings();
      setVrmSettings(next);
      setAutoRotate(next.autoRotate);
      setShowGrid(next.showGrid);
      setSpringBones(next.springBones);
      setWireframe(next.wireframe);
      setPlaybackSpeed(next.playbackSpeed || 1);
    };
    window.addEventListener('archive-vrm-settings-changed', handler);
    return () => window.removeEventListener('archive-vrm-settings-changed', handler);
  }, []);

  // Compute effective extension
  const fileExt = (ext || name.split('.').pop() || '').toLowerCase();
  const isVRM = fileExt === 'vrm';
  const isVRMA = fileExt === 'vrma';
  const isGLTF = fileExt === 'glb' || fileExt === 'gltf';
  const isOBJ = fileExt === 'obj';
  const isSTL = fileExt === 'stl';
  const isFBX = fileExt === 'fbx';
  const hasRealFile = Boolean(src && (isVRM || isVRMA || isGLTF || isOBJ || isSTL || isFBX));

  // Determine if currently viewed VRM is the set custom mannequin
  const isCurrentCustomMannequin = Boolean(
    isVRM &&
    src &&
    vrmSettings.customMannequinUrl &&
    (vrmSettings.customMannequinUrl === src || vrmSettings.customMannequinName === name)
  );

  // Helper to fit camera to loaded 3D bounds
  const fitCameraToObject = useCallback((object: THREE.Object3D) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.7; // breathing room

    camera.position.set(center.x, center.y + size.y * 0.1, center.z + cameraZ);
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();

    // Position grid just underneath object bottom
    if (gridRef.current) {
      gridRef.current.position.y = box.min.y - 0.02;
    }
  }, []);

  // Setup Three.js Canvas Scene once
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isBlack ? 0x000000 : isLight ? 0xf1f5f9 : 0x0c131a);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.05, 1000);
    camera.position.set(0, 1.5, 4.5);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = false;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 0.4;
    controls.maxDistance = 50;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight1.position.set(4, 10, 6);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x94bce3, 0.85);
    dirLight2.position.set(-5, 4, -4);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0xb5d9fd, 0.5, 20);
    pointLight.position.set(0, -2, 3);
    scene.add(pointLight);

    // Coordinate Grid
    const grid = new THREE.GridHelper(10, 20, isLight ? 0x94a3b8 : 0x416180, isLight ? 0xcbd5e1 : 0x1d2d3d);
    grid.position.y = 0;
    scene.add(grid);
    gridRef.current = grid;

    // Render loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = Math.min(clockRef.current.getDelta(), 0.04);

      // Update VRM springs/expressions with bounded delta to prevent physics spiral
      if (currentVrmRef.current) {
        currentVrmRef.current.update(delta);
      }

      // Update Animation Mixer
      if (mixerRef.current) {
        mixerRef.current.update(delta * playbackSpeedRef.current);
        if (actionRef.current) {
          const curTime = actionRef.current.time;
          // Direct DOM updates for zero-lag 60fps playback without React re-renders
          if (!isScrubbingRef.current) {
            if (timeSliderRef.current) {
              timeSliderRef.current.value = String(curTime);
            }
            if (timeDisplayRef.current) {
              timeDisplayRef.current.textContent = `${formatTime(curTime)} / ${formatTime(animDurationRef.current)}`;
            }
          }
        }
      }

      // Auto-rotation turntable if enabled
      controls.autoRotate = Boolean(autoRotateRef.current);
      controls.autoRotateSpeed = 2.2;

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update scene background and coordinate grid in-place when theme changes without re-creating canvas
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(isBlack ? 0x000000 : isLight ? 0xf1f5f9 : 0x0c131a);
    }
    if (gridRef.current && sceneRef.current) {
      const oldY = gridRef.current.position.y;
      const oldVisible = gridRef.current.visible;
      sceneRef.current.remove(gridRef.current);
      const grid = new THREE.GridHelper(10, 20, isLight ? 0x94a3b8 : 0x416180, isLight ? 0xcbd5e1 : 0x1d2d3d);
      grid.position.y = oldY;
      grid.visible = oldVisible;
      sceneRef.current.add(grid);
      gridRef.current = grid;
    }
  }, [isLight, isBlack]);

  // Load Model / File whenever src, ext, or proceduralShape changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    let isCancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setAvailableAnimations([]);
    setAvailableExpressions([]);
    setAnimDuration(0);
    if (timeSliderRef.current) timeSliderRef.current.value = '0';
    if (timeDisplayRef.current) timeDisplayRef.current.textContent = '00:00.0 / 00:00.0';

    const targetMannequinType: MannequinType = vrmSettings.mannequinType || '12point';
    const targetMannequinKey = targetMannequinType === '12point'
      ? '12point'
      : targetMannequinType === 'custom' && vrmSettings.customMannequinUrl
      ? `custom:${vrmSettings.customMannequinUrl}`
      : 'default';

    const canReuseAvatar = Boolean(
      isVRMA &&
      currentVrmRef.current &&
      loadedObjectRef.current &&
      currentMannequinKeyRef.current === targetMannequinKey
    );

    // If we can reuse the avatar already live on stage, don't destroy or unmount it!
    if (canReuseAvatar) {
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
      }
      if (currentVrmRef.current?.humanoid) {
        currentVrmRef.current.humanoid.resetNormalizedPose();
      }
    } else {
      // Clean up previous loaded object
      if (loadedObjectRef.current) {
        scene.remove(loadedObjectRef.current);
        loadedObjectRef.current = null;
      }
      if (currentVrmRef.current) {
        currentVrmRef.current = null;
      }
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
        actionRef.current = null;
      }
      currentMannequinKeyRef.current = null;
    }

    const calculateMeshStats = (obj: THREE.Object3D) => {
      let vertices = 0;
      let faces = 0;
      let meshes = 0;
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && child.visible) {
          meshes++;
          const mesh = child as THREE.Mesh;
          const geom = mesh.geometry;
          if (geom) {
            vertices += geom.attributes.position ? geom.attributes.position.count : 0;
            if (geom.index) {
              faces += geom.index.count / 3;
            } else if (geom.attributes.position) {
              faces += geom.attributes.position.count / 3;
            }
          }
        }
      });
      setStats({ vertices, faces: Math.round(faces), meshes });
    };

    // Branch A: Fallback to Procedural 3D shapes if no src or unrecognized format
    if (!hasRealFile || !src) {
      // If the file extension clearly indicates a real 3D file, don't generate procedural shapes while waiting for src
      if (!src && (isVRM || isVRMA || isGLTF || isOBJ || isSTL || isFBX)) {
        setIsLoading(true);
        return;
      }

      let geom: THREE.BufferGeometry;
      if (proceduralShape === 'knot') {
        geom = new THREE.TorusKnotGeometry(1.1, 0.35, 128, 32);
      } else if (proceduralShape === 'ico') {
        geom = new THREE.IcosahedronGeometry(1.5, 2);
      } else if (proceduralShape === 'torus') {
        geom = new THREE.TorusGeometry(1.3, 0.45, 30, 100);
      } else {
        geom = new THREE.BoxGeometry(2, 2, 2, 4, 4, 4);
      }

      const mat = new THREE.MeshStandardMaterial({
        color: isLight ? 0x2563eb : 0x94bce3,
        metalness: 0.3,
        roughness: 0.25,
        wireframe
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = 1.2;
      scene.add(mesh);
      loadedObjectRef.current = mesh;
      calculateMeshStats(mesh);
      fitCameraToObject(mesh);
      setIsLoading(false);
      return;
    }

    // Branch B: Real File Ingestion
    const loadRealModel = async () => {
      try {
        const gltfLoader = new GLTFLoader();
        // Register VRM and VRM Animation Plugins
        gltfLoader.register((parser) => new VRMLoaderPlugin(parser));
        gltfLoader.register((parser) => new VRMAnimationLoaderPlugin(parser));

        const loadGltfPayload = async (url: string): Promise<any> => {
          if (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://')) {
            const res = await fetch(url);
            if (!res.ok) {
              let errBody = '';
              try { errBody = await res.text(); } catch {}
              throw new Error(`Failed to retrieve file from server (HTTP ${res.status}${errBody ? `: ${errBody}` : ''})`);
            }
            const buf = await res.arrayBuffer();
            return new Promise<any>((resolve, reject) => {
              gltfLoader.parse(buf, '', resolve, reject);
            });
          }
          return gltfLoader.loadAsync(url);
        };

        const bindAnimationPayload = (payloadGltf: any, targetVrm: VRM) => {
          const vrmAnimation = payloadGltf.userData.vrmAnimation || payloadGltf.userData.vrmAnimations?.[0];
          let clip: THREE.AnimationClip;
          if (vrmAnimation) {
            clip = createVRMAnimationClip(vrmAnimation, targetVrm);
          } else if (payloadGltf.animations && payloadGltf.animations.length > 0) {
            clip = payloadGltf.animations[0];
          } else {
            throw new Error('This animation file does not contain readable humanoid motion tracks or animation keyframes.');
          }
          return {
            clip,
            motionName: vrmAnimation?.name || payloadGltf.animations?.[0]?.name || name || 'VRMA Motion'
          };
        };

        const sanitizeHumanoidAvatar = (targetVrm: VRM) => {
          const toRemove: THREE.Object3D[] = [];
          targetVrm.scene.traverse((child) => {
            if (child.name.toLowerCase().includes('robo')) {
              child.visible = false;
              toRemove.push(child);
            }
          });
          toRemove.forEach((c) => {
            if (c.parent) c.parent.remove(c);
          });
        };

        // 1. VRM Avatar (.vrm)
        if (isVRM) {
          currentMannequinKeyRef.current = null;
          const gltf = await loadGltfPayload(src);
          if (isCancelled) return;
          const vrm = gltf.userData.vrm as VRM | undefined;

          if (vrm) {
            currentVrmRef.current = vrm;
            // Handle VRM 0.x vs 1.0 coordinate rotation
            VRMUtils.rotateVRM0(vrm);
            sanitizeHumanoidAvatar(vrm);

            scene.add(vrm.scene);
            loadedObjectRef.current = vrm.scene;

            // Extract expression names
            if (vrm.expressionManager) {
              const expNames = Object.keys(vrm.expressionManager.expressionMap || {});
              setAvailableExpressions(expNames);
            }

            calculateMeshStats(vrm.scene);
            fitCameraToObject(vrm.scene);
          } else {
            scene.add(gltf.scene);
            loadedObjectRef.current = gltf.scene;
            calculateMeshStats(gltf.scene);
            fitCameraToObject(gltf.scene);
          }
        }
        // 2. VRM Animation (.vrma)
        else if (isVRMA) {
          // If avatar is already live and mounted on stage, perform INSTANT animation swap!
          if (canReuseAvatar && currentVrmRef.current) {
            const vrmaGltf = await loadGltfPayload(src);
            if (isCancelled) return;

            const targetVrm = currentVrmRef.current;
            const { clip, motionName } = bindAnimationPayload(vrmaGltf, targetVrm);

            const mixer = mixerRef.current || new THREE.AnimationMixer(targetVrm.scene);
            mixerRef.current = mixer;

            const action = mixer.clipAction(clip);
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.play();
            actionRef.current = action;

            setAnimDuration(clip.duration);
            if (timeSliderRef.current) timeSliderRef.current.value = '0';
            if (timeDisplayRef.current) timeDisplayRef.current.textContent = `00:00.0 / ${formatTime(clip.duration)}`;
            setIsPlaying(true);
            setAvailableAnimations([motionName]);
            setIsLoading(false);
            return;
          }

          // Otherwise, mount the requested mannequin avatar
          let vrm: VRM;
          if (targetMannequinKey === '12point') {
            vrm = build12PointMannequin(theme);
          } else if (targetMannequinKey === 'default') {
            let avatarGltf = cachedDefaultAvatarGltf;
            if (!avatarGltf) {
              avatarGltf = await loadGltfPayload(DEFAULT_AVATAR_URL);
              cachedDefaultAvatarGltf = avatarGltf;
            }
            const loadedVrm = avatarGltf.userData.vrm as VRM | undefined;
            if (!loadedVrm) throw new Error('Default avatar does not contain valid VRM data');
            vrm = loadedVrm;
            VRMUtils.rotateVRM0(vrm);
            sanitizeHumanoidAvatar(vrm);
          } else {
            // Custom avatar picked from workspace
            const avatarUrl = vrmSettings.customMannequinUrl || DEFAULT_AVATAR_URL;
            let avatarGltf;
            try {
              avatarGltf = await loadGltfPayload(avatarUrl);
            } catch (err) {
              console.warn('Failed to load custom mannequin, falling back to default:', err);
              avatarGltf = cachedDefaultAvatarGltf || (await loadGltfPayload(DEFAULT_AVATAR_URL));
              cachedDefaultAvatarGltf = avatarGltf;
            }
            const loadedVrm = avatarGltf.userData.vrm as VRM | undefined;
            if (!loadedVrm) throw new Error('Target mannequin avatar does not contain valid VRM data');
            vrm = loadedVrm;
            VRMUtils.rotateVRM0(vrm);
            sanitizeHumanoidAvatar(vrm);
          }

          if (isCancelled) return;

          currentVrmRef.current = vrm;
          currentMannequinKeyRef.current = targetMannequinKey;
          scene.add(vrm.scene);
          loadedObjectRef.current = vrm.scene;

          // Now load the .vrma animation file
          const vrmaGltf = await loadGltfPayload(src);
          if (isCancelled) return;

          const { clip, motionName } = bindAnimationPayload(vrmaGltf, vrm);

          const mixer = new THREE.AnimationMixer(vrm.scene);
          mixerRef.current = mixer;

          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.play();
          actionRef.current = action;

          setAnimDuration(clip.duration);
          setAvailableAnimations([motionName]);
          calculateMeshStats(vrm.scene);
          fitCameraToObject(vrm.scene);
        }
        // 3. Standard GLB / GLTF
        else if (isGLTF) {
          currentMannequinKeyRef.current = null;
          const gltf = await loadGltfPayload(src);
          if (isCancelled) return;

          scene.add(gltf.scene);
          loadedObjectRef.current = gltf.scene;

          // If GLTF contains animations, bind to mixer
          if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(gltf.scene);
            mixerRef.current = mixer;
            const names = gltf.animations.map((a: any, i: number) => a.name || `Animation ${i + 1}`);
            setAvailableAnimations(names);

            const firstClip = gltf.animations[0];
            const action = mixer.clipAction(firstClip);
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.play();
            actionRef.current = action;
            setAnimDuration(firstClip.duration);
          }

          calculateMeshStats(gltf.scene);
          fitCameraToObject(gltf.scene);
        }
        // 4. Wavefront OBJ (.obj)
        else if (isOBJ) {
          currentMannequinKeyRef.current = null;
          const objLoader = new OBJLoader();
          const obj = await objLoader.loadAsync(src);
          if (isCancelled) return;

          // Apply clean default PBR material if none exists
          obj.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const m = child as THREE.Mesh;
              if (m.geometry) m.geometry.computeVertexNormals();
              if (!m.material || (Array.isArray(m.material) && m.material.length === 0)) {
                m.material = new THREE.MeshStandardMaterial({
                  color: isLight ? 0x2563eb : 0x94bce3,
                  metalness: 0.25,
                  roughness: 0.35,
                  wireframe
                });
              }
            }
          });

          scene.add(obj);
          loadedObjectRef.current = obj;
          calculateMeshStats(obj);
          fitCameraToObject(obj);
        }
        // 5. Stereolithography STL (.stl)
        else if (isSTL) {
          currentMannequinKeyRef.current = null;
          const stlLoader = new STLLoader();
          const geom = await stlLoader.loadAsync(src);
          if (isCancelled) return;

          geom.computeVertexNormals();
          const mat = new THREE.MeshStandardMaterial({
            color: isLight ? 0x2563eb : 0x94bce3,
            metalness: 0.3,
            roughness: 0.3,
            wireframe
          });
          const mesh = new THREE.Mesh(geom, mat);
          scene.add(mesh);
          loadedObjectRef.current = mesh;
          calculateMeshStats(mesh);
          fitCameraToObject(mesh);
        }
        // 6. Autodesk Filmbox FBX (.fbx)
        else if (isFBX) {
          currentMannequinKeyRef.current = null;
          const fbxLoader = new FBXLoader();
          const fbx = await fbxLoader.loadAsync(src);
          if (isCancelled) return;

          // Process meshes & materials
          fbx.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const m = child as THREE.Mesh;
              if (m.geometry) m.geometry.computeVertexNormals();
              if (!m.material || (Array.isArray(m.material) && m.material.length === 0)) {
                m.material = new THREE.MeshStandardMaterial({
                  color: isLight ? 0x2563eb : 0x94bce3,
                  metalness: 0.25,
                  roughness: 0.35,
                  wireframe
                });
              } else if (wireframe) {
                if (Array.isArray(m.material)) {
                  m.material.forEach((mat) => { (mat as any).wireframe = true; });
                } else {
                  (m.material as any).wireframe = true;
                }
              }
            }
          });

          scene.add(fbx);
          loadedObjectRef.current = fbx;

          // Wire up FBX animations if present
          if (fbx.animations && fbx.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(fbx);
            mixerRef.current = mixer;
            const names = fbx.animations.map((a, i) => a.name || `Animation ${i + 1}`);
            setAvailableAnimations(names);

            const firstClip = fbx.animations[0];
            const action = mixer.clipAction(firstClip);
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.play();
            actionRef.current = action;
            setAnimDuration(firstClip.duration);
          }

          calculateMeshStats(fbx);
          fitCameraToObject(fbx);
        }

        if (!isCancelled) {
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('Error loading 3D asset:', err);
        if (!isCancelled) {
          setLoadError(err.message || 'Failed to parse 3D asset payload');
          setIsLoading(false);
        }
      }
    };

    loadRealModel();

    return () => {
      isCancelled = true;
    };
  }, [src, fileExt, proceduralShape, hasRealFile, isVRM, isVRMA, isGLTF, isOBJ, isSTL, isFBX, fitCameraToObject, vrmSettings.customMannequinUrl, vrmSettings.mannequinType]);

  // Wireframe toggle handler across meshes
  useEffect(() => {
    if (!loadedObjectRef.current) return;
    loadedObjectRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => {
            if (m && 'wireframe' in m) (m as any).wireframe = wireframe;
          });
        } else if (mesh.material && 'wireframe' in mesh.material) {
          (mesh.material as any).wireframe = wireframe;
        }
      }
    });
  }, [wireframe]);

  // Grid toggle handler
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.visible = showGrid;
    }
  }, [showGrid]);

  // Spring bone physics toggle for VRM
  useEffect(() => {
    if (currentVrmRef.current?.springBoneManager) {
      currentVrmRef.current.springBoneManager.joints.forEach((joint) => {
        // Toggle spring bone joint active state
        if ('enabled' in joint) {
          (joint as any).enabled = springBones;
        }
      });
    }
  }, [springBones]);

  // VRM Expression trigger
  const handleSetExpression = (expName: string) => {
    if (!currentVrmRef.current?.expressionManager) return;
    const em = currentVrmRef.current.expressionManager;
    // Reset all expressions
    availableExpressions.forEach((name) => em.setValue(name, 0));
    // Set target expression
    em.setValue(expName, 1.0);
    setActiveExpression(expName);
  };

  // Animation playback controls
  const handleTogglePlay = () => {
    if (!actionRef.current) return;
    if (isPlaying) {
      actionRef.current.paused = true;
      setIsPlaying(false);
    } else {
      actionRef.current.paused = false;
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (actionRef.current) {
      actionRef.current.time = time;
    }
    if (timeDisplayRef.current) {
      timeDisplayRef.current.textContent = `${formatTime(time)} / ${formatTime(animDurationRef.current)}`;
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (actionRef.current) {
      actionRef.current.timeScale = speed;
    }
  };

  // VRM Mannequin Selection
  const handleSetAsMannequin = () => {
    if (!src || !isVRM) return;
    setCustomVRMMannequin(src, name);
  };

  const handleResetMannequin = () => {
    resetVRMMannequinToDefault();
  };

  // Format time display (mm:ss.s)
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = (secs % 60).toFixed(1);
    return `${m.toString().padStart(2, '0')}:${parseFloat(s) < 10 ? '0' : ''}${s}`;
  };

  // Environment background style
  const getEnvironmentBg = () => {
    if (isBlack || vrmSettings.environment === 'black') return '#000000';
    if (isLight) {
      if (vrmSettings.environment === 'studio') return 'radial-gradient(circle at 50% 40%, #ffffff 0%, #e2e8f0 100%)';
      if (vrmSettings.environment === 'slate') return 'radial-gradient(circle at 50% 40%, #f1f5f9 0%, #cbd5e1 100%)';
      return 'radial-gradient(circle at 50% 40%, #f8fafc 0%, #e2e8f0 100%)';
    }
    // Dark mode environments
    switch (vrmSettings.environment) {
      case 'studio':
        return 'radial-gradient(circle at 50% 35%, #252e38 0%, #11161d 100%)';
      case 'slate':
        return 'radial-gradient(circle at 50% 35%, #182838 0%, #0d1620 100%)';
      case 'blueprint':
      default:
        return 'radial-gradient(circle at 50% 35%, #172a3f 0%, #0c131a 100%)';
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: getEnvironmentBg(),
        borderRadius: '12px',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Top Primary Controls Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: isBlack ? '#111111' : isLight ? '#f1f5f9' : 'rgba(24,36,50,.94)',
          borderBottom: isBlack ? '1px solid #222' : isLight ? '1px solid #e2e8f0' : '1px solid rgba(148,188,227,.16)',
          zIndex: 10,
          flexWrap: 'wrap',
          gap: '6px'
        }}
      >
        {/* Left Side: Procedural selector OR Format Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {!hasRealFile ? (
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['knot', 'ico', 'torus', 'cube'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setProceduralShape(s)}
                  style={{
                    ...btnStyle(isLight, isBlack),
                    background: proceduralShape === s ? (isLight ? '#2563eb' : 'rgba(148,188,227,.3)') : 'transparent',
                    borderColor: proceduralShape === s ? (isLight ? '#2563eb' : '#94bce3') : undefined,
                    color: proceduralShape === s ? '#ffffff' : undefined
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  borderRadius: '5px',
                  background: isVRM
                    ? 'rgba(168, 85, 247, 0.2)'
                    : isVRMA
                    ? 'rgba(236, 72, 153, 0.2)'
                    : 'rgba(56, 189, 248, 0.2)',
                  color: isVRM ? '#c084fc' : isVRMA ? '#f472b6' : '#38bdf8',
                  border: `1px solid ${isVRM ? 'rgba(168, 85, 247, 0.4)' : isVRMA ? 'rgba(236, 72, 153, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`
                }}
              >
                {fileExt.toUpperCase()}
              </span>

              {/* VRM: Set as VRMA Mannequin Action */}
              {isVRM && (
                isCurrentCustomMannequin ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span
                      style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '9.5px',
                        background: 'rgba(16, 185, 129, 0.2)',
                        color: '#34d399',
                        padding: '3px 7px',
                        borderRadius: '5px',
                        border: '1px solid rgba(16, 185, 129, 0.4)'
                      }}
                    >
                      ★ Active Mannequin
                    </span>
                    <button
                      onClick={handleResetMannequin}
                      title="Reset back to default mannequin (Seed-san)"
                      style={btnStyle(isLight, isBlack)}
                    >
                      Reset
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleSetAsMannequin}
                    title="Use this avatar model when previewing .vrma animation files"
                    style={{
                      ...btnStyle(isLight, isBlack),
                      background: 'rgba(168, 85, 247, 0.15)',
                      borderColor: 'rgba(168, 85, 247, 0.4)',
                      color: '#d8b4fe'
                    }}
                  >
                    ★ Set as VRMA Mannequin
                  </button>
                )
              )}

              {/* VRMA: Mannequin Engine Selector (12-Point Rig vs AAA Avatar vs Custom) */}
              {isVRMA && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
                      borderRadius: '6px',
                      padding: '2px',
                      border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)'
                    }}
                  >
                    <button
                      onClick={() => {
                        saveVRMSettings({ mannequinType: '12point' });
                      }}
                      title="Industry standard 12-point motion capture rig - Instant zero-latency binding"
                      style={{
                        ...btnStyle(isLight, isBlack),
                        border: 'none',
                        background: (vrmSettings.mannequinType || '12point') === '12point'
                          ? (isLight ? '#2563eb' : 'rgba(56,189,248,0.25)')
                          : 'transparent',
                        color: (vrmSettings.mannequinType || '12point') === '12point'
                          ? (isLight ? '#ffffff' : '#38bdf8')
                          : (isLight ? '#64748b' : 'rgba(233,237,242,.6)'),
                        fontWeight: (vrmSettings.mannequinType || '12point') === '12point' ? 700 : 500
                      }}
                    >
                      ⚡ 12-Point Rig
                    </button>

                    <button
                      onClick={() => {
                        saveVRMSettings({ mannequinType: 'default' });
                      }}
                      title="AAA Reference Textured VRM Avatar (Seed-san)"
                      style={{
                        ...btnStyle(isLight, isBlack),
                        border: 'none',
                        background: vrmSettings.mannequinType === 'default'
                          ? (isLight ? '#2563eb' : 'rgba(168,85,247,0.25)')
                          : 'transparent',
                        color: vrmSettings.mannequinType === 'default'
                          ? (isLight ? '#ffffff' : '#c084fc')
                          : (isLight ? '#64748b' : 'rgba(233,237,242,.6)'),
                        fontWeight: vrmSettings.mannequinType === 'default' ? 700 : 500
                      }}
                    >
                      ✨ AAA Avatar
                    </button>

                    {vrmSettings.customMannequinUrl && (
                      <button
                        onClick={() => {
                          saveVRMSettings({ mannequinType: 'custom' });
                        }}
                        title={`Custom Avatar: ${vrmSettings.customMannequinName || 'Custom'}`}
                        style={{
                          ...btnStyle(isLight, isBlack),
                          border: 'none',
                          background: vrmSettings.mannequinType === 'custom'
                            ? (isLight ? '#2563eb' : 'rgba(56,239,125,0.25)')
                            : 'transparent',
                          color: vrmSettings.mannequinType === 'custom'
                            ? (isLight ? '#ffffff' : '#34d399')
                            : (isLight ? '#64748b' : 'rgba(233,237,242,.6)'),
                          fontWeight: vrmSettings.mannequinType === 'custom' ? 700 : 500
                        }}
                      >
                        👤 {vrmSettings.customMannequinName ? vrmSettings.customMannequinName.slice(0, 10) : 'Custom'}
                      </button>
                    )}
                  </div>

                  <span
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '9px',
                      color: (vrmSettings.mannequinType || '12point') === '12point'
                        ? '#38bdf8'
                        : vrmSettings.mannequinType === 'default'
                        ? '#c084fc'
                        : '#34d399',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: (vrmSettings.mannequinType || '12point') === '12point'
                        ? 'rgba(56,189,248,0.12)'
                        : vrmSettings.mannequinType === 'default'
                        ? 'rgba(168,85,247,0.12)'
                        : 'rgba(56,239,125,0.12)'
                    }}
                  >
                    {(vrmSettings.mannequinType || '12point') === '12point'
                      ? '⚡ Instant Mocap'
                      : vrmSettings.mannequinType === 'default'
                      ? '✨ Seed-san'
                      : '👤 Custom'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: View Toggles */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {isVRM && (
            <button
              onClick={() => setSpringBones(!springBones)}
              title="Toggle dynamic hair and clothing physics"
              style={{
                ...btnStyle(isLight, isBlack),
                background: springBones ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                color: springBones ? '#c084fc' : undefined,
                borderColor: springBones ? '#a855f7' : undefined
              }}
            >
              Springs {springBones ? 'On' : 'Off'}
            </button>
          )}

          <button
            onClick={() => setWireframe(!wireframe)}
            style={{
              ...btnStyle(isLight, isBlack),
              background: wireframe ? 'rgba(56,239,125,.18)' : 'transparent',
              color: wireframe ? '#38ef7d' : undefined,
              borderColor: wireframe ? '#38ef7d' : undefined
            }}
          >
            Wireframe
          </button>

          <button
            onClick={() => {
              const next = !autoRotate;
              setAutoRotate(next);
              autoRotateRef.current = next;
              saveVRMSettings({ autoRotate: next });
            }}
            style={{
              ...btnStyle(isLight, isBlack),
              background: autoRotate ? (isLight ? '#2563eb' : 'rgba(148,188,227,.25)') : 'transparent',
              color: autoRotate && isLight ? '#ffffff' : undefined
            }}
            title={autoRotate ? 'Disable 3D turntable auto-rotation' : 'Enable 3D turntable auto-rotation'}
          >
            {autoRotate ? 'Spin On' : 'Spin Off'}
          </button>

          <button
            onClick={() => setShowGrid(!showGrid)}
            style={{
              ...btnStyle(isLight, isBlack),
              background: showGrid ? (isLight ? '#2563eb' : 'rgba(148,188,227,.25)') : 'transparent',
              color: showGrid && isLight ? '#ffffff' : undefined
            }}
          >
            Grid
          </button>
        </div>
      </div>

      {/* VRM Expression Sub-toolbar (Only shown for .vrm models with expressions) */}
      {isVRM && availableExpressions.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 12px',
            background: isBlack ? '#181818' : isLight ? '#e2e8f0' : 'rgba(18,28,40,.96)',
            borderBottom: isBlack ? '1px solid #282828' : isLight ? '1px solid #cbd5e1' : '1px solid rgba(148,188,227,.1)',
            overflowX: 'auto',
            zIndex: 9
          }}
        >
          <span
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '9px',
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              color: isLight ? '#64748b' : 'rgba(233,237,242,.5)',
              marginRight: '4px'
            }}
          >
            Expression:
          </span>
          {['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised', 'blink'].map((expr) => {
            const hasExpr = availableExpressions.includes(expr);
            if (!hasExpr && expr !== 'neutral') return null;
            return (
              <button
                key={expr}
                onClick={() => handleSetExpression(expr)}
                style={{
                  ...btnStyle(isLight, isBlack),
                  padding: '2px 7px',
                  fontSize: '9.5px',
                  background: activeExpression === expr ? (isLight ? '#a855f7' : 'rgba(168,85,247,.3)') : 'transparent',
                  color: activeExpression === expr ? '#ffffff' : undefined,
                  borderColor: activeExpression === expr ? '#a855f7' : undefined
                }}
              >
                {expr}
              </button>
            );
          })}
        </div>
      )}

      {/* Animation Playback Sub-toolbar (For .vrma or animated .glb) */}
      {(isVRMA || (isGLTF && animDuration > 0)) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 12px',
            background: isBlack ? '#141414' : isLight ? '#e2e8f0' : 'rgba(16,24,35,.98)',
            borderBottom: isBlack ? '1px solid #252525' : isLight ? '1px solid #cbd5e1' : '1px solid rgba(148,188,227,.12)',
            zIndex: 9,
            flexWrap: 'wrap'
          }}
        >
          {/* Play/Pause Button */}
          <button
            onClick={handleTogglePlay}
            style={{
              ...btnStyle(isLight, isBlack),
              padding: '3px 10px',
              fontWeight: 700,
              background: isPlaying ? (isLight ? '#2563eb' : 'rgba(56,189,248,.25)') : 'transparent',
              color: isPlaying ? (isLight ? '#ffffff' : '#38bdf8') : undefined,
              borderColor: isPlaying ? '#38bdf8' : undefined
            }}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>

          {/* Scrubber Range Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '140px' }}>
            <input
              ref={timeSliderRef}
              type="range"
              min="0"
              max={animDuration || 1}
              step="0.01"
              defaultValue={0}
              onMouseDown={() => { isScrubbingRef.current = true; }}
              onTouchStart={() => { isScrubbingRef.current = true; }}
              onMouseUp={() => { isScrubbingRef.current = false; }}
              onTouchEnd={() => { isScrubbingRef.current = false; }}
              onChange={handleSeek}
              style={{
                flex: 1,
                accentColor: isLight ? '#2563eb' : '#38bdf8',
                cursor: 'pointer'
              }}
            />
            <span
              ref={timeDisplayRef}
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '9.5px',
                color: isLight ? '#475569' : 'rgba(233,237,242,.7)',
                whiteSpace: 'nowrap'
              }}
            >
              00:00.0 / {formatTime(animDuration)}
            </span>
          </div>

          {/* Speed Selector */}
          <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
            {[0.5, 1, 1.5, 2].map((spd) => (
              <button
                key={spd}
                onClick={() => handleSpeedChange(spd)}
                style={{
                  ...btnStyle(isLight, isBlack),
                  padding: '2px 6px',
                  fontSize: '9px',
                  background: playbackSpeed === spd ? (isLight ? '#0f172a' : 'rgba(255,255,255,.2)') : 'transparent',
                  color: playbackSpeed === spd ? '#ffffff' : undefined
                }}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      )}

      {/* WebGL Canvas Viewport */}
      <div
        ref={mountRef}
        style={{
          flex: 1,
          cursor: 'grab',
          position: 'relative',
          minHeight: 0
        }}
      >
        {/* Blank Black Overlay curtain with smooth fade-out and "Loading..." indicator */}
        <div
          onTransitionEnd={(e) => {
            if (e.propertyName === 'opacity' && overlayOpacity === 0) {
              setOverlayVisible(false);
            }
          }}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: isLight ? '#f8fafc' : '#000000',
            display: overlayVisible ? 'flex' : 'none',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: overlayOpacity,
            transition: 'opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: overlayOpacity === 0 ? 'none' : 'auto',
            zIndex: 40,
            gap: '14px',
            userSelect: 'none'
          }}
        >
          {loadError ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                padding: '16px 24px',
                borderRadius: '10px',
                background: isLight ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.18)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                maxWidth: '85%',
                textAlign: 'center'
              }}
            >
              <div style={{ color: '#ef4444', fontSize: '13px', fontWeight: 600, fontFamily: 'ui-monospace, monospace' }}>
                Failed to load 3D model
              </div>
              <div style={{ color: isLight ? '#991b1b' : '#fca5a5', fontSize: '11px', fontFamily: 'ui-monospace, monospace' }}>
                {loadError}
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px'
              }}
            >
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  border: isLight ? '3px solid rgba(15,23,42,0.1)' : '3px solid rgba(255,255,255,0.15)',
                  borderTopColor: isLight ? '#2563eb' : '#38bdf8',
                  borderRadius: '50%',
                  animation: 'archiveSpin 0.75s linear infinite'
                }}
              />
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  color: isLight ? '#0f172a' : '#ffffff'
                }}
              >
                Loading...
              </span>
              {isVRMA && (
                <span
                  style={{
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '10px',
                    color: isLight ? '#64748b' : 'rgba(255, 255, 255, 0.55)',
                    letterSpacing: '.04em'
                  }}
                >
                  Binding VRMA animation to mannequin…
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Telemetry HUD */}
      <div
        style={{
          padding: '6px 14px',
          background: isBlack ? '#111111' : isLight ? '#f1f5f9' : 'rgba(24,36,50,.96)',
          borderTop: isBlack ? '1px solid #222' : isLight ? '1px solid #e2e8f0' : '1px solid rgba(148,188,227,.14)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: '10px',
          color: isLight ? '#64748b' : 'rgba(233,237,242,.7)',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', gap: '14px' }}>
          <span>Polys: {stats.faces.toLocaleString()}</span>
          <span>Verts: {stats.vertices.toLocaleString()}</span>
          {stats.meshes > 1 && <span>Meshes: {stats.meshes}</span>}
        </div>
        <div style={{ color: isLight ? '#94a3b8' : 'rgba(233,237,242,.4)' }}>
          Left-drag: Orbit · Right-drag: Pan · Wheel: Zoom
        </div>
      </div>

      <style>{`
        @keyframes archiveSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const btnStyle = (isLight: boolean, isBlack: boolean): React.CSSProperties => ({
  padding: '3px 8px',
  borderRadius: '6px',
  border: isBlack
    ? '1px solid rgba(255, 255, 255, 0.2)'
    : isLight
    ? '1px solid rgba(15, 23, 42, 0.15)'
    : '1px solid rgba(148,188,227,.2)',
  background: isBlack
    ? 'rgba(255, 255, 255, 0.08)'
    : isLight
    ? 'rgba(15, 23, 42, 0.05)'
    : 'rgba(148,188,227,.1)',
  color: isBlack ? '#ffffff' : isLight ? '#0f172a' : '#b5d9fd',
  fontFamily: 'ui-monospace, Menlo, monospace',
  fontSize: '10px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px'
});
