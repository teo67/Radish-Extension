const lex = require('./Lexing/Lexer.js');
const Scope = require('./Scope.js');
const Variable = require('./Variable.js');
const { textdocument, languageserver, tokenTypes, tokenModifiers } = require('../global.js');
const { CompletionItemKind, ParameterInformation } = require('vscode-languageserver');
const TokenTypes = require('./TokenTypes.js');
// const typeMap = {};
// for(let i = 0; i < tokenTypes.length; i++) { // compile reverse arrays
//     typeMap[tokenTypes[i]] = i;  
// }
// const modifierMap = {};
// for(let i = 0; i < tokenModifiers.length; i++) {
//     modifierMap[tokenModifiers[i]] = i;  
// }
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
    static Reference = 525 // enum to return type variable
}
class Dependency {
    constructor(_target, _reference, _find) { // null for a token dep
        this.target = _target; // rt
        this.reference = _reference; // reference scope to begin search
        this.find = _find; // rt
    }
}
class TokenDependency {
    constructor(_raw, _reference, _line, _startchar, _baseScope = null) {
        this.raw = _raw;
        this.reference = _reference;
        this.line = _line;
        this.startchar = _startchar;
        this.baseScope = _baseScope;
    }
}
class PropertyDependency {
    constructor(_path, _reference) {
        this.path = _path;
        this.reference = _reference;
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
        this.propertydependencies = [];
        this.currentthis = null;
        this.tokendependencies = []; // [tokendependency]
    }

    HandleTokenDependency(dep) {

    }

    CheckVar(vari, dep, type = null, scope = null) {
        if(vari === null) {
            if(type !== null && scope !== null && dep !== null) {
                scope.addToDeps(type, dep);
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
        inherited = this.FindInVariable("prototype", inherited.properties, null);
        //console.log(inherited);
        if(!this.CheckVar(inherited, dep)) {
            return null;
        }
        return inherited;
    }

    PassInRT(dep, rt) {
        return this.GetFromRT(dep, dep.reference, rt.raw, rt.baseScope, rt.inherited, rt.detail);
    }

    GetFromRT(dep, ref, raw, baseScope, inherited = null, detail = "") { // false = cancel
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
            if(i == 1 && ignoreFirst && (raw[0] == "this" || raw[0] == "super")) {
                if(!this.CheckVar(currentVar, dep, raw[0], ref)) {
                    return null;
                }
            } else if(!this.CheckVar(currentVar, dep)) {
                return null;
            }
            before.push(currentVar);
            currentVar = this.FindInVariable(raw[i], currentVar.properties, currentVar.inherited);
        }
        if(currentVar === null) {
            return null;
        }
        before.push(currentVar);
        console.log("before = " + before[0].evaluated);
        //console.log("returning");
        return before; // object literal: simple variable with only properties, class: var with properties and inherit (optional), "new" object: var with no properties but inherit points to class
        //, a.b.c... -> c
    }

    HandleDependency(dep) {
        console.log(`dep ${dep.target.raw}, ${dep.find.raw}`)
        const found = this.PassInRT(dep, dep.target);
        
        if(found === null) { // no var or failed somewhere
            console.log("not found")
            return;
        }
        console.log("found = " + found[0].evaluated);
        console.log("length = " + found.length);
        console.log("foundtarget = " + found[found.length - 1]);
        const foundTarget = found[found.length - 1];
        if(foundTarget.evaluated) { // already eval'd
            console.log("already evaluated")
            return;
        }
        //console.log("found target successfully");
        let foundSet = this.PassInRT(dep, dep.find);
        if(foundSet === null) {
            console.log("no set");
            return;
        }
        foundSet = foundSet[foundSet.length - 1];
        if(!this.CheckVar(foundSet, dep)) { // if null or not eval'd, etc
            console.log("set already eval'd");
            return;
        }
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
            }
            let proto = this.FindInVariable("prototype", foundSet.properties, foundSet.inherited);
            if(proto === null) {
                proto = new Variable("prototype", CompletionItemKind.Variable, this.currentInt, "", "");
                proto.inner.detail = "[prototype object]";
                proto.evaluated = true;
                foundSet.properties.push(proto);
                this.currentInt++;
            }
            proto.properties = saved.properties;
            proto.inherited = saved.inherited;
        }
        //console.log("found set successfully");
        foundTarget.inherited = foundSet.inherited;
        for(const prop of foundTarget.properties) {
            foundSet.properties.push(prop); // transfer props manually to keep pointers to scope
        }
        foundTarget.properties = foundSet.properties;
        console.log(`${foundTarget.inner.detail} -> ${foundSet.inner.detail}`)
        foundTarget.inner.detail = foundSet.inner.detail;
        
