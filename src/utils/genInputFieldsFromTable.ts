import {GraphQLBoolean, GraphQLList, GraphQLNonNull, GraphQLString} from 'graphql';
import {GraphQLInputObjectType, GraphQLInt} from 'graphql/type';
import {dateScalar} from '../graphql/scalars/date';
import {type GraphQLInputFieldConfig, type ThunkObjMap} from 'graphql/type/definition';
import {PgColumn, PgTable} from "drizzle-orm/pg-core";

type ColumnTypes = 'MySqlInt' | 'MySqlVarChar' | 'MySqlDateTime';

const likeFilters = {
    like: {
        type: GraphQLString,
    },
    notLike: {
        type: GraphQLString,
    },
    ilike: {
        type: GraphQLString,
    },
    notIlike: {
        type: GraphQLString,
    },
};

const nullFilters = {
    isNull: {
        type: GraphQLBoolean,
    },
    isNotNull: {
        type: GraphQLBoolean,
    },
};

function newGraphQlFilterObject(objectName: string, colProps: PgColumn) {
    let fields = {};

    switch (colProps.columnType as ColumnTypes) {
        case 'MySqlInt':
            fields = {
                eq: {
                    type: GraphQLInt,
                },
                gt: {
                    type: GraphQLInt,
                },
                gte: {
                    type: GraphQLInt,
                },
                lt: {
                    type: GraphQLInt,
                },
                lte: {
                    type: GraphQLInt,
                },
                inArray: {
                    type: new GraphQLList(new GraphQLNonNull(GraphQLInt)),
                },
                notInArray: {
                    type: new GraphQLList(new GraphQLNonNull(GraphQLInt)),
                },
                ...likeFilters,
                ...nullFilters,
            };
            break;

        case 'MySqlVarChar':
            fields = {
                eq: {
                    type: GraphQLString,
                },
                gt: {
                    type: GraphQLString,
                },
                gte: {
                    type: GraphQLString,
                },
                lt: {
                    type: GraphQLString,
                },
                lte: {
                    type: GraphQLString,
                },
                inArray: {
                    type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
                },
                notInArray: {
                    type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
                },
                ...likeFilters,
                ...nullFilters,
            };
            break;

        case 'MySqlDateTime':
            fields = {
                eq: {
                    type: dateScalar,
                },
                gt: {
                    type: dateScalar,
                },
                gte: {
                    type: dateScalar,
                },
                lt: {
                    type: dateScalar,
                },
                lte: {
                    type: dateScalar,
                },
                inArray: {
                    type: new GraphQLList(new GraphQLNonNull(dateScalar)),
                },
                notInArray: {
                    type: new GraphQLList(new GraphQLNonNull(dateScalar)),
                },
                ...likeFilters,
                ...nullFilters,
            };
            break;

        default:
            throw new Error(`Unknown column type ${colProps.columnType} from ${objectName}`);
    }

    return new GraphQLInputObjectType({
        name: `${objectName}${capitalize(colProps.name)}Filters`,
        fields,
    });
}

function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function genInputFiltersFromTable(objectName: string, table: PgTable) {
    const cols = Object.keys(table);

    let filters: ThunkObjMap<GraphQLInputFieldConfig> = {};

    cols.forEach((col) => {
        filters[col] = {
            type: newGraphQlFilterObject(objectName, (table as any)[col]),
        };
    });

    return new GraphQLInputObjectType({
        name: `${objectName}Filters`,
        description: `Filters for ${objectName} object`,
        fields: filters,
    });
}
