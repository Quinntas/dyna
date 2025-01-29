import {ApolloServer} from "@apollo/server";
import {schema} from "../graphql/schema.ts";

export const server = new ApolloServer({schema})