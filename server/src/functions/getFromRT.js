const Variable = require('../classes/Variable.js');
const findInScope = require('./findInScope.js');
const checkVar = require('./checkVar.js');
const findInVariable = require('./findInVariable.js');
const propertyStuff = require('./propertyStuff.js').run;
const CompletionItemKind = require('../global.js').server2.CompletionItemKind;
const getFromRT = (dep, ref, raw, baseScope, inherited = null, linkedscope = null, imported = null, detail = "", propertycreation = false, playground) => { // false = cancel
    if(imported !== null) {
        return [imported];
    }
    //console.log(raw);console.log(ref);
    let _inherited = null;
    if(inherited !== null) {
        //console.log('inheriting');
        _inherited = exporting.dep(inherited, dep, playground);
        if(_inherited === null) {
            return null;
        }
    }
    //console.log("" + raw + inherited + inherited);
    let currentVar = null;
    let before = [];
    let ignoreFirst = false;
    if(baseScope === null) { 
        //console.log("no base")
        if(raw.length == 0) {
            //console.log("no raw")
            //console.log("00")
            currentVar = new Variable("", CompletionItemKind.Variable); // return a blank variable
            currentVar.evaluated = true;
            currentVar.inner.detail = detail;
            if(linkedscope !== null) {
                currentVar.inner.returns = linkedscope.returns;
            }
        } else {
            //console.log("raw exists")
            if(linkedscope !== null && raw[0] == "()") {
                currentVar = linkedscope.returns;
            } else {
                //console.log('getting ' + raw[0])
                currentVar = findInScope(raw[0], ref);
            }
            ignoreFirst = true;
        }
    } else {
        //console.log("base exists")
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
            //console.log("failed on " + currentVar);
            return playground ? before : null;
        }
        before.push(currentVar);
        currentVar = (raw[i] == "()") ? currentVar.inner.returns : findInVariable(raw[i], currentVar.properties, currentVar.inherited);
    }
    if(currentVar === null) {
        if(before.length > 0 && raw.length > 0) {
            if(propertycreation && raw[raw.length - 1] != "()") {
                const newprop = new Variable(raw[raw.length - 1], CompletionItemKind.Variable, "[variable]");
                before[before.length - 1].properties.push(newprop);
                //console.log('propping');
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
    //console.log("before = " + before[0].evaluated);
    //console.log("returning");
    return before; // object literal: simple variable with only properties, class: var with properties and inherit (optional), "new" object: var with no properties but inherit points to class
    //, a.b.c... -> c
}

const exporting = {
    run: getFromRT, 
    dep: null
};
module.exports = exporting;