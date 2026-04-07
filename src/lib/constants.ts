// 3D Viewer Constants
export const CAMERA_CONFIG = {
  FOV: parseInt(process.env.NEXT_PUBLIC_CAMERA_FOV || '75'),
  NEAR: 0.1,
  FAR: 1000,
  POSITION: [0, 0, 2.5] as [number, number, number],
};

export const LIGHTING_CONFIG = {
  AMBIENT_INTENSITY: 0.5,
  DIRECTIONAL_INTENSITY: 1,
  DIRECTIONAL_POSITION: [5, 10, 8] as [number, number, number],
};

// Model Configuration
export const MODEL_CONFIG = {
  DEFAULT_SCALE: 1,
  MAX_SCALE: 2,
  MIN_SCALE: 0.5,
  ROTATION_SPEED: 0.01,
};

// UI Configuration
export const UI_CONFIG = {
  TOAST_DURATION: 3000,
  ANIMATION_DURATION: 300,
};

// API Endpoints
export const API_ENDPOINTS = {
  MODELS: '/api/models',
  UPLOAD: '/api/upload',
  CONVERT: '/api/convert',
};
