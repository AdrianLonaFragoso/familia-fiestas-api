import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma CLI (generate, db push, migrate, studio) reads the connection string from here.
// Direct (non-pooled) URL is preferred for migrations; fall back to the pooled one.
const connectionString = process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"] ?? "";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: connectionString,
  },
});
