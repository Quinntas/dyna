import {Resolver} from "../../../../core/resolver.ts";
import type {Context} from "../../../../core/context.ts";
import {usersInput, type UsersInputDTO, usersOutput, type UsersOutputDTO} from "./users.dto.ts";
import type {GraphQLResolveInfo} from "graphql";
import {buildQuery, parseGraphQLResolveInfo, runQuery} from "../../../../core/dyna.ts";
import {userTable} from "../../infra/user.table.ts";


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
        const queries = buildQuery(
            userTable,
            parseGraphQLResolveInfo('users', resolveInfo, 'admin'),
            input.pagination
        );

        return runQuery(queries, input.pagination)
    }
}
