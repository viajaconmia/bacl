// utils/s3Utils.js
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3Client = new S3Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const generatePresignedUploadUrl = async (key, contentType) => {


  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
    // NO TAGGING → simplifica la firma
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: 60 });

  const publicUrl = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;

  return { url, key, publicUrl };
};

module.exports = { generatePresignedUploadUrl };
