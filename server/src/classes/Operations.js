const lex = require('../functions/lex.js');
const Scope = require('./Scope.js');
const Variable = require('./Variable.js');
const { server2, cached } = require('../global.js');
const CompletionItemKind = server2.CompletionItemKind;
const TokenTypes = require('./TokenTypes.js');
const parseDoc = require('../functions/parseDoc.js');
const ReturnType = require('./returnType.js');
class Dependency {
    constructor(_target, _reference, _find) { // null for a token dep
        this.target = _target; // rt
        this.reference = _reference; // reference scope to begin search
        this.find = _find; // rt
        this.handled = false;
    }
}
class TokenDependency {
    constructor(_lines, _chars, _path, _reference, _baseScope, _before = []) {
        this.lines = _lines;
        this.chars = _chars;
        this.path = _path;
        this.reference = _reference;
        this.baseScope = _baseScope;
        this.before = _before;
    }
}
class Operations {
    constructor(reader) {
        this.reader = reader;
        this.Stored = null;
        this.PrevRow = -1;
        this.PrevCol = -1;
        this.currentInt = 0;
        this.cs = null; // current scope
        this.dependencies = [];
        this.currentthis = null;
        this.currentDocs = null;
        this.currentFun = null;
        this.tokendependencies = [];
        this.path = reader.file.uri.slice(0, reader.file.uri.lastIndexOf("/"));
    }

    CleanUp() {
        this.reader = null;
        this.cs = null;
        this.dependencies = [];
        this.currentthis = null;
        this.tokendependencies = [];
    }

    RequireSymbol(input) {
        const next = this.Read();
        if(!(next.Type == TokenTypes.SYMBOL && next.Val == input)) {
            throw this.Error(`Error: expected symbol: ${input}`);
        }
    }

    Error(input) {
        if(this.Stored == null) {
            return this.reader.Error(input);
        }
        return this.reader.Error(input, this.PrevRow, this.PrevCol);        
    }

    get Row() {
        if(this.Stored == null) {
            return this.reader.row;
        }
        return this.PrevRow;
    }

    get Col() {
        if(this.Stored == null) {
            return this.reader.col;
        }
        return this.PrevCol;
    }

