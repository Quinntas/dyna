import {graphqlSchemaData} from "../../../graphql/schemaData.ts";
import {GraphQLList} from "graphql";
import type {UserSelectModel} from "../infra/user.table.ts";
import {
    type PaginationInputDTO,
    paginationInputObject,
    type PaginationOutputDTO,
    paginationOutputObject
} from "../../../graphql/objects/pagination.ts";

export type WhereFilters =
    'eq'
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "inArray"
    | "notInArray"
    | "isNull"
    | "isNotNull"
    | "like"
    | "notLike"
    | "ilike"
    | "notIlike";

export type WhereFilterObject = Record<string, {
    [key in WhereFilters]?: unknown;
}>

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
        type: graphqlSchemaData.filters.User
    }
}

export const usersOutput = {
    data: {
        type: new GraphQLList(graphqlSchemaData.types.User)
    },
    pagination: {
        type: paginationOutputObject
    }
}