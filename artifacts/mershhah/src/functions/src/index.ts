import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import sharp from "sharp";
import * as path from "path";

admin.initializeApp();

export const optimizeImages = functions.storage
  .object()
  .onFinalize(async (object) => {
    const filePath = object.name;
    const contentType = object.contentType;
    const bucket = admin.storage().bucket(object.bucket);

    // 1. Exit if this is not a file, not an image, or already a WebP.
    if (!filePath || !contentType || !contentType.startsWith("image/") || contentType.startsWith("image/webp")) {
        functions.logger.log("Exiting: Not a valid image to process.", {filePath, contentType});
        return null;
    }
    
    // 2. Check if file is in one of the image directories we care about
    const isRestaurantImage = filePath.startsWith('restaurants/');
    const isUserImage = filePath.startsWith('users/');
    if (!isRestaurantImage && !isUserImage) {
        functions.logger.log("Exiting: File is not in a monitored directory.", {filePath});
        return null;
    }

    const fileName = path.basename(filePath);
    // 3. Exit if this is a an already-optimized image (to prevent infinite loops)
    if (fileName.endsWith('.webp')) {
      functions.logger.log("Exiting: File is already a webp.", filePath);
      return null;
    }

    const file = bucket.file(filePath);
    const tempFilePath = `/tmp/${fileName}`;
    
    // 4. Download file to a temp location
    await file.download({ destination: tempFilePath });
    functions.logger.log("Image downloaded locally to", tempFilePath);

    let quality = 80;
    let outputBuffer;

    // 5. Try to compress the image under 2MB
    while (quality >= 40) {
      outputBuffer = await sharp(tempFilePath)
        .resize({ width: 1200, withoutEnlargement: true }) // Resize to max 1200px width, don't enlarge smaller images
        .webp({ quality })
        .toBuffer();

      if (outputBuffer.length <= 2 * 1024 * 1024) break; // Break if under 2MB

      quality -= 10;
    }

    if (!outputBuffer) {
        functions.logger.error("Could not generate optimized buffer for", filePath);
        return null;
    }

    // 6. Define the new file path, replacing extension with .webp
    const newFilePath = filePath.replace(/\.[^/.]+$/, "") + ".webp";

    // 7. Upload the new optimized image
    await bucket.file(newFilePath).save(outputBuffer, {
      metadata: {
        contentType: "image/webp",
      },
    });
    functions.logger.log("Optimized image uploaded to", newFilePath);

    // 8. Delete the original file
    await file.delete();
    functions.logger.log("Original file deleted.", filePath);

    return null;
  });
