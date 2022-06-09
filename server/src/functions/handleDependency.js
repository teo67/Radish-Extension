const passInRT = require('./passInRT.js').run;
const findInVariable = require('./findInVariable.js');
const checkVar = require('./checkVar.js');
const Variable = require('../classes/Variable.js');
const findInScope = require('./findInScope.js');
const { constructordependencies, server2 } = require('../global.js');
const CompletionItemKind = server2.CompletionItemKind;
const ReturnType = require('../classes/returnType.js');
const handleDependency = (dep) => {
    //console.log('started: ' + `dep ${dep.target.raw}, ${dep.find.raw}`);
    //console.log(dep.target.raw);
    if(dep.handled) {
        return; // this could save some time
    }
    //console.log(`dep ${dep.target.raw}, ${dep.find.raw}`)
    //console.log('passing');
    const found = passInRT(dep, dep.target, true);
    
    if(found === null) { // no var or failed somewhere
        //console.log("not found")
        return;
    }
    //console.log("found = " + found[0].evaluated);
    //console.log("length = " + found.length);
    //console.log("foundtarget = " + found[found.length - 1]);
    const foundTarget = found[found.length - 1];
    if(foundTarget.evaluated) { // already eval'd
        //console.log("already evaluated")
        return;
    }
    //console.log("found target successfully");
    let foundSet = passInRT(dep, dep.find);
    if(foundSet === null) {
        //console.log("no set");
        return;
    }
    if(!checkVar(foundSet[foundSet.length - 1], dep)) { // if null or not eval'd, etc
        //console.log('set cancel');
        return;
    }
    //console.log("found!");
    foundSet = foundSet[foundSet.length - 1];

    //console.log(`made it past everything on ${dep.target.raw}`);
    if(dep.find.type == CompletionItemKind.Class) {
        const construct = findInVariable("constructor", foundSet.properties, null);
        if(construct !== null) { // this should pretty much always be true
            constructordependencies.push(construct);
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
            //console.log(newprop);
            if(newprop.isStatic) {
                foundSet.properties.push(newprop);
                exporting.dep(foundSet, newprop);
            } else {
                proto.properties.push(newprop);
                exporting.dep(proto, newprop);
                //console.log(newprop.inner.label);
            }
        }
        
        proto.inherited = saved.inherited;
    }
    if(dep.find.linkedscope !== null) {
        if(found.length > 1) {
            const _this = findInScope("this", dep.find.linkedscope);
            //console.log("this!!");
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
                        realSuper.inner.detail = _super.inner.detail;
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
    //console.log('success: ' + `dep ${dep.target.raw}, ${dep.find.raw}`);
    //console.log("found set successfully");
    foundTarget.inherited = foundSet.inherited;
    for(const prop of foundSet.properties) {
        foundTarget.properties.push(prop); // transfer props manually to keep pointers to scope
        exporting.dep(foundTarget, prop);
    }
    foundTarget.inner.detail = foundSet.inner.detail;
    
    foundTarget.inner.kind = (dep.find.type == ReturnType.Reference ? foundSet.inner.kind : dep.find.type);
    if(foundSet.inner.returns !== null) {
        foundTarget.inner.returns = foundSet.inner.returns;
        for(const _dep of foundTarget.returndeps) {
            handleDependency(_dep);
        }
    }
    foundTarget.ignore = false;
    foundTarget.evaluated = true;
    dep.handled = true;
    //console.log("about to run deps");
    for(const dep of foundTarget.deps) {
        //console.log("running dep: " + dep.target.raw);
        handleDependency(dep);
    }
    
    return;
}

const exporting = {
    run: handleDependency, 
    dep: null
};
module.exports = exporting;