        foundTarget.inner.kind = (dep.find.type == ReturnType.Reference ? foundSet.inner.kind : dep.find.type);
        if(dep.find.linkedscope !== null && (found.length > 1 || dep.find.thisref !== null)) {
            let _super = null;
            const _this = new Variable("this", CompletionItemKind.Variable, this.currentInt, "", "");
            this.currentInt++;
            _this.evaluated = true;
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
            if(foundTarget.inner.label == "constructor" && _super !== null) {
                if(!this.CheckVar(_super, dep)) {
                    return;
                }
                const realSuper = new Variable("super", CompletionItemKind.Function, this.currentInt, "", "");
                this.currentInt++;
                realSuper.evaluated = true;
                realSuper.properties = _super.properties;
                realSuper.inherited = _super.inherited;
                realSuper.inner.detail = "[inherited constructor]";
                dep.find.linkedscope.addVar(realSuper);
                for(const _dep of dep.find.linkedscope.superdeps) {
                    this.HandleDependency(_dep);
                }
            }
            _this.evaluated = true;
            dep.find.linkedscope.addVar(_this); // TO-DO: change so that _this gets pushed to scope linked to dep.find (add property to returnType?)
            for(const _dep of dep.find.linkedscope.thisdeps) {
                this.HandleDependency(_dep);
            }
        }
        foundTarget.evaluated = true;
        //console.log("about to run deps");
        for(const dep of foundTarget.deps) {
            //console.log("running dep");
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
//     /Users/h205p3/Desktop/code/Radish-Extension/server/src/parser/Operations.js:163
//     if(foundTarget.evaluated) { // already eval'd
//                    ^

// TypeError: Cannot read properties of null (reading 'evaluated')
// at Operations.HandleDependency (/Users/h205p3/Desktop/code/Radish-Extension/server/src/parser/Operations.js:163:24)
// at Operations.HandleDependency (/Users/h205p3/Desktop/code/Radish-Extension/server/src/parser/Operations.js:252:22)
// at assess (/Users/h205p3/Desktop/code/Radish-Extension/server/src/assess.js:74:17)
//     /Users/h205p3/Desktop/code/Radish-Extension/server/src/parser/Operations.js:265
//         for(const vari of scope.vars) {
//                                 ^

// TypeError: Cannot read properties of undefined (reading 'vars')
//     at Operations.FindInScope (/Users/h205p3/Desktop/code/Radish-Extension/server/src/parser/Operations.js:265:33)
//     at Operations.GetFromRT (/Users/h205p3/Desktop/code/Radish-Extension/server/src/parser/Operations.js:127:35)
//     at Operations.PassInRT (/Users/h205p3/Desktop/code/Radish-Extension/server/src/parser/Operations.js:101:21)
//     at Operations.HandleDependency (/Users/h205p3/Desktop/code/Radish-Extension/server/src/parser/Operations.js:157:28)

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

    HandlePropertyDependency(dep) { // adds various properties to variables
        const firstFind = this.FindInScope(dep.path[0], dep.reference);
        if(firstFind === null) {
            return;
        }
        let currentVar = firstFind;
        //console.log("found first");
        for(let i = 1; i < dep.path.length - 1; i++) {
            const found = this.FindInVariable(dep.path[i], currentVar.properties, currentVar.inherited);
            if(found === null) {
                if(currentVar.propertydeps[dep.path[i]] === undefined) {
                    currentVar.propertydeps[dep.path[i]] = [];
                }
                currentVar.propertydeps[dep.path[i]].push(dep);
                return;
            }
            currentVar = found;
        }
        const lastFind = this.FindInVariable(dep.path[dep.path.length - 1], currentVar.properties, currentVar.inherited);
        if(lastFind !== null) {
            return;
        }
        //console.log("found second");
        currentVar.properties.push(new Variable(dep.path[dep.path.length - 1], CompletionItemKind.Variable, this.currentInt, "", ""));
        this.currentInt++;
        //console.log("pushed second");
        const propdeps = currentVar.propertydeps[dep.path[dep.path.length - 1]];
        //console.log(propdeps);
        if(propdeps !== undefined) {
            for(const propdep of propdeps) {
                this.HandlePropertyDependency(propdep);
            }
        }
        //console.log("done");
        return;
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
        const ran = lex(this.reader);
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
        let read = this.Read();
        if(read.Type == TokenTypes.SYMBOL && (read.Val == "]" || read.Val == ")")) { // empty list
            this.Stored = read;
            return [returning, returningString];
        }
        while(true) { 
            this.Stored = read;
            if(params) {
                let key = this.Read();
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
                const newvar = new Variable(key.Val, CompletionItemKind.Variable, this.currentInt, "", "");
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
        return [returning, returningString];
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
                if(a.raw.length > 1) {
                    this.propertydependencies.push(new PropertyDependency(a.raw, this.cs));
                }
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
        // here, we add to dependencies, so long as returning.length > 0
        if(returning.length > 0) {
            this.tokendependencies.push(new TokenDependency(returning, this.cs, startline, startchar, returned.baseScope));
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
                let next = this.Read();
                
                while(next.Type == TokenTypes.OPERATOR && (next.Val == "public" || next.Val == "private" || next.Val == "protected" || next.Val == "static")) {
                    next = this.Read();
                }
                if(next.Type == TokenTypes.KEYWORD && next.Val != "this" && next.Val != "super") { // can't declare a variable named "this"
                    let desc = "variable"
                    const afterNext = this.Read();
                    if(afterNext.Type == TokenTypes.SYMBOL && afterNext.Val == "{") {
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
                                desc += ` | ${newType.Val} {}`;
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
                    newvar.inner.detail = "[" + desc + "]";
                    this.cs.addVar(newvar);
                    this.currentInt++;
                    return new ReturnType(CompletionItemKind.Variable, "", [ next.Val ]);
                }
                throw this.Error(`Expecting a variable name instead of ${next.Val}!`);
            }
            if(returned.Val == "tool" || returned.Val == "t") {
                this.RequireSymbol("(");
                const params = this.ParseLi(true);
                //console.log(params);
                this.RequireSymbol(")");
                this.RequireSymbol("{");
                const _cs = this.ParseScope();
                this.RequireSymbol("}");
                let desc = "[tool] { ";
                for(let i = 0; i < params[1].length; i++) {
                    desc += params[1][i];
                    if(i < params[1].length - 1) {
                        desc += ", ";
                    }
                }
                desc += " }";
                _cs.vars = _cs.vars.concat(params[0]);
                _cs.params = params[1];
                return new ReturnType(CompletionItemKind.Function, desc, [], null, null, _cs, this.currentthis);
            }
            if(returned.Val == "null" || returned.Val == "all") {
                return new ReturnType(CompletionItemKind.Variable, `initial value: ${returned.Val}`);
            }
            if(returned.Val == "throw" || returned.Val == "import") {
                this.ParseExpression();
                return new ReturnType(CompletionItemKind.Variable, `[${returned.Val}]`);
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