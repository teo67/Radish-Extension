const { baseScope } = require('../global.js');
const findInScope = (target, scope, bs = null) => {
    for(const vari of scope.vars) {
        if(vari.inner.label == target) {
            return vari;
        }
    }
    if(scope.enclosing !== null) {
        return findInScope(target, scope.enclosing, bs);
    }
    for(const vari of (bs === null ? baseScope : bs)) {
        if(vari.inner.label == target) {
            return vari;
        }
    }
    return null;
}
module.exports = findInScope;