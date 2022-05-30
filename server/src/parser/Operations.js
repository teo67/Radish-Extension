const lex = require('./Lexing/Lexer.js');
const Scope = require('./Scope.js');
const Variable = require('./Variable.js');
const { textdocument, languageserver, tokenTypes, tokenKey, server2 } = require('../global.js');
const CompletionItemKind = server2.CompletionItemKind;
const TokenTypes = require('./TokenTypes.js');
class ReturnType {
    constructor(_type, _detail = "", _raw = [], _baseScope = null, _inherited = null, _linkedscope = null, _thisref = null) {
        this.type = _type; // for example: CompletionItemKind.Variable
        this.raw = _raw; // array of string
        this.baseScope = _baseScope;
        this.inherited = _inherited;
        this.linkedscope = _linkedscope;
        this.thisref = _thisref;
        this.detail = _detail;
    }
    static Reference = 525; // enum to return type variable
    static Parameter = 526;
}
class Dependency {
    constructor(_target, _reference, _find) { // null for a token dep
        this.target = _target; // rt
        this.reference = _reference; // reference scope to begin search
        this.find = _find; // rt
        this.handled = false;
    }
}
class TokenDependency {
    constructor(_line, _char, _path, _reference, _baseScope) {
        this.line = _line;
        this.char = _char;
        this.path = _path;
        this.reference = _reference;
        this.baseScope = _baseScope;
    }
}
class ConstructorDependency { // super simple dependency for setting type/description of constructor that has been overridden
    constructor(_target, _find) {
        this.target = _target;
        this.find = _find;
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
        this.tokendependencies = [];
        this.constructordependencies = [];
    }

    HandleTokenDependencies() {
        let overall = [];
        let lastline = 0;
        let lastchar = 0;
        for(const dep of this.tokendependencies) {
            //console.log(dep.path + " - " + dep.char)
            const gotten = this.GetFromRT(null, dep.reference, dep.path, dep.baseScope, null, "");
            let current = dep.char;
            if(dep.baseScope !== null) {
                gotten.shift();
                current++;
            }
            if(gotten === null || gotten.length != dep.path.length) {
                console.log(gotten);
                continue;
            }
            
            let returning = [];
            for(let i = 0; i < gotten.length; i++) {
                const adding = [];
                adding.push(dep.line - 1 - lastline);
                const savedchar = current - 1;
                adding.push(savedchar - (dep.line - 1 == lastline ? lastchar : 0));
                
                adding.push(dep.path[i].length);
                current += dep.path[i].length + 1;
                const index = tokenKey.indexOf(gotten[i].inner.kind);
                if(index == -1) {
                    continue;
                }
                adding.push(index);
                adding.push(0);
                lastline = dep.line - 1;
                lastchar = savedchar;
                returning = returning.concat(adding);
            }
            overall = overall.concat(returning);
        }
        return overall;
    }

    CheckVar(vari, dep, previous = null, searching = "") {
        if(vari === null) {
            if(previous !== null) {
                if(previous.propertydeps[":" + searching] === undefined) { // we have to add a colon because {}["constructor"] actually means something in js
                    previous.propertydeps[":" + searching] = [];
                }
                previous.propertydeps[":" + searching].push(dep);
            }
            return false;
        }
        if(!vari.evaluated) {
            if(dep !== null) {
                vari.deps.push(dep);
            }
            return false;
        }
        return true;
    }

    GetInherited(str, scoperef, dep) {
        let inherited = this.FindInScope(str, scoperef);
        if(!this.CheckVar(inherited, dep)) {
            return null;
        }
        const saved = inherited;
        inherited = this.FindInVariable("prototype", inherited.properties, null);
        //console.log(inherited);
        if(!this.CheckVar(inherited, dep, saved, "prototype")) {
            return null;
        }
        return inherited;
    }

    PassInRT(dep, rt, propertycreation = false) {
        return this.GetFromRT(dep, dep.reference, rt.raw, rt.baseScope, rt.inherited, rt.detail, propertycreation);
    }

