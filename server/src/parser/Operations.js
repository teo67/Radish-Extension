const lex = require('./Lexing/Lexer.js');
const Scope = require('./Scope.js');
const Variable = require('./Variable.js');
const { textdocument, languageserver } = require('../global.js');
const { CompletionItemKind } = require('vscode-languageserver');
const TokenTypes = require('./TokenTypes.js');
class Operations {
    constructor(reader) {
        this.reader = reader;
        this.Stored = null;
        this.PrevRow = -1;
        this.PrevCol = -1;
        this.currentInt = 0;
        this.cs = null; // current scope
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

    ParseScope() { //returns scope
        // console.log("parsing scope");
        const saved = this.cs;
        this.cs = new Scope(this.Row, this.Col);
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
                const innerScope = new Scope(this.Row, this.Col);
                const saved2 = this.cs;
                this.cs = innerScope;
                this.ParseLi();
                this.RequireSymbol(")");
                this.RequireSymbol("{");
                this.ParseScope();
                this.RequireSymbol("}");
                saved2.append(this.cs);
                this.cs = saved2;
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
        this.Stored = read;
        if(saved !== null) {
            saved.append(this.cs);
            this.cs = saved;
        }
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

    ParseLi(params = false) { // list of varis
        // console.log("parsing list");
        let read = this.Read();
        if(read.Type == TokenTypes.SYMBOL && (read.Val == "]" || read.Val == ")")) { // empty list
            this.Stored = read;
            return;
        }
        while(true) { 
            this.Stored = read;
            if(params) {
                let key = this.Read();
                if(key.Type != TokenTypes.KEYWORD) {
                    throw this.Error("Expecting a function parameter!");
                }
                const next = this.Read();
                if(next.Val == "plant" || next.Val == "p") {
                    this.ParseExpression();
                } else {
                    this.Stored = next;
                }
                this.cs.addVar(new Variable(key, CompletionItemKind.Variable, this.currentInt, "", ""));
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
    }

    Parse(lowerfunction, cases, extracheck = null) { 
        this[lowerfunction]();
        let next = this.Read();
        const check = () => {
            if(next.Type == TokenTypes.OPERATOR) {
                if(extracheck != null) {
                    const result = extracheck(next);
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
    }

    ParseExpression() {
        // console.log("parsing expression");
        this.Parse("ParseCombiners", ["plant", "p", "+=", "-=", "*=", "/=", "%="], (next) => {
            if(next.Val == "++" || next.Val == "--") {
                return false; // end expression
            }
            return null;
        });
    }

    ParseCombiners() {
        // console.log("parsing combiners");
        this.Parse("ParseComparators", ["&&", "||"]);
    }

    ParseComparators() {
        // console.log("parsing comparators");
        this.Parse("ParseTerms", ["==", ">=", "<=", ">", "<", "!="]);
    }

    ParseTerms() {
        // console.log("parsing terms");
        this.Parse("ParseFactors", ["+", "-"]);
    }

    ParseFactors() {
        // console.log("parsing factors");
        this.Parse("ParseNegatives", ["*", "/", "%"]);
    }

    ParseNegatives() {
        // console.log("parsing negatives");
        const returned = this.Read();
        if(returned.Type == TokenTypes.OPERATOR) {
            if(returned.Val == "-" || returned.Val == "!") {
                this.ParseNegatives();
                return;
            }
        }
        this.Stored = returned;
        this.ParseCalls();
    }
    
    ParseCalls() {
        // console.log("parsing calls");
        this.ParseLowest();
        let next = this.Read();
        const checkCheck = () => {
            if(next.Val == "(") {
                this.ParseLi();
                this.RequireSymbol(")");
                return true;
            }
            if(next.Val == "[") {
                this.ParseExpression();
                this.RequireSymbol("]");
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
                    this.Read();
                    return true;
                }
            }
            this.Stored = next; // cancel viewing
            return false;
        }
        while(check()) {
            next = this.Read();
        }
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
                if(next.Type == TokenTypes.KEYWORD && next.Val != "this") { // can't declare a variable named "this"
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
                                const newscope = new Scope(this.Row, this.Col);
                                const saved = this.cs;
                                this.cs = newscope;
                                if(newType.Val == "plant" || newType.Val == "p") {
                                    this.cs.addVar(new Variable("input", CompletionItemKind.Variable, this.currentInt, "", ""));
                                    this.currentInt++;
                                }
                                this.ParseScope();
                                saved.append(newscope);
                                this.cs = saved;
                            } else {
                                throw this.Error("Only plant and harvest functions are valid in this context!");
                            }
                            this.RequireSymbol("}");
                        }
                        this.RequireSymbol("}");
                        return;
                    }
                    this.Stored = afterNext;
                    // console.log("adding var");
                    this.cs.addVar(new Variable(next.Val, CompletionItemKind.Variable, this.currentInt, "", ""));
                    this.currentInt++;
                    return;
                }
                throw this.Error(`Expecting a variable name instead of ${next.Val}!`);
            }
            if(returned.Val == "tool" || returned.Val == "t") {
                const newscope = new Scope(this.Row, this.Col);
                const saved = this.cs
                this.cs = newscope;
                this.RequireSymbol("(");
                this.ParseLi(true);
                this.RequireSymbol(")");
                this.RequireSymbol("{");
                this.ParseScope();
                this.RequireSymbol("}");
                saved.append(newscope);
                this.cs = saved;
                return;
            }
            if(returned.Val == "null" || returned.Val == "all") {
                return;
            }
            if(returned.Val == "throw" || returned.Val == "pass" || returned.Val == "import") {
                ParseExpression();
                return;
            }
            if(returned.Val == "class") {
                const next = this.Read();
                if(next.Type == TokenTypes.SYMBOL && next.Val == ":") {
                    // nothing to do here
                } else {
                    this.Stored = next;
                }
                this.RequireSymbol("{");
                this.ParseScope();
                this.RequireSymbol("}");
                return;
            }
            if(returned.Val == "new") {
                this.Read();
                this.RequireSymbol("(");
                this.ParseLi();
                this.RequireSymbol(")");
                return;
            }
        } else if(returned.Type == TokenTypes.STRING || returned.Type == TokenTypes.NUMBER || returned.Type == TokenTypes.BOOLEAN || returned.Type == TokenTypes.KEYWORD) {
            return;
        } else if(returned.Type == TokenTypes.SYMBOL) {
            if(returned.Val == "(") {
                this.ParseExpression();
                this.RequireSymbol(")");
                return;
            } 
            if(returned.Val == "[") {
                this.ParseLi();
                this.RequireSymbol("]");
                return;
            }
            if(returned.Val == "{") {
                this.ParseScope();
                this.RequireSymbol("}");
                return;
            }
        }
        throw this.Error(`Could not parse value: ${returned.Val}`);
    }
}
module.exports = Operations;