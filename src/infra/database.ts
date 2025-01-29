import {drizzle} from "drizzle-orm/postgres-js";
import {env} from "../utils/env.ts";
import {tables} from "../graphql/tables.ts";

export const db = drizzle(env.DATABASE_URL, {schema: tables})