    GetFromRT(dep, ref, raw, baseScope, inherited = null, detail = "", propertycreation = false) { // false = cancel
        let _inherited = null;
        if(inherited !== null) {
            _inherited = this.GetInherited(inherited, ref, dep);
            if(_inherited === null) {
                return null;
            }
        }
        //console.log("" + raw + inherited + inherited);
        let currentVar = null;
        let before = [];
        let ignoreFirst = false;
        if(baseScope === null) { // if this is true then inherited will be null
            //console.log("no base")
            if(raw.length == 0) {
                //console.log("no raw")
                //console.log("00")
                currentVar = new Variable("", CompletionItemKind.Variable, this.currentInt, "", ""); // return a blank variable
                currentVar.evaluated = true;
                currentVar.inner.detail = detail;
                this.currentInt++;
            } else {
                //console.log("raw exists")
                currentVar = this.FindInScope(raw[0], ref);
                ignoreFirst = true;
            }
        } else {
            //console.log("base exists")
            currentVar = new Variable("", CompletionItemKind.Variable, this.currentInt, "", "");
            this.currentInt++;
            currentVar.properties = baseScope;
            currentVar.inherited = _inherited;
            currentVar.inner.detail = detail;
            currentVar.evaluated = true;
        }
        for(let i = (ignoreFirst ? 1 : 0); i < raw.length; i++) {
            let arg1 = null;
            let arg2 = "";
            if(before.length > 0 && i > 0) {
                arg1 = before[before.length - 1];
                arg2 = raw[i - 1];
            }
            if(!this.CheckVar(currentVar, dep, arg1, arg2)) {
                return null;
            }
            before.push(currentVar);
            currentVar = this.FindInVariable(raw[i], currentVar.properties, currentVar.inherited);
        }
        if(currentVar === null) {
            if(before.length > 0 && raw.length > 0) {
                if(propertycreation) {
                    const newprop = new Variable(raw[raw.length - 1], CompletionItemKind.Variable, this.currentInt, "", "");
                    before[before.length - 1].properties.push(newprop);
                    this.PropertyStuff(before[before.length - 1], newprop);
                    currentVar = newprop;
                } else {
                    this.CheckVar(null, dep, before[before.length - 1], raw[raw.length - 1]);
                    return null;
                }
            } else {
                return null;
            }
        }
        before.push(currentVar);
        //console.log("before = " + before[0].evaluated);
        //console.log("returning");
        return before; // object literal: simple variable with only properties, class: var with properties and inherit (optional), "new" object: var with no properties but inherit points to class
        //, a.b.c... -> c
    }

    PropertyStuff(holder, held) {
        //console.log(holder.inner.label + " - " + held.inner.label);
        if(holder.propertydeps[":" + held.inner.label] !== undefined) {
            //console.log(holder.propertydeps);
            //console.log(holder.propertydeps[":" + held.inner.label]);
            for(const propdep of holder.propertydeps[":" + held.inner.label]) {
                this.HandleDependency(propdep);
            }
        } 
    }

    HandleConstDep(dep) {
        if(!dep.find.evaluated) {
            return;
        }
        dep.target.inner.detail = dep.find.inner.detail;
        dep.target.inner.documentation = dep.find.inner.documentation;
        dep.target.inner.kind = dep.find.inner.kind;
    }

