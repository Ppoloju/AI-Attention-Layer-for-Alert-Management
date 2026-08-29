import type { NextConfig } from "next";
import path from "path";
import { config as loadEnv } from "dotenv";

// Load monorepo root .env (Supabase, Upstash, Groq, DATABASE_URL)
loadEnv({ path: path.resolve(__dirname, "../.env") });

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
