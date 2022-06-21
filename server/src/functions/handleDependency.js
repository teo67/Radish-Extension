const passInRT = require('./passInRT.js').run;
const findInVariable = require('./findInVariable.js');
const checkVar = require('./checkVar.js');
const Variable = require('../classes/Variable.js');
const findInScope = require('./findInScope.js');
const global = require('../global.js');
const CompletionItemKind = global.server2.CompletionItemKind;
const ReturnType = require('../classes/ReturnType.js');
const handleDependency = (dep) => {
    if(dep.handled) {
        return; // this could save some time
    }
    const found = passInRT(dep, dep.target, true);
    
    if(found === null) { // no var or failed somewhere
        return;
    }
    const foundTarget = found[found.length - 1];
    if(foundTarget.evaluated && !dep.override) { // already eval'd
        return;
    }
    let foundSet = passInRT(dep, dep.find);
    if(foundSet === null) { 
        return;
    }
    if(!checkVar(foundSet[foundSet.length - 1], dep)) { // if null or not eval'd, etc  
        return;
    }
    foundSet = foundSet[foundSet.length - 1];
    if(dep.find.type == CompletionItemKind.Class) {
        const construct = findInVariable("constructor", foundSet.properties, null);
        if(construct !== null) { // this should pretty much always be true
            global.currentOperator.constructordependencies.push(construct);
        }
        const saved = foundSet; 
        foundSet = construct;
        if(!checkVar(construct, dep)) {
            return;
        } 
        let proto = findInVariable("prototype", foundSet.properties, foundSet.inherited);
        if(proto === null) {
            proto = new Variable("prototype", CompletionItemKind.Variable);
            proto.inner.detail = "[prototype object]";
            proto.evaluated = true;
            foundSet.properties.push(proto);
            exporting.dep(foundSet, proto);
        }
        for(const newprop of saved.properties) {
            
            if(newprop.isStatic) {
                foundSet.properties.push(newprop);
                exporting.dep(foundSet, newprop);
            } else {
                proto.properties.push(newprop);
                exporting.dep(proto, newprop);
            }
        }
        
        proto.inherited = saved.inherited;
    }
    if(dep.find.linkedscope !== null) {
        if(found.length > 1) {
            const _this = findInScope("this", dep.find.linkedscope);
            
            if(_this !== null) {
                const _super = found[found.length - 2].inherited !== null ? findInVariable("constructor", found[found.length - 2].inherited.properties, null) : null;
                if(_super !== null && !checkVar(_super, dep)) { // if there is a constructor but it isn't evaluated, save it
                    return;
                } 
                _this.inner.detail = "[object reference]";
                _this.properties = found[found.length - 2].properties;
                _this.inherited = found[found.length - 2].inherited;
                for(const newprop of _this.properties) {
                    exporting.dep(_this, newprop);
                }
                if(_super !== null) {
                    const realSuper = findInScope("super", dep.find.linkedscope);
                    if(realSuper !== null) {
                        realSuper.evaluated = true;
                        realSuper.ignore = false;
                        realSuper.properties = _super.properties;
                        for(const newprop of realSuper.properties) {
                            exporting.dep(realSuper, newprop);
                        }
                        realSuper.inherited = _super.inherited;
                        realSuper.inner.detail = _super.inner.detail.length == 0 ? "[variable]" : _super.inner.detail;
                        for(const _dep of realSuper.deps) {
                            handleDependency(_dep);
                        }
                    }
                }
                _this.evaluated = true;
                _this.ignore = false;
                for(const _dep of _this.deps) {
                    handleDependency(_dep);
                }
            }
        } else if(foundTarget.inner.label != "constructor") {
            const _super = findInScope("super", dep.find.linkedscope);
            _super.ignore = true;
            _super.evaluated = true; // cancel all possible deps on super, we're not gonna use it
        }
    } 
    
    
    foundTarget.inherited = foundSet.inherited;
    for(const prop of foundSet.properties) {
        foundTarget.properties.push(prop); // transfer props manually to keep pointers to scope
        exporting.dep(foundTarget, prop);
    }
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
            handleDependency(_dep);
        }
    }
    foundTarget.ignore = false;
    foundTarget.evaluated = true;
    dep.handled = true;
    
    for(const dep of foundTarget.deps) {
        handleDependency(dep);
    }
    return;
}

const exporting = {
    run: handleDependency, 
    dep: null
};
module.exports = exporting;