import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'datjttwmv',
  api_key: process.env.CLOUDINARY_API_KEY || '327283535632842',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'SZF_I7q4mwrzPikBktbkMLRbTmI'
});

export function uploadToCloudinary(
  fileBuffer: Buffer,
  publicId: string,
  folder: string = 'chat',
  resourceType: 'image' | 'video' | 'raw' | 'auto' = 'image'
): Promise<any> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder: folder,
        overwrite: true,
        invalidate: true,
        resource_type: resourceType
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    uploadStream.write(fileBuffer);
    uploadStream.end();
  });
}

export { cloudinary };
