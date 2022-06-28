const { cached, assessTime } = require('../global');
const Response = require('./Response.js');
const tokens = new Response(async change => {
    const stored = cached[change.textDocument.uri];
    if(stored === undefined) {
        return {data:[]};
    }
    const currentVers = stored.ref.version;
    let stamp = stored.stamp;
    let numWaits = 0;
    while(currentVers > stamp) {
        //console.log("token request is waiting for an updated array of tokens from the latest assess request...");
        await new Promise((resolve, reject) => setTimeout(resolve, assessTime * 2));
        numWaits++;
        if(numWaits > 10) {
            console.log("Token request cancelled, could not find updated token array!");
            return {data:[]};
        }
        stamp = stored.stamp;
    }
    return {
        data: stored.tokens
    };
}, "tokens", {data:[]});
module.exports = tokens;