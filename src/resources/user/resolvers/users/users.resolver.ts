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
        const query = buildQuery(
            userTable,
            parseGraphQLResolveInfo('users', resolveInfo, 'admin'),
            input.pagination
        );

        const results = await query.execute();

        return {
            data: results as unknown as UserSelectModel,
            pagination: {
                nextOffset: 0,
                total: 0,
                hasMore: false
            }
        }
    }
}
