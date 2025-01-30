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