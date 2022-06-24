const handleDependency = require('./handleDependency.js').run;
module.exports = (constr, operations) => {
    if(constr.evaluated) {
        return;
    }
    constr.evaluated = true; // if you implied a constructor
    for(const _dep of constr.deps) {
        handleDependency(_dep, operations);
    }
}