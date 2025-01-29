import {
    and,
    Column,
    eq,
    getTableColumns,
    getTableName,
    gt,
    gte,
    ilike,
    inArray,
    isNotNull,
    isNull,
    like,
    lt,
    lte,
    notIlike,
    notInArray,
    notLike,
    sql,
    SQL,
    Table
} from "drizzle-orm";
import {
    type FieldNode,
    GraphQLBoolean,
    type GraphQLFieldConfig,
    GraphQLInt,
    GraphQLList,
    GraphQLNonNull,
    GraphQLObjectType,
    GraphQLString,
} from "graphql";
import {getTableConfig} from "drizzle-orm/pg-core";
import {GraphQLInputObjectType, type GraphQLResolveInfo, type GraphQLScalarType} from "graphql/type";
import type {GraphQLInputFieldConfig} from "graphql/type/definition";
import {dateScalar} from "../graphql/scalars/date.ts";
import {db} from "../infra/database.ts";

type DrizzleSchemaType = Record<string, Table>;
type ObjectTypeBuffer = Record<string, GraphQLObjectType>;
type FilterTypeBuffer = Record<string, GraphQLInputObjectType>;

interface ForeignKeyInfo {
    column: Column;
    table: Table;
    fieldName: string;
}

interface SelectField {
    table: string;
    column: string;
    alias?: string;
}

interface JoinInfo {
    sourceTable: Table;
    targetTable: Table;
    sourceColumn: Column;
    targetColumn: Column;
}

type WhereFilters =
    | "eq" | "gt" | "gte" | "lt" | "lte"
    | "inArray" | "notInArray" | "isNull" | "isNotNull"
    | "like" | "notLike" | "ilike" | "notIlike";

type WhereFilterObject = Record<string, Partial<Record<WhereFilters, unknown>>>;

const objectTypeBuffer: ObjectTypeBuffer = {};
const filterTypeBuffer: FilterTypeBuffer = {};
const columnFilterTypeBuffer: Record<string, GraphQLInputObjectType> = {};

const likeFilters: Record<string, { type: typeof GraphQLString }> = {
    like: {type: GraphQLString},
    notLike: {type: GraphQLString},
    ilike: {type: GraphQLString},
    notIlike: {type: GraphQLString},
};

const nullFilters: Record<string, { type: typeof GraphQLBoolean }> = {
    isNull: {type: GraphQLBoolean},
    isNotNull: {type: GraphQLBoolean},
};

type ColumnTypes =
    | 'PgText'
    | 'PgInteger'
    | 'MySqlInt'
    | 'MySqlVarChar'
    | 'MySqlDateTime'
    | 'PgSerial'
    | 'PgVarchar'
    | 'PgTimestamp';

const typeMap: Record<ColumnTypes, GraphQLScalarType> = {
    PgInteger: GraphQLInt,
    PgSerial: GraphQLInt,
    MySqlInt: GraphQLInt,
    PgText: GraphQLString,
    PgVarchar: GraphQLString,
    MySqlVarChar: GraphQLString,
    PgTimestamp: dateScalar,
    MySqlDateTime: dateScalar,
};

const getGraphQLTypeFromDrizzleColType = (colType: string): GraphQLScalarType => {
    const gqlType = typeMap[colType as ColumnTypes];
    if (!gqlType) {
        throw new Error(`Unknown column type ${colType}`);
    }
    return gqlType;
};

const newFieldFilters = (gqlType: GraphQLScalarType): Record<string, GraphQLInputFieldConfig> => ({
    eq: {type: gqlType},
    gt: {type: gqlType},
    gte: {type: gqlType},
    lt: {type: gqlType},
    lte: {type: gqlType},
    inArray: {type: new GraphQLList(new GraphQLNonNull(gqlType))},
    notInArray: {type: new GraphQLList(new GraphQLNonNull(gqlType))},
    ...likeFilters,
    ...nullFilters,
});

const capitalize = (str: string): string => str[0].toUpperCase() + str.slice(1);

const newGraphQlFilterObject = (objectName: string, colProps: Column, prefix = ''): GraphQLInputObjectType => {
    const filterName = `${prefix}${objectName}${capitalize(colProps.name)}Filters`;
    if (columnFilterTypeBuffer[filterName]) return columnFilterTypeBuffer[filterName];

    return columnFilterTypeBuffer[filterName] = new GraphQLInputObjectType({
        name: filterName,
        fields: newFieldFilters(getGraphQLTypeFromDrizzleColType(colProps.columnType)),
    });
};

