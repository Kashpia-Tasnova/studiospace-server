import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../db";

const router = Router();

// GET all studio listings
router.get("/", async (req, res) => {
  try {
    const db = getDB();

    const studios = await db
      .collection("studios")
      .find({})
      .toArray();

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
      capacity,
      status,
    } = req.body;

    if (
      !name ||
      !description ||
      !category ||
      !location ||
      price === undefined ||
      capacity === undefined
    ) {
      res.status(400).json({
        success: false,
        message: "Please provide all required studio information",
      });
      return;
    }

    if (
      typeof price !== "number" ||
      typeof capacity !== "number" ||
      price <= 0 ||
      capacity <= 0
    ) {
      res.status(400).json({
        success: false,
        message: "Price and capacity must be positive numbers",
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
      capacity,
      status: status || "available",
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
      capacity,
      status,
    } = req.body;

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (location !== undefined) updateData.location = location;
    if (price !== undefined) updateData.price = price;
    if (capacity !== undefined) updateData.capacity = capacity;
    if (status !== undefined) updateData.status = status;

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({
        success: false,
        message: "Please provide information to update",
      });
      return;
    }

    if (
      (price !== undefined &&
        (typeof price !== "number" || price <= 0)) ||
      (capacity !== undefined &&
        (typeof capacity !== "number" || capacity <= 0))
    ) {
      res.status(400).json({
        success: false,
        message: "Price and capacity must be positive numbers",
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