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
        const query = buildQuery(
            sessionTable,
            parseGraphQLResolveInfo('sessions', resolveInfo, 'admin'),
            input.pagination
        );

        const results = await query.execute();

        return {
            data: results as unknown as SessionSelectModel,
            pagination: {
                nextOffset: 0,
                total: 0,
                hasMore: false
            }
        }
    }
}
