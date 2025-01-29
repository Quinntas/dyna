import {graphqlSchemaData} from "../../../graphql/schemaData.ts";
import {GraphQLList} from "graphql";
import type {UserSelectModel} from "../infra/user.table.ts";

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
    where: any
}

export interface UsersOutputDTO extends UserSelectModel {
}

export const usersInput = {
    where: {
        type: graphqlSchemaData.filters.User
    }
}

export const usersOutput = new GraphQLList(graphqlSchemaData.types.User)