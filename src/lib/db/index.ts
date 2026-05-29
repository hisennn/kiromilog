import "server-only";

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "@/lib/env";
import * as schema from "@/lib/db/schema";

type SqlClient = NeonQueryFunction<false, false>;
type DbClient = ReturnType<typeof drizzle<typeof schema>>;

let sqlClient: SqlClient | null = null;
let dbClient: DbClient | null = null;

export function getSql() {
  sqlClient ??= neon<false, false>(env.DATABASE_URL);
  return sqlClient;
}

export function getDb() {
  dbClient ??= drizzle(getSql(), {
    schema,
  });

  return dbClient;
}

export const db = new Proxy({} as DbClient, {
  get(_target, property: keyof DbClient) {
    return getDb()[property];
  },
});

export const sql = new Proxy(
  (() => undefined) as unknown as SqlClient,
  {
    apply(_target, _thisArg, argumentsList: Parameters<SqlClient>) {
      return getSql()(...argumentsList);
    },
    get(_target, property: keyof SqlClient) {
      return getSql()[property];
    },
  },
);
