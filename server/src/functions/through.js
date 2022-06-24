const { baseScope } = require('../global.js');
const isInScope = require('./isInScope.js');
const through = (scope, position, list = true) => {
    let returning = [];
    let blacklist = [];
    for(const inner of scope.innerscopes) {
        if(!isInScope(position, inner)) {
            continue;
        }
        if(!list) {
            return through(inner, position, false);
        }
        const returned = through(inner, position);
        for(const ret of returned) {
            returning.push(ret);
            blacklist.push(ret.inner.label);
        }
        break;
    }
    if(list) {
        for(const vari of scope.vars) {
            if(!vari.ignore && !blacklist.includes(vari.inner.label)) {
                returning.push(vari);
            }
        }
    }
    if(!list) {
        return scope;
    }
    return returning.concat(baseScope);
}
module.exports = through;