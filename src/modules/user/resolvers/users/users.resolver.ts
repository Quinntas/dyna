import {Resolver} from "../../../../core/resolver.ts";
import type {Context} from "../../../../core/context.ts";
import {usersInput, type UsersInputDTO, usersOutput, type UsersOutputDTO} from "./users.dto.ts";
import type {GraphQLResolveInfo} from "graphql";
import {buildQuery, parseGraphQLResolveInfo} from "../../../../core/dyna.ts";
import {type UserSelectModel, userTable} from "../../infra/user.table.ts";


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

        const {query, totalQuery} = buildQuery(
            userTable,
            parseGraphQLResolveInfo('users', resolveInfo, 'admin'),
            input.pagination
        );

        const results = await query.execute();
        const data = results as unknown as UserSelectModel[];

        const [{count}] = await totalQuery.execute();
        const offset = input.pagination?.offset || 0;
        const limit = input.pagination?.limit || 0;
        const nextOffset = offset + limit;
        const hasMore = input.pagination ? nextOffset < count : false;
        const total = count;

        return {
            data,
            pagination: {
                nextOffset,
                total,
                hasMore
            }
        }
    }
}