const genInputFiltersFromTable = (objectName: string, table: Table, prefix = '', extraFields: Record<string, GraphQLInputFieldConfig> = {}): GraphQLInputObjectType => {
    const filterName = `${prefix}${objectName}Filters`;
    if (columnFilterTypeBuffer[filterName]) return columnFilterTypeBuffer[filterName];

    const filters: Record<string, GraphQLInputFieldConfig> = {};
    const columns = getTableColumns(table);

    for (const columnName in columns) {
        filters[columnName] = {type: newGraphQlFilterObject(objectName, columns[columnName], prefix)};
    }

    return columnFilterTypeBuffer[filterName] = new GraphQLInputObjectType({
        name: filterName,
        description: `Filters for ${objectName} object`,
        fields: {...filters, ...extraFields},
    });
};


const sortTablesByDependencies = (schema: DrizzleSchemaType): [string, Table][] => {
    const sorted: [string, Table][] = [];
    const visited = new Set<string>();

    const visit = (name: string, table: Table): void => {
        if (visited.has(name)) return;
        visited.add(name);

        const config = getTableConfig(table);
        for (let i = 0; i < config.foreignKeys.length; i++) {
            const relatedTable = config.foreignKeys[i].reference().foreignTable;
            visit(getTableName(relatedTable), relatedTable);
        }
        sorted.push([name, table]);
    };

    for (const name in schema) {
        visit(name, schema[name]);
    }
    return sorted;
};

const parseWhereFilters = (table: Table, filters?: WhereFilterObject): SQL | undefined => {
    if (!filters) return undefined;

    const conditions: SQL[] = [];
    for (const columnName in filters) {
        const filterObj = filters[columnName];
        if (!filterObj) continue;

        const column: any = table[columnName as keyof typeof table];
        if (!column) continue;

        for (const operator in filterObj) {
            let condition: SQL | undefined;
            const value = filterObj[operator as WhereFilters];

            switch (operator as WhereFilters) {
                case "eq":
                    condition = eq(column, value);
                    break;
                case "gt":
                    condition = gt(column, value);
                    break;
                case "gte":
                    condition = gte(column, value);
                    break;
                case "lt":
                    condition = lt(column, value);
                    break;
                case "lte":
                    condition = lte(column, value);
                    break;
                case "inArray":
                    condition = inArray(column, value as unknown[]);
                    break;
                case "notInArray":
                    condition = notInArray(column, value as unknown[]);
                    break;
                case "like":
                    condition = like(column, value as string);
                    break;
                case "notLike":
                    condition = notLike(column, value as string);
                    break;
                case "ilike":
                    condition = ilike(column, value as string);
                    break;
                case "notIlike":
                    condition = notIlike(column, value as string);
                    break;
                case "isNull":
                    if (value) condition = isNull(column);
                    break;
                case "isNotNull":
                    if (value) condition = isNotNull(column);
                    break;
            }
            if (condition) conditions.push(condition);
        }
    }

    return conditions.length ? and(...conditions) : undefined;
};


const buildSelectFields = (table: Table, selections: Set<string>, prefix = ""): SelectField[] => {
    const fields: SelectField[] = [];
    const tableName = getTableName(table);

    fields.push({table: tableName, column: "id", alias: prefix ? `${prefix}_id` : "id"});

    selections.forEach(field => {
        if (table[field as keyof typeof table]) {
            fields.push({
                table: tableName,
                column: field,
                alias: prefix ? `${prefix}_${field}` : field,
            });
        }
    });

    return fields;
};


const createObjectTypes = (schema: DrizzleSchemaType): ObjectTypeBuffer => {
    const sortedTables = sortTablesByDependencies(schema);

    for (let i = 0; i < sortedTables.length; i++) {
        const [name, table] = sortedTables[i];
        if (!objectTypeBuffer[name]) {
            try {
                objectTypeBuffer[name] = new GraphQLObjectType({
                    name: `${name}Object`,
                    fields: () => generateFields(name, table),
                });
            } catch (error) {
                console.error(`Failed to create GraphQLObjectType for ${name}:`, error);
                throw error;
            }
        }
    }
    return objectTypeBuffer;
};

