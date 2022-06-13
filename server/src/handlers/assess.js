const global = require('../global.js');
const Reader = require('../classes/CountingReader.js');
const Operations = require('../classes/Operations.js');
const Variable = require('../classes//Variable.js');
const Scope = require('../classes/Scope.js');
const DiagnosticSeverity = global.server2.DiagnosticSeverity;
const Response = require('./Response.js');
const handleConstDep = require('../functions/handleConstDep.js');
const handleDependency = require('../functions/handleDependency.js').run;
const handleTokenDependencies = require('../functions/handleTokenDependencies');
/*
changed = false: assessing either in progress or done, no further changes
changed = true: assessing in progress and will repeat once done
*/
const printInDetail = (any, numspaces) => {
    let returning = '';
    const newindent = `\n${' '.repeat(numspaces)}`;
    if(any instanceof Scope) {
        returning += `${newindent}Scope(start(${any.startline}, ${any.startchar}), end(${any.endline}, ${any.endchar})) {`;
        returning += `${newindent}  vars: [`;
        for(const vari of any.vars) {
            returning += printInDetail(vari, numspaces + 4);
        }
        returning += `${newindent}  ], inner: [`;
        for(const inner of any.innerscopes) {
            returning += printInDetail(inner, numspaces + 4);
        }
        returning += `${newindent}  ]${newindent}  Returns: ${any.returns === null ? "none" : any.returns.inner.label}${newindent}}`;
    } else if(any instanceof Variable) {
        if(any.inner.label == 'prototype') {
             returning += `${newindent} -- prototype --`;
        } else {
            returning += `${newindent}Variable {`;
            returning += `${newindent}  name: ${any.inner.label}, properties: [`;
            for(const prop of any.properties) {
                returning += printInDetail(prop, numspaces + 2);
            }
            returning += `${newindent}  ], inherited: ${(any.inherited === null) ? "none" : any.inherited.inner.label}, ${newindent}  Returns: ${any.returns === null ? "none" : any.returns.inner.label}${newindent}}`;
        }
        
    }
    return returning;
}
const assess = new Response(async document => {
    //Variable 6
    //Class 7
    //Function 3
    //Field 5
    if(document._lineOffsets === undefined) {
        document.getLineOffsets(); // generate line offsets if they start as undefined
    }
    if(global.cached[document.uri] === undefined) {
        global.cached[document.uri] = {
            cs: null, 
            stamp: -1,
            chain: '',
            ref: document, 
            tokens: [], 
            noHoverZones: []
        };
    }
    const version = document.version;
    await new Promise((resolve, reject) => setTimeout(resolve, global.assessTime));
    const version2 = document.version;
    if(version != version2 && !(global.cached[document.uri] !== undefined && version2 - global.cached[document.uri].stamp > 20)) {
        return null;
    }
    if(global.cached[document.uri] !== undefined && global.cached[document.uri].stamp == version2) {
        return null;
    }
    const ops = new Operations(new Reader(document));
    global.currentOperator = ops;
    let returning = null;
    ops.ParseScope();
    global.cached[document.uri].cs = ops.cs;
    global.cached[document.uri].noHoverZones = ops.noHoverZones;
    for(const dep of ops.dependencies) {
        handleDependency(dep);
    }
    for(const dep of ops.constructordependencies) {
        handleConstDep(dep);
    }
    global.cached[document.uri].tokens = handleTokenDependencies(ops.tokendependencies);
    returning = { uri: document.uri, diagnostics: ops.diagnostics };
    global.currentOperator = null;
    ops.CleanUp();
    global.cached[document.uri].stamp = version2;
    return returning;
}, "assess", null);
module.exports = assess;