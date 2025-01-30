import type {UserSelectModel} from "../resources/user/infra/user.table.ts";
import {tables} from "../graphql/tables.ts";
import type {SessionSelectModel} from "../resources/session/infra/session.table.ts";

export type RolePermissions = {
    allowedTables: Set<string>;
    allowedColumns: Map<
        '*' |
        keyof typeof tables, Set<keyof UserSelectModel | keyof SessionSelectModel | '*'>
    >;
    allowedRelations?: Map<
        '*' |
        keyof typeof tables, Set<'*' | keyof typeof tables>
    >;
};

export type Roles = 'admin' | 'user';

export const rolePermissions: Record<Roles, RolePermissions> = {
    admin: {
        allowedTables: new Set(['*']),
        allowedColumns: new Map([
            ['*', new Set(['*'])]
        ])
    },
    user: {
        allowedTables: new Set(['users']),
        allowedColumns: new Map([
            ['users', new Set(['name'])],
        ])
    },
} as const;


