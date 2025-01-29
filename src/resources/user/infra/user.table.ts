import {pgTable, varchar} from "drizzle-orm/pg-core";
import {baseColumns} from "../../../infra/baseColumns.ts";
import type {InferInsertModel, InferSelectModel} from "drizzle-orm";

export const userTable = pgTable('users', {
    ...baseColumns,
    email: varchar("email", {length: 255}).notNull().unique(),
    password: varchar("password", {length: 255}).notNull(),
    role: varchar("role", {length: 255}).notNull(),
});


export type UserSelectModel = InferSelectModel<typeof userTable>;
export type UserInsertModel = InferInsertModel<typeof userTable>;