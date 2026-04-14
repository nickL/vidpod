import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"

import * as schema from "./schema"

const readDatabaseUrl = () => {
  const value = process.env.DATABASE_URL

  if (!value) {
    throw new Error("Uh ohs - Missing required env var: DATABASE_URL")
  }

  return value
}

const client = neon(readDatabaseUrl())

export const db = drizzle({ client, schema })

export { schema }
