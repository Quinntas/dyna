import {
    type GraphQLFieldConfig,
    type GraphQLInputFieldConfig,
    GraphQLObjectType,
    type GraphQLResolveInfo,
    type ThunkObjMap,
} from 'graphql';

export abstract class Resolver<Context, Input, Output> {
    private readonly _output: GraphQLObjectType;
    private readonly _input: ThunkObjMap<GraphQLInputFieldConfig> | undefined;

    // TODO: fix this type
    get type(): any {
        return {
            [this._name]: {
                description: this._description,
                type: this._output,
                args: this._input,
                // TODO: try catch this
                resolve: (
                    root: null,
                    args: Input,
                    context: Context,
                    resolveInfo: GraphQLResolveInfo,
                ) => {
                    return this.handle(root, args, context, resolveInfo);
                },
            },
        };
    }

    protected constructor(
        private readonly _name: string,
        private readonly _description: string,
        output: ThunkObjMap<GraphQLFieldConfig<any, any>>,
        input?: ThunkObjMap<GraphQLInputFieldConfig>,
    ) {
        const outputName = `${_name}Output`;
        this._output = new GraphQLObjectType({
            name: outputName,
            description: _description,
            fields: output,
        });
        this._input = input;
    }

    protected abstract handle(
        root: null,
        input: Input,
        context: Context,
        resolveInfo: GraphQLResolveInfo,
    ): Output | Promise<Output>;
}
