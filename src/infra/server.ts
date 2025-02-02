import {ApolloServer} from "@apollo/server";
import {schema} from "../graphql/schema.ts";
import type {Context} from "../core/context.ts";

export const server = new ApolloServer<Context>({schema})