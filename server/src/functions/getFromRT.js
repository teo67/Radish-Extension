const Variable = require('../classes/Variable.js');
const findInScope = require('./findInScope.js');
const checkVar = require('./checkVar.js');
const findInVariable = require('./findInVariable.js');
const propertyStuff = require('./propertyStuff.js').run;
const global = require('../global.js');
const CompletionItemKind = global.server2.CompletionItemKind;

const getFromRT = (operations, dep, ref, raw, baseScope, inherited = null, linkedscope = null, imported = null, detail = "", propertycreation = false, playground = false) => { // false = cancel
    if(detail == "ANY") {
        return playground ? [] : null;
    }
    let _inherited = null;
    if(inherited !== null) {
        _inherited = exporting.dep(operations, inherited, dep, playground);
        if(_inherited === null) {
            return null;
        }
    }
    let currentVar = null;
    let before = [];
    let ignoreFirst = false;
    if(imported !== null) {
        currentVar = imported;
    } else {
        const dict = {
            'stri': 'String', 
            'tool': 'Function', 
            'obje': 'Object', 
            'numb': 'Number', 
            'bool': 'Boolean',
            'arra': 'Array',
            'poly': 'Poly'
        };
        const res = dict[detail.substring(1, 5)];
        if((detail.length >= 5 && (res !== undefined)) || raw.length == 0 || baseScope !== null || _inherited !== null) {
            currentVar = new Variable("", CompletionItemKind.Variable);
            currentVar.evaluated = true;
            if(linkedscope !== null) {
                currentVar.returns = linkedscope.returns;
            }
            if(_inherited !== null) {
                currentVar.inherited = _inherited;
            } else if(res !== undefined) {
                currentVar.inherited = operations.protos[res];
            }
            if(baseScope !== null) {
                currentVar.properties = baseScope;
            }
            currentVar.inner.detail = detail;
        } else {
            if(linkedscope !== null && raw[0] == "()") {
                currentVar = linkedscope.returns;
            } else {
                currentVar = findInScope(raw[0], ref, operations.bs);
            }
            ignoreFirst = true;
        }
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
    if(before.length > 0 && raw.length > 0) {
        if(propertycreation && raw[raw.length - 1] != "()" && (currentVar === null || !before[before.length - 1].properties.includes(currentVar))) {
            const newprop = new Variable(raw[raw.length - 1], CompletionItemKind.Variable, "[variable]");
            before[before.length - 1].properties.push(newprop);
            propertyStuff(operations, before[before.length - 1], newprop);
            currentVar = newprop;
        } else if(currentVar === null) {
            checkVar(null, dep, before[before.length - 1], raw[raw.length - 1], playground);
            return playground ? before : null;
        }
    } else if(currentVar === null) {
        return playground ? before : null;
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