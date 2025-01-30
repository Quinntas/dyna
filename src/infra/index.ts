import {startStandaloneServer} from "@apollo/server/standalone";
import {server} from "./server.ts";
import {env} from "../utils/env.ts";

startStandaloneServer(server, {
    listen: {
        port: env.PORT
    }
})
    .then(({url}) => console.log(`🚀 Server ready at ${url}`))
    .catch(err => console.error(err));