import {userTable} from "../modules/user/infra/user.table.ts";
import {sessionTable} from "../modules/session/infra/session.table.ts";

export const tables = {
    users: userTable,
    sessions: sessionTable
} as const