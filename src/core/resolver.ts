import {type GraphQLInputFieldConfig, GraphQLObjectType, type GraphQLResolveInfo, type ThunkObjMap,} from 'graphql';
import {GraphQLError, GraphQLList} from "graphql/index";

export abstract class Resolver<Context, Input, Output> {
    private readonly _output: GraphQLList<any> | GraphQLObjectType;
    private readonly _input: ThunkObjMap<GraphQLInputFieldConfig> | undefined;

    // TODO: fix this type
    get type(): any {
        return {
            [this._name]: {
                description: this._description,
                type: this._output,
                args: this._input,
                resolve: (
                    root: null,
                    args: Input,
                    context: Context,
                    resolveInfo: GraphQLResolveInfo,
                ) => {
                    try {
                        return this.handle(root, args, context, resolveInfo);
                    } catch (e: unknown) {
                        console.error(e)
                        if (e instanceof Error)
                            throw new GraphQLError(e.message);
                    }
                },
            },
        };
    }

    protected constructor(
        private readonly _name: string,
        private readonly _description: string,
        output: GraphQLList<any> | GraphQLObjectType,
        input?: ThunkObjMap<GraphQLInputFieldConfig>,
    ) {
        this._output = output;
        this._input = input;
    }

    protected abstract handle(
        root: null,
        input: Input,
        context: Context,
        resolveInfo: GraphQLResolveInfo,
    ): Output | Promise<Output>;
}