    Read() {
        //Print("reading");
        if(this.Stored != null) {
            const saved = this.Stored;
            this.Stored = null;
            //Print(saved.Val);
            return saved;
        }
        this.PrevCol = this.reader.col;
        this.PrevRow = this.reader.row;
        let ran = lex(this.reader);
        if(ran.Type != TokenTypes.SEMIS) {
            this.currentDocs = null; 
        }
        while(ran.Type == TokenTypes.SEMIS) {
            this.currentDocs = ran;
            ran = lex(this.reader);
        }
        //Print(ran.Val);
        return ran;
    }
    ParseScope(setthis = false, setfun = false) { //returns scope
        // console.log("parsing scope");
        const saved = this.cs;
        const newscope = new Scope(this.Row, this.Col, this.cs);
        this.cs = newscope;
        if(setthis) {
            this.currentthis.properties = newscope.vars;
        }
        if(setfun) {
            this.currentFun = newscope;
        }
        let read = this.Read();
        while(read.Type != TokenTypes.ENDOFFILE && !(read.Type == TokenTypes.SYMBOL && read.Val == "}")) {
            if(read.Type == TokenTypes.OPERATOR && read.Val == "if") {
                this.Stored = read;
                this.ParseIfs();
            } else if(read.Type == TokenTypes.OPERATOR && read.Val == "while") {
                this.RequireSymbol("(");
                this.ParseExpression();
                this.RequireSymbol(")");
                this.RequireSymbol("{");
                this.ParseScope();
                this.RequireSymbol("}");
            } else if(read.Type == TokenTypes.OPERATOR && read.Val == "for") {
                this.RequireSymbol("(");
                this.ScopeWith(() => {
                    this.ParseLi();
                    this.RequireSymbol(")");
                    this.RequireSymbol("{");
                    this.ParseScope();
                    this.RequireSymbol("}");
                });
            } else if(read.Type == TokenTypes.OPERATOR && (read.Val == "cancel" || read.Val == "continue" || read.Val == "end")) {
                // nothing to do here
                this.cs.markUnused(this.Row, this.Col);
            } else if(read.Type == TokenTypes.OPERATOR && (read.Val == "harvest" || read.Val == "h")) {
                const ret = this.ParseExpression();
                let fun = this.currentFun;
                if(fun === null) {
                    let currentcs = this.cs;
                    while(currentcs.enclosing !== null) {
                        currentcs = currentcs.enclosing;
                    }
                    fun = currentcs;
                    //console.log(fun);
                }
                const return1 = new ReturnType(ReturnType.Reference, "", ["()"], null, null, fun);
                this.dependencies.push(new Dependency(return1, this.cs, ret));

                this.cs.markUnused(this.Row, this.Col);
            } else if(read.Type == TokenTypes.OPERATOR && read.Val == "try") {
                this.RequireSymbol("{");
                this.ParseScope();
                this.RequireSymbol("}");
                const next = this.Read();
                if(next.Type == TokenTypes.OPERATOR && next.Val == "catch") {
                    this.RequireSymbol("{");
                    this.ParseScope();
                    this.RequireSymbol("}");
                } else {
                    throw this.Error("Expecting catch phrase after try {}");
                }
            } else {
                this.Stored = read;
                this.ParseExpression();
            }
            read = this.Read();
        }
        
        newscope.end(this.Row, this.Col - read.Val.length); // we subtract 1 to ignore the last bracket
        this.Stored = read;
        if(saved !== null) {
            saved.append(newscope);
            this.cs = saved;
        } else {
            const filereturn = new Variable("(anonymous file harvest)", CompletionItemKind.Variable, "[variable]");
            this.cs.returns = filereturn;
        }
        return newscope;
    }

    ScopeWith(inner) {
        const saved = this.cs;
        const newscope = new Scope(this.Row, this.Col, this.cs);
        this.cs = newscope;
        inner();
        newscope.end(this.Row, this.Col);
        saved.append(newscope);
        this.cs = saved;
        return newscope;
    }

    ParseIfs() {
        // console.log("parsing ifs");
        const IF = this.Read();
        if(!(IF.Type == TokenTypes.OPERATOR && IF.Val == "if")) {
            throw this.Error("Expecting if statement!");
        }
        this.ParseIf();
        let read = this.Read();
        while(read.Type == TokenTypes.OPERATOR && read.Val == "elseif") {
            this.ParseIf();
            read = this.Read();
        }
        if(read.Type == TokenTypes.OPERATOR && read.Val == "else") {
            this.RequireSymbol("{");
            this.ParseScope();
            this.RequireSymbol("}");
        } else {
            this.Stored = read;
        }
    }

    ParseIf() { // single scope
        // console.log("parsing if");
        this.RequireSymbol("(");
        this.ParseExpression();
        this.RequireSymbol(")");
        this.RequireSymbol("{");
        this.ParseScope();
        this.RequireSymbol("}");
    }

