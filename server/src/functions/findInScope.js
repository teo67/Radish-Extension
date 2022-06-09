const findInScope = (target, scope) => {
    for(const vari of scope.vars) {
        if(vari.inner.label == target) {
            return vari;
        }
    }
    if(scope.enclosing !== null) {
        return findInScope(target, scope.enclosing);
    }
    return null;
}
module.exports = findInScope;