import "server-only";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import { env } from "@/lib/env";
import * as schema from "@/lib/db/schema";

type Transaction = Parameters<Parameters<ReturnType<typeof drizzle<typeof schema>>["transaction"]>[0]>[0];
export type { Transaction };

export async function withTransaction<T>(operation: (tx: Transaction) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    return await drizzle(pool, { schema }).transaction(operation);
  } finally {
    await pool.end();
  }
}
