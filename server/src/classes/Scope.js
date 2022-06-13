const global = require('../global.js');

class Scope {
    constructor(_startline, _startchar, _enclosing = null, _isthis = false) {
        this.startline = _startline;
        this.startchar = _startchar;
        this.endline = this.startline;
        this.endchar = this.startchar;
        this.vars = [];
        this.innerscopes = [];
        this.enclosing = _enclosing;
        this.isthis = _isthis;
        this.returns = null;

        this.unused = null;
    }
    end(line, char) {
        this.endline = line;
        this.endchar = char;
        if(this.unused !== null && !(this.unused.line == this.endline - 1 && this.unused.character == this.endchar - 1)) {
            global.currentOperator.diagnostics.push({
                severity: global.server2.DiagnosticSeverity.Hint,
                range: {
                    start: this.unused, 
                    end: {
                        line: this.endline - 1, 
                        character: this.endchar - 1
                    }
                },
                message: 'This code is after a breaking statement and will not run.',
                source: 'Radish Language Server', 
                tags: [global.server2.DiagnosticTag.Unnecessary]
            });
        }
    }
    append(scope) {
        this.innerscopes.push(scope);
    }
    addVar(vari = null) {
        if(vari !== null) {
            this.vars.push(vari);
        }
    }
    markUnused(position) {
        if(this.unused === null) {
            this.unused = position;
        }
    }
}
module.exports = Scope;