    ParseLi(params = false) { 
        let returning = [];
        let returningString = [];
        let returningTokens = [];
        let read = this.Read();
        if(read.Type == TokenTypes.SYMBOL && (read.Val == "]" || read.Val == ")")) { // empty list
            this.Stored = read;
            return {
                vars: [], 
                strings: [], 
                tokens: []
            };
        }
        while(true) { 
            this.Stored = read;
            if(params) {
                const doc = this.currentDocs;
                let key = this.Read();
                const newvar = new Variable(key.Val, CompletionItemKind.Field);
                const tok = new TokenDependency([this.Row], [this.Col - key.Val.length], [key.Val], null, null)
                this.tokendependencies.push(tok);
                returningTokens.push(tok);
                if(key.Type != TokenTypes.KEYWORD) {
                    throw this.Error("Expecting a function parameter!");
                }
                const next = this.Read();
                
                
                let isOptional = false;
                if(next.Val == "plant" || next.Val == "p") {
                    this.ParseExpression();
                    isOptional = true;
                } else {
                    this.Stored = next;
                }
                newvar.inner.detail = isOptional ? "[optional variable]" : "[variable]";
                if(doc !== null && doc.Val.length > 2) {
                    const parsed = parseDoc(doc);
                    newvar.inner.documentation = parsed[0];
                    newvar.inner.params = parsed[1];
                }
                
                returning.push(newvar);
                returningString.push(isOptional ? (key.Val + "?") : key.Val);
                this.currentInt++;
            } else {
                this.ParseExpression();
            }
            
            const next = this.Read();

            if(!(next.Type == TokenTypes.SYMBOL && next.Val == ",")) {
                this.Stored = next;
                break;
            }

            read = this.Read();
        }
        return {
            vars: returning, 
            strings: returningString,
            tokens: returningTokens
        };
    }

    Parse(lowerfunction, cases, extracheck = null) { 
        const a = this[lowerfunction]();
        let next = this.Read();
        const check = () => {
            if(next.Type == TokenTypes.OPERATOR) {
                if(extracheck != null) {
                    const result = extracheck(next, a);
                    if(result !== null) {
                        return result;
                    }
                }
                if(cases.includes(next.Val)) {
                    this[lowerfunction]();
                    return true;
                }
            }
            this.Stored = next; // cancel viewing
            return false;
        };
        while(check()) {
            next = this.Read();
        }
        return a; // return first value parsed for type-checking purposes
    }

    ParseExpression() {
        // console.log("parsing expression");
        return this.Parse("ParseCombiners", ["plant", "p", "+=", "-=", "*=", "/=", "%="], (next, a) => {
            if(next.Val == "++" || next.Val == "--") {
                return false; // end expression
            }
            if(next.Val == "plant" || next.Val == "p") {
                const other = this.ParseCombiners();
                this.dependencies.push(new Dependency(a, this.cs, other));
                return true; // continue in next loop
            }
            return null; // nothing happened
        });
    }
    ParseCombiners() {
        // console.log("parsing combiners");
        return this.Parse("ParseComparators", ["&&", "||"]);
    }

    ParseComparators() {
        // console.log("parsing comparators");
        return this.Parse("ParseTerms", ["==", ">=", "<=", ">", "<", "!="]);
    }

    ParseTerms() {
        // console.log("parsing terms");
        return this.Parse("ParseFactors", ["+", "-"]);
    }

    ParseFactors() {
        // console.log("parsing factors");
        return this.Parse("ParseNegatives", ["*", "/", "%"]);
    }

    ParseNegatives() {
        // console.log("parsing negatives");
        const returned = this.Read();
        if(returned.Type == TokenTypes.OPERATOR) {
            if(returned.Val == "-" || returned.Val == "!") {
                return this.ParseNegatives();
            }
        }
        this.Stored = returned;
        return this.ParseCalls();
    }
    
