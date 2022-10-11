const passInRT = require('./passInRT.js').run;
const findInVariable = require('./findInVariable.js');
const checkVar = require('./checkVar.js');
const Variable = require('../classes/Variable.js');
const findInScope = require('./findInScope.js');
const global = require('../global.js');
const CompletionItemKind = global.server2.CompletionItemKind;
const ReturnType = require('../classes/ReturnType.js');
const handleDependency = (dep, operations) => {
    // console.log('starting');
    // console.log(dep.target.raw);
    // console.log(dep.find.raw);
    if(dep.handled) {
        //console.log('alr handled');
        return; // this could save some time
    }
    let found; 
    let foundTarget;
    if(dep.target != "SKIP") {
        found = passInRT(operations, dep, dep.target, true);
        if(found === null) { // no var or failed somewhere
            //console.log('no found');
            return;
        }
        foundTarget = found[found.length - 1];
        if(foundTarget.evaluated || (foundTarget.lock && !dep.override)) { // already eval'd
            //console.log('alr evald');
            return;
        }
    }
    let foundSet = passInRT(operations, dep, dep.find);
    if(foundSet === null) { 
        //console.log('no set');
        return;
    }
    if(!checkVar(foundSet[foundSet.length - 1], dep)) { // if null or not eval'd, etc  
        //console.log('set not evald');
        return;
    }
    //console.log('success');
    foundSet = foundSet[foundSet.length - 1];
    if(dep.find.type == CompletionItemKind.Class && dep.target == "SKIP") {
        let construct = null;
        for(let i = 0; i < foundSet.properties.length; i++) {
            if(foundSet.properties[i].inner.label == "constructor") {
                construct = foundSet.properties[i];
                if(construct === null) {
                    return;
                }
                if(!checkVar(construct, dep)) {
                    return;
                }
                foundSet.properties.splice(i, 1);
                break;
            }
        }
        const saved = foundSet; 
        foundSet = construct;
        let proto = findInVariable("prototype", foundSet.properties, foundSet.inherited);
        if(proto === null) {
            proto = new Variable("prototype", CompletionItemKind.Variable);
            proto.inner.detail = "[object]";
            proto.evaluated = true;
            foundSet.properties.push(proto);
            exporting.dep(operations, foundSet, proto);
        }
        for(const newprop of saved.properties) {
            if(newprop.isStatic) {
                foundSet.properties.push(newprop);
                exporting.dep(operations, foundSet, newprop);
            } else {
                proto.properties.push(newprop);
                exporting.dep(operations, proto, newprop);
            }
        }
        
        proto.inherited = saved.inherited === null ? operations.protos.Object : saved.inherited;
        dep.handled = true;
        return;
    }
    if(dep.find.linkedscope !== null) {
        if(found.length > 1) {
            const _this = findInScope("this", dep.find.linkedscope);
            if(_this !== null) {
                _this.inner.detail = "[object]";
                _this.properties = found[found.length - 2].properties;
                _this.inherited = found[found.length - 2].inherited;// === null ? global.protos.OBJECT : found[found.length - 2].inherited;
                _this.evaluated = true;
                _this.ignore = false;
                for(const _dep of _this.deps) {
                    handleDependency(_dep, operations);
                }
            }
        }
        if(foundTarget.addsuper) {
            let _super = passInRT(operations, dep, foundTarget.addsuper);
            if(_super === null) { 
                return;
            }
            _super = _super[_super.length - 1];
            if(!checkVar(_super, dep)) { // if null or not eval'd, etc  
                return;
            }
            const supervar = findInScope("super", dep.find.linkedscope); 
            if(supervar !== null) {
                supervar.inner.detail = _super.inner.detail;
                supervar.properties = _super.properties;
                supervar.inherited = _super.inherited;
                supervar.inner.kind = CompletionItemKind.Function;
                supervar.evaluated = true;
                supervar.ignore = false;
                supervar.params = _super.params;
                supervar.returns = _super.returns;
                for(const _dep of supervar.deps) {
                    handleDependency(_dep, operations);
                }
            }
        }
    }
    
    foundTarget.inherited = foundSet.inherited;
    foundTarget.properties = foundSet.properties;
    if(foundSet.inner.detail.length == 0) {
        if(foundTarget.inner.detail.length == 0) {
            foundTarget.inner.detail = '[variable]';
        }
    } else {
        foundTarget.inner.detail = foundSet.inner.detail;
    }
    const kind = (dep.find.type == ReturnType.Reference ? foundSet.inner.kind : dep.find.type);
    if(kind != CompletionItemKind.Variable && kind != CompletionItemKind.Field) {
        foundTarget.inner.kind = kind; // no need to set if variable (otherwise messes with parameters)
    }
    if(foundSet.returns !== null) {
        foundTarget.returns = foundSet.returns;
        for(const _dep of foundTarget.returndeps) {
            handleDependency(_dep, operations);
        }
    }
    if(foundTarget == operations.protos.Object) {
        foundTarget.inherited = null; // #ExceptionThatProvesTheRule amiright
    }
    foundTarget.ignore = false;
    foundTarget.evaluated = true;
    if(dep.target.documentation !== undefined) {
        if(foundTarget.inner.documentation.length == 0) {
            foundTarget.inner.documentation = dep.target.documentation[0];
        }
        if(Object.keys(foundTarget.params).length == 0) {
            foundTarget.params = dep.target.documentation[1];
        }
    }
    dep.handled = true;
    
    for(const dep of foundTarget.deps) {
        handleDependency(dep, operations);
    }
    return;
}

const exporting = {
    run: handleDependency, 
    dep: null
};
module.exports = exporting;