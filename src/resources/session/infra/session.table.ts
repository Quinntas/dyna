import {pgTable, serial, varchar} from "drizzle-orm/pg-core";
import {baseColumns} from "../../../infra/baseColumns.ts";
import {userTable} from "../../user/infra/user.table.ts";
import type {InferInsertModel, InferSelectModel} from "drizzle-orm";

export const sessionTable = pgTable("sessions", {
    ...baseColumns,
    name: varchar("name", {length: 255}).notNull(),
    status: varchar("status", {length: 255}).notNull(),
    user_id: serial("user_id").notNull().references(() => userTable.id)
})

export type SessionSelectModel = InferSelectModel<typeof sessionTable>;
export type SessionInsertModel = InferInsertModel<typeof sessionTable>;