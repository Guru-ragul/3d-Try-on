'use client';

import { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, useGLTF } from '@react-three/drei';
import type { Group } from 'three';

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

  return <primitive object={scene} />;
}

export function ModelViewer({ modelUrl, onModelLoaded, onError }: ModelViewerProps) {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (modelUrl) setIsLoading(true);
  }, [modelUrl]);

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-slate-900 to-slate-800">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 2.5]} fov={75} />

        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 8]} intensity={1} />

        {modelUrl ? (
          <GltfModel
            url={modelUrl}
            onLoaded={() => setIsLoading(false)}
          />
        ) : (
          <PlaceholderMesh />
        )}

        <OrbitControls autoRotate={!modelUrl} autoRotateSpeed={2} />
        <Environment preset="city" />
      </Canvas>

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