const generateFields = (name: string, table: Table): Record<string, GraphQLFieldConfig<unknown, unknown>> => {
    const config = getTableConfig(table);
    const fkMap = new Map<string, ForeignKeyInfo>();

    config.foreignKeys.forEach(fk => {
        const column = fk.reference().columns[0];
        fkMap.set(column.name, {
            column,
            table: fk.reference().foreignTable,
            fieldName: getTableName(fk.reference().foreignTable),
        });
    });

    const fields: Record<string, GraphQLFieldConfig<unknown, unknown>> = {};

    Object.entries(config.columns).forEach(([columnName, column]) => {
        const fk = fkMap.get(column.name);
        if (fk) {
            const relatedTableName = getTableName(fk.table);
            const relatedObjectType = objectTypeBuffer[relatedTableName];
            if (!relatedObjectType) {
                throw new Error(`Type for ${relatedTableName} not found in buffer.`);
            }

            fields[fk.fieldName] = {
                type: new GraphQLNonNull(relatedObjectType),
                args: {
                    where: {
                        type: getFilterType(relatedTableName, fk.table, "Nested")
                    },
                },
                resolve: (source: any) => source[fk.fieldName],
            };
        } else {
            fields[column.name] = {
                type: getGraphQLTypeFromDrizzleColType(column.columnType),
            };
        }
    });

    return fields;
};


const getSelectedFields = (info: GraphQLResolveInfo): Set<string> => {
    const selections = new Set<string>();
    const fieldNodes = info.fieldNodes;

    for (let i = 0; i < fieldNodes.length; i++) {
        const selectionSet = fieldNodes[i]?.selectionSet?.selections;
        if (!selectionSet) continue;
        for (let j = 0; j < selectionSet.length; j++) {
            const selection = selectionSet[j];
            if (selection.kind === "Field" && selection.name.value) {
                selections.add(selection.name.value);
            }
        }
    }

    return selections;
};

const getForeignKeyForField = (table: Table, fieldName: string): {
    table: Table,
    sourceColumn: Column,
    targetColumn: Column
} | null => {
    const config = getTableConfig(table);

    for (let i = 0; i < config.foreignKeys.length; i++) {
        const fk = config.foreignKeys[i];
        const foreignTableName = getTableName(fk.reference().foreignTable);
        const columnName = fk.reference().columns[0].name;
        if (foreignTableName === fieldName || columnName === `${fieldName}_id`) {
            return {
                table: fk.reference().foreignTable,
                sourceColumn: fk.reference().columns[0],
                targetColumn: fk.reference().foreignColumns[0]
            };
        }
    }
    return null;
};

const getNestedSelections = (fieldNode: FieldNode): Set<string> => {
    const selections = new Set<string>();
    const fieldNodeSelections = fieldNode.selectionSet?.selections;

    if (fieldNodeSelections) {
        for (let i = 0; i < fieldNodeSelections.length; i++) {
            const selection = fieldNodeSelections[i];
            if (selection.kind === "Field") {
                selections.add(selection.name.value);
            }
        }
    }

    return selections;
};

