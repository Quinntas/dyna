import {
    usersInput,
    type UsersInputDTO,
    usersOutput,
    type UsersOutputDTO,
    type WhereFilterObject,
    type WhereFilters
} from './users.dto';
import type {GraphQLResolveInfo} from "graphql";
import {GraphQLError} from "graphql/index";
import {
    type Column,
    eq,
    getTableColumns,
    gt,
    gte,
    ilike,
    inArray,
    isNotNull,
    isNull,
    like,
    lt,
    lte,
    notIlike,
    notInArray,
    notLike,
    SQL,
    sql,
    type Table
} from "drizzle-orm";
import {db} from "../../../infra/database.ts";
import {Resolver} from "../../../core/resolver.ts";
import type {Context} from "../../../core/context.ts";
import {buildQuery, nestObject} from "../../../core/dyna.ts";
import {type UserSelectModel, userTable} from "../infra/user.table.ts";

function genWhereQuery(whereFilter: WhereFilters, col: Column, filter: unknown) {
    switch (whereFilter) {
        case 'eq':
            return eq(col, filter)
        case "gt":
            return gt(col, filter)
        case "lt":
            return lt(col, filter)
        case "gte":
            return gte(col, filter)
        case "lte":
            return lte(col, filter)
        case "inArray":
            return inArray(col, filter as unknown[])
        case "notInArray":
            return notInArray(col, filter as unknown[])
        case "isNull":
            return isNull(col)
        case "isNotNull":
            return isNotNull(col)
        case "like":
            return like(col, filter as string)
        case "notLike":
            return notLike(col, filter as string)
        case "ilike":
            return ilike(col, filter as string)
        case "notIlike":
            return notIlike(col, filter as string)
        default:
        case null:
        case undefined:
            throw new GraphQLError(`Filter ${whereFilter} not found`);
    }
}

export function genQuery(whereInput: WhereFilterObject, baseTable: Table) {
    const cols = getTableColumns(baseTable)
    const whereKeys = Object.keys(whereInput);

    let query = db.select().from(baseTable)
    let whereQuery: SQL = sql`(`

    for (let i = 0; i < whereKeys.length; i++) {
        const col: Column | undefined = Object.values(cols).find((col) => col.name === whereKeys[i]);
        if (!col) throw new GraphQLError(`Column ${whereKeys[i]} not found`);

        const filters = whereInput[whereKeys[i]];

        const keys: WhereFilters[] = Object.keys(filters) as WhereFilters[];

        for (let j = 0; j < keys.length; j++) {
            whereQuery.append(genWhereQuery(keys[j], col, filters[keys[j]]))

            if (j < keys.length - 1)
                whereQuery.append(sql` AND `)
        }

        if (whereKeys.length > 1 && i < whereKeys.length - 1)
            whereQuery.append(sql` AND `)
    }

    whereQuery.append(sql`)`)
    query.where(whereQuery)

    return query
}

export class UsersResolver extends Resolver<Context, UsersInputDTO, UsersOutputDTO> {
    constructor() {
        super('Users', 'List users', usersOutput, usersInput);
    }

    async handle(
        root: null,
        input: UsersInputDTO,
        context: Context,
        resolveInfo: GraphQLResolveInfo,
    ): Promise<UsersOutputDTO> {
        console.log(input)

        const query = buildQuery(
            userTable,
            resolveInfo,
            input.where,
            resolveInfo.variableValues,
            input.pagination?.limit,
            input.pagination?.offset
        );

        const results: UserSelectModel[] = await query.execute();

        return {
            data: results.map(row => nestObject(row)) as unknown as UserSelectModel,
            pagination: {
                nextOffset: 0,
                total: 0,
                hasMore: false
            }
        }
    }
}