    ParseCalls(acceptParens = true) {
        // console.log("parsing calls");
        
        let isUnknown = false; // if so return variable no matter what
        let stillOriginal = true; // if so return original lowest result
        const returned = this.ParseLowest();
        
        const returning = [];
        const startlines = [];
        const startchars = [];
        let next = this.Read();
        const checkCheck = () => {
            if(next.Val == "(" && acceptParens) {
                stillOriginal = false;
                this.ParseLi();
                this.RequireSymbol(")");
                if(!isUnknown) {
                    returning.push("()");
                    startlines.push(-1);
                    startchars.push(-1);
                }
                return true;
            }
            if(next.Val == "[") {
                this.ParseExpression();
                this.RequireSymbol("]");
                isUnknown = true;
                return true;
            }
            return false;
        }
        const check = () => {
            if(next.Type == TokenTypes.SYMBOL) {
                while(checkCheck()) {
                    next = this.Read();
                }
                if(next.Val == ".") {
                    stillOriginal = false;
                    const val = this.Read().Val;
                    if(!isUnknown) {
                        returning.push(val);
                        startlines.push(this.Row);
                        startchars.push(this.Col - val.length);
                    }
                    return true;
                }
            }
            this.Stored = next; // cancel viewing
            return false;
        }
        while(check()) {
            next = this.Read();
        }
        
        if(returning.length > 0) {
            this.tokendependencies.push(new TokenDependency(startlines, startchars, returning, this.cs, returned.baseScope, returned.raw)); // make it so it doesnt include previous stuff
        }

        if(isUnknown) {
            return new ReturnType(CompletionItemKind.Variable);
        }
        if(stillOriginal) {
            return returned;
        }
        // if clear accessor
        return new ReturnType(ReturnType.Reference, "", returned.raw.concat(returning), returned.baseScope, returned.inherited);
    }

