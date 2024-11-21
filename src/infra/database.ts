import {drizzle} from "drizzle-orm/postgres-js";
import {env} from "../utils/env.ts";
import {getTableName, type Table} from "drizzle-orm";
import {userTable} from "../resolvers/users/user.table.ts";

export const db = drizzle(env.DATABASE_URL)

export const tables: Record<string, Table> = {
    [getTableName(userTable)]: userTable
}