    HandleDependency(dep) {
        if(dep.handled) {
            return; // this could save some time
        }
        //console.log(`dep ${dep.target.raw}, ${dep.find.raw}`)
        const found = this.PassInRT(dep, dep.target, true);
        
        if(found === null) { // no var or failed somewhere
            //console.log("not found")
            return;
        }
        //console.log("found = " + found[0].evaluated);
        //console.log("length = " + found.length);
        //console.log("foundtarget = " + found[found.length - 1]);
        const foundTarget = found[found.length - 1];
        if(foundTarget.evaluated) { // already eval'd
            //console.log("already evaluated")
            return;
        }
        //console.log("found target successfully");
        let foundSet = this.PassInRT(dep, dep.find);
        if(foundSet === null) {
            //console.log("no set");
            return;
        }
        if(!this.CheckVar(foundSet[foundSet.length - 1], dep)) { // if null or not eval'd, etc
            return;
        }
        foundSet = foundSet[foundSet.length - 1];
        if(dep.find.type == CompletionItemKind.Class) {
            const construct = this.FindInVariable("constructor", foundSet.properties, null);
            const saved = foundSet; 
            if(construct === null) {
                foundSet = new Variable("constructor", CompletionItemKind.Function, this.currentInt, "", "");
                foundSet.inner.detail = "[tool] {}";
                foundSet.evaluated = true;  
                this.currentInt++;
            } else {
                foundSet = construct;
                if(!construct.evaluated) {
                    this.constructordependencies.push(new ConstructorDependency(foundTarget, foundSet)); // save for later
                }
            }
            let proto = this.FindInVariable("prototype", foundSet.properties, foundSet.inherited);
            if(proto === null) {
                proto = new Variable("prototype", CompletionItemKind.Variable, this.currentInt, "", "");
                proto.inner.detail = "[prototype object]";
                proto.evaluated = true;
                foundSet.properties.push(proto);
                this.PropertyStuff(foundSet, proto);
                this.currentInt++;
            }
            proto.properties = saved.properties;
            for(const newprop of proto.properties) {
                this.PropertyStuff(proto, newprop);
            }
            proto.inherited = saved.inherited;
        }
        //console.log("found set successfully");
        foundTarget.inherited = foundSet.inherited;
        for(const prop of foundSet.properties) {
            foundTarget.properties.push(prop); // transfer props manually to keep pointers to scope
            this.PropertyStuff(foundTarget, prop);
        }
        foundSet.properties = foundTarget.properties;
        //console.log(foundTarget);
        //console.log(foundSet);
        //console.log(`${foundTarget.inner.detail} -> ${foundSet.inner.detail}`)
        foundTarget.inner.detail = foundSet.inner.detail;
        
        foundTarget.inner.kind = (dep.find.type == ReturnType.Reference ? foundSet.inner.kind : dep.find.type);

        if(dep.find.linkedscope !== null && (found.length > 1 || dep.find.thisref !== null)) {
            let _super = null;
            const _this = this.FindInScope("this", dep.find.linkedscope);
            //console.log("this!!");
            if(_this !== null) {
                _this.inner.detail = "[object reference]";
                if(dep.find.thisref !== null) {
                    _this.properties = dep.find.thisref.properties;
                    let inh = null;
                    if(dep.find.thisref.inherited !== null) {
                        inh = this.GetInherited(dep.find.thisref.inherited, dep.reference, dep);
                        if(inh === null) {
                            return;
                        }
                        _super = this.FindInVariable("constructor", inh.properties, inh.inherited);
                    }
                    _this.inherited = inh;
                } else { // we know that found[0] !== null atp
                    _this.properties = found[found.length - 2].properties;
                    _this.inherited = found[found.length - 2].inherited;
                    if(found[found.length - 2].inherited !== null) {
                        _super = this.FindInVariable("constructor", found[found.length - 2].inherited.properties, found[found.length - 2].inherited.inherited);
                    }
                }
                for(const newprop of _this.properties) {
                    this.PropertyStuff(_this, newprop);
                }
                if(foundTarget.inner.label == "constructor" && _super !== null) {
                    if(!this.CheckVar(_super, dep)) {
                        return;
                    }
                    const realSuper = this.FindInScope("super", dep.find.linkedscope);
                    if(realSuper !== null) {
                        realSuper.evaluated = true;
                        realSuper.ignore = false;
                        realSuper.properties = _super.properties;
                        for(const newprop of realSuper.properties) {
                            this.PropertyStuff(realSuper, newprop);
                        }
                        realSuper.inherited = _super.inherited;
                        realSuper.inner.detail = _super.inner.detail;
                        for(const _dep of realSuper.deps) {
                            this.HandleDependency(_dep);
                        }
                    }
                }
                _this.evaluated = true;
                _this.ignore = false;
                for(const _dep of _this.deps) {
                    this.HandleDependency(_dep);
                }
            }
            
        }
        foundTarget.evaluated = true;
        dep.handled = true;
        //console.log("about to run deps");
        for(const dep of foundTarget.deps) {
            //console.log("running dep: " + dep.target.raw);
            this.HandleDependency(dep);
        }
        return;
    }

