import { Router, Request, Response, NextFunction } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../db";
import type { createAuth } from "../auth";

type Auth = Awaited<ReturnType<typeof createAuth>>;

export function createReviewRouter(auth: Auth) {
  const router = Router();

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
      console.error("Review authentication error:", error);

      res.status(401).json({
        success: false,
        message: "Authentication failed. Please log in again.",
      });
    }
  }

  // GET reviews written by the logged-in customer
  router.get("/my-reviews", requireAuth, async (req, res) => {
    try {
      const db = getDB();
      const user = res.locals.user;

      const reviews = await db
        .collection("reviews")
        .find({ customerId: user.id })
        .sort({ createdAt: -1 })
        .toArray();

      const studioIds = reviews.map((review) => review.studioId);

      const studios = studioIds.length
        ? await db
            .collection("studios")
            .find({ _id: { $in: studioIds } })
            .toArray()
        : [];

      const studioMap = new Map(
        studios.map((studio) => [
          studio._id.toString(),
          {
            name: studio.name,
            category: studio.category,
            location: studio.location,
          },
        ])
      );

      const result = reviews.map((review) => ({
        ...review,
        studio: studioMap.get(review.studioId.toString()) || null,
      }));

      res.status(200).json({
        success: true,
        message: "Your reviews retrieved successfully",
        data: result,
      });
    } catch (error) {
      console.error("Error fetching customer reviews:", error);

      res.status(500).json({
        success: false,
        message: "Failed to retrieve your reviews",
      });
    }
  });

  // GET reviews received by the logged-in host
  router.get("/received", requireAuth, async (req, res) => {
    try {
      const db = getDB();
      const user = res.locals.user;

      // Find only studios owned by the logged-in host
      const ownedStudios = await db
        .collection("studios")
        .find({ ownerId: user.id })
        .toArray();

      const studioIds = ownedStudios.map((studio) => studio._id);

      if (studioIds.length === 0) {
        res.status(200).json({
          success: true,
          message: "No studios found for this host",
          data: [],
        });
        return;
      }

      // Retrieve reviews only for the host's own studios
      const reviews = await db
        .collection("reviews")
        .find({ studioId: { $in: studioIds } })
        .sort({ createdAt: -1 })
        .toArray();

      const studioMap = new Map(
        ownedStudios.map((studio) => [
          studio._id.toString(),
          {
            name: studio.name,
            category: studio.category,
            location: studio.location,
          },
        ])
      );

      const result = reviews.map((review) => ({
        ...review,
        studio: studioMap.get(review.studioId.toString()) || null,
      }));

      res.status(200).json({
        success: true,
        message: "Reviews for your studios retrieved successfully",
        data: result,
      });
    } catch (error) {
      console.error("Error fetching host reviews:", error);

      res.status(500).json({
        success: false,
        message: "Failed to retrieve reviews for your studios",
      });
    }
  });

  // GET reviews for a particular studio
  router.get("/studio/:studioId", async (req, res) => {
    try {
      const { studioId } = req.params;

      if (
        typeof studioId !== "string" ||
        !ObjectId.isValid(studioId)
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid studio ID",
        });
        return;
      }

      const db = getDB();

      const reviews = await db
        .collection("reviews")
        .find({ studioId: new ObjectId(studioId) })
        .sort({ createdAt: -1 })
        .toArray();

      res.status(200).json({
        success: true,
        message: "Studio reviews retrieved successfully",
        data: reviews,
      });
    } catch (error) {
      console.error("Error fetching studio reviews:", error);

      res.status(500).json({
        success: false,
        message: "Failed to retrieve studio reviews",
      });
    }
  });

  // GET completed bookings eligible for review by the logged-in customer
  router.get(
    "/eligibility/:studioId",
    requireAuth,
    async (req, res) => {
      try {
        const { studioId } = req.params;

        if (
          typeof studioId !== "string" ||
          !ObjectId.isValid(studioId)
        ) {
          res.status(400).json({
            success: false,
            message: "Invalid studio ID",
          });
          return;
        }

        const db = getDB();
        const user = res.locals.user;
        const studioObjectId = new ObjectId(studioId);

        const completedBookings = await db
          .collection("bookings")
          .find({
            studioId: studioObjectId,
            customerId: user.id,
            status: "Completed",
          })
          .sort({ completedAt: -1 })
          .toArray();

        const bookingIds = completedBookings.map(
          (booking) => booking._id
        );

        const existingReviews = await db
          .collection("reviews")
          .find({
            bookingId: { $in: bookingIds },
          })
          .toArray();

        const reviewedBookingIds = new Set(
          existingReviews.map((review) =>
            review.bookingId.toString()
          )
        );

        const eligibleBookings = completedBookings.map(
          (booking) => ({
            _id: booking._id,
            bookingDate: booking.bookingDate,
            alreadyReviewed: reviewedBookingIds.has(
              booking._id.toString()
            ),
          })
        );

        res.status(200).json({
          success: true,
          message: "Review eligibility retrieved successfully",
          data: eligibleBookings,
        });
      } catch (error) {
        console.error("Error checking review eligibility:", error);

        res.status(500).json({
          success: false,
          message: "Failed to check review eligibility",
        });
      }
    }
  );

  // POST a review for a completed booking
  router.post("/", requireAuth, async (req, res) => {
    try {
      const { studioId, bookingId, rating, comment } = req.body;

      // Validate studio and booking IDs
      if (
        typeof studioId !== "string" ||
        !ObjectId.isValid(studioId) ||
        typeof bookingId !== "string" ||
        !ObjectId.isValid(bookingId)
      ) {
        res.status(400).json({
          success: false,
          message:
            "Please provide valid studio and booking information",
        });
        return;
      }

      // Validate rating
      if (
        typeof rating !== "number" ||
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
      ) {
        res.status(400).json({
          success: false,
          message: "Rating must be a whole number between 1 and 5",
        });
        return;
      }

      // Validate optional comment
      if (
        comment !== undefined &&
        (typeof comment !== "string" || comment.trim().length > 1000)
      ) {
        res.status(400).json({
          success: false,
          message: "Review comment must be 1000 characters or fewer",
        });
        return;
      }

      const db = getDB();
      const user = res.locals.user;

      const studioObjectId = new ObjectId(studioId);
      const bookingObjectId = new ObjectId(bookingId);

      // Confirm that the studio exists
      const studio = await db.collection("studios").findOne({
        _id: studioObjectId,
      });

      if (!studio) {
        res.status(404).json({
          success: false,
          message: "Studio not found",
        });
        return;
      }

      // Only the customer who completed this booking can review it
      const booking = await db.collection("bookings").findOne({
        _id: bookingObjectId,
        studioId: studioObjectId,
        customerId: user.id,
        status: "Completed",
      });

      if (!booking) {
        res.status(403).json({
          success: false,
          message:
            "You can only review a studio after completing a booking for it",
        });
        return;
      }

      // Prevent multiple reviews for the same booking
      const existingReview = await db.collection("reviews").findOne({
        bookingId: bookingObjectId,
      });

      if (existingReview) {
        res.status(409).json({
          success: false,
          message: "You have already reviewed this booking",
        });
        return;
      }

      // Prepare review document
      const review = {
        studioId: studioObjectId,
        bookingId: bookingObjectId,
        customerId: user.id,
        customerName: user.name,
        customerImage: user.image || "",
        rating,
        comment: comment?.trim() || "",
        createdAt: new Date(),
      };

      const result = await db.collection("reviews").insertOne(review);

      res.status(201).json({
        success: true,
        message: "Your review was submitted successfully",
        data: {
          _id: result.insertedId,
          ...review,
        },
      });
    } catch (error) {
      // Handle duplicate submissions caught by MongoDB's unique index
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 11000
      ) {
        res.status(409).json({
          success: false,
          message: "You have already reviewed this booking",
        });
        return;
      }

      console.error("Error submitting review:", error);

      res.status(500).json({
        success: false,
        message: "Failed to submit your review",
      });
    }
  });

  return router;
}