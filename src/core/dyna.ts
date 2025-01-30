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
    table: Table, info: GraphQLResolveInfo, whereFilters?: WhereFilterObject, args?: Record<string, any>,
    limit?: number, offset?: number
) => {
    const selections = getSelectedFields(info);
    const joins: JoinInfo[] = [];
    const selectFields: SelectField[] = [];
    const existingAliases = new Set<string>();
    const whereConditions: SQL[] = [];
    const foreignKeyCache = new Map<string, ReturnType<typeof getForeignKeyForField>>();

    const addField = ({table: tableName, column, alias}: SelectField) => {
        const fieldAlias = alias || column;
        if (!existingAliases.has(fieldAlias)) {
            existingAliases.add(fieldAlias);
            selectFields.push({table: tableName, column, alias: fieldAlias});
        }
    };

    const memoizedGetForeignKeyForField = (currentTable: Table, fieldName: string) => {
        const tableName = getTableName(currentTable);
        const key = `${tableName}:${fieldName}`;
        if (foreignKeyCache.has(key)) return foreignKeyCache.get(key)!;

        const result = getForeignKeyForField(currentTable, fieldName);
        foreignKeyCache.set(key, result);
        return result;
    };

    const processRootSelection = (selection: FieldNode) => {
        if (selection.name.value === "data" && selection.selectionSet) {
            const selections = selection.selectionSet.selections;
            for (let i = 0; i < selections.length; i++) {
                const subSelection = selections[i];
                if (subSelection.kind === "Field") {
                    processNestedSelections(table, subSelection);
                }
            }
        } else {
            processNestedSelections(table, selection);
        }
    };

    const processNestedSelections = (currentTable: Table, fieldNode: FieldNode, parentPrefix = "") => {
        const fieldName = fieldNode.name.value;
        const foreignKey = memoizedGetForeignKeyForField(currentTable, fieldName);
        if (!foreignKey) return;

        const nestedSelections = getNestedSelections(fieldNode);
        const prefix = parentPrefix ? `${parentPrefix}_${fieldName}` : fieldName;
        const currentTableName = getTableName(currentTable);

        const nestedWhereArg = fieldNode.arguments?.find(arg => arg.name.value === "where");
        const nestedWhereValue = nestedWhereArg?.value.kind === "Variable"
            ? args?.[nestedWhereArg.value.name.value]
            : undefined;

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

        const fkColumnName = foreignKey.sourceColumn.name;
        addField({
            table: currentTableName,
            column: fkColumnName,
            alias: parentPrefix ? `${parentPrefix}_${fkColumnName}` : fkColumnName
        });

        const nestedFields = buildSelectFields(foreignKey.table, nestedSelections, prefix);
        for (let i = 0; i < nestedFields.length; i++) {
            addField(nestedFields[i]);
        }

        const selectionSet = fieldNode.selectionSet?.selections;
        if (selectionSet) {
            for (let i = 0; i < selectionSet.length; i++) {
                const selection = selectionSet[i];
                if (selection.kind === "Field") {
                    processNestedSelections(foreignKey.table, selection, prefix);
                }
            }
        }
    };

    const initialFields = buildSelectFields(table, selections);
    for (let i = 0; i < initialFields.length; i++) {
        addField(initialFields[i]);
    }

    const rootSelectionSet = info.fieldNodes[0].selectionSet?.selections;
    if (rootSelectionSet) {
        for (let i = 0; i < rootSelectionSet.length; i++) {
            const selection = rootSelectionSet[i];
            if (selection.kind === "Field") {
                processRootSelection(selection);
            }
        }
    }

    const selectObj: Record<string, SQL> = {};
    for (let i = 0; i < selectFields.length; i++) {
        const {table: tableName, column, alias} = selectFields[i];
        selectObj[alias || column] = sql`${sql.identifier(tableName)}
        .
        ${sql.identifier(column)}`;
    }

    let query: any = db.select(selectObj).from(table);

    for (let i = 0; i < joins.length; i++) {
        const {targetTable, sourceColumn, targetColumn} = joins[i];
        query = query.leftJoin(targetTable, eq(sourceColumn, targetColumn));
    }

    if (whereFilters) {
        const mainConditions = parseWhereFilters(table, whereFilters);
        if (mainConditions) whereConditions.push(mainConditions);
    }
    if (whereConditions.length) query = query.where(and(...whereConditions));

    if (limit) query = query.limit(limit);
    if (offset) query = query.offset(offset);

    return query;
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
