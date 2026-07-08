const { Storage } = require('@google-cloud/storage');

const storage = new Storage({
  projectId: 'clipixx',
  keyFilename: './config/firebase-service-account.json'
});

const bucketName = 'clipixx.firebasestorage.app';

const corsConfiguration = [
  {
    maxAgeSeconds: 3600,
    method: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
    responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'User-Agent', 'x-goog-resumable'],
  },
];

async function setCors() {
  try {
    await storage.bucket(bucketName).setCorsConfiguration(corsConfiguration);
    console.log(`Bucket ${bucketName} was updated with a CORS config`);
  } catch (error) {
    console.error('Failed to update bucket:', error);
  }
}

setCors();
