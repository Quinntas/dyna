import {pgTable, varchar} from "drizzle-orm/pg-core";
import {baseColumns} from "../../infra/baseColumns.ts";

export const userTable = pgTable('users', {
    ...baseColumns,
    email: varchar('email').notNull(),
    password: varchar('password').notNull(),
})