const { cached } = require('./global');
module.exports = change => {
    const stored = cached[change.textDocument.uri];
    if(stored === undefined) {
        return {data:[]};
    }
    return {
        data: stored.tokens
    };
}