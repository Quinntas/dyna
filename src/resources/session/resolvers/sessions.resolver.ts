import {Resolver} from "../../../core/resolver.ts";
import type {Context} from "../../../core/context.ts";
import {buildQuery, nestObject} from "../../../core/dyna.ts";
import {type UserSelectModel, userTable} from "../../user/infra/user.table.ts";
import {sessionInput, type SessionInputDTO, sessionOutput, type SessionOutputDTO} from "./sessions.dto.ts";
import type {SessionSelectModel} from "../infra/session.table.ts";
import type {GraphQLResolveInfo} from "graphql";

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

        console.log(results)

        return {
            data: results.map(row => nestObject(row)) as unknown as SessionSelectModel,
            pagination: {
                nextOffset: 0,
                total: 0,
                hasMore: false
            }
        }
    }
}
