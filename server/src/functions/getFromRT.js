const Variable = require('../classes/Variable.js');
const findInScope = require('./findInScope.js');
const checkVar = require('./checkVar.js');
const findInVariable = require('./findInVariable.js');
const propertyStuff = require('./propertyStuff.js').run;
const CompletionItemKind = require('../global.js').server2.CompletionItemKind;
const getFromRT = (dep, ref, raw, baseScope, inherited = null, linkedscope = null, imported = null, detail = "", propertycreation = false, playground = false) => { // false = cancel
    console.log(raw);
    let _inherited = null;
    if(inherited !== null) {
        _inherited = exporting.dep(inherited, dep, playground);
        if(_inherited === null) {
            return null;
        }
    }
    let currentVar = null;
    let before = [];
    let ignoreFirst = false;
    if(imported !== null) {
        currentVar = imported;
    } else if(baseScope === null) { 
        if(raw.length == 0) {
            currentVar = new Variable("", CompletionItemKind.Variable); // return a blank variable
            currentVar.evaluated = true;
            currentVar.inner.detail = detail;
            if(linkedscope !== null) {
                currentVar.returns = linkedscope.returns;
            }
        } else {
            if(linkedscope !== null && raw[0] == "()") {
                currentVar = linkedscope.returns;
            } else {
                currentVar = findInScope(raw[0], ref);
            }
            ignoreFirst = true;
        }
    } else {
        currentVar = new Variable("", CompletionItemKind.Variable);
        currentVar.properties = baseScope;
        currentVar.inherited = _inherited;
        currentVar.inner.detail = detail;
        currentVar.evaluated = true;
    }
    for(let i = (ignoreFirst ? 1 : 0); i < raw.length; i++) {
        let arg1 = null;
        let arg2 = "";
        if(before.length > 0 && i > 0) {
            arg1 = before[before.length - 1];
            arg2 = raw[i - 1];
        }
        if(!checkVar(currentVar, dep, arg1, arg2, playground) || (currentVar.ignore && playground)) {
            return playground ? before : null;
        }
        before.push(currentVar);
        currentVar = (raw[i] == "()") ? currentVar.returns : findInVariable(raw[i], currentVar.properties, currentVar.inherited);
    }
    if(currentVar === null) {
        if(before.length > 0 && raw.length > 0) {
            if(propertycreation && raw[raw.length - 1] != "()") {
                const newprop = new Variable(raw[raw.length - 1], CompletionItemKind.Variable, "[variable]");
                before[before.length - 1].properties.push(newprop);
                
                propertyStuff(before[before.length - 1], newprop);
                currentVar = newprop;
            } else {
                checkVar(null, dep, before[before.length - 1], raw[raw.length - 1], playground);
                return playground ? before : null;
            }
        } else {
            return playground ? before : null;
        }
    }
    if(playground && currentVar.ignore) {
        return before;
    }
    before.push(currentVar);
    return before; // object literal: simple variable with only properties, class: var with properties and inherit (optional), "new" object: var with no properties but inherit points to class
    //, a.b.c... -> c
}

const exporting = {
    run: getFromRT, 
    dep: null
};
module.exports = exporting;