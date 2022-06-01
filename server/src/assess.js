const { cached, languageserver, server2, assessTime } = require('./global.js');
//const { Diagnostic, DiagnosticSeverity } = require('./global.js').server2;
const lex = require('./parser/Lexing/Lexer.js');
const Reader = require('./parser/CountingReader.js');
const Operations = require('./parser/Operations.js');
const Variable = require('./parser/Variable.js');
const Scope = require('./parser/Scope.js');
const DiagnosticSeverity = server2.DiagnosticSeverity;
const Response = require('./Response.js');
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
const assess = new Response(async document => {
    if(document._lineOffsets === undefined) {
        document.getLineOffsets(); // generate line offsets if they start as undefined
    }
    if(cached[document.uri] === undefined) {
        cached[document.uri] = {
            cs: null, 
            stamp: -1,
            chain: '',
            ref: document, 
            tokens: []
        };
    }
    const version = document.version;
    await new Promise((resolve, reject) => setTimeout(resolve, assessTime));
    const version2 = document.version;
    if(version != version2 && !(cached[document.uri] !== undefined && version2 - cached[document.uri].stamp > 20)) {
        return null;
    }
    if(cached[document.uri] !== undefined && cached[document.uri].stamp == version2) {
        return null;
    }
    //console.log("running " + document.getText());
    //console.log(document._content);
    const ops = new Operations(new Reader(document));
    let returning = null;
    try {
        ops.ParseScope();
        cached[document.uri].cs = ops.cs;
        for(const dep of ops.dependencies) {
            //console.log("dep");
            ops.HandleDependency(dep);
        }
        for(const dep of ops.constructordependencies) {
            ops.HandleConstDep(dep);
        }
        cached[document.uri].tokens = ops.HandleTokenDependencies();
        //console.log(cached[document.uri].tokens);
        //console.log(printInDetail(ops.cs, 0));
        //console.log(ops.dependencies);
        //console.log(ops.cs);
        returning = { uri: document.uri, diagnostics: [] };
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
        returning = { uri: document.uri, diagnostics: [ diagnostic ] };
    }
    cached[document.uri].stamp = version2;
    return returning;
}, "assess", null);
module.exports = assess;