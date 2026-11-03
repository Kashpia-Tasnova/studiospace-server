import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";

import type { createAuth } from "../auth";

type Auth = Awaited<ReturnType<typeof createAuth>>;

export function createUploadRouter(auth: Auth) {
  const router = Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB per image
      files: 10, // Maximum 10 images per request
    },
    fileFilter: (req, file, callback) => {
      if (!file.mimetype.startsWith("image/")) {
        callback(new Error("Only image files are allowed"));
        return;
      }

      callback(null, true);
    },
  });

  // Verify the user's Better Auth session before processing uploads.
  async function requireAuth(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
     const { fromNodeHeaders } = await import("better-auth/node");

     const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
   });

      if (!session) {
        res.status(401).json({
          success: false,
          message: "Please log in to upload images",
        });
        return;
      }

      next();
    } catch (error) {
      console.error("Upload authentication error:", error);

      res.status(401).json({
        success: false,
        message: "Authentication failed. Please log in again.",
      });
    }
  }

  router.post(
    "/images",
    requireAuth,
    upload.array("images", 10),
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

  return router;
}