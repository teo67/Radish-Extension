const checkVar = require('./checkVar.js');
const findInVariable = require('./findInVariable.js');
const getInherited = (rt, dep, playground = false) => {
    //console.log('getting inherited to ' + rt.raw);
    let inherited = exporting.dep(dep, rt);
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