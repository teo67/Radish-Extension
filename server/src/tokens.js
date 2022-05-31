const { cached } = require('./global');
const Response = require('./Response.js');
const tokens = new Response(change => {
    const stored = cached[change.textDocument.uri];
    if(stored === undefined) {
        return {data:[]};
    }
    return {
        data: stored.tokens
    };
}, "tokens", {data:[]});
module.exports = tokens;