    FindInScope(target, scope) {
        for(const vari of scope.vars) {
            if(vari.inner.label == target) {
                return vari;
            }
        }
        if(scope.enclosing !== null) {
            return this.FindInScope(target, scope.enclosing);
        }
        return null;
    }

    FindInVariable(target, properties, inherited) {
        //console.log("finding " + target);
        for(const prop of properties) {
            if(prop.inner.label == target) {
                return prop;
            }
        }
        if(inherited !== null) {
            //console.log(inherited.inner.label + "\n" + inherited.properties + "\n" + inherited.inherited)
            return this.FindInVariable(target, inherited.properties, inherited.inherited);
        }
        return null;
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
    ParseScope(setthis = false) { //returns scope
        // console.log("parsing scope");
        const saved = this.cs;
        const newscope = new Scope(this.Row, this.Col, this.cs);
        this.cs = newscope;
        if(setthis) {
            this.currentthis.properties = newscope.vars;
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
            } else if(read.Type == TokenTypes.OPERATOR && (read.Val == "harvest" || read.Val == "h")) {
                this.ParseExpression();
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
        
        newscope.end(this.Row, this.Col);
        this.Stored = read;
        if(saved !== null) {
            saved.append(newscope);
            this.cs = saved;
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
                let key = this.Read();
                const newvar = new Variable(key.Val, CompletionItemKind.Field, this.currentInt, "", "");
                const tok = new TokenDependency(this.Row, this.Col - key.Val.length, [key.Val], null, null)
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
                newvar.inner.detail = isOptional ? "[optional parameter]" : "[parameter]";
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
    
    ParseCalls() {
        // console.log("parsing calls");
        
        let isUnknown = false; // if so return variable no matter what
        let stillOriginal = true; // if so return original lowest result
        const returned = this.ParseLowest();
        
        const returning = returned.raw;

        const startline = this.Row;
        const startchar = this.Col - (returned.raw.length > 0 ? returned.raw[0].length : 0);
        let next = this.Read();
        const checkCheck = () => {
            if(next.Val == "(") {
                this.ParseLi();
                this.RequireSymbol(")");
                isUnknown = true;
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
            this.tokendependencies.push(new TokenDependency(startline, startchar, returning, this.cs, returned.baseScope));
        }

        if(isUnknown) {
            return new ReturnType(CompletionItemKind.Variable);
        }
        if(stillOriginal) {
            return returned;
        }
        // if clear accessor
        return new ReturnType(ReturnType.Reference, "", returning, returned.baseScope, returned.inherited);
    }

    ParseLowest() {
        // console.log("parsing lowest");
        const returned = this.Read();
        if(returned.Type == TokenTypes.OPERATOR) {
            if(returned.Val == "dig" || returned.Val == "d") {
                const doc = this.currentDocs;
                let next = this.Read();
                let prop = false;
                while(next.Type == TokenTypes.OPERATOR && (next.Val == "public" || next.Val == "private" || next.Val == "protected" || next.Val == "static")) {
                    next = this.Read();
                }
                if(next.Type == TokenTypes.KEYWORD && next.Val != "this" && next.Val != "super" && next.Val != "prototype") { // can't declare a variable named "this"
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
                                throw this.Error(`Expecting plant or harvest function instead of ${newType.Val}!`);
                            }
                            this.RequireSymbol("{");
                            if(newType.Val == "plant" || newType.Val == "p" || newType.Val == "harvest" || newType.Val == "h") {
                                const _cs = this.ParseScope();
                                if(newType.Val == "plant" || newType.Val == "p") {
                                    _cs.addVar(new Variable("input", CompletionItemKind.Variable, this.currentInt, "", ""));
                                    this.currentInt++;
                                }
                                if(this.currentthis !== null) {
                                    const _this = new Variable("this", CompletionItemKind.Variable, this.currentInt, "", "");
                                    this.currentInt++;
                                    _this.evaluated = true;
                                    _this.properties = this.currentthis.properties;
                                    _this.inherited = this.currentthis.inherited;
                                    _this.inner.detail = "[object reference]";
                                    _cs.addVar(_this);
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
                    
                    const newvar = new Variable(next.Val, CompletionItemKind.Variable, this.currentInt, "", "");
                    newvar.inner.detail = "[variable]";
                    if(doc !== null && doc.Val.length > 2) {
                        const old = doc.Val.substring(1, doc.Val.length - 1);
                        let edited = '';
                        for(let i = 0; i < old.length; i++) {
                            if(old[i] == '\n' || old[i] == '\r') {
                                edited += '\n';
                            } else {
                                edited += old[i];
                            }
                        }
                        newvar.inner.documentation = edited;
                        //newvar.inner.documentation = doc.Val.substring(1, doc.Val.length - 1);
                    }
                    if(prop) {
                        newvar.evaluated = true;
                    }
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
                const _cs = this.ParseScope();
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
                const _this = new Variable("this", CompletionItemKind.Variable, this.currentInt, "", "");
                this.currentInt++;
                const _super = new Variable("super", CompletionItemKind.Variable, this.currentInt, "", "");
                this.currentInt++;
                _super.ignore = true;
                _this.ignore = true;
                _cs.vars.push(_this);
                _cs.vars.push(_super);
                return new ReturnType(CompletionItemKind.Function, desc, [], null, null, _cs, this.currentthis);
            }
            if(returned.Val == "null" || returned.Val == "all") {
                return new ReturnType(CompletionItemKind.Variable, `initial value: ${returned.Val}`);
            }
            if(returned.Val == "throw" || returned.Val == "import") {
                this.ParseExpression();
                return new ReturnType(CompletionItemKind.Variable, `[${returned.Val} statement]`);
            }
            if(returned.Val == "class") {
                const next = this.Read();
                let inherited = null;
                if(next.Type == TokenTypes.SYMBOL && next.Val == ":") {
                    // nothing to do here
                    inherited = this.Read().Val;
                } else {
                    this.Stored = next;
                }
                
                this.RequireSymbol("{");
                const prevthis = this.currentthis;
                this.currentthis = {
                    inherited: inherited
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
                    hasConstr = new Variable("constructor", CompletionItemKind.Function, this.currentInt, "", "");
                    hasConstr.inner.detail = "[tool] {}";
                    this.currentInt++;
                    cs.vars.push(hasConstr);
                }
                this.RequireSymbol("}");
                this.currentthis = prevthis;
                return new ReturnType(CompletionItemKind.Class, "", [], cs.vars, inherited);
            }
            if(returned.Val == "new") {
                const next = this.Read();
                this.RequireSymbol("(");
                this.ParseLi();
                this.RequireSymbol(")");
                return new ReturnType(CompletionItemKind.Variable, `[object : ${next.Val}]`, [], [], next.Val); // this way the object gets linked to the class it is derived from while still being treated like an object
            }
        } else if(returned.Type == TokenTypes.STRING || returned.Type == TokenTypes.NUMBER || returned.Type == TokenTypes.BOOLEAN) {
            return new ReturnType(CompletionItemKind.Variable, ["[string]", "[number]", "[boolean]"][[TokenTypes.STRING, TokenTypes.NUMBER, TokenTypes.BOOLEAN].indexOf(returned.Type)]);
        } else if(returned.Type == TokenTypes.KEYWORD) {
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