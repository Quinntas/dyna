import {userTable} from "../resources/user/infra/user.table.ts";
import {sessionTable} from "../resources/session/infra/session.table.ts";

export const tables = {
    User: userTable,
    Session: sessionTable
} as const