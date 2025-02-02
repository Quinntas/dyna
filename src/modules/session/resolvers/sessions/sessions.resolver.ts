import {Resolver} from "../../../../core/resolver.ts";
import type {Context} from "../../../../core/context.ts";
import {sessionInput, type SessionInputDTO, sessionOutput, type SessionOutputDTO} from "./sessions.dto.ts";
import type {GraphQLResolveInfo} from "graphql";
import {buildQuery, parseGraphQLResolveInfo} from "../../../../core/dyna.ts";
import {type SessionSelectModel, sessionTable} from "../../infra/session.table.ts";

export class SessionsResolver extends Resolver<Context, SessionInputDTO, SessionOutputDTO> {
    constructor() {
        super('Session', 'List sessions', sessionOutput, sessionInput);
    }

    async handle(
        root: null,
        input: SessionInputDTO,
        context: Context,
        resolveInfo: GraphQLResolveInfo,
    ): Promise<SessionOutputDTO> {
        const {query, totalQuery} = buildQuery(
            sessionTable,
            parseGraphQLResolveInfo('sessions', resolveInfo, 'admin'),
            input.pagination
        );

        const results = await query.execute();
        const data = results as unknown as SessionSelectModel[];

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
