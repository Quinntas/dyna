import {Kind} from 'graphql/language';
import {GraphQLScalarType} from 'graphql/type';

export const dateScalar = new GraphQLScalarType({
    name: 'Date',
    description: 'Date custom scalar type',
    serialize(value) {
        if (!(value instanceof Date)) throw new Error('Date is not an instance of Date');
        return value.toISOString();
    },
    parseValue(value) {
        if (!(value instanceof Date)) throw new Error('Date is not an instance of Date');
        return new Date(value);
    },
    parseLiteral(ast) {
        if (ast.kind !== Kind.STRING) return null;
        return new Date(ast.value);
    },
});
