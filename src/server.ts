
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB } from "./db";
import { getDB } from "./db";
import { createAuth } from "./auth";
import { createStudioRouter } from "./routes/studio.routes";
import { createUploadRouter } from "./routes/upload.routes";
import { createBookingRouter } from "./routes/booking.routes";
import { createReviewRouter } from "./routes/review.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Allow both local development and the deployed website
const allowedOrigins = [
  "http://localhost:3000",
  "https://studiospace-client-gray.vercel.app",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Welcome route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to StudioSpace API!",
  });
});

async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();
    // Prevent multiple reviews for the same booking
  // Prevent multiple reviews for the same booking
   await getDB()
  .collection("reviews")
  .createIndex({ bookingId: 1 }, { unique: true });

console.log("Review database index is ready!");
    // Initialize Better Auth
    const auth = await createAuth();

    const { toNodeHandler } = await import("better-auth/node");

    // Better Auth must be mounted before express.json()
    app.all("/api/auth/*splat", toNodeHandler(auth));

    // Parse incoming JSON requests
    app.use(express.json());

    // Studio routes
    app.use("/api/studios", createStudioRouter(auth));

    // Image upload routes
    app.use("/api/upload", createUploadRouter(auth));

    // Booking routes
    app.use("/api/bookings", createBookingRouter(auth));

    // Review routes
    app.use("/api/reviews", createReviewRouter(auth));

    // Start Express server
    app.listen(PORT, () => {
      console.log(`StudioSpace API is running on port ${PORT}`);
      console.log("Better Auth is ready!");
      console.log("Studio routes are ready!");
      console.log("Upload routes are ready!");
      console.log("Booking routes are ready!");
      console.log("Review routes are ready!");
    });
  } catch (error) {
    console.error("Failed to start StudioSpace server:", error);
    process.exit(1);
  }
}

startServer();
