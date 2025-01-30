import {userTable} from "../resources/user/infra/user.table.ts";
import {sessionTable} from "../resources/session/infra/session.table.ts";

export const tables = {
    user: userTable,
    session: sessionTable
} as const