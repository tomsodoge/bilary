import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/lib/db/schema';

const client = postgres(process.env.DATABASE_URL_WORKER!, { prepare: false });
export const db = drizzle(client, { schema });
export { schema };
