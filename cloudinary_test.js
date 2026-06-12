const cloudinary = require('cloudinary').v2;

// 1. Configure Cloudinary
cloudinary.config({
  cloud_name: 'datjttwmv',
  api_key: '327283535632842',
  api_secret: 'SZF_I7q4mwrzPikBktbkMLRbTmI'
});

async function run() {
  try {
    // 2. Upload an image
    const sampleImageUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
    console.log('Uploading image to Cloudinary...');
    const uploadResult = await cloudinary.uploader.upload(sampleImageUrl, {
      public_id: 'cloudinary_test_sample'
    });

    console.log('Upload successful!');
    console.log('Secure URL:', uploadResult.secure_url);
    console.log('Public ID:', uploadResult.public_id);

    // 3. Get image details (Fetching metadata from Cloudinary)
    console.log('\nFetching image details...');
    const details = await cloudinary.api.resource(uploadResult.public_id);
    console.log('Width:', details.width);
    console.log('Height:', details.height);
    console.log('Format:', details.format);
    console.log('File Size (Bytes):', details.bytes);

    // 4. Transform the image
    // Generate a transformed version using f_auto and q_auto
    const transformedUrl = cloudinary.url(uploadResult.public_id, {
      secure: true,
      transformation: [
        { fetch_format: 'auto' }, // f_auto: Automatically selects the best format supported by the browser (WebP, AVIF, etc.)
        { quality: 'auto' }       // q_auto: Automatically optimizes image quality/compression level
      ]
    });

    console.log('\nDone! Click link below to see optimized version of the image. Check the size and the format.');
    console.log(transformedUrl);

  } catch (error) {
    console.error('Error occurred:', error.message || error);
  }
}

run();
