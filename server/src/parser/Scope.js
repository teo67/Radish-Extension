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
        this.thisdeps = [];
        this.superdeps = [];
        this.params = null; // only for functions (array of strings), used for semantic tokenizing/highlighting
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
    addToDeps(type, dep) {
        if(type !== "this" && type !== "super") {
            console.log("no dep added");
            return;
        }
        if(this.params !== null) {
            console.log("params");
            this[type + "deps"].push(dep);
            return;
        }
        if(this.enclosing === null) {
            console.log("no enclosing");
            return;
        }
        console.log("going to enclosing");
        this.enclosing.addToDeps(type, dep);
    }
}
module.exports = Scope;