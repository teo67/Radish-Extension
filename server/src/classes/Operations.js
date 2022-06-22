const lex = require('../functions/lex.js');
const Scope = require('./Scope.js');
const Variable = require('./Variable.js');
// global.server2, global.cached, global.importCache, global.connection
const global = require('../global.js');
const CompletionItemKind = global.server2.CompletionItemKind;
const TokenTypes = require('./TokenTypes.js');
const parseDoc = require('../functions/parseDoc.js');
const ReturnType = require('./ReturnType.js');
const fs = require('fs');
const CountingReader = require('./CountingReader.js');
const handleDependency = require('../functions/handleDependency.js').run;
const handleConstDep = require('../functions/handleConstDep.js');
class Dependency {
    constructor(_target, _reference, _find, _override = false) { // null for a token dep
        this.target = _target; // rt
        this.reference = _reference; // reference scope to begin search
        this.find = _find; // rt
        this.override = _override; // overide already eval'd
        this.handled = false;
    }
}
class TokenDependency {
    constructor(_lines, _chars, _path, _reference, _baseScope, _isDeclarationIfSoWhatsThis = null, _before = [], _imported = null, _linkedscope = null) {
        this.lines = _lines;
        this.chars = _chars;
        this.path = _path;
        this.reference = _reference;
        this.baseScope = _baseScope;
        this.before = _before;
        this.isDeclarationIfSoWhatsThis = _isDeclarationIfSoWhatsThis; // only used to decide which variables to analyze as used only once
        // null: not declaration, false: no scope, true: scope
        this.imported = _imported;
        this.linkedscope = _linkedscope;
    }
}
class Operations {
    constructor(reader) {
        this.reader = reader;
        this.Stored = null;
        this.PrevRow = -1;
        this.PrevCol = -1;
        this.cs = null; // current scope
        this.dependencies = [];
        this.currentthis = null;
        this.currentDocs = null;
        this.currentFun = null;
        this.tokendependencies = [];
        this.noHoverZones = [];
        this.diagnostics = [];
        this.constructordependencies = [];
        this.lastTrim = {
            line: 0, 
            character: 0
        };
        this.path = reader.file.uri.slice(0, reader.file.uri.lastIndexOf("/"));
    }

    CleanUp() {
        this.reader = null;
        this.cs = null;
        this.dependencies = [];
        this.currentthis = null;
        this.tokendependencies = [];
        this.noHoverZones = [];
        this.diagnostics = [];
        this.constructordependencies = [];
    }

    AddDiagnostic(message, start = this.lastTrim, end = {
        line: this.Row - 1, 
        character: this.Col - 1
    }) {
        this.diagnostics.push({
            severity: global.server2.DiagnosticSeverity.Error,
            range: {
                start: start, 
                end: end
            },
            message: message,
            source: 'Radish Language Server', 
            tags: []
        });
    }

    RequireSymbol(input) {
        const next = this.Read();
        if(!(next.Type == TokenTypes.SYMBOL && next.Val == input)) {
            this.AddDiagnostic(`Error: expected symbol: ${input}`);
            this.Stored = next;
        }
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
        if(this.Stored != null) {
            const saved = this.Stored;
            this.Stored = null;
            return saved;
        }
        this.PrevCol = this.reader.col;
        this.PrevRow = this.reader.row;
        return lex(this.reader);
    }
    ParseScope(setthis = false, setfun = false) { //returns scope
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
                const after = this.Read();
                this.cs.markUnused(this.lastTrim);
                this.Stored = after;
            } else if(read.Type == TokenTypes.OPERATOR && (read.Val == "harvest" || read.Val == "h")) {
                const ret = this.ParseExpression();
                let fun = this.currentFun;
                if(fun === null) {
                    let currentcs = this.cs;
                    while(currentcs.enclosing !== null) {
                        currentcs = currentcs.enclosing;
                    }
                    fun = currentcs;
                }
                const return1 = new ReturnType(ReturnType.Reference, "", ["()"], null, null, fun);
                this.dependencies.push(new Dependency(return1, this.cs, ret));
                
                const after = this.Read();
                this.cs.markUnused(this.lastTrim);
                this.Stored = after;
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
                    this.AddDiagnostic("Expecting catch phrase after try {}");
                    this.Stored = next;
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
        const IF = this.Read();
        if(!(IF.Type == TokenTypes.OPERATOR && IF.Val == "if")) {
            this.AddDiagnostic("Expecting if statement!");
            this.Stored = IF;
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
        let returningDeps = [];
        let read = this.Read();
        if(read.Type == TokenTypes.SYMBOL && (read.Val == "]" || read.Val == ")")) { // empty list
            this.Stored = read;
            return {
                vars: [], 
                strings: [], 
                tokens: [], 
                deps: []
            };
        }
        while(true) { 
            this.Stored = read;
            if(params) {
                const doc = this.currentDocs;
                const key = this.Read();
                if(key.Type != TokenTypes.KEYWORD) {
                    this.AddDiagnostic("Expecting a function parameter!");
                } else {
                    const newvar = new Variable(key.Val, CompletionItemKind.Field);
                    const tok = new TokenDependency([this.Row], [this.Col - key.Val.length], [key.Val], null, null, false)
                    this.tokendependencies.push(tok);
                    returningTokens.push(tok);
                    
                    const next = this.Read();
                    let isOptional = false;
                    if(next.Val == "plant" || next.Val == "p") {
                        const dep = new Dependency(
                            new ReturnType(ReturnType.Reference, "", [key.Val]), 
                            null,
                            this.ParseExpression()
                        );
                        this.dependencies.push(dep);
                        returningDeps.push(dep);
                        isOptional = true;
                    } else {
                        this.Stored = next;
                    }
                    newvar.inner.detail = isOptional ? "[optional variable]" : "[variable]";
                    if(doc !== null && doc.length > 2) {
                        const parsed = parseDoc(doc);
                        newvar.inner.documentation = parsed[0];
                        newvar.params = parsed[1];
                    }
                    
                    returning.push(newvar);
                    returningString.push(isOptional ? (key.Val + "?") : key.Val);
                }
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
            tokens: returningTokens, 
            deps: returningDeps
        };
    }

    Parse(lowerfunction, cases) { 
        let current = this[lowerfunction]();
        let next = null;
        let done = false;
        while(!done) {
            next = this.Read();
            done = true;
            if(next.Type == TokenTypes.OPERATOR) {
                const result = this[cases](next.Val, current, lowerfunction);
                if(result != null) {
                    current = result;
                    done = false;
                }
            }
        }
        this.Stored = next;
        return current;
    }

    IsExpression(val, current, previous) {
        if(val[val.length - 1] == "=") {
            const edited = val.slice(0, val.length - 1);
            const others = ["IsCombiners", "IsComparators", "IsTerms", "IsFactors"];
            for(const other of others) {
                const returned = this[other](edited, current, previous);
                if(returned !== null) {
                    return returned;
                }
            }
        } else if(val == "plant" || val == "p") {
            const other = this[previous]();
            this.dependencies.push(new Dependency(current, this.cs, other));
            return current; // continue in next loop
        }
        return null; // nothing happened
    }

    ParseExpression() {
        return this.Parse("ParseCombiners", "IsExpression");
    }

    IsCombiners(val, current, previous) {
        if(val == "||" || val == "&&") {
            this[previous]();
            return new ReturnType(CompletionItemKind.Variable, "[boolean]");
        }
        if(["&", "|", "^"].includes(val)) {
            this[previous]();
            return new ReturnType(CompletionItemKind.Variable, "[number]");
        }
        return null;
    }

    ParseCombiners() {
        return this.Parse("ParseComparators", "IsCombiners");
    }

    IsComparators(val, current, previous) {
        if(["==", ">=", "<=", ">", "<", "!="].includes(val)) {
            this[previous]();
            return new ReturnType(CompletionItemKind.Variable, "[boolean]");
        }
        return null;
    }

    ParseComparators() {
        return this.Parse("ParseShifts", "IsComparators");
    }

    IsShifts(val, current, previous) {
        if(val == "<<" || val == ">>") {
            this[previous]();
            return new ReturnType(CompletionItemKind.Variable, "[number]");
        }
        return null;
    }

    ParseShifts() {
        return this.Parse("ParseTerms", "IsShifts");
    }

    IsTerms(val, current, previous) {
        if(val == "+" || val == "-") {
            this[previous]();
            return this.Convert(current);
        }
        return null;
    }

    ParseTerms() {
        return this.Parse("ParseFactors", "IsTerms");
    }

    IsFactors(val, current, previous) {
        if(["*", "/", "%"].includes(val)) {
            this[previous]();
            return this.Convert(current);
        }
        return null;
    }

    ParseFactors() {
        return this.Parse("ParseNegatives", "IsFactors");
    }

    Convert(current) {
        if(current.detail.startsWith('[string : ') || current.detail.startsWith('[number : ')) {
            current.detail = current.detail.slice(0, 7) + ']';
        }
        return current;
    }

    ParseNegatives() {
        const returned = this.Read();
        if(returned.Type == TokenTypes.OPERATOR) {
            if(returned.Val == "-" || returned.Val == "~") {
                this.ParseNegatives();
                return new ReturnType(CompletionItemKind.Variable, "[number]");
            }
            if(returned.Val == "!") {
                this.ParseNegatives();
                return new ReturnType(CompletionItemKind.Variable, "[boolean]");
            }
        }
        this.Stored = returned;
        return this.ParsePosts();
    }

    ParsePosts() {
        const before = this.ParseCalls();
        let returned = null;
        let done = false;
        while(!done) {
            returned = this.Read();
            if(!(returned.Type == TokenTypes.OPERATOR && (returned.Val == "++" || returned.Val == "--"))) {
                done = true;
            }
        }
        this.Stored = returned;
        return before;
    }
    
    ParseCalls(acceptParens = true) {
        let isUnknown = false; // if so return variable no matter what
        let stillOriginal = true; // if so return original lowest result
        const returned = this.ParseLowest();
        const returning = [];
        const startlines = [];
        const startchars = [];
        let next = null;
        let done = false;
        while(!done) {
            next = this.Read();
            if(next.Type == TokenTypes.SYMBOL) {
                let doneDone = false;
                while(!doneDone) {
                    if(next.Type == TokenTypes.SYMBOL) {
                        if(next.Val == "(" && acceptParens) {
                            stillOriginal = false;
                            this.ParseLi();
                            this.RequireSymbol(")");
                            if(!isUnknown) {
                                returning.push("()");
                                startlines.push(-1);
                                startchars.push(-1);
                            }
                            next = this.Read();
                        } else if(next.Val == "[") {
                            this.ParseExpression();
                            this.RequireSymbol("]");
                            isUnknown = true;
                            next = this.Read();
                        } else {
                            doneDone = true;
                        }
                    } else {
                        doneDone = true;
                    }
                }
                if(next.Val == "." || next.Val == ":") {
                    stillOriginal = false;
                    const val = this.Read().Val;
                    if(!isUnknown) {
                        returning.push(val);
                        startlines.push(this.Row);
                        startchars.push(this.Col - val.length);
                    }
                } else {
                    done = true;
                }
            } else {
                done = true;
            }
        }
        this.Stored = next;
        if(returning.length > 0) {
            this.tokendependencies.push(new TokenDependency(startlines, startchars, returning, this.cs, returned.baseScope, null, returned.raw, returned.imported, returned.linkedscope)); // make it so it doesnt include previous stuff
        }
        if(isUnknown) {
            return new ReturnType(CompletionItemKind.Variable);
        }
        if(stillOriginal) {
            return returned;
        }
        return new ReturnType(ReturnType.Reference, "", returned.raw.concat(returning), returned.baseScope, returned.inherited, returned.linkedscope, returned.imported);
    }

    ParseLowest() {
        let returned = this.Read();
        if(returned.Type == TokenTypes.OPERATOR) {
            if(returned.Val == "dig" || returned.Val == "d") {
                const doc = this.currentDocs;
                let next = this.Read();
                let prop = false;
                let skip = false;
                let _static = false;
                while(next.Type == TokenTypes.OPERATOR && (next.Val == "public" || next.Val == "private" || next.Val == "protected" || next.Val == "static")) {
                    if(next.Val == "static") {
                        _static = true;
                    }
                    next = this.Read();
                }
                if(next.Type == TokenTypes.KEYWORD && next.Val != "this" && next.Val != "super" && next.Val != "prototype") { // can't declare a variable named "this"
                    for(const _vari of this.cs.vars) {
                        if(_vari.inner.label == next.Val) {
                            this.AddDiagnostic(`Cannot declare variable '${next.Val}' more than once in the same scope!`);
                            skip = true;
                        }
                    }
                    this.tokendependencies.push(new TokenDependency([this.Row], [this.Col - next.Val.length], [next.Val], this.cs, null, this.currentthis !== null));
                    const afterNext = this.Read();
                    if(afterNext.Type == TokenTypes.SYMBOL && afterNext.Val == "{") {
                        prop = true;
                        for(let i = 0; i < 2; i++) {
                            const newType = this.Read();
                            if(newType.Type == TokenTypes.SYMBOL && newType.Val == "}") {
                                this.Stored = newType;
                                break;
                            }
                            if(newType.Type != TokenTypes.OPERATOR) {
                                this.AddDiagnostic(`Expecting plant or harvest function instead of ${newType.Val}!`);
                            } else {
                                this.RequireSymbol("{");
                                if(newType.Val == "plant" || newType.Val == "p" || newType.Val == "harvest" || newType.Val == "h") {
                                    const prevFun = this.currentFun;
                                    const _cs = this.ParseScope(false, true);
                                    this.currentFun = prevFun;
                                    if(newType.Val == "plant" || newType.Val == "p") {
                                        _cs.addVar(new Variable("input", CompletionItemKind.Variable, "[variable]"));
                                    } else { // harvest || h
                                        const returns = new Variable("(anonymous harvested value)", CompletionItemKind.Variable, "[no explicit value]");
                                        _cs.returns = returns; // we only care about return values for the harvest
                                        this.dependencies.push(new Dependency(new ReturnType(CompletionItemKind.Variable, "", [next.Val]), this.cs, 
                                        new ReturnType(ReturnType.Reference, "", ["()"], null, null, _cs), true));
                                    }
                                    const _this = new Variable("this", CompletionItemKind.Variable, "[variable]");
                                    const _super = new Variable("super", CompletionItemKind.Variable, "[variable]");
                                    _super.ignore = true;
                                    _this.ignore = true;
                                    _cs.vars.push(_this);
                                    _cs.vars.push(_super);
                                    if(this.currentthis !== null) {
                                        this.dependencies.push(new Dependency(
                                            new ReturnType(ReturnType.Reference, "", ["this"]), 
                                            _cs, 
                                            new ReturnType(CompletionItemKind.Variable, "[object reference]al", [], this.currentthis.properties, this.currentthis.inherited)
                                        ));
                                        if(next.Val == "constructor") {
                                            this.dependencies.push(new Dependency(
                                                new ReturnType(ReturnType.Reference, "", ["super"]), 
                                                _cs, 
                                                new ReturnType(ReturnType.Reference, "", ["constructor"], [], this.currentthis.inherited)
                                            ));
                                        }
                                    }
                                    this.RequireSymbol("}");
                                } else {
                                    this.AddDiagnostic("Only plant and harvest functions are valid in this context!"); // also likely to be redundant
                                }
                            }
                        }
                        this.RequireSymbol("}");
                    } else {
                        this.Stored = afterNext;
                    }
                    
                    if(!skip) {
                        const newvar = new Variable(next.Val, CompletionItemKind.Variable, "[variable]");
                        if(doc !== null && doc.length > 2) {
                            const parsed = parseDoc(doc);
                            newvar.inner.documentation = parsed[0];
                            newvar.params = parsed[1];
                        }
                        if(prop) {
                            newvar.evaluated = true;
                        }
                        newvar.isStatic = _static;
                        
                        this.cs.addVar(newvar);
                    }
                    
                    return new ReturnType(CompletionItemKind.Variable, "", [ next.Val ]);
                }
                this.AddDiagnostic(`Expecting a variable name instead of ${next.Val}! (note that 'this', 'super', and 'prototype' are reserved names and cannot be reused)`);
                this.Stored = next;
                return new ReturnType(CompletionItemKind.Variable);
            }
            if(returned.Val == "uproot") {
                const next = this.Read();
                this.tokendependencies.push(new TokenDependency([this.Row], [this.Col - next.Val.length], [next.Val], this.cs, null, null));
                return new ReturnType(CompletionItemKind.Variable, "", [ next.Val ]);
            }
            if(returned.Val == "tool" || returned.Val == "t") {
                const startline = this.Row;
                const startchar = this.Col;
                this.RequireSymbol("(");
                const params = this.ParseLi(true);
                
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
                }
                for(const dep of params.deps) {
                    dep.reference = _cs;
                }
                _cs.vars = _cs.vars.concat(params.vars);
                
                const _this = new Variable("this", CompletionItemKind.Variable, "[variable]");
                const _super = new Variable("super", CompletionItemKind.Variable, "[variable]");
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
                const next = this.ParseExpression(); // negatives is "one phrase" level (no whitespace) so it feels right
                if(next.detail.startsWith('[string :')) {
                    let val = next.detail.slice(10, next.detail.length - 1);
                    const lastI = val.lastIndexOf('/');
                    if(lastI != -1) {
                        val = val.slice(0, lastI) + val.slice(lastI).toLowerCase(); // file names are always lowercase in uris
                    }
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
                    let cache = global.cached[path] === undefined ? undefined : global.cached[path].cs;
                    if(cache !== undefined) {
                        cache = cache.returns;
                    }
                    if(cache === undefined) {
                        cache = global.importCache[path];
                    }
                    if(cache === undefined && path.startsWith("file://")) {
                        let result;
                        try { 
                            result = fs.readFileSync(path.slice(6), { encoding: 'utf-8' });
                        } catch {
                            result = null;
                        }
                        if(result !== null) {
                            const newOps = new Operations(new CountingReader({
                                _content: result,
                                uri: path
                            }));
                            const saved = global.currentOperator;
                            global.currentOperator = newOps;
                            newOps.ParseScope();
                            for(const dep of newOps.dependencies) {
                                handleDependency(dep);
                            }
                            for(const dep of newOps.constructordependencies) {
                                handleConstDep(dep);
                            }
                            global.importCache[path] = newOps.cs.returns;
                            cache = newOps.cs.returns;
                            global.currentOperator = saved;
                            global.connection.sendDiagnostics({ uri: path, diagnostics: newOps.diagnostics });
                            newOps.CleanUp();
                        }
                    }
                    if(cache !== undefined) {
                        return new ReturnType(ReturnType.Reference, "[import]", [], null, null, null, cache);
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
        } else if(returned.Type == TokenTypes.STRING) {
            const add = () => {
                this.noHoverZones.push({
                    startline: this.lastTrim.line + 1, 
                    startchar: this.lastTrim.character + 2,
                    endline: this.Row, 
                    endchar: this.Col - 1
                });
            }
            let value = returned.Val.slice(1, returned.Val.length - 1);
            if(returned.Val[0] == '\'') {
                value = null;
                this.AddDiagnostic("Strings may not be declared using single quotes!");
            } else {
                add();
                while(returned.Val[returned.Val.length - 1] == '\'') {
                    value = null;
                    this.ParseExpression();
                    returned = this.Read();
                    if(returned.Type != TokenTypes.STRING) {
                        this.AddDiagnostic("Strings may not be ended using single quotes!");
                    } else if(returned.Val[0] != '\'') {
                        this.AddDiagnostic("String interpolations must begin and end with single quotes!");
                    } else {
                        add();
                    }
                }
            }
            return new ReturnType(CompletionItemKind.Variable, value === null ? "[string]" : `[string : ${value}]`);
        } else if(returned.Type == TokenTypes.NUMBER) {
            return new ReturnType(CompletionItemKind.Variable, `[number : ${returned.Val}]`);
        } else if(returned.Type == TokenTypes.BOOLEAN) {
            return new ReturnType(CompletionItemKind.Variable, "[boolean]");
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
        this.AddDiagnostic(returned.Val.length > 0 ? `Could not parse value: ${returned.Val}` : 'Expected another token!');
        return new ReturnType(CompletionItemKind.Variable); // nothing
    }
}
module.exports = Operations;