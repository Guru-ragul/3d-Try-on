'use client';

import { useState, useRef, useEffect, Suspense, Component, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei';
import type { Group } from 'three';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class CanvasErrorBoundary extends Component<
  { children: ReactNode; onError?: (e: Error) => void },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; onError?: (e: Error) => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full bg-slate-900 flex items-center justify-center">
          <div className="text-center px-4">
            <p className="text-red-400 font-semibold mb-2">Failed to render 3D view</p>
            <p className="text-slate-400 text-sm">{this.state.error?.message}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface ModelViewerProps {
  modelUrl?: string;
  onModelLoaded?: () => void;
  onError?: (error: Error) => void;
}

function PlaceholderMesh() {
  const meshRef = useRef<Group>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
    }
  });

  return (
    <group ref={meshRef}>
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
    </group>
  );
}

function GltfModel({ url, onLoaded }: { url: string; onLoaded?: () => void }) {
  const { scene } = useGLTF(url);

  useEffect(() => {
    onLoaded?.();
  }, [onLoaded]);

  return <primitive object={scene} dispose={null} />;
}

export function ModelViewer({ modelUrl, onModelLoaded, onError }: ModelViewerProps) {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (modelUrl) setIsLoading(true);
  }, [modelUrl]);

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-slate-900 to-slate-800">
      <CanvasErrorBoundary onError={onError}>
        <Canvas>
          <PerspectiveCamera makeDefault position={[0, 0, 2.5]} fov={75} />

          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 10, 8]} intensity={1.2} />
          <directionalLight position={[-5, -5, -5]} intensity={0.3} />
          <hemisphereLight args={['#c7d4f0', '#1e293b', 0.5]} />

          <Suspense fallback={null}>
            {modelUrl ? (
              <GltfModel
                url={modelUrl}
                onLoaded={() => setIsLoading(false)}
              />
            ) : (
              <PlaceholderMesh />
            )}
          </Suspense>

          <OrbitControls autoRotate={!modelUrl} autoRotateSpeed={2} />
        </Canvas>
      </CanvasErrorBoundary>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-2" />
            <p>Loading model...</p>
          </div>
        </div>
      )}
    </div>
  );
}
