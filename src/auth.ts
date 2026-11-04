import { getDB } from "./db";

export async function createAuth() {
  const { betterAuth } = await import("better-auth");
  const { mongodbAdapter } = await import("better-auth/adapters/mongodb");
  const { jwt } = await import("better-auth/plugins");

  const isProduction = process.env.NODE_ENV === "production";

  return betterAuth({
    database: mongodbAdapter(getDB()),

    baseURL: process.env.BETTER_AUTH_URL,

    secret: process.env.BETTER_AUTH_SECRET,

    trustedOrigins: [
      "http://localhost:3000",
      "https://studiospace-client-gray.vercel.app",
    ],

    advanced: {
      defaultCookieAttributes: {
        sameSite: isProduction ? "none" : "lax",
        secure: isProduction,
        httpOnly: true,
      },
    },

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
    },

    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      },
    },

    plugins: [jwt()],
  });
}