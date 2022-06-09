const { unusedAreas, server2 } = require('../global.js');

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

        this.unusedchar = -1;
        this.unusedline = -1;
    }
    end(line, char) {
        this.endline = line;
        this.endchar = char;
        if(this.unusedchar != -1 && this.unusedline != -1) {
            console.log('ending');
            unusedAreas.push({
                severity: server2.DiagnosticSeverity.Hint,
                range: {
                    start: {
                        line: this.unusedline - 1, 
                        character: this.unusedchar - 1
                    }, 
                    end: {
                        line: this.endline - 1, 
                        character: this.endchar - 1
                    }
                },
                message: 'This code is after a breaking statement and will not run.',
                source: 'Radish Language Server', 
                tags: [server2.DiagnosticTag.Unnecessary]
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
    markUnused(line, char) {
        console.log('marking unused!');
        this.unusedline = line;
        this.unusedchar = char;
    }
}
module.exports = Scope;