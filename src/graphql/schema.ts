import {buildSchema, GraphQLObjectType, GraphQLSchema} from 'graphql';
import {readFileSync} from 'node:fs';
import {usersResolver} from '../resolvers/users';

function getSchema(): GraphQLSchema {
    if (process.env.NODE_ENV === 'development')
        return new GraphQLSchema({
            query: new GraphQLObjectType({
                name: 'Query',
                fields: {
                    ...usersResolver.type,
                },
            }),
        });

    const schemaFile = readFileSync('./schema.graphql', 'utf-8');

    return buildSchema(schemaFile);
}

export const schema = getSchema();
