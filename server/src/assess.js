const { cached, languageserver, server2 } = require('./global.js');
//const { Diagnostic, DiagnosticSeverity } = require('./global.js').server2;
const lex = require('./parser/Lexing/Lexer.js');
const Reader = require('./parser/CountingReader.js');
const Operations = require('./parser/Operations.js');
const Variable = require('./parser/Variable.js');
const Scope = require('./parser/Scope.js');
const { isFunction } = require('util');
const DiagnosticSeverity = server2.DiagnosticSeverity;
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
        returning += `${newindent}  ]${newindent}}`;
    } else if(any instanceof Variable) {
        if(any.inner.label == 'prototype') {
             returning += `${newindent} -- prototype --`;
        } else {
            returning += `${newindent}Variable {`;
            returning += `${newindent}  name: ${any.inner.label}, properties: [`;
            for(const prop of any.properties) {
                returning += printInDetail(prop, numspaces + 2);
            }
            returning += `${newindent}  ], inherited: ${(any.inherited === null) ? "none" : any.inherited.inner.label}${newindent}}`;
        }
        
    }
    return returning;
}
const assess = async (document, connection) => {
    //console.log("assessing");
    if(cached[document.uri] === undefined) {
        cached[document.uri] = {
            cs: null, 
            stamp: -1,
            chain: '',
            ref: document, 
            tokens: []
        };
    }
    //console.log("starting");
    const version = document.version;
    await new Promise((resolve, reject) => setTimeout(resolve, 50));
    const version2 = document.version;
    if(version != version2 && !(cached[document.uri] !== undefined && version2 - cached[document.uri].stamp > 20)) {
        return;
    }
    if(cached[document.uri] !== undefined && cached[document.uri].stamp == version2) {
        return;
    }
    //console.log("running " + document.getText());
    
    const ops = new Operations(new Reader(document));
    try {
        ops.ParseScope();
        cached[document.uri].cs = ops.cs;
        for(const propdep of ops.propertydependencies) {
            //console.log("prop");
            ops.HandlePropertyDependency(propdep);
        }
        for(const dep of ops.dependencies) {
            //console.log("dep");
            ops.HandleDependency(dep);
        }
        cached[document.uri].tokens = ops.HandleTokenDependencies();
        //console.log(printInDetail(ops.cs, 0));
        //console.log(ops.propertydependencies);
        //console.log(ops.dependencies);
        //console.log(ops.cs);
        connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
    } catch(e) {
        //console.log(e);
        //console.log("new error");
        const diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: {
				start: {
                    line: e.row, 
                    character: e.col
                }, 
                end: {
                    line: e.row, 
                    character: e.col + 1
                }
			},
			message: e.message,
			source: 'ex'
		}
        connection.sendDiagnostics({ uri: document.uri, diagnostics: [ diagnostic ] });
    }
    cached[document.uri].stamp = version2;
    return;
}
module.exports = assess;