import {GraphQLBoolean, GraphQLList, GraphQLNonNull, GraphQLString} from 'graphql';
import {GraphQLInputObjectType, GraphQLInt, type GraphQLScalarType} from 'graphql/type';
import {dateScalar} from '../graphql/scalars/date';
import {type GraphQLInputFieldConfig, type ThunkObjMap} from 'graphql/type/definition';
import {Column, getTableColumns, type Table} from "drizzle-orm";

type ColumnTypes = 'MySqlInt' | 'MySqlVarChar' | 'MySqlDateTime' | 'PgSerial' | 'PgVarchar' | 'PgTimestamp';

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

function newFieldFilters(gqlType: GraphQLScalarType) {
    return {
        eq: {
            type: gqlType,
        },
        gt: {
            type: gqlType,
        },
        gte: {
            type: gqlType,
        },
        lt: {
            type: gqlType,
        },
        lte: {
            type: gqlType,
        },
        inArray: {
            type: new GraphQLList(new GraphQLNonNull(gqlType)),
        },
        notInArray: {
            type: new GraphQLList(new GraphQLNonNull(gqlType)),
        },
        ...likeFilters,
        ...nullFilters,
    };
}

function newGraphQlFilterObject(objectName: string, colProps: Column) {
    let fields = {};

    switch (colProps.columnType as ColumnTypes) {
        case 'PgSerial':
        case 'MySqlInt':
            fields = newFieldFilters(GraphQLInt);
            break;

        case "PgVarchar":
        case 'MySqlVarChar':
            fields = newFieldFilters(GraphQLString);
            break;

        case "PgTimestamp":
        case 'MySqlDateTime':
            fields = newFieldFilters(dateScalar);
            break

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

export function genInputFiltersFromTable(objectName: string, table: Table, extraFields: ThunkObjMap<GraphQLInputFieldConfig> = {}) {
    const cols = getTableColumns(table)

    let filters: ThunkObjMap<GraphQLInputFieldConfig> = {};

    for (const col of Object.values(cols))
        filters[col.name] = {
            type: newGraphQlFilterObject(objectName, col),
        };

    return new GraphQLInputObjectType({
        name: `${objectName}Filters`,
        description: `Filters for ${objectName} object`,
        fields: {
            ...filters,
            ...extraFields
        },
    });
}
