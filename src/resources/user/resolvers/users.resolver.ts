import {usersInput, type UsersInputDTO, usersOutput, type UsersOutputDTO} from './users.dto';
import type {GraphQLResolveInfo} from "graphql";
import {Resolver} from "../../../core/resolver.ts";
import type {Context} from "../../../core/context.ts";
import {buildQuery, nestObject} from "../../../core/dyna.ts";
import {type UserSelectModel, userTable} from "../infra/user.table.ts";

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
