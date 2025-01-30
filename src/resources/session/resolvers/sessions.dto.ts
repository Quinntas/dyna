import {
    type PaginationInputDTO,
    paginationInputObject,
    type PaginationOutputDTO,
    paginationOutputObject
} from "../../../graphql/objects/pagination.ts";
import {graphqlSchemaData} from "../../../graphql/schemaData.ts";
import type {WhereFilterObject} from "../../user/resolvers/users.dto.ts";
import type {SessionSelectModel} from "../infra/session.table.ts";
import {GraphQLList} from "graphql";

export interface SessionInputDTO {
    where: WhereFilterObject
    pagination?: PaginationInputDTO
}

export interface SessionOutputDTO {
    data: SessionSelectModel
    pagination?: PaginationOutputDTO
}

export const sessionInput = {
    pagination: {
        type: paginationInputObject
    },
    where: {
        type: graphqlSchemaData.filters.session
    }
}

export const sessionOutput = {
    data: {
        type: new GraphQLList(graphqlSchemaData.types.session)
    },
    pagination: {
        type: paginationOutputObject
    }
}