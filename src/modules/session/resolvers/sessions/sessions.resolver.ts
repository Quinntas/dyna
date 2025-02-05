import {Resolver} from "../../../../core/resolver.ts";
import type {Context} from "../../../../core/context.ts";
import {sessionInput, type SessionInputDTO, sessionOutput, type SessionOutputDTO} from "./sessions.dto.ts";
import type {GraphQLResolveInfo} from "graphql";
import {buildQuery, parseGraphQLResolveInfo, runQuery} from "../../../../core/dyna.ts";
import {sessionTable} from "../../infra/session.table.ts";


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
        return runQuery(buildQuery(
            sessionTable,
            parseGraphQLResolveInfo('sessions', resolveInfo, 'admin'),
            input.pagination
        ), input.pagination)
    }
}
