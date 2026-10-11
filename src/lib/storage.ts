import * as Minio from 'minio';

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || '172.17.0.1',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'miniopassword123',
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'busdevcore-attachments';

export async function ensureBucket() {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
    }
  } catch (err) {
    console.error('Error ensuring bucket:', err);
  }
}

export async function uploadFile(
  objectName: string,
  buffer: Buffer,
  size: number,
  contentType: string
): Promise<string> {
  await ensureBucket();
  await minioClient.putObject(BUCKET_NAME, objectName, buffer, size, {
    'Content-Type': contentType,
  });
  return `/api/files/${encodeURIComponent(objectName)}`;
}

export async function getFileStream(objectName: string) {
  return await minioClient.getObject(BUCKET_NAME, objectName);
}

export async function getFileStat(objectName: string) {
  return await minioClient.statObject(BUCKET_NAME, objectName);
}

export async function deleteFile(objectName: string) {
  await minioClient.removeObject(BUCKET_NAME, objectName);
}

export default minioClient;
