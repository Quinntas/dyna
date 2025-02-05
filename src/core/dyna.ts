import {
    and,
    asc,
    Column,
    count,
    desc,
    type DrizzleTypeError,
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
    GraphQLBoolean,
    GraphQLError,
    type GraphQLFieldConfig,
    type GraphQLInputFieldConfig,
    GraphQLInputObjectType,
    GraphQLInt,
    GraphQLList,
    GraphQLNonNull,
    GraphQLObjectType,
    type GraphQLResolveInfo,
    GraphQLScalarType,
    GraphQLString
} from "graphql";
import {getTableConfig, type PgSelectBase} from "drizzle-orm/pg-core";
import {Kind} from "graphql/language";
import {dateScalar} from "../graphql/scalars/date.ts";
import {db} from "../infra/database.ts";
import {tables} from "../graphql/tables.ts";
import {rolePermissions, type Roles} from "../infra/rbac.ts";
import {type PaginationInputDTO, PaginationOrderByEnum} from "../graphql/objects/pagination.ts";

// ──────────────────────────────────────────────
// SECTION: Type Definitions & Constants
// ──────────────────────────────────────────────

type DrizzleSchemaType = Record<string, Table>;

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

export type WhereFilterObject = Record<string, Partial<Record<WhereFilters, unknown>>>;
type WhereFilters =
    | "eq" | "gt" | "gte" | "lt" | "lte"
    | "inArray" | "notInArray" | "isNull" | "isNotNull"
    | "like" | "notLike" | "ilike" | "notIlike";

type ColumnTypes =
    | 'PgText'
    | 'PgInteger'
    | 'MySqlInt'
    | 'MySqlVarChar'
    | 'MySqlDateTime'
    | 'PgSerial'
    | 'PgVarchar'
    | 'PgTimestamp'
    | 'PgTimestampString';

const typeMap: Record<ColumnTypes, GraphQLScalarType> = {
    PgInteger: GraphQLInt,
    PgSerial: GraphQLInt,
    MySqlInt: GraphQLInt,
    PgText: GraphQLString,
    PgVarchar: GraphQLString,
    MySqlVarChar: GraphQLString,
    PgTimestamp: dateScalar,
    PgTimestampString: dateScalar,
    MySqlDateTime: dateScalar,
};

const getGraphQLTypeFromDrizzleColType = (colType: string): GraphQLScalarType => {
    const gqlType = typeMap[colType as ColumnTypes];
    if (!gqlType) throw new Error(`Unknown column type ${colType}`);
    return gqlType;
};

const capitalize = (s: string): string => s[0].toUpperCase() + s.slice(1);

// ──────────────────────────────────────────────
// SECTION: GraphQL Filter Helpers
// ──────────────────────────────────────────────

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

const columnFilterTypeBuffer: Record<string, GraphQLInputObjectType> = Object.create(null);

const newGraphQlFilterObject = (
    objectName: string,
    col: Column,
    prefix = ''
): GraphQLInputObjectType => {
    const filterName = `${prefix}${objectName}${capitalize(col.name)}Filters`;
    if (columnFilterTypeBuffer[filterName]) return columnFilterTypeBuffer[filterName];
    return (columnFilterTypeBuffer[filterName] = new GraphQLInputObjectType({
        name: filterName,
        fields: newFieldFilters(getGraphQLTypeFromDrizzleColType(col.columnType)),
    }));
};

const filterTypeBuffer: Record<string, GraphQLInputObjectType> = Object.create(null);

export const genInputFiltersFromTable = (
    objectName: string,
    table: Table,
    prefix = '',
    extraFields: Record<string, GraphQLInputFieldConfig> = {}
): GraphQLInputObjectType => {
    const filterName = `${prefix}${objectName}Filters`;
    if (filterTypeBuffer[filterName]) return filterTypeBuffer[filterName];

    const cols = getTableColumns(table);
    const filters: Record<string, GraphQLInputFieldConfig> = Object.create(null);
    for (const colName in cols) {
        filters[colName] = {type: newGraphQlFilterObject(objectName, cols[colName])};
    }

    return (filterTypeBuffer[filterName] = new GraphQLInputObjectType({
        name: filterName,
        description: `Filters for ${objectName}`,
        fields: {...filters, ...extraFields}
    }));
};

// ──────────────────────────────────────────────
// SECTION: Schema Object Types
// ──────────────────────────────────────────────

type ObjectTypeBuffer = Record<string, GraphQLObjectType>;
const objectTypeBuffer: ObjectTypeBuffer = Object.create(null);

