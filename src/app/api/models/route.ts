import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/models
 * List available 3D models
 */
export async function GET() {
  // This is a placeholder for future model listing endpoint
  // In production, this would fetch from a database or file storage
  return NextResponse.json(
    {
      models: [
        {
          id: 1,
          name: 'Sample Model',
          url: '/models/sample.glb',
          uploadedAt: new Date().toISOString(),
        },
      ],
      total: 1,
    },
    { status: 200 }
  );
}

/**
 * POST /api/models
 * Upload a new 3D model (placeholder)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['model/gltf-binary', 'model/obj', 'application/octet-stream'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.glb')) {
      return NextResponse.json(
        { error: 'Invalid file type' },
        { status: 400 }
      );
    }

    // In production, save to cloud storage (e.g., AWS S3, Vercel Blob)
    // For now, return a success response
    return NextResponse.json(
      {
        success: true,
        message: 'Model uploaded successfully',
        file: {
          name: file.name,
          size: file.size,
          type: file.type,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Model upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload model' },
      { status: 500 }
    );
  }
}
