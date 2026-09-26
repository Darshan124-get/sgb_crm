const { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand, 
  HeadObjectCommand, 
  ListObjectsV2Command
} = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const logger = require('../utils/whatsappLogger');
require('dotenv').config();

// R2 Configuration from Environment Variables
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const defaultBucket = process.env.R2_BUCKET || 'sgb-crm-media';
const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
const region = process.env.R2_REGION || 'auto';

let s3Client = null;

if (accessKeyId && secretAccessKey && endpoint) {
  s3Client = new S3Client({
    region: region,
    endpoint: endpoint,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  });
  console.log('✅ StorageService: Cloudflare R2 Client initialized successfully.');
} else {
  console.warn('⚠️ StorageService: R2 credentials incomplete in environment. S3 operations will fail if invoked.');
}

/**
 * Normalizes an object key to prevent leading slashes or invalid characters.
 */
function normalizeKey(key) {
  if (!key) return '';
  return key.replace(/^\/+/, '').trim();
}

/**
 * Generates a public URL for an R2 object key.
 */
function getPublicUrl(key, bucketName = defaultBucket) {
  if (!key) return '';
  const cleanKey = extractKeyFromUrl(key);
  if (!cleanKey) return '';
  if (cleanKey.startsWith('http://') || cleanKey.startsWith('https://')) {
    return cleanKey;
  }
  const baseUrl = (process.env.APP_BASE_URL || process.env.SERVER_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
  return `${baseUrl}/api/media/${cleanKey}`;
}

/**
 * Uploads a Buffer, Stream, or String to Cloudflare R2.
 */
async function uploadObject({ key, body, contentType = 'application/octet-stream', metadata = {}, bucket = defaultBucket }) {
  const cleanKey = normalizeKey(key);
  if (!s3Client) {
    throw new Error('StorageService: S3/R2 client is not configured.');
  }

  try {
    const parallelUploads3 = new Upload({
      client: s3Client,
      params: {
        Bucket: bucket,
        Key: cleanKey,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
      },
      queueSize: 4,
      partSize: 1024 * 1024 * 5, // 5MB parts
      leavePartsOnError: false,
    });

    await parallelUploads3.done();
    const publicUrl = getPublicUrl(cleanKey, bucket);
    return {
      success: true,
      key: cleanKey,
      bucket: bucket,
      url: publicUrl,
      publicUrl: publicUrl
    };
  } catch (error) {
    logger.error(`[STORAGE SERVICE] Upload error for key '${cleanKey}': ${error.message}`);
    throw error;
  }
}

/**
 * Downloads an object from R2 and returns its Buffer and Metadata.
 */
async function downloadObject({ key, bucket = defaultBucket }) {
  const cleanKey = normalizeKey(key);
  if (!s3Client) throw new Error('StorageService: S3/R2 client is not configured.');

  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: cleanKey,
    });
    const response = await s3Client.send(command);
    
    const streamToBuffer = async (stream) => {
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    };

    const buffer = await streamToBuffer(response.Body);
    return {
      buffer,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      metadata: response.Metadata,
      eTag: response.ETag,
    };
  } catch (error) {
    logger.error(`[STORAGE SERVICE] Download error for key '${cleanKey}': ${error.message}`);
    throw error;
  }
}

/**
 * Checks if an object exists in R2.
 */
async function objectExists({ key, bucket = defaultBucket }) {
  const cleanKey = normalizeKey(key);
  if (!s3Client) return false;

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: cleanKey,
    });
    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Fetches object metadata without downloading body.
 */
async function getObjectMetadata({ key, bucket = defaultBucket }) {
  const cleanKey = normalizeKey(key);
  if (!s3Client) throw new Error('StorageService: S3/R2 client is not configured.');

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: cleanKey,
    });
    const response = await s3Client.send(command);
    return {
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      lastModified: response.LastModified,
      eTag: response.ETag,
      metadata: response.Metadata,
    };
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Deletes an object from R2.
 */
async function deleteObject({ key, bucket = defaultBucket }) {
  const cleanKey = normalizeKey(key);
  if (!s3Client) throw new Error('StorageService: S3/R2 client is not configured.');

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: cleanKey,
    });
    await s3Client.send(command);
    return { success: true, key: cleanKey };
  } catch (error) {
    logger.error(`[STORAGE SERVICE] Delete error for key '${cleanKey}': ${error.message}`);
    throw error;
  }
}

/**
 * Generates a presigned URL for private access or direct upload.
 */
async function generatePresignedUrl({ key, bucket = defaultBucket, expiresIn = 3600, operation = 'getObject' }) {
  const cleanKey = normalizeKey(key);
  if (!s3Client) throw new Error('StorageService: S3/R2 client is not configured.');

  try {
    const CommandClass = operation === 'putObject' ? PutObjectCommand : GetObjectCommand;
    const command = new CommandClass({
      Bucket: bucket,
      Key: cleanKey,
    });
    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    logger.error(`[STORAGE SERVICE] Presigned URL error for key '${cleanKey}': ${error.message}`);
    throw error;
  }
}

/**
 * Lists objects under a prefix.
 */
async function listObjects({ prefix = '', bucket = defaultBucket, maxKeys = 1000, continuationToken }) {
  if (!s3Client) throw new Error('StorageService: S3/R2 client is not configured.');

  try {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: normalizeKey(prefix),
      MaxKeys: maxKeys,
      ContinuationToken: continuationToken,
    });
    const response = await s3Client.send(command);
    return {
      objects: (response.Contents || []).map(obj => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        eTag: obj.ETag,
      })),
      isTruncated: response.IsTruncated,
      nextContinuationToken: response.NextContinuationToken,
    };
  } catch (error) {
    logger.error(`[STORAGE SERVICE] List objects error: ${error.message}`);
    throw error;
  }
}

/**
 * Extract storage key from full URL (Supabase or R2 or relative path).
 */
function extractKeyFromUrl(url) {
  if (!url) return '';

  if (url.includes('/api/media/')) {
    const idx = url.indexOf('/api/media/');
    return normalizeKey(url.substring(idx + '/api/media/'.length));
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return normalizeKey(url);
  }

  // Supabase URL format: https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path>
  const supabaseMatch = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
  if (supabaseMatch) {
    return normalizeKey(supabaseMatch[1]);
  }

  if (endpoint && url.startsWith(endpoint)) {
    const pathAfterEndpoint = url.substring(endpoint.length).replace(/^\/+/, '');
    const parts = pathAfterEndpoint.split('/');
    if (parts.length > 1 && parts[0] === defaultBucket) {
      return parts.slice(1).join('/');
    }
    return pathAfterEndpoint;
  }

  return normalizeKey(url);
}

module.exports = {
  s3Client,
  normalizeKey,
  getPublicUrl,
  uploadObject,
  downloadObject,
  objectExists,
  getObjectMetadata,
  deleteObject,
  generatePresignedUrl,
  listObjects,
  extractKeyFromUrl,
  defaultBucket,
};