const sortTablesByDependencies = (schema: DrizzleSchemaType): [string, Table][] => {
    const sorted: [string, Table][] = [];
    const visited = new Set<string>();

    for (const [name, table] of Object.entries(schema)) {
        (function visit(n: string, t: Table): void {
            if (visited.has(n)) return;
            visited.add(n);
            const config = getTableConfig(t);
            const fks = config.foreignKeys;
            for (let i = 0, len = fks.length; i < len; i++) {
                const relatedTable = fks[i].reference().foreignTable;
                visit(getTableName(relatedTable), relatedTable);
            }
            sorted.push([n, t]);
        })(name, table);
    }
    return sorted;
};

const generateFields = (name: string, table: Table): Record<string, GraphQLFieldConfig<any, any>> => {
    const config = getTableConfig(table);
    const fkMap = new Map<string, ForeignKeyInfo>();

    const fks = config.foreignKeys;
    for (let i = 0, len = fks.length; i < len; i++) {
        const fk = fks[i];
        const col = fk.reference().columns[0];
        fkMap.set(col.name, {
            column: col,
            table: fk.reference().foreignTable,
            fieldName: getTableName(fk.reference().foreignTable)
        });
    }

    const fields: Record<string, GraphQLFieldConfig<any, any>> = Object.create(null);
    const cols = config.columns;
    for (const colName in cols) {
        const col = cols[colName];
        const fk = fkMap.get(col.name);
        if (fk) {
            const relatedTableName = getTableName(fk.table);
            const relatedObj = objectTypeBuffer[relatedTableName];
            if (!relatedObj) throw new Error(`Type for ${relatedTableName} not found.`);
            fields[fk.fieldName] = {
                type: new GraphQLNonNull(relatedObj),
                args: {where: {type: getFilterType(relatedTableName, fk.table, "Nested")}},
                resolve: (src: any) => src[fk.fieldName]
            };
        } else {
            fields[col.name] = {type: getGraphQLTypeFromDrizzleColType(col.columnType)};
        }
    }
    return fields;
};

export const createObjectTypes = (schema: DrizzleSchemaType): ObjectTypeBuffer => {
    const sorted = sortTablesByDependencies(schema);
    for (let i = 0, len = sorted.length; i < len; i++) {
        const [name, table] = sorted[i];
        const baseFilter = `${name}Filters`;
        if (!filterTypeBuffer[baseFilter]) {
            filterTypeBuffer[baseFilter] = genInputFiltersFromTable(name, table);
        }
    }
    for (let i = 0, len = sorted.length; i < len; i++) {
        const [name, table] = sorted[i];
        if (!objectTypeBuffer[name]) {
            objectTypeBuffer[name] = new GraphQLObjectType({
                name: `${name}Object`,
                fields: () => generateFields(name, table)
            });
        }
    }
    return objectTypeBuffer;
};

const getFilterType = (name: string, table: Table, prefix = ""): GraphQLInputObjectType => {
    const base = `${name}Filters`;
    const prefixed = `${prefix}${name}Filters`;
    if (filterTypeBuffer[base]) return filterTypeBuffer[base];
    if (!filterTypeBuffer[prefixed]) {
        filterTypeBuffer[prefixed] = genInputFiltersFromTable(name, table, prefix);
    }
    return filterTypeBuffer[prefixed];
};

// ──────────────────────────────────────────────
// SECTION: Query Building
// ──────────────────────────────────────────────

export const buildQuery = (
    table: Table,
    analysis: QueryAnalysisResult | null,
    pagination?: PaginationInputDTO,
    extraConditions?: SQL
) => {
    if (!analysis) throw new Error("Analysis is null");
    const query = db.select(analysis.obj as SelectedFields<any, any>).from(table);
    const totalQuery = db.select({count: count()}).from(table);

    const joinArr = Array.from(analysis.resources.joinTables);
    for (let i = 0, len = joinArr.length; i < len; i++) {
        const jtName = joinArr[i];
        const jt = tables[jtName];
        if (!jt) throw new Error(`Table ${jtName} not found`);
        const mainCfg = getTableConfig(table);
        // TODO: Use first FK for join
        query.leftJoin(
            jt,
            eq(
                mainCfg.foreignKeys[0].reference().columns[0],
                mainCfg.foreignKeys[0].reference().foreignColumns[0]
            )
        );
        totalQuery.leftJoin(
            jt,
            eq(
                mainCfg.foreignKeys[0].reference().columns[0],
                mainCfg.foreignKeys[0].reference().foreignColumns[0]
            )
        );
    }

    const wcEntries = Array.from(analysis.resources.whereConditions.entries());
    const conds: SQL[] = [];
    for (let i = 0, len = wcEntries.length; i < len; i++) {
        const [tName, condObj] = wcEntries[i];
        const t = tables[tName];
        if (!t) throw new Error(`Table ${tName} not found`);
        const parsed = parseWhereFilters(t, condObj);
        if (parsed) conds.push(parsed);
    }
    if (conds.length) {
        if (extraConditions) query.where(and(extraConditions, ...conds));
        else query.where(and(...conds));
        if (extraConditions) totalQuery.where(and(extraConditions, ...conds));
        else totalQuery.where(and(...conds));
    }

    if (pagination) {
        if (pagination.limit) query.limit(pagination.limit);
        if (pagination.offset) query.offset(pagination.offset);
        if (pagination.orderBy) {
            query.orderBy(pagination.orderBy === PaginationOrderByEnum.ASC
                ? asc(table["id"])
                : desc(table["id"]));
        }
    }

    return {
        query,
        totalQuery
    };
};

