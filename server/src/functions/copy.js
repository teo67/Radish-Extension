const Variable = require('../classes/Variable.js');
const copy = (vari, previous = new Map()) => { // we copy so that files cannot permanently edit the standard library objects
    const gotten = previous.get(vari);
    if(gotten !== undefined) {
        //console.log('skipping ' + vari.inner.label);
        return gotten;
    }
    //console.log('making new ' + vari.inner.label);
    const n = new Variable(vari.inner.label, vari.inner.kind, vari.inner.detail, vari.inner.documentation);
    previous.set(vari, n);
    for(const prop of vari.properties) {
        n.properties.push(copy(prop, previous));
    }
    if(vari.inherited !== null) {
        n.inherited = copy(vari.inherited, previous);
    }
    n.evaluated = true;
    n.isStatic = vari.isStatic;
    for(const key of Object.keys(vari.params)) {
        n.params[key] = vari.params[key];
    }
    if(vari.returns !== null) {
        n.returns = copy(vari.returns, previous);
    }
    return n;
}
const copyarr = arr => {
    const previous = new Map();
    const returning = [];
    for(const vari of arr) {
        returning.push(copy(vari, previous));
    }
    return returning;
}
module.exports = copyarr;