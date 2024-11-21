import {pgTable, serial, varchar} from "drizzle-orm/pg-core";

export const userTable = pgTable('users', {
    id: serial('id').primaryKey(),
    email: varchar('email').notNull(),
    password: varchar('password').notNull(),
})