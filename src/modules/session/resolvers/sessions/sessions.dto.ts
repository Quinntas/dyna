import {graphqlSchemaData} from "../../../../graphql/schemaData.ts";
import type {WhereFilterObject} from "../../../../core/dyna.ts";
import {
    type PaginationInputDTO,
    paginationInputObject,
    type PaginationOutputDTO,
    paginationOutputObject
} from "../../../../graphql/objects/pagination.ts";
import type {SessionSelectModel} from "../../infra/session.table.ts";
import {GraphQLList, GraphQLNonNull} from "graphql";

export interface SessionInputDTO {
    where: WhereFilterObject
    pagination?: PaginationInputDTO
}

export interface SessionOutputDTO {
    data: Partial<SessionSelectModel>[]
    pagination?: PaginationOutputDTO
}

export const sessionInput = {
    pagination: {
        type: paginationInputObject
    },
    where: {
        type: graphqlSchemaData.filters.sessions
    }
}

export const sessionOutput = {
    data: {
        type: new GraphQLNonNull(new GraphQLList(graphqlSchemaData.types.sessions))
    },
    pagination: {
        type: paginationOutputObject
    }
}