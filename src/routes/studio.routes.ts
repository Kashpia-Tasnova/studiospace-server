
import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../db";

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

// Validate host information
function isValidHost(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const host = value as Record<string, unknown>;

  return (
    typeof host.name === "string" &&
    host.name.trim().length > 0 &&
    typeof host.email === "string" &&
    host.email.trim().length > 0 &&
    (host.profileImage === undefined ||
      typeof host.profileImage === "string")
  );
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

// GET a single studio by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
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

// POST a new studio
router.post("/", async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      location,
      price,
      securityDeposit,
      capacity,
      status,
      rating,
      images,
      amenities,
      host,
    } = req.body;

    // Check required fields
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

    // Validate price, security deposit, and capacity
    if (
      typeof price !== "number" ||
      typeof securityDeposit !== "number" ||
      typeof capacity !== "number" ||
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

    // Validate rating
    if (
      rating !== undefined &&
      (typeof rating !== "number" || rating < 0 || rating > 5)
    ) {
      res.status(400).json({
        success: false,
        message: "Rating must be a number between 0 and 5",
      });
      return;
    }

    // Validate images
    if (images !== undefined && !isStringArray(images)) {
      res.status(400).json({
        success: false,
        message: "Images must be an array of non-empty URLs",
      });
      return;
    }

    // Validate amenities
    if (amenities !== undefined && !isStringArray(amenities)) {
      res.status(400).json({
        success: false,
        message: "Amenities must be an array of non-empty strings",
      });
      return;
    }

    // Validate host
    if (host !== undefined && !isValidHost(host)) {
      res.status(400).json({
        success: false,
        message: "Please provide valid host information",
      });
      return;
    }

    const db = getDB();

    const newStudio = {
      name,
      description,
      category,
      location,
      price,
      securityDeposit,
      capacity,
      status: status || "available",
      ...(rating !== undefined && { rating }),
      ...(images !== undefined && { images }),
      ...(amenities !== undefined && { amenities }),
      ...(host !== undefined && { host }),
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

// PUT update an existing studio
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
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
      status,
      rating,
      createdAt,
      images,
      amenities,
      host,
    } = req.body;

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (location !== undefined) updateData.location = location;
    if (price !== undefined) updateData.price = price;

    if (securityDeposit !== undefined) {
      updateData.securityDeposit = securityDeposit;
    }

    if (capacity !== undefined) updateData.capacity = capacity;
    if (status !== undefined) updateData.status = status;
    if (rating !== undefined) updateData.rating = rating;

    // Update creation date
    if (createdAt !== undefined) {
      const parsedDate = new Date(createdAt);

      if (Number.isNaN(parsedDate.getTime())) {
        res.status(400).json({
          success: false,
          message: "Please provide a valid creation date",
        });
        return;
      }

      updateData.createdAt = parsedDate;
    }

    // Update studio images
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

    // Update studio amenities
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

    // Update host information
    if (host !== undefined) {
      if (!isValidHost(host)) {
        res.status(400).json({
          success: false,
          message: "Please provide valid host information",
        });
        return;
      }

      updateData.host = host;
    }

    // Check if there is anything to update
    if (Object.keys(updateData).length === 0) {
      res.status(400).json({
        success: false,
        message: "Please provide information to update",
      });
      return;
    }

    // Validate price, security deposit, and capacity
    if (
      (price !== undefined &&
        (typeof price !== "number" || price <= 0)) ||
      (securityDeposit !== undefined &&
        (typeof securityDeposit !== "number" || securityDeposit < 0)) ||
      (capacity !== undefined &&
        (typeof capacity !== "number" || capacity <= 0))
    ) {
      res.status(400).json({
        success: false,
        message:
          "Price and capacity must be positive numbers, and security deposit cannot be negative",
      });
      return;
    }

    // Validate rating
    if (
      rating !== undefined &&
      (typeof rating !== "number" || rating < 0 || rating > 5)
    ) {
      res.status(400).json({
        success: false,
        message: "Rating must be a number between 0 and 5",
      });
      return;
    }

    const db = getDB();

    const result = await db.collection("studios").findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: "after" }
    );

    if (!result) {
      res.status(404).json({
        success: false,
        message: "Studio not found",
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

// DELETE a studio by ID
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid studio ID",
      });
      return;
    }

    const db = getDB();

    const result = await db.collection("studios").deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      res.status(404).json({
        success: false,
        message: "Studio not found",
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

export default router;
