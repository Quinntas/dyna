import type {WhereFilterObject} from "../../../../core/dyna.ts";
import {
    type PaginationInputDTO,
    paginationInputObject,
    type PaginationOutputDTO,
    paginationOutputObject
} from "../../../../graphql/objects/pagination.ts";
import type {UserSelectModel} from "../../infra/user.table.ts";
import {graphqlSchemaData} from "../../../../graphql/schemaData.ts";
import {GraphQLList} from "graphql";


export interface UsersInputDTO {
    where: WhereFilterObject
    pagination?: PaginationInputDTO
}

export interface UsersOutputDTO {
    data: UserSelectModel
    pagination?: PaginationOutputDTO
}

export const usersInput = {
    pagination: {
        type: paginationInputObject
    },
    where: {
        type: graphqlSchemaData.filters.users
    }
}

export const usersOutput = {
    data: {
        type: new GraphQLList(graphqlSchemaData.types.users)
    },
    pagination: {
        type: paginationOutputObject
    }
}