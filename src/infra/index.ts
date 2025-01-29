import {startStandaloneServer} from "@apollo/server/standalone";
import {server} from "./server.ts";

startStandaloneServer(server)
    .then(({url}) => console.log(`🚀 Server ready at ${url}`))
    .catch(err => console.error(err));