const { baseScope } = require('../global.js');
const findInScope = (target, scope) => {
    for(const vari of scope.vars) {
        if(vari.inner.label == target) {
            return vari;
        }
    }
    if(scope.enclosing !== null) {
        return findInScope(target, scope.enclosing);
    }
    for(const vari of baseScope) {
        if(vari.inner.label == target) {
            return vari;
        }
    }
    return null;
}
module.exports = findInScope;