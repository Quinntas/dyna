import {buildSchema, GraphQLObjectType, GraphQLSchema} from 'graphql';
import {readFileSync} from 'node:fs';
import {env} from "../utils/env.ts";
import {usersResolver} from "../resources/user/resolvers";


function getSchema(): GraphQLSchema {
    if (env.NODE_ENV === 'development')
        return new GraphQLSchema({
            query: new GraphQLObjectType({
                name: 'Query',
                fields: {
                    ...usersResolver.type
                },
            }),
        });

    const schemaFile = readFileSync('./schema.graphql', 'utf-8');

    return buildSchema(schemaFile);
}

export const schema = getSchema();