    ParseLowest() {
        // console.log("parsing lowest");
        const returned = this.Read();
        if(returned.Type == TokenTypes.OPERATOR) {
            if(returned.Val == "dig" || returned.Val == "d") {
                const doc = this.currentDocs;
                let next = this.Read();
                let prop = false;
                let _static = false;
                while(next.Type == TokenTypes.OPERATOR && (next.Val == "public" || next.Val == "private" || next.Val == "protected" || next.Val == "static")) {
                    if(next.Val == "static") {
                        _static = true;
                    }
                    next = this.Read();
                }
                if(next.Type == TokenTypes.KEYWORD && next.Val != "this" && next.Val != "super" && next.Val != "prototype") { // can't declare a variable named "this"
                    this.tokendependencies.push(new TokenDependency([this.Row], [this.Col - next.Val.length], [next.Val], this.cs, null));
                    const afterNext = this.Read();
                    if(afterNext.Type == TokenTypes.SYMBOL && afterNext.Val == "{") {
                        //console.log("getter/setter");
                        prop = true;
                        for(let i = 0; i < 2; i++) {
                            const newType = this.Read();
                            if(newType.Type == TokenTypes.SYMBOL && newType.Val == "}") {
                                this.Stored = newType;
                                break;
                            }
                            if(newType.Type != TokenTypes.OPERATOR) {
                                throw this.Error(`Expecting plant or harvest function instead of ${newType.Val}!`);
                            }
                            this.RequireSymbol("{");
                            //console.log("aaa");
                            if(newType.Val == "plant" || newType.Val == "p" || newType.Val == "harvest" || newType.Val == "h") {
                                //console.log('correct value');
                                const prevFun = this.currentFun;
                                const _cs = this.ParseScope(false, true);
                                this.currentFun = prevFun;
                                if(newType.Val == "plant" || newType.Val == "p") {
                                    _cs.addVar(new Variable("input", CompletionItemKind.Variable, "[variable]"));
                                    this.currentInt++;
                                }
                                const _this = new Variable("this", CompletionItemKind.Variable, "[variable]");
                                this.currentInt++;
                                const _super = new Variable("super", CompletionItemKind.Variable, "[variable]");
                                this.currentInt++;
                                _super.ignore = true;
                                _this.ignore = true;
                                _cs.vars.push(_this);
                                _cs.vars.push(_super);
                                if(this.currentthis !== null) {
                                    this.dependencies.push(new Dependency(
                                        new ReturnType(ReturnType.Reference, "", ["this"]), 
                                        _cs, 
                                        new ReturnType(CompletionItemKind.Variable, "[object reference]", [], this.currentthis.properties, this.currentthis.inherited)
                                    ));
                                    if(next.Val == "constructor") {
                                        this.dependencies.push(new Dependency(
                                            new ReturnType(ReturnType.Reference, "", ["super"]), 
                                            _cs, 
                                            new ReturnType(ReturnType.Reference, "", ["constructor"], [], this.currentthis.inherited)
                                        ));
                                    }
                                }
                            } else {
                                throw this.Error("Only plant and harvest functions are valid in this context!");
                            }
                            this.RequireSymbol("}");
                        }
                        this.RequireSymbol("}");
                    } else {
                        this.Stored = afterNext;
                    }
                    // console.log("adding var");
                    
                    const newvar = new Variable(next.Val, CompletionItemKind.Variable);
                    newvar.inner.detail = "[variable]";
                    if(doc !== null && doc.Val.length > 2) {
                        const parsed = parseDoc(doc);
                        newvar.inner.documentation = parsed[0];
                        newvar.inner.params = parsed[1];
                    }
                    if(prop) {
                        newvar.evaluated = true;
                    }
                    newvar.isStatic = _static;
                    for(const _vari of this.cs.vars) {
                        if(_vari.inner.label == newvar.inner.label) {
                            throw this.Error(`Cannot declare variable '${newvar.inner.label}' more than once in the same scope!`);
                        }
                    }
                    this.cs.addVar(newvar);
                    this.currentInt++;
                    return new ReturnType(CompletionItemKind.Variable, "", [ next.Val ]);
                }
                throw this.Error(`Expecting a variable name instead of ${next.Val}! (note that 'this', 'super', and 'prototype' are reserved names and cannot be reused)`);
            }
            if(returned.Val == "tool" || returned.Val == "t") {
                const startline = this.Row;
                const startchar = this.Col;
                this.RequireSymbol("(");
                const params = this.ParseLi(true);
                //console.log(params);
                this.RequireSymbol(")");
                this.RequireSymbol("{");
                const previousFun = this.currentFun;
                const _cs = this.ParseScope(false, true);
                this.currentFun = previousFun;
                _cs.startchar = startchar;
                _cs.startline = startline;
                this.RequireSymbol("}");
                let desc = "[tool] { ";
                for(let i = 0; i < params.strings.length; i++) {
                    desc += params.strings[i];
                    if(i < params.strings.length - 1) {
                        desc += ", ";
                    }
                }
                desc += " }";
                for(const token of params.tokens) {
                    token.reference = _cs;
                    //console.log(token);
                }
                _cs.vars = _cs.vars.concat(params.vars);
                const _this = new Variable("this", CompletionItemKind.Variable, "[variable]");
                this.currentInt++;
                const _super = new Variable("super", CompletionItemKind.Variable, "[variable]");
                this.currentInt++;
                _super.ignore = true;
                _this.ignore = true;
                _cs.vars.push(_this);
                _cs.vars.push(_super);
                if(this.currentthis !== null) {
                    this.dependencies.push(new Dependency(
                        new ReturnType(ReturnType.Reference, "", ["this"]), 
                        _cs, 
                        new ReturnType(CompletionItemKind.Variable, "[object reference]", [], this.currentthis.properties, this.currentthis.inherited)
                    ));
                    this.dependencies.push(new Dependency(
                        new ReturnType(ReturnType.Reference, "", ["super"]), 
                        _cs, 
                        new ReturnType(ReturnType.Reference, "", ["constructor"], [], this.currentthis.inherited)
                    ));
                }
                const returns = new Variable("(anonymous harvested value)", CompletionItemKind.Variable, "[no explicit value]");
                this.currentInt++;
                _cs.returns = returns;
                return new ReturnType(CompletionItemKind.Function, desc, [], null, null, _cs);
            }
            if(returned.Val == "null") {
                return new ReturnType(CompletionItemKind.Variable, `[null]`);
            }
            if(returned.Val == "all") {
                return new ReturnType(CompletionItemKind.Variable, "[object]", [], this.cs.vars);
            }
            if(returned.Val == "throw") {
                this.ParseExpression();
                return new ReturnType(CompletionItemKind.Variable, `[error]`);
            } 
            if(returned.Val == "import") {
                const next = this.Read();
                if(next.Type == TokenTypes.STRING) {
                    let val = next.Val;
                    let path = this.path;
                    while(val.startsWith("../")) {
                        val = val.slice(3);
                        path = path.slice(0, path.lastIndexOf("/"));
                    }
                    path += "/";
                    path += val;
                    if(!val.endsWith(".rdsh")) {
                        path += ".rdsh";
                    }
                    //console.log(path);
                    //console.log(cached);
                    const cache = cached[path];
                    if(cache !== undefined) {
                        //console.log(cache.cs.returns);
                        return new ReturnType(ReturnType.Reference, "[import]", [], null, null, null, cache.cs.returns);
                    }
                }
                return new ReturnType(CompletionItemKind.Variable, "[import]");
            }
            if(returned.Val == "class") {
                const next = this.Read();
                let inherited = null;
                if(next.Type == TokenTypes.SYMBOL && next.Val == ":") {
                    inherited = this.ParseExpression();
                    // const tok = new TokenDependency([this.Row], [this.Col - inherited.length], [inherited], this.cs, null);
                    // this.tokendependencies.push(tok);
                } else {
                    this.Stored = next;
                }
                
                this.RequireSymbol("{");
                const prevthis = this.currentthis;
                this.currentthis = {
                    inherited: inherited // FIX
                };
                const cs = this.ParseScope(true);
                let hasConstr = false;
                for(const vari of cs.vars) {
                    if(vari.inner.label == "constructor") {
                        hasConstr = vari;
                        break;
                    }
                }
                if(!hasConstr) {
                    hasConstr = new Variable("constructor", CompletionItemKind.Function);
                    hasConstr.evaluated = true;
                    hasConstr.inner.detail = "[tool] {}";
                    this.currentInt++;
                    cs.vars.push(hasConstr);
                }
                this.RequireSymbol("}");
                this.currentthis = prevthis;
                return new ReturnType(CompletionItemKind.Class, "", [], cs.vars, inherited);
            }
            if(returned.Val == "new") {
                const next = this.ParseCalls(false);
                //const tok = new TokenDependency([this.Row], [this.Col - next.Val.length], [next.Val], this.cs, null);
                //this.tokendependencies.push(tok);
                this.RequireSymbol("(");
                this.ParseLi();
                this.RequireSymbol(")");
                return new ReturnType(CompletionItemKind.Variable, `[object : Class]`, [], [], next); // this way the object gets linked to the class it is derived from while still being treated like an object
            }
        } else if(returned.Type == TokenTypes.STRING || returned.Type == TokenTypes.NUMBER || returned.Type == TokenTypes.BOOLEAN) {
            return new ReturnType(CompletionItemKind.Variable, ["[string]", "[number]", "[boolean]"][[TokenTypes.STRING, TokenTypes.NUMBER, TokenTypes.BOOLEAN].indexOf(returned.Type)]);
        } else if(returned.Type == TokenTypes.KEYWORD) {
            this.tokendependencies.push(new TokenDependency([this.Row], [this.Col - returned.Val.length], [returned.Val], this.cs, null));
            return new ReturnType(ReturnType.Reference, "", [ returned.Val ]);
        } else if(returned.Type == TokenTypes.SYMBOL) {
            if(returned.Val == "(") {
                const rt = this.ParseExpression();
                this.RequireSymbol(")");
                return rt;
            } 
            if(returned.Val == "[") {
                this.ParseLi();
                this.RequireSymbol("]");
                return new ReturnType(CompletionItemKind.Variable, "[array]");
            }
            if(returned.Val == "{") {
                const prevthis = this.currentthis;
                this.currentthis = {
                    inherited: null
                };
                const cs = this.ParseScope(true);
                this.RequireSymbol("}");
                this.currentthis = prevthis;
                return new ReturnType(CompletionItemKind.Variable, "[object]", [], cs.vars);
            }
        }
        throw this.Error(`Could not parse value: ${returned.Val}`);
    }
}
module.exports = Operations;