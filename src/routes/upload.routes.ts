
import { Router, Request, Response } from "express";
import multer from "multer";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per image
  },
  fileFilter: (req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      callback(new Error("Only image files are allowed"));
      return;
    }

    callback(null, true);
  },
});

router.post(
  "/images",
  upload.array("images"),
  async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.IMGBB_API_KEY;

      if (!apiKey) {
        res.status(500).json({
          success: false,
          message: "ImgBB API key is not configured",
        });
        return;
      }

      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          message: "Please select at least one image",
        });
        return;
      }

      const uploadedImages: string[] = [];

      for (const file of files) {
        const formData = new FormData();

        const imageBlob = new Blob(
          [new Uint8Array(file.buffer)],
          { type: file.mimetype }
        );

        formData.append("image", imageBlob, file.originalname);

        const response = await fetch(
          `https://api.imgbb.com/1/upload?key=${apiKey}`,
          {
            method: "POST",
            body: formData,
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error?.message || "An image could not be uploaded"
          );
        }

        uploadedImages.push(result.data.url);
      }

      res.status(200).json({
        success: true,
        message: "Images uploaded successfully",
        data: uploadedImages,
      });
    } catch (error) {
      console.error("Image upload error:", error);

      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Image upload failed",
      });
    }
  }
);

export default router;
