
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./db";
import studioRoutes from "./routes/studio.routes";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

// Welcome route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to StudioSpace API!",
  });
});

// Studios API routes
app.use("/api/studios", studioRoutes);

async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`StudioSpace API is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start StudioSpace server:", error);
    process.exit(1);
  }
}

startServer();
