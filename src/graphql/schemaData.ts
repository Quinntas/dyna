import {generateSchemaData} from "../core/dyna.ts";
import {tables} from "./tables.ts";

export const graphqlSchemaData = generateSchemaData(tables)
