
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB } from "./db";
import { createAuth } from "./auth";
import { createStudioRouter } from "./routes/studio.routes";
import { createUploadRouter } from "./routes/upload.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: "http://localhost:3000",
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
    await connectDB();

    const auth = await createAuth();

    const { toNodeHandler } = await import("better-auth/node");

    // Better Auth must be mounted before express.json()
    app.all("/api/auth/*splat", toNodeHandler(auth));

    app.use(express.json());

    // Studio routes with Better Auth session verification
    app.use("/api/studios", createStudioRouter(auth));

    // Image upload routes with Better Auth session verification
    app.use("/api/upload", createUploadRouter(auth));

    app.listen(PORT, () => {
      console.log(`StudioSpace API is running on http://localhost:${PORT}`);
      console.log("Better Auth is ready!");
    });
  } catch (error) {
    console.error("Failed to start StudioSpace server:", error);
    process.exit(1);
  }
}

startServer();
