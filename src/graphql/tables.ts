import {userTable} from "../resources/user/infra/user.table.ts";
import {sessionTable} from "../resources/session/infra/session.table.ts";

export const tables = {
    users: userTable,
    sessions: sessionTable
} as const