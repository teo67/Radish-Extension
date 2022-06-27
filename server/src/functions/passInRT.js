const passInRT = (operations, dep, rt, propertycreation = false) => {
    return exporting.dep(operations, dep, dep.reference, rt.raw, rt.baseScope, rt.inherited, rt.linkedscope, rt.imported, rt.detail, propertycreation);
}

const exporting = {
    run: passInRT, 
    dep: null
};
module.exports = exporting;