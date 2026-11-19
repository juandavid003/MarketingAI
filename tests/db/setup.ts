import "dotenv/config";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Run `npm run db:tunnel` and keep .env pointing at it.");
}
