import { setServers } from "node:dns";
import "dotenv/config";
import { MongoClient, Db } from "mongodb";

// Use Google DNS servers
setServers(["8.8.8.8", "8.8.4.4"]);

const mongodbUri = process.env.MONGODB_URI;

if (!mongodbUri) {
  throw new Error("MONGODB_URI is missing from the .env file");
}

const client = new MongoClient(mongodbUri);

let database: Db;

export async function connectDB(): Promise<void> {
  try {
    await client.connect();

    database = client.db("studiospace");

    await database.command({ ping: 1 });

    console.log("MongoDB connected successfully!");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    throw error;
  }
}

export function getDB(): Db {
  if (!database) {
    throw new Error("Database is not connected yet");
  }

  return database;
}