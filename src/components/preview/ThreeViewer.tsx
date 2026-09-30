import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface ThreeViewerProps {
  name: string;
}

export const ThreeViewer: React.FC<ThreeViewerProps> = ({ name }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [shape, setShape] = useState<'torus' | 'ico' | 'cube' | 'knot'>('knot');
  const [stats, setStats] = useState({ vertices: 0, faces: 0 });

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const isDraggingRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c131a);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.set(0, 2.5, 6);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x94bce3, 1.2);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x416180, 0.8);
    dirLight2.position.set(-5, -5, -5);
    scene.add(dirLight2);

    // Grid Floor
    const grid = new THREE.GridHelper(10, 20, 0x416180, 0x1d2d3d);
    grid.position.y = -1.6;
    scene.add(grid);
    gridRef.current = grid;

    // Render loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (meshRef.current && autoRotate && !isDraggingRef.current) {
        meshRef.current.rotation.y += 0.008;
        meshRef.current.rotation.x += 0.003;
      }
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

  // Update geometry when shape or wireframe changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (meshRef.current) {
      scene.remove(meshRef.current);
      meshRef.current.geometry.dispose();
      (meshRef.current.material as THREE.Material).dispose();
    }

    let geom: THREE.BufferGeometry;
    if (shape === 'knot') {
      geom = new THREE.TorusKnotGeometry(1.1, 0.36, 128, 32);
    } else if (shape === 'ico') {
      geom = new THREE.IcosahedronGeometry(1.5, 2);
    } else if (shape === 'torus') {
      geom = new THREE.TorusGeometry(1.3, 0.45, 30, 100);
    } else {
      geom = new THREE.BoxGeometry(2, 2, 2, 4, 4, 4);
    }

    const mat = new THREE.MeshStandardMaterial({
      color: 0x94bce3,
      metalness: 0.3,
      roughness: 0.25,
      wireframe: wireframe
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.y = 0.2;
    scene.add(mesh);
    meshRef.current = mesh;

    setStats({
      vertices: geom.attributes.position ? geom.attributes.position.count : 0,
      faces: geom.index ? geom.index.count / 3 : (geom.attributes.position ? geom.attributes.position.count / 3 : 0)
    });
  }, [shape, wireframe]);

  // Update grid visibility
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.visible = showGrid;
    }
  }, [showGrid]);

  // Pointer drag to orbit
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !meshRef.current) return;
    const deltaX = e.clientX - prevMouseRef.current.x;
    const deltaY = e.clientY - prevMouseRef.current.y;
    meshRef.current.rotation.y += deltaX * 0.01;
    meshRef.current.rotation.x += deltaY * 0.01;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!cameraRef.current) return;
    cameraRef.current.position.z = Math.max(2, Math.min(14, cameraRef.current.position.z + e.deltaY * 0.005));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0c131a',
        borderRadius: '14px',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Top Controls Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'rgba(24,36,50,.92)',
          borderBottom: '1px solid rgba(148,188,227,.14)',
          zIndex: 10,
          flexWrap: 'wrap',
          gap: '6px'
        }}
      >
        {/* Shape Switcher */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['knot', 'ico', 'torus', 'cube'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setShape(s)}
              style={{
                ...btnStyle,
                background: shape === s ? 'rgba(148,188,227,.3)' : 'transparent',
                borderColor: shape === s ? '#94bce3' : 'rgba(148,188,227,.2)',
                color: shape === s ? '#ffffff' : '#b5d9fd'
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* View toggles */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setWireframe(!wireframe)}
            style={{
              ...btnStyle,
              background: wireframe ? 'rgba(56,239,125,.18)' : 'transparent',
              color: wireframe ? '#38ef7d' : '#b5d9fd',
              borderColor: wireframe ? '#38ef7d' : 'rgba(148,188,227,.2)'
            }}
          >
            Wireframe
          </button>

          <button
            onClick={() => setAutoRotate(!autoRotate)}
            style={{
              ...btnStyle,
              background: autoRotate ? 'rgba(148,188,227,.25)' : 'transparent'
            }}
          >
            {autoRotate ? 'Spin On' : 'Spin Off'}
          </button>

          <button
            onClick={() => setShowGrid(!showGrid)}
            style={{
              ...btnStyle,
              background: showGrid ? 'rgba(148,188,227,.25)' : 'transparent'
            }}
          >
            Grid
          </button>
        </div>
      </div>

      {/* WebGL Canvas Container */}
      <div
        ref={mountRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{
          flex: 1,
          cursor: 'grab',
          position: 'relative'
        }}
      />

      {/* Bottom HUD Bar */}
      <div
        style={{
          padding: '6px 14px',
          background: 'rgba(24,36,50,.94)',
          borderTop: '1px solid rgba(148,188,227,.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: '10px',
          color: 'rgba(233,237,242,.7)'
        }}
      >
        <div>
          <span>Polys: {stats.faces.toLocaleString()}</span>
          <span style={{ marginLeft: '12px' }}>Verts: {stats.vertices.toLocaleString()}</span>
        </div>
        <div style={{ color: 'rgba(233,237,242,.4)' }}>
          Left-drag: Rotate · Wheel: Zoom
        </div>
      </div>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: '6px',
  border: '1px solid rgba(148,188,227,.2)',
  background: 'rgba(148,188,227,.1)',
  color: '#b5d9fd',
  fontFamily: 'ui-monospace, Menlo, monospace',
  fontSize: '10.5px',
  cursor: 'pointer'
};
