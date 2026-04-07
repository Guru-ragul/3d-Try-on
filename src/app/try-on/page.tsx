'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const ModelViewer = dynamic(
  () => import('@/components/3d/ModelViewer').then((m) => ({ default: m.ModelViewer })),
  { ssr: false, loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400">Initializing 3D viewer...</div>
    </div>
  ) }
);

export default function TryOnPage() {
  const [modelUrl, setModelUrl] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['.glb', '.gltf', '.obj', '.fbx'];
    const isValid = validTypes.some((type) =>
      file.name.toLowerCase().endsWith(type)
    );

    if (!isValid) {
      setError('Please upload a valid 3D model file (.glb, .gltf, .obj, .fbx)');
      return;
    }

    // Create URL for the file
    const url = URL.createObjectURL(file);
    setModelUrl(url);
    setFileName(file.name);
    setError('');
  };

  const handleError = (err: Error) => {
    setError(`Failed to load model: ${err.message}`);
    setModelUrl('');
  };

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-1">3D Fit Try-On</h1>
          <p className="text-slate-400">Upload and preview 3D models in real-time</p>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 p-6 max-w-7xl mx-auto w-full">
        {/* Viewer Section */}
        <div className="flex-1 min-h-[500px] rounded-lg overflow-hidden shadow-2xl border border-slate-800">
          <ModelViewer
            modelUrl={modelUrl}
            onError={handleError}
          />
        </div>

        {/* Controls Section */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
          {/* Upload Card */}
          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800 shadow-lg">
            <h2 className="text-lg font-semibold text-white mb-4">Upload Model</h2>

            <div className="mb-4">
              <label
                htmlFor="model-upload"
                className="block w-full p-4 border-2 border-dashed border-slate-700 rounded-lg text-center cursor-pointer hover:border-blue-500 hover:bg-blue-500/5 transition-colors"
              >
                <input
                  id="model-upload"
                  type="file"
                  accept=".glb,.gltf,.obj,.fbx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <p className="text-slate-400">
                  <span className="font-semibold text-blue-400">Click to upload</span>
                  {' '}or drag and drop
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  GLB, GLTF, OBJ, or FBX (up to 50MB)
                </p>
              </label>
            </div>

            {fileName && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-300 text-sm flex items-center justify-between">
                <span className="truncate">{fileName}</span>
                <button
                  onClick={() => {
                    setModelUrl('');
                    setFileName('');
                  }}
                  className="ml-2 text-blue-400 hover:text-blue-300"
                >
                  ✕
                </button>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Info Card */}
          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800 shadow-lg">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
              Controls
            </h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">•</span>
                <span>
                  <strong className="text-slate-300">Rotate:</strong> Drag with mouse
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">•</span>
                <span>
                  <strong className="text-slate-300">Zoom:</strong> Scroll wheel
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">•</span>
                <span>
                  <strong className="text-slate-300">Pan:</strong> Right-click + drag
                </span>
              </li>
            </ul>
          </div>

          {/* Settings Card */}
          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800 shadow-lg">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
              Supported Formats
            </h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                GLB (Binary GLTF)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                GLTF (JSON + Assets)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                OBJ (Wavefront)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                FBX (Autodesk)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
