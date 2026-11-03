
import { Router, Request, Response, NextFunction } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../db";
import type { createAuth } from "../auth";

type Auth = Awaited<ReturnType<typeof createAuth>>;

export function createBookingRouter(auth: Auth) {
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
      console.error("Booking authentication error:", error);

      res.status(401).json({
        success: false,
        message: "Authentication failed. Please log in again.",
      });
    }
  }

  // Create a booking
  router.post("/", requireAuth, async (req, res) => {
    try {
      const { studioId, bookingDate, startTime, endTime, guests } = req.body;

      if (
        typeof studioId !== "string" ||
        !ObjectId.isValid(studioId) ||
        typeof bookingDate !== "string" ||
        typeof startTime !== "string" ||
        typeof endTime !== "string" ||
        typeof guests !== "number"
      ) {
        res.status(400).json({
          success: false,
          message: "Please provide valid booking information",
        });
        return;
      }

      // Validate date
      const date = new Date(`${bookingDate}T00:00:00`);

      if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== bookingDate
      ) {
        res.status(400).json({
          success: false,
          message: "Please provide a valid booking date",
        });
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (date < today) {
        res.status(400).json({
          success: false,
          message: "Booking date cannot be in the past",
        });
        return;
      }

      // Validate time format
      const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

      if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
        res.status(400).json({
          success: false,
          message: "Please provide valid start and end times",
        });
        return;
      }

      const [startHour, startMinute] = startTime.split(":").map(Number);
      const [endHour, endMinute] = endTime.split(":").map(Number);

      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      if (endMinutes <= startMinutes) {
        res.status(400).json({
          success: false,
          message: "End time must be later than start time",
        });
        return;
      }

      if (!Number.isInteger(guests) || guests < 1) {
        res.status(400).json({
          success: false,
          message: "Please provide a valid number of guests",
        });
        return;
      }

      const db = getDB();
      const user = res.locals.user;

      // Retrieve the selected studio from MongoDB
      const studio = await db.collection("studios").findOne({
        _id: new ObjectId(studioId),
      });

      if (!studio) {
        res.status(404).json({
          success: false,
          message: "Studio not found",
        });
        return;
      }

      if (studio.status !== "available") {
        res.status(400).json({
          success: false,
          message: "This studio is currently unavailable",
        });
        return;
      }

      if (studio.ownerId === user.id) {
        res.status(400).json({
          success: false,
          message: "You cannot book your own studio",
        });
        return;
      }

      if (guests > studio.capacity) {
        res.status(400).json({
          success: false,
          message: `This studio can accommodate up to ${studio.capacity} guests`,
        });
        return;
      }

      // Calculate booking duration and price using database values
      const durationHours = (endMinutes - startMinutes) / 60;
      const totalPrice = durationHours * studio.price;
      const securityDeposit = studio.securityDeposit;

      const booking = {
        studioId: new ObjectId(studioId),
        studioName: studio.name,
        studioImage: studio.images?.[0] || "",
        studioLocation: studio.location,

        ownerId: studio.ownerId,

        customerId: user.id,
        customerName: user.name,
        customerEmail: user.email,

        bookingDate,
        startTime,
        endTime,
        durationHours,
        guests,

        hourlyRate: studio.price,
        totalPrice,
        securityDeposit,

        status: "Pending",
        createdAt: new Date(),
      };

      const result = await db.collection("bookings").insertOne(booking);

      res.status(201).json({
        success: true,
        message: "Booking request submitted successfully",
        data: {
          _id: result.insertedId,
          ...booking,
        },
      });
    } catch (error) {
      console.error("Error creating booking:", error);

      res.status(500).json({
        success: false,
        message: "Failed to create booking",
      });
    }
  });

  // Get bookings belonging to the logged-in customer
  router.get("/my-bookings", requireAuth, async (req, res) => {
    try {
      const db = getDB();
      const user = res.locals.user;

      const bookings = await db
        .collection("bookings")
        .find({ customerId: user.id })
        .sort({ createdAt: -1 })
        .toArray();

      res.status(200).json({
        success: true,
        message: "Your bookings retrieved successfully",
        data: bookings,
      });
    } catch (error) {
      console.error("Error fetching bookings:", error);

      res.status(500).json({
        success: false,
        message: "Failed to retrieve your bookings",
      });
    }
  });

  // Cancel a pending booking belonging to the logged-in customer
  router.patch("/:id/cancel", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;

      if (typeof id !== "string" || !ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid booking ID",
        });
        return;
      }

      const db = getDB();
      const user = res.locals.user;

      const result = await db.collection("bookings").updateOne(
        {
          _id: new ObjectId(id),
          customerId: user.id,
          status: "Pending",
        },
        {
          $set: {
            status: "Cancelled",
            cancelledAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        const booking = await db.collection("bookings").findOne({
          _id: new ObjectId(id),
        });

        if (!booking) {
          res.status(404).json({
            success: false,
            message: "Booking not found",
          });
          return;
        }

        if (booking.customerId !== user.id) {
          res.status(403).json({
            success: false,
            message: "You are not authorized to cancel this booking",
          });
          return;
        }

        res.status(400).json({
          success: false,
          message: "Only pending bookings can be cancelled",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Booking cancelled successfully",
      });
    } catch (error) {
      console.error("Error cancelling booking:", error);

      res.status(500).json({
        success: false,
        message: "Failed to cancel booking",
      });
    }
  });

  return router;
}