export const buildQuery = (
    table: Table, info: GraphQLResolveInfo, whereFilters?: WhereFilterObject, args?: Record<string, any>,
    limit?: number, offset?: number
) => {
    const selections = getSelectedFields(info);
    const joins: JoinInfo[] = [];
    let selectFields: SelectField[] = buildSelectFields(table, selections);
    const whereConditions: SQL[] = [];

    const processNestedSelections = (currentTable: Table, fieldNode: FieldNode, parentPrefix = "") => {
        const fieldName = fieldNode.name.value;
        const foreignKey = getForeignKeyForField(currentTable, fieldName);

        if (foreignKey) {
            const nestedSelections = getNestedSelections(fieldNode);
            const prefix = parentPrefix ? `${parentPrefix}_${fieldName}` : fieldName;

            const nestedWhereArg = fieldNode.arguments?.find(arg => arg.name.value === "where");
            const nestedWhereValue = nestedWhereArg?.value.kind === "Variable" ? args?.[nestedWhereArg.value.name.value] : undefined;

            if (nestedWhereValue) {
                const nestedConditions = parseWhereFilters(foreignKey.table, nestedWhereValue);
                if (nestedConditions) whereConditions.push(nestedConditions);
            }

            joins.push({
                sourceTable: currentTable,
                targetTable: foreignKey.table,
                sourceColumn: foreignKey.sourceColumn,
                targetColumn: foreignKey.targetColumn,
            });

            const nestedSelectFields = buildSelectFields(foreignKey.table, nestedSelections, prefix);
            selectFields.push(...nestedSelectFields);

            const selectionSet = fieldNode.selectionSet;
            if (selectionSet) {
                for (const selection of selectionSet.selections) {
                    if (selection.kind === "Field") {
                        processNestedSelections(foreignKey.table, selection, prefix);
                    }
                }
            }
        }
    };

    const rootSelectionSet = info.fieldNodes[0].selectionSet;
    if (rootSelectionSet) {
        for (const selection of rootSelectionSet.selections) {
            if (selection.kind === "Field") {
                processNestedSelections(table, selection);
            }
        }
    }

    const selectObj: Record<string, SQL> = {};
    selectFields.forEach(({table: tableName, column, alias}) => {
        // @formatter:off
        selectObj[alias || column] = sql`${sql.identifier(tableName)}.${sql.identifier(column)}`;
    });

    let query:any = db.select(selectObj).from(table);
    joins.forEach(({targetTable, sourceColumn, targetColumn}) => {
        query = query.leftJoin(targetTable, eq(sourceColumn, targetColumn));
    });

    if (whereFilters) {
        const mainConditions = parseWhereFilters(table, whereFilters);
        if (mainConditions) whereConditions.push(mainConditions);
    }

    if (whereConditions.length) {
        query = query.where(and(...whereConditions));
    }

    if (limit) {
        query = query.limit(limit);
    }

    if (offset) {
        query = query.offset(offset);
    }

    return query;
};


const getFilterType = (name: string, table: Table, prefix = ""): GraphQLInputObjectType => {
    const filterName = `${prefix}${name}Filters`;
    const baseFilterName = `${name}Filters`;

    if (filterTypeBuffer[filterName]) {
        return filterTypeBuffer[filterName];
    }
    if (prefix === "Nested" && filterTypeBuffer[baseFilterName]) {
        return filterTypeBuffer[baseFilterName];
    }
    return filterTypeBuffer[filterName] = genInputFiltersFromTable(name, table, prefix);
};

export const nestObject = (flatRow: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(flatRow)) {
        const parts = key.split('_');
        let current: any = result;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!current[part]) {
                current[part] = {};
            }
            current = current[part];
        }
        const lastPart = parts[parts.length - 1];
        current[lastPart] = value;
    }

    const removeNullObjects = (obj: any): any => {
        if (typeof obj !== 'object' || obj === null) return obj;

        if ('id' in obj && obj.id === null) return null;

        Object.keys(obj).forEach(k => {
            obj[k] = removeNullObjects(obj[k]);
            if (obj[k] === null) delete obj[k];
        });

        return Object.keys(obj).length === 0 ? null : obj;
    };

    return removeNullObjects(result) as Record<string, unknown>;
};

export function generateSchemaData<T extends DrizzleSchemaType>(schema: T) {
    // @ts-expect-error asd
    const filters: Record<keyof T, GraphQLInputObjectType> = {}
    // @ts-expect-error asd
    const types: Record<keyof T, GraphQLObjectType> = {}

    createObjectTypes(schema);

    for (const name in schema) {
        const table = schema[name]
        const objectType = objectTypeBuffer[name];
        if (!objectType) throw new Error(`GraphQL type for ${name} is undefined.`);
        types[name] = objectType
        filters[name] = genInputFiltersFromTable(name, table)
    }

    return {
        types,
        filters
    }
}

export const generateResolvers = <T extends DrizzleSchemaType>(schema: T) => {
    // @ts-expect-error asd
    const resolvers: Record<keyof T, GraphQLFieldConfig<null, unknown>> = {};
    createObjectTypes(schema);

    for (const name in schema) {
        const table = schema[name];
        const objectType = objectTypeBuffer[name];
        if (!objectType) throw new Error(`GraphQL type for ${name} is undefined.`);

        resolvers[name] = {
            type: new GraphQLList(objectType),
            args: {where: {type: getFilterType(name, table)}},
            resolve: async (_source, args, _context, info) => {
                const query = buildQuery(table, info, args.where, info.variableValues);
                const results:Record<string, unknown>[] = await query.execute();
                return results.map(row => nestObject(row))
            },
        };
    }

    return resolvers;
};


