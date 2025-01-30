import {GraphQLError, type GraphQLResolveInfo, type SelectionNode} from 'graphql';
import {Kind} from 'graphql/language';
import type {Column} from "drizzle-orm";
import {tables} from "../graphql/tables.ts";
import {rolePermissions, type Roles} from "../infra/rbac.ts";

export type QueryAnalysisResult = {
    obj: ParsedGraphQLResolveInfo;
    depth: number;
    resources: {
        tables: Set<string>;
        columns: Map<string, Set<string>>;
    };
};

export type ParsedGraphQLResolveInfo = {
    [key: string]: Column | ParsedGraphQLResolveInfo;
};

export function parseGraphQLResolveInfo(
    baseObjectName: keyof typeof tables,
    maxDepth: number,
    info: GraphQLResolveInfo,
    userRole: Roles,
): QueryAnalysisResult | null {
    const fieldNodes = info.fieldNodes;
    if (!fieldNodes[0]?.selectionSet?.selections) return null;

    const stack: Array<{
        objectName: string;
        selections: readonly SelectionNode[];
        currentDepth: number;
        parentObj: ParsedGraphQLResolveInfo;
    }> = [];

    const result: QueryAnalysisResult = {
        obj: {},
        depth: 0,
        resources: {
            tables: new Set<string>(),
            columns: new Map<string, Set<string>>(),
            joinTables: new Set<string>(),
        },
    };

    // Initialize stack with base selections
    for (const selection of fieldNodes[0].selectionSet.selections) {
        if (selection.kind === Kind.FIELD && selection.name.value === 'data' && selection.selectionSet) {
            stack.push({
                objectName: baseObjectName,
                selections: selection.selectionSet.selections,
                currentDepth: 1,
                parentObj: result.obj,
            });
            result.resources.tables.add(baseObjectName);
            break;
        }
    }

    while (stack.length > 0) {
        const {objectName, selections, currentDepth, parentObj} = stack.pop()!;
        const table = tables[objectName];

        if (!table) {
            throw new GraphQLError(`Table ${objectName} not found`);
        }

        // Update max depth tracking
        if (currentDepth > result.depth) {
            result.depth = currentDepth;
        }

        // Check depth limit before processing
        if (currentDepth > maxDepth) {
            throw new GraphQLError(`Max depth of ${maxDepth} exceeded`);
        }

        for (const selection of selections) {
            if (selection.kind !== Kind.FIELD) continue;

            const fieldName = selection.name.value;
            const column = table[fieldName as keyof typeof table];

            if (selection.selectionSet) {
                // Handle nested resource
                const nestedObj: ParsedGraphQLResolveInfo = {};
                parentObj[fieldName] = nestedObj;

                // Track joined tables
                const joinedTable = tables[fieldName];
                if (joinedTable) {
                    result.resources.tables.add(fieldName);
                    result.resources.joinTables.add(fieldName);
                }

                stack.push({
                    objectName: fieldName,
                    selections: selection.selectionSet.selections,
                    currentDepth: currentDepth + 1,
                    parentObj: nestedObj,
                });
            } else if (column) {
                // Track column usage
                if (!result.resources.columns.has(objectName)) {
                    result.resources.columns.set(objectName, new Set<string>());
                }
                result.resources.columns.get(objectName)!.add(fieldName);

                // Add column to result object
                parentObj[fieldName] = column as Column;
            }
        }
    }

    const authError = authorizeQuery(result.resources, userRole);

    if (authError)
        throw authError;

    return result.depth > 0 ? result : null;
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