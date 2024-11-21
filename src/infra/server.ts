import {createServer} from "node:http";
import {httpHandler} from "../lib/httpHandler.ts";
import {schema} from "../graphql/schema.ts";

export const server = createServer((req, res) => httpHandler(schema, req, res));
