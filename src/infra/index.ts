import {startStandaloneServer} from "@apollo/server/standalone";
import {server} from "./server.ts";
import {env} from "../utils/env.ts";


startStandaloneServer(server, {
    listen: {
        port: env.PORT,
    },
    context: async (integrationContext) => {
        const token = integrationContext.req.headers.authorization

        if (!token) throw new Error('Unauthorized')

        const split = token.split(' ')

        if (split.length !== 2) throw new Error('Unauthorized')

        const [type, tokenValue] = split

        if (type !== 'Bearer') throw new Error('Unauthorized')

        return {
            token: tokenValue
        }
    }
})
    .then(({url}) => console.log(`🚀 Server ready at ${url}`))
    .catch(err => console.error(err));