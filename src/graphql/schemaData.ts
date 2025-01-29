import {tables} from "./tables.ts";
import {generateSchemaData} from "../core/dyna.ts";

export const graphqlSchemaData = generateSchemaData(tables)
