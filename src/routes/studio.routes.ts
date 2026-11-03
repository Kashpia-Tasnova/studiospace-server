
import { Router, Request, Response, NextFunction } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../db";
import type { createAuth } from "../auth";

type Auth = Awaited<ReturnType<typeof createAuth>>;

export function createStudioRouter(auth: Auth) {
  const router = Router();

  // Validate an array containing only non-empty strings
  function isStringArray(value: unknown): value is string[] {
    return (
      Array.isArray(value) &&
      value.every(
        (item) => typeof item === "string" && item.trim().length > 0
      )
    );
  }

  // Verify the user's Better Auth session
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
          message: "Please log in to continue",
        });
        return;
      }

      res.locals.user = session.user;
      next();
    } catch (error) {
      console.error("Studio authentication error:", error);

      res.status(401).json({
        success: false,
        message: "Authentication failed. Please log in again.",
      });
    }
  }

  // GET all studio listings
  router.get("/", async (req, res) => {
    try {
      const db = getDB();

      const studios = await db.collection("studios").find({}).toArray();

      res.status(200).json({
        success: true,
        message: "Studios retrieved successfully",
        data: studios,
      });
    } catch (error) {
      console.error("Error fetching studios:", error);

      res.status(500).json({
        success: false,
        message: "Failed to retrieve studios",
      });
    }
  });

  // GET the 6 newest available studios for the homepage
  router.get("/featured", async (req, res) => {
    try {
      const db = getDB();

      const studios = await db
        .collection("studios")
        .find({ status: "available" })
        .sort({ createdAt: -1, _id: -1 })
        .limit(6)
        .toArray();

      res.status(200).json({
        success: true,
        message: "Featured studios retrieved successfully",
        data: studios,
      });
    } catch (error) {
      console.error("Error fetching featured studios:", error);

      res.status(500).json({
        success: false,
        message: "Failed to retrieve featured studios",
      });
    }
  });

  // GET all studio listings belonging to the logged-in user
  router.get("/my-listings", requireAuth, async (req, res) => {
    try {
      const user = res.locals.user;
      const db = getDB();

      const studios = await db
        .collection("studios")
        .find({ ownerId: user.id })
        .sort({ createdAt: -1 })
        .toArray();

      res.status(200).json({
        success: true,
        message: "Your studio listings retrieved successfully",
        data: studios,
      });
    } catch (error) {
      console.error("Error fetching user's studio listings:", error);

      res.status(500).json({
        success: false,
        message: "Failed to retrieve your studio listings",
      });
    }
  });

  // GET a single studio by ID
  router.get("/:id", async (req, res) => {
    try {
      const id = req.params.id;

      if (typeof id !== "string" || !ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid studio ID",
        });
        return;
      }

      const db = getDB();

      const studio = await db.collection("studios").findOne({
        _id: new ObjectId(id),
      });

      if (!studio) {
        res.status(404).json({
          success: false,
          message: "Studio not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Studio retrieved successfully",
        data: studio,
      });
    } catch (error) {
      console.error("Error fetching studio:", error);

      res.status(500).json({
        success: false,
        message: "Failed to retrieve studio",
      });
    }
  });

  // POST a new studio - authenticated users only
  router.post("/", requireAuth, async (req, res) => {
    try {
      const {
        name,
        description,
        category,
        location,
        price,
        securityDeposit,
        capacity,
        images,
        amenities,
      } = req.body;

      if (
        !name ||
        !description ||
        !category ||
        !location ||
        price === undefined ||
        securityDeposit === undefined ||
        capacity === undefined
      ) {
        res.status(400).json({
          success: false,
          message: "Please provide all required studio information",
        });
        return;
      }

      if (
        typeof name !== "string" ||
        typeof description !== "string" ||
        typeof category !== "string" ||
        typeof location !== "string" ||
        !name.trim() ||
        !description.trim() ||
        !category.trim() ||
        !location.trim()
      ) {
        res.status(400).json({
          success: false,
          message: "Please provide valid studio information",
        });
        return;
      }

      if (
        typeof price !== "number" ||
        typeof securityDeposit !== "number" ||
        typeof capacity !== "number" ||
        !Number.isFinite(price) ||
        !Number.isFinite(securityDeposit) ||
        !Number.isFinite(capacity) ||
        price <= 0 ||
        securityDeposit < 0 ||
        capacity <= 0
      ) {
        res.status(400).json({
          success: false,
          message:
            "Price and capacity must be positive numbers, and security deposit cannot be negative",
        });
        return;
      }

      if (images !== undefined && !isStringArray(images)) {
        res.status(400).json({
          success: false,
          message: "Images must be an array of non-empty URLs",
        });
        return;
      }

      if (amenities !== undefined && !isStringArray(amenities)) {
        res.status(400).json({
          success: false,
          message: "Amenities must be an array of non-empty strings",
        });
        return;
      }

      const db = getDB();
      const user = res.locals.user;

      // Owner information comes from the authenticated session.
      const newStudio = {
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
        location: location.trim(),
        price,
        securityDeposit,
        capacity,
        status: "available",
        images: images || [],
        amenities: amenities || [],

        // Unique authenticated user ID for ownership checks
        ownerId: user.id,

        host: {
          name: user.name,
          email: user.email,
          ...(user.image && { profileImage: user.image }),
        },

        createdAt: new Date(),
      };

      const result = await db.collection("studios").insertOne(newStudio);

      res.status(201).json({
        success: true,
        message: "Studio created successfully",
        data: {
          _id: result.insertedId,
          ...newStudio,
        },
      });
    } catch (error) {
      console.error("Error creating studio:", error);

      res.status(500).json({
        success: false,
        message: "Failed to create studio",
      });
    }
  });

  // PUT update a studio - owner only
  router.put("/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;

      if (typeof id !== "string" || !ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid studio ID",
        });
        return;
      }

      const {
        name,
        description,
        category,
        location,
        price,
        securityDeposit,
        capacity,
        images,
        amenities,
      } = req.body;

      const updateData: Record<string, unknown> = {};

      // Validate text fields
      const textFields = [
        { key: "name", value: name },
        { key: "description", value: description },
        { key: "category", value: category },
        { key: "location", value: location },
      ];

      for (const field of textFields) {
        if (field.value !== undefined) {
          if (
            typeof field.value !== "string" ||
            !field.value.trim()
          ) {
            res.status(400).json({
              success: false,
              message: `Please provide a valid ${field.key}`,
            });
            return;
          }

          updateData[field.key] = field.value.trim();
        }
      }

      // Validate price
      if (price !== undefined) {
        if (
          typeof price !== "number" ||
          !Number.isFinite(price) ||
          price <= 0
        ) {
          res.status(400).json({
            success: false,
            message: "Price must be a positive number",
          });
          return;
        }

        updateData.price = price;
      }

      // Validate security deposit
      if (securityDeposit !== undefined) {
        if (
          typeof securityDeposit !== "number" ||
          !Number.isFinite(securityDeposit) ||
          securityDeposit < 0
        ) {
          res.status(400).json({
            success: false,
            message: "Security deposit cannot be negative",
          });
          return;
        }

        updateData.securityDeposit = securityDeposit;
      }

      // Validate capacity
      if (capacity !== undefined) {
        if (
          typeof capacity !== "number" ||
          !Number.isFinite(capacity) ||
          capacity <= 0
        ) {
          res.status(400).json({
            success: false,
            message: "Capacity must be a positive number",
          });
          return;
        }

        updateData.capacity = capacity;
      }

      // Validate images
      if (images !== undefined) {
        if (!isStringArray(images)) {
          res.status(400).json({
            success: false,
            message: "Images must be an array of non-empty URLs",
          });
          return;
        }

        updateData.images = images;
      }

      // Validate amenities
      if (amenities !== undefined) {
        if (!isStringArray(amenities)) {
          res.status(400).json({
            success: false,
            message: "Amenities must be an array of non-empty strings",
          });
          return;
        }

        updateData.amenities = amenities;
      }

      if (Object.keys(updateData).length === 0) {
        res.status(400).json({
          success: false,
          message: "Please provide information to update",
        });
        return;
      }

      const db = getDB();
      const user = res.locals.user;

      // Update only if the authenticated user owns this studio
      const result = await db.collection("studios").findOneAndUpdate(
        {
          _id: new ObjectId(id),
          ownerId: user.id,
        },
        {
          $set: updateData,
        },
        {
          returnDocument: "after",
        }
      );

      if (!result) {
        const existingStudio = await db.collection("studios").findOne({
          _id: new ObjectId(id),
        });

        if (!existingStudio) {
          res.status(404).json({
            success: false,
            message: "Studio not found",
          });
          return;
        }

        res.status(403).json({
          success: false,
          message: "You are not authorized to update this studio",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Studio updated successfully",
        data: result,
      });
    } catch (error) {
      console.error("Error updating studio:", error);

      res.status(500).json({
        success: false,
        message: "Failed to update studio",
      });
    }
  });

  // DELETE a studio - owner only
  router.delete("/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;

      if (typeof id !== "string" || !ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid studio ID",
        });
        return;
      }

      const db = getDB();
      const user = res.locals.user;

      // Delete only if the authenticated user owns this studio
      const result = await db.collection("studios").deleteOne({
        _id: new ObjectId(id),
        ownerId: user.id,
      });

      if (result.deletedCount === 0) {
        const existingStudio = await db.collection("studios").findOne({
          _id: new ObjectId(id),
        });

        if (!existingStudio) {
          res.status(404).json({
            success: false,
            message: "Studio not found",
          });
          return;
        }

        res.status(403).json({
          success: false,
          message: "You are not authorized to delete this studio",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Studio deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting studio:", error);

      res.status(500).json({
        success: false,
        message: "Failed to delete studio",
      });
    }
  });

  return router;
}
