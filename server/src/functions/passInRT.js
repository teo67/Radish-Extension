const passInRT = (dep, rt, propertycreation = false) => {
    //console.log('getting ' + rt.raw);
    return exporting.dep(dep, dep.reference, rt.raw, rt.baseScope, rt.inherited, rt.linkedscope, rt.imported, rt.detail, propertycreation);
}

const exporting = {
    run: passInRT, 
    dep: null
};
module.exports = exporting;