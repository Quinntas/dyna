import {GraphQLBoolean, GraphQLInputObjectType, GraphQLInt} from 'graphql/type';
import {GraphQLNonNull, GraphQLObjectType} from 'graphql';
import {newEnumType} from './factories/enum';

export enum PaginationOrderByEnum {
    ASC = 'ASC',
    DESC = 'DESC',
}

export interface PaginationInputDTO {
    limit: number;
    offset: number;
    orderBy: PaginationOrderByEnum;
}

export interface PaginationOutputDTO {
    nextOffset: number;
    hasMore: boolean;
    total: number;
}

export const GraphqlPaginationOrderByEnum = newEnumType(
    'PaginationOrderByEnum',
    PaginationOrderByEnum,
);

export const paginationInputObject = new GraphQLInputObjectType({
    name: 'PaginationInput',
    description: 'Pagination input',
    fields: {
        limit: {
            type: new GraphQLNonNull(GraphQLInt),
        },
        offset: {
            type: new GraphQLNonNull(GraphQLInt),
        },
        orderBy: {
            type: GraphqlPaginationOrderByEnum,
        },
    },
});

export const paginationOutputObject = new GraphQLObjectType({
    name: 'PaginationOutput',
    description: 'Pagination output',
    fields: {
        nextOffset: {
            type: new GraphQLNonNull(GraphQLInt),
        },
        hasMore: {
            type: new GraphQLNonNull(GraphQLBoolean),
        },
        total: {
            type: new GraphQLNonNull(GraphQLInt),
        },
    },
});
