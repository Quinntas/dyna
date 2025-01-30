import {
    and,
    asc,
    Column,
    desc,
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
    type SelectedFields,
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
import {tables} from "../graphql/tables.ts";
import {rolePermissions, type Roles} from "../infra/rbac.ts";
import {GraphQLError, type SelectionNode} from "graphql/index";
import {Kind} from "graphql/language";
import {type PaginationInputDTO, PaginationOrderByEnum} from "../graphql/objects/pagination.ts";

type DrizzleSchemaType = Record<string, Table>;
type ObjectTypeBuffer = Record<string, GraphQLObjectType>;
type FilterTypeBuffer = Record<string, GraphQLInputObjectType>;

export type QueryAnalysisResult = {
    obj: ParsedGraphQLResolveInfo;
    depth: number;
    resources: {
        tables: Set<Table>;
        columns: Map<string, Set<string>>;
        joinTables: Set<string>;
        whereConditions: Map<string, WhereFilterObject>;
    };
};

export type ParsedGraphQLResolveInfo = {
    [key: string]: Column | ParsedGraphQLResolveInfo;
};


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

type WhereFilters =
    | "eq" | "gt" | "gte" | "lt" | "lte"
    | "inArray" | "notInArray" | "isNull" | "isNotNull"
    | "like" | "notLike" | "ilike" | "notIlike";

export type WhereFilterObject = Record<string, Partial<Record<WhereFilters, unknown>>>;

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
    if (filterTypeBuffer[filterName]) return filterTypeBuffer[filterName];

    const filters: Record<string, GraphQLInputFieldConfig> = {};
    const columns = getTableColumns(table);

    for (const columnName in columns) {
        filters[columnName] = {type: newGraphQlFilterObject(objectName, columns[columnName], '')};
    }

    return filterTypeBuffer[filterName] = new GraphQLInputObjectType({
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


const createObjectTypes = (schema: DrizzleSchemaType): ObjectTypeBuffer => {
    const sortedTables = sortTablesByDependencies(schema);

    for (const [name, table] of sortedTables) {
        const baseFilterName = `${name}Filters`;
        if (!filterTypeBuffer[baseFilterName]) {
            filterTypeBuffer[baseFilterName] = genInputFiltersFromTable(name, table);
        }
    }

    for (const [name, table] of sortedTables) {
        if (!objectTypeBuffer[name]) {
            objectTypeBuffer[name] = new GraphQLObjectType({
                name: `${name}Object`,
                fields: () => generateFields(name, table),
            });
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
        const targetTable = fk.reference().foreignTable;
        const targetTableName = getTableName(targetTable).toLowerCase();

        if (fieldName.toLowerCase() === targetTableName.toLowerCase() ||
            fieldName.toLowerCase() === `${targetTableName}_id`) {
            return {
                table: targetTable,
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
    table: Table,
    analysis: QueryAnalysisResult | null,
    pagination?: PaginationInputDTO
) => {
    if (!analysis)
        throw new Error("Analysis is null")

    const query = db.select(
        analysis.obj as SelectedFields<any, any>
    ).from(table)

    for (const joinTableName of analysis.resources.joinTables) {
        const joinTable: Table | undefined = tables[joinTableName];

        if (!joinTable) {
            throw new Error(`Table ${joinTableName} not found`);
        }

        const mainTableConfig = getTableConfig(table);
        query.leftJoin(
            joinTable,
            eq(
                mainTableConfig.foreignKeys[0].reference().columns[0],
                mainTableConfig.foreignKeys[0].reference().foreignColumns[0]
            )
        )
    }

    const parsedConditions = []

    for (const [tableName, conditions] of analysis.resources.whereConditions) {
        const table: Table | undefined = tables[tableName];

        if (!table) {
            throw new Error(`Table ${tableName} not found`);
        }

        parsedConditions.push(parseWhereFilters(table, conditions))
    }

    if (parsedConditions.length > 0)
        query.where(and(...parsedConditions))

    if (pagination?.limit)
        query.limit(pagination.limit)

    if (pagination?.offset)
        query.offset(pagination.offset)

    if (pagination?.orderBy)
        switch (pagination.orderBy) {
            case PaginationOrderByEnum.ASC:
                query.orderBy(asc(table['id']))
                break;
            case PaginationOrderByEnum.DESC:
                query.orderBy(desc(table['id']))
                break;
        }

    return query
};

// Optimized helper function
const buildSelectFields = (table: Table, selections: Set<string>, prefix = ""): SelectField[] => {
    const fields: SelectField[] = [];
    const tableName = getTableName(table);
    const idAlias = prefix ? `${prefix}_id` : "id";

    fields.push({table: tableName, column: "id", alias: idAlias});

    const selectionArray = Array.from(selections);
    for (let i = 0; i < selectionArray.length; i++) {
        const field = selectionArray[i];
        if (table[field as keyof typeof table]) {
            fields.push({
                table: tableName,
                column: field,
                alias: prefix ? `${prefix}_${field}` : field,
            });
        }
    }

    return fields;
};

const getFilterType = (name: string, table: Table, prefix = ""): GraphQLInputObjectType => {
    const baseFilterName = `${name}Filters`;
    const prefixedFilterName = `${prefix}${name}Filters`;

    if (filterTypeBuffer[baseFilterName]) {
        return filterTypeBuffer[baseFilterName];
    }

    if (!filterTypeBuffer[prefixedFilterName]) {
        filterTypeBuffer[prefixedFilterName] = genInputFiltersFromTable(name, table, prefix);
    }

    return filterTypeBuffer[prefixedFilterName];
};

export const nestObject = (flatRow: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    const nodeMap = new Map<string, Record<string, unknown>>();
    nodeMap.set('', result);

    for (const [key, value] of Object.entries(flatRow)) {
        const parts = key.split('_');
        let currentPath = '';
        let currentLevel = result;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            const newPath = currentPath ? `${currentPath}_${part}` : part;

            if (!nodeMap.has(newPath)) {
                const newLevel: Record<string, unknown> = {};
                nodeMap.set(newPath, newLevel);
                currentLevel[part] = newLevel;
            }

            currentLevel = nodeMap.get(newPath)!;
            currentPath = newPath;
        }

        const prop = parts[parts.length - 1];
        currentLevel[prop] = value;
    }

    const stack: Array<[Record<string, unknown>, string[]]> = [[result, []]];
    const removalQueue: Array<[string[], string]> = [];

    while (stack.length > 0) {
        const [node, path] = stack.pop()!;
        let hasValidContent = false;
        let hasId = false;

        // Check for ID presence first
        if ('id' in node && node.id !== null) {
            hasId = true;
            hasValidContent = true;
        }

        for (const [key, value] of Object.entries(node)) {
            if (typeof value === 'object' && value !== null) {
                stack.push([value as Record<string, unknown>, [...path, key]]);
                hasValidContent = true;
            } else if (value !== null) {
                hasValidContent = true;
            }
        }

        if (!hasValidContent && !hasId) {
            removalQueue.push([path, path[path.length - 1]]);
        }
    }

    for (const [path, key] of removalQueue) {
        if (path.length === 0) continue;

        const parentPath = path.slice(0, -1).join('_');
        const parent = nodeMap.get(parentPath) || result;
        delete parent[key];
    }

    return result;
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

export function parseGraphQLResolveInfo(
    baseObjectName: keyof typeof tables,
    info: GraphQLResolveInfo,
    userRole: Roles,
    maxDepth: number = 5,
    rootBase: string = "data"
): QueryAnalysisResult | null {
    const fieldNodes = info.fieldNodes;
    if (!fieldNodes[0]?.selectionSet?.selections) return null;

    const stack: Array<{
        objectName: string;
        selections: readonly SelectionNode[];
        currentDepth: number;
        parentObj: ParsedGraphQLResolveInfo;
        whereArg?: WhereFilterObject;
    }> = [];

    const result: QueryAnalysisResult = {
        obj: {},
        depth: 0,
        resources: {
            tables: new Set<Table>(),
            columns: new Map<string, Set<string>>(),
            joinTables: new Set<string>(),
            whereConditions: new Map<string, WhereFilterObject>(),
        },
    };

    const baseWhereArg = getWhereArgument(fieldNodes[0], info.variableValues);

    for (const selection of fieldNodes[0].selectionSet.selections) {
        if (selection.kind === Kind.FIELD && selection.name.value === rootBase && selection.selectionSet) {
            stack.push({
                objectName: baseObjectName,
                selections: selection.selectionSet.selections,
                currentDepth: 1,
                parentObj: result.obj,
                whereArg: baseWhereArg
            });
            result.resources.tables.add(baseObjectName);
            if (baseWhereArg) {
                result.resources.whereConditions.set(baseObjectName, baseWhereArg);
            }
            break;
        }
    }

    while (stack.length > 0) {
        const {objectName, selections, currentDepth, parentObj, whereArg} = stack.pop()!;
        const table: Table | undefined = tables[objectName];

        if (!table) {
            throw new GraphQLError(`Table ${objectName} not found`);
        }

        if (currentDepth > result.depth) {
            result.depth = currentDepth;
        }

        if (currentDepth > maxDepth) {
            throw new GraphQLError(`Max depth of ${maxDepth} exceeded`);
        }

        for (const selection of selections) {
            if (selection.kind !== Kind.FIELD) continue;

            const fieldName = selection.name.value;
            const column = table[fieldName as keyof typeof table];

            if (selection.selectionSet) {
                const nestedObj: ParsedGraphQLResolveInfo = {};
                parentObj[fieldName] = nestedObj;

                const nestedWhereArg = getWhereArgument(selection, info.variableValues);

                const joinedTable: Table | undefined = tables[fieldName];
                if (joinedTable) {
                    result.resources.tables.add(fieldName);
                    result.resources.joinTables.add(fieldName);
                    if (nestedWhereArg) {
                        result.resources.whereConditions.set(fieldName, nestedWhereArg);
                    }
                }

                stack.push({
                    objectName: fieldName,
                    selections: selection.selectionSet.selections,
                    currentDepth: currentDepth + 1,
                    parentObj: nestedObj,
                    whereArg: nestedWhereArg
                });
            } else if (column) {
                if (!result.resources.columns.has(objectName)) {
                    result.resources.columns.set(objectName, new Set<string>());
                }
                result.resources.columns.get(objectName)!.add(fieldName);

                parentObj[fieldName] = column as Column;
            }
        }
    }

    const authError = authorizeQuery(result.resources, userRole);

    if (authError)
        throw authError;

    return result.depth > 0 ? result : null;
}

function getWhereArgument(
    field: SelectionNode & { arguments?: readonly any[] },
    variables: Record<string, any>
): WhereFilterObject | undefined {
    if (!field.arguments?.length) return undefined;

    const whereArg = field.arguments.find(arg => arg.name.value === 'where');
    if (!whereArg) return undefined;

    if (whereArg.value.kind === Kind.VARIABLE) {
        const varName = whereArg.value.name.value;
        return variables[varName];
    }

    if (whereArg.value.kind === Kind.OBJECT) {
        return parseWhereObject(whereArg.value);
    }

    return undefined;
}

function parseWhereObject(obj: any): WhereFilterObject {
    const result: WhereFilterObject = {};

    for (const field of obj.fields) {
        const key = field.name.value;
        const value = field.value;

        if (value.kind === Kind.OBJECT) {
            result[key] = parseWhereObject(value);
        } else {
            result[key] = value.value;
        }
    }

    return result;
}

function authorizeQuery(resources: QueryAnalysisResult['resources'], role: Roles): GraphQLError | null {
    const permissions = rolePermissions[role]

    for (const table of resources.tables) {
        if (!permissions.allowedTables.has('*') && !permissions.allowedTables.has(table)) {
            return new GraphQLError(`Unauthorized access to table: ${table}`);
        }
    }

    for (const [table, columns] of resources.columns) {
        const allowedColumns = permissions.allowedColumns.get(table) || permissions.allowedColumns.get('*');

        if (!allowedColumns) {
            return new GraphQLError(`Unauthorized access to table: ${table}`);
        }

        if (!allowedColumns.has('*')) {
            for (const column of columns) {
                if (!allowedColumns.has(column)) {
                    return new GraphQLError(`Unauthorized access to column: ${table}.${column}`);
                }
            }
        }
    }

    return null;
}
