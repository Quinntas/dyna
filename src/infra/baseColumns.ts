import {serial, timestamp, varchar} from 'drizzle-orm/pg-core';
import {randomUUID} from "node:crypto";

// @formatter:off
export const baseColumns = {
    id: serial('id').primaryKey(),
    pid: varchar('pid', {length: 191})
        .notNull()
        .$defaultFn(() => randomUUID()),
    createdAt: timestamp('created_at', {mode:"date"})
        .notNull()
        .defaultNow(),
};