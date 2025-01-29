import {GraphQLError, type GraphQLResolveInfo, type SelectionNode} from 'graphql/index';
import {Kind} from 'graphql/language';
import type {Column} from "drizzle-orm";
import {tables} from "../graphql/tables.ts";

type ParsedGraphQLResolveInfo = {
    [key: string]: Column | ParsedGraphQLResolveInfo;
};

function getPropertiesFromSelectionSet(
    objectName: string,
    selections: readonly SelectionNode[],
    depth: number,
) {
    let obj: ParsedGraphQLResolveInfo = {};
    for (let i = 0; i < selections.length; i++) {
        const val = selections[i];
        if (val.kind !== Kind.FIELD) continue;
        if (!val.selectionSet) {
            const table = tables[objectName];
            if (!table) throw new GraphQLError(`Table ${table} not found`);
            Object.assign(obj, {
                // @ts-ignore - TODO: fix this
                [selections[i].name.value]: table[selections[i].name.value],
            });
        } else {
            const res = getPropertiesFromSelectionSet(
                val.name.value,
                val.selectionSet!.selections,
                depth + 1,
            );
            obj[val.name.value] = res.obj;
            depth = res.depth;
        }
    }
    return {
        obj,
        depth,
    };
}

export function parseGraphQLResolveInfo(
    baseObjectName: string,
    maxDepth: number,
    data: GraphQLResolveInfo,
) {
    const len: number = data.fieldNodes[0].selectionSet?.selections.length || 0;

    if (len === 0) return null;

    let baseSelectionSet = null;

    for (let i = 0; i < len; i++) {
        const val = data.fieldNodes[0].selectionSet!.selections[i];
        if (!val) continue;
        if (val.kind !== Kind.FIELD) continue;
        if (val.name.value != 'data') continue;
        baseSelectionSet = val;
    }

    if (!baseSelectionSet) return null;
    const subSelectionSet = baseSelectionSet.selectionSet;

    if (!subSelectionSet) return null;
    const res = getPropertiesFromSelectionSet(baseObjectName, subSelectionSet.selections, 1);

    if (res.depth > maxDepth)
        throw new GraphQLError(`Max depth exceeded. Max depth is ${maxDepth}`);

    return res.obj;
}
