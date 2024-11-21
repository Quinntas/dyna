import {Resolver} from '../../lib/resolver';
import {type Context} from '../../lib/context';
import {type UsersInputDTO, usersInputFields, type UsersOutputDTO, usersOutputFields} from './users.dto';
import {parseGraphQLResolveInfo} from '../../utils/parseGraphqlResolver';
import type {GraphQLResolveInfo} from "graphql";

export class UsersResolver extends Resolver<Context, UsersInputDTO, UsersOutputDTO> {
    constructor() {
        super('users', 'List users', usersOutputFields, usersInputFields);
    }

    protected handle(
        root: null,
        input: UsersInputDTO,
        context: Context,
        resolveInfo: GraphQLResolveInfo,
    ): UsersOutputDTO {
        console.log(input);
        console.log(parseGraphQLResolveInfo('User', 2, resolveInfo));

        return {
            pagination: {
                hasMore: false,
                nextOffset: 0,
                total: 0,
            },
        };
    }
}
