import * as Minio from 'minio';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required storage configuration: ${name}`);
  return value;
}

function getStorage() {
  const client = new Minio.Client({
    endPoint: requiredEnv('MINIO_ENDPOINT'),
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: requiredEnv('MINIO_ACCESS_KEY'),
    secretKey: requiredEnv('MINIO_SECRET_KEY'),
  });
  return { client, bucket: requiredEnv('MINIO_BUCKET') };
}

export async function ensureBucket() {
  const { client, bucket } = getStorage();
  const exists = await client.bucketExists(bucket);
  if (!exists) await client.makeBucket(bucket, 'us-east-1');
}

export async function uploadFile(
  objectName: string,
  buffer: Buffer,
  size: number,
  contentType: string
): Promise<string> {
  const { client, bucket } = getStorage();
  await ensureBucket();
  await client.putObject(bucket, objectName, buffer, size, {
    'Content-Type': contentType,
  });
  return `/api/files/${encodeURIComponent(objectName)}`;
}

export async function getFileStream(objectName: string) {
  const { client, bucket } = getStorage();
  return await client.getObject(bucket, objectName);
}

export async function getFileStat(objectName: string) {
  const { client, bucket } = getStorage();
  return await client.statObject(bucket, objectName);
}

export async function deleteFile(objectName: string) {
  const { client, bucket } = getStorage();
  await client.removeObject(bucket, objectName);
}
