const { cached, languageserver, server2 } = require('./global.js');
//const { Diagnostic, DiagnosticSeverity } = require('./global.js').server2;
const lex = require('./parser/Lexing/Lexer.js');
const Reader = require('./parser/CountingReader.js');
const Operations = require('./parser/Operations.js');
const DiagnosticSeverity = server2.DiagnosticSeverity;
/*
changed = false: assessing either in progress or done, no further changes
changed = true: assessing in progress and will repeat once done
*/
const assess = async (document, connection) => {
    //console.log("starting");
    const version = document.version;
    await new Promise((resolve, reject) => setTimeout(resolve, 1000));
    const version2 = document.version;
    if(version != version2 && !(cached[document.uri] !== undefined && version2 - cached[document.uri].stamp > 20)) {
        return;
    }
    if(cached[document.uri] !== undefined && cached[document.uri].stamp == version2) {
        return;
    }
    //console.log("running " + document.getText());
    if(cached[document.uri] === undefined) {
        cached[document.uri] = {
            cs: [], 
            stamp: -1
        };
    }
    const ops = new Operations(new Reader(document));
    try {
        ops.ParseScope();
        cached[document.uri].cs = ops.cs;
        console.log(ops.dependencies);
        connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
    } catch(e) {
        console.log("new error");
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