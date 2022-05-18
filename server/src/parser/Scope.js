class Scope {
    constructor(_startline, _startchar, _enclosing = null) {
        this.startline = _startline;
        this.startchar = _startchar;
        this.endline = this.startline;
        this.endchar = this.startchar;
        this.vars = [];
        this.innerscopes = [];
        this.enclosing = _enclosing;
    }
    end(line, char) {
        this.endline = line;
        this.endchar = char;
    }
    append(scope) {
        this.innerscopes.push(scope);
    }
    addVar(vari = null) {
        if(vari !== null) {
            this.vars.push(vari);
        }
    }
}
module.exports = Scope;