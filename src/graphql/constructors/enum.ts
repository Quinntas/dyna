import {GraphQLEnumType} from 'graphql/type';

export function newEnumType(name: string, e: {[s: number]: string}) {
    const vals = Object.getOwnPropertyNames(e);

    return new GraphQLEnumType({
        name: name,
        values: Object.assign(
            {},
            ...vals.map( (val) => {
                return {
                    [val]: {
                        value: val,
                    },
                };
            }),
        ),
    });
}
