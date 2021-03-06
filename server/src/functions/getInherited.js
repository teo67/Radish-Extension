const checkVar = require('./checkVar.js');
const findInVariable = require('./findInVariable.js');
const getInherited = (operations, rt, dep, playground = false) => {
    let inherited = exporting.dep(operations, dep, rt);
    if(inherited === null) {
        // didnt work
        return null;
    }
    inherited = inherited[inherited.length - 1];
    if(!checkVar(inherited, dep, null, "", playground)) {
        return null;
    }
    const asProto = findInVariable("prototype", inherited.properties, null);
    if(asProto === null) {
        return inherited;
    }
    if(!checkVar(asProto, dep, inherited, "prototype", playground)) {
        // wait for it
        return null;
    }
    // we chillin
    return asProto;
}

const exporting = {
    run: getInherited, 
    dep: null
};
module.exports = exporting;