const parseWhereFilters = (table: Table, filters?: WhereFilterObject): SQL | undefined => {
    if (!filters) return undefined;
    const conds: SQL[] = [];
    for (const colName in filters) {
        const filterObj = filters[colName];
        if (!filterObj) continue;
        const column = table[colName as keyof typeof table] as unknown as Column;
        if (!column) continue;
        for (const op in filterObj) {
            const value = filterObj[op as WhereFilters];
            if (value === undefined || value === null) continue;
            let cond: SQL | undefined;
            switch (op as WhereFilters) {
                case "eq":
                    cond = eq(column, value);
                    break;
                case "gt":
                    cond = gt(column, value);
                    break;
                case "gte":
                    cond = gte(column, value);
                    break;
                case "lt":
                    cond = lt(column, value);
                    break;
                case "lte":
                    cond = lte(column, value);
                    break;
                case "inArray":
                    cond = inArray(column, value as unknown[]);
                    break;
                case "notInArray":
                    cond = notInArray(column, value as unknown[]);
                    break;
                case "like":
                    cond = like(column, value as string);
                    break;
                case "notLike":
                    cond = notLike(column, value as string);
                    break;
                case "ilike":
                    cond = ilike(column, value as string);
                    break;
                case "notIlike":
                    cond = notIlike(column, value as string);
                    break;
                case "isNull":
                    if (value) cond = isNull(column);
                    break;
                case "isNotNull":
                    if (value) cond = isNotNull(column);
                    break;
            }
            if (cond) conds.push(cond);
        }
    }
    return conds.length ? and(...conds) : undefined;
};

// ──────────────────────────────────────────────
// SECTION: GraphQL ResolveInfo Parsing Helpers
// ──────────────────────────────────────────────

export const parseGraphQLResolveInfo = (
    baseObjectName: keyof typeof tables,
    info: GraphQLResolveInfo,
    userRole: Roles,
    maxDepth = 5,
    rootBase = "data"
): QueryAnalysisResult | null => {
    const fieldNodes = info.fieldNodes;
    if (!fieldNodes[0]?.selectionSet?.selections) return null;
    const result: QueryAnalysisResult = {
        obj: {},
        depth: 0,
        resources: {
            tables: new Set<Table>(),
            columns: new Map<string, Set<string>>(),
            joinTables: new Set<string>(),
            whereConditions: new Map<string, WhereFilterObject>()
        }
    };
    const baseWhere = getWhereArgument(fieldNodes[0], info.variableValues);
    const stack: Array<{
        objectName: string;
        selections: readonly any[];
        depth: number;
        parent: ParsedGraphQLResolveInfo;
    }> = [];

    // Find the root "data" field.
    const selections = fieldNodes[0].selectionSet.selections;
    for (let i = 0, len = selections.length; i < len; i++) {
        const sel = selections[i];
        if (sel.kind === Kind.FIELD && sel.name.value === rootBase && sel.selectionSet) {
            stack.push({
                objectName: baseObjectName,
                selections: sel.selectionSet.selections,
                depth: 1,
                parent: result.obj
            });
            result.resources.tables.add(tables[baseObjectName]);
            if (baseWhere) result.resources.whereConditions.set(baseObjectName, baseWhere);
            break;
        }
    }

    while (stack.length) {
        const {objectName, selections, depth, parent} = stack.pop()!;
        const table = tables[objectName];
        if (!table) throw new GraphQLError(`Table ${objectName} not found`);
        if (depth > result.depth) result.depth = depth;
        if (depth > maxDepth) throw new GraphQLError(`Max depth of ${maxDepth} exceeded`);

        for (let i = 0, len = selections.length; i < len; i++) {
            const sel = selections[i];
            if (sel.kind !== Kind.FIELD) continue;
            const fieldName = sel.name.value;
            const col = table[fieldName as keyof typeof table];
            if (sel.selectionSet) {
                const nested: ParsedGraphQLResolveInfo = {};
                parent[fieldName] = nested;
                const nestedWhere = getWhereArgument(sel, info.variableValues);
                const joinedTable = tables[fieldName];
                if (joinedTable) {
                    result.resources.tables.add(joinedTable);
                    result.resources.joinTables.add(fieldName);
                    if (nestedWhere) result.resources.whereConditions.set(fieldName, nestedWhere);
                }
                stack.push({
                    objectName: fieldName,
                    selections: sel.selectionSet.selections,
                    depth: depth + 1,
                    parent: nested
                });
            } else if (col) {
                let setCols = result.resources.columns.get(objectName);
                if (!setCols) {
                    setCols = new Set<string>();
                    result.resources.columns.set(objectName, setCols);
                }
                setCols.add(fieldName);
                parent[fieldName] = col;
            }
        }
    }

    const authErr = authorizeQuery(result.resources, userRole);
    if (authErr) throw authErr;
    return result.depth > 0 ? result : null;
};

const getWhereArgument = (
    field: any & { arguments?: readonly any[] },
    variables: Record<string, any>
): WhereFilterObject | undefined => {
    if (!field.arguments?.length) return undefined;
    const arg = field.arguments.find((a: any) => a.name.value === 'where');
    if (!arg) return undefined;
    if (arg.value.kind === Kind.VARIABLE) return variables[arg.value.name.value];
    if (arg.value.kind === Kind.OBJECT) return parseWhereObject(arg.value, variables);
    return undefined;
};

const parseWhereObject = (obj: any, variables: Record<string, any>): WhereFilterObject => {
    const res: WhereFilterObject = {};
    const fields = obj.fields;
    for (let i = 0, len = fields.length; i < len; i++) {
        const f = fields[i];
        const key = f.name.value;
        const value = f.value;
        if (value.kind === Kind.OBJECT) {
            res[key] = parseWhereObject(value, variables);
        } else if (value.kind === Kind.VARIABLE) {
            res[key] = variables[value.name.value];
        } else {
            res[key] = value.value;
        }
    }
    return res;
};

// ──────────────────────────────────────────────
// SECTION: Schema Generation & Utility Functions
// ──────────────────────────────────────────────

export function generateSchemaData<T extends DrizzleSchemaType>(schema: T) {
    createObjectTypes(schema);
    const filters: Record<keyof T, GraphQLInputObjectType> = {} as any;
    const types: Record<keyof T, GraphQLObjectType> = {} as any;
    for (const name in schema) {
        const table = schema[name];
        const objType = objectTypeBuffer[name];
        if (!objType) throw new Error(`GraphQL type for ${name} is undefined.`);
        types[name] = objType;
        filters[name] = genInputFiltersFromTable(name, table);
    }
    return {types, filters};
}

const authorizeQuery = (resources: QueryAnalysisResult["resources"], role: Roles): GraphQLError | null => {
    const perms = rolePermissions[role];
    for (const t of resources.tables) {
        if (!perms.allowedTables.has("*") && !perms.allowedTables.has(t)) {
            return new GraphQLError(`Unauthorized access to table: ${t}`);
        }
    }
    for (const [t, cols] of resources.columns) {
        const allowed = perms.allowedColumns.get(t) || perms.allowedColumns.get("*");
        if (!allowed) return new GraphQLError(`Unauthorized access to table: ${t}`);
        if (!allowed.has("*")) {
            for (const col of cols) {
                if (!allowed.has(col)) return new GraphQLError(`Unauthorized access to column: ${t}.${col}`);
            }
        }
    }
    return null;
};

export async function runQuery<T>(
    queries: {
        query: PgSelectBase<any, any, any>,
        totalQuery: PgSelectBase<string, { count: SQL<number> }, "partial", Record<string, "not-null">, false, never, {
            count: number
        }[], {
            count: DrizzleTypeError<"You cannot reference this field without assigning it an alias first - use `.as(<alias>)`">
        }>
    },
    pagination?: PaginationInputDTO
) {
    const {query, totalQuery} = queries;

    const [results, [{count}]] = await Promise.all([query.execute(), totalQuery.execute()]);

    const offset = pagination?.offset || 0;
    const limit = pagination?.limit || 0;
    const nextOffset = offset + limit;
    const hasMore = pagination ? nextOffset < count : false;
    const total = count;

    return {
        data: results as unknown as T[],
        pagination: {
            nextOffset,
            total,
            hasMore
        }
    }
}