const lex = require('./Lexing/Lexer.js');
const Scope = require('./Scope.js');
const Variable = require('./Variable.js');
const { textdocument, languageserver } = require('../global.js');
const { CompletionItemKind } = require('vscode-languageserver');
class Operations {
    static OpKeywords = [
        "if", "elseif", "else", 
        "while", "for", 
        "dig", "d", "tool", "t", "plant", "p",
        "harvest", "h", "cancel", "continue", "end",
        "new", "null", "class",
        "public", "private", "protected", "static",
        "try", "catch", "throw", "import", "all", "pass"
    ];
    constructor(reader) {
        this.reader = reader;
        this.Stored = null;
        this.PrevRow = -1;
        this.PrevCol = -1;
        this.currentInt = 0;
    }

    static IsKeyword(input) {
        return Operations.OpKeywords.includes(input);
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
        const returning = new Scope(this.Row, this.Col);
        let read = this.Read();
        while(read.Type != TokenTypes.ENDOFFILE && !(read.Type == TokenTypes.SYMBOL && read.Val == "}")) {
            if(read.Type == TokenTypes.OPERATOR && read.Val == "if") {
                this.Stored = read;
                const ifs = this.ParseIfs(returning);
                for(const _if of ifs) {
                    returning.append(_if);
                }
            } else if(read.Type == TokenTypes.OPERATOR && read.Val == "while") {
                this.RequireSymbol("(");
                returning.addVar(this.ParseExpression());
                this.RequireSymbol(")");
                this.RequireSymbol("{");
                returning.append(this.ParseScope());
                this.RequireSymbol("}");
            } else if(read.Type == TokenTypes.OPERATOR && read.Val == "for") {
                this.RequireSymbol("(");
                const innerScope = new Scope(this.Row, this.Col);
                innerScope.addVar(this.ParseLi());
                this.RequireSymbol(")");
                this.RequireSymbol("{");
                innerScope.append(this.ParseScope());
                this.RequireSymbol("}");
                returning.append(innerScope);
            } else if(read.Type == TokenTypes.OPERATOR && (read.Val == "cancel" || read.Val == "continue" || read.Val == "end")) {
                // nothing to do here
            } else if(read.Type == TokenTypes.OPERATOR && (read.Val == "harvest" || read.Val == "h")) {
                returning.addVar(this.ParseExpression());
            } else if(read.Type == TokenTypes.OPERATOR && read.Val == "try") {
                this.RequireSymbol("{");
                returning.append(this.ParseScope());
                this.RequireSymbol("}");
                const next = this.Read();
                if(next.Type == TokenTypes.OPERATOR && next.Val == "catch") {
                    this.RequireSymbol("{");
                    returning.append(this.ParseScope());
                    this.RequireSymbol("}");
                } else {
                    throw this.Error("Expecting catch phrase after try {}");
                }
            } else {
                this.Stored = read;
                returning.addVar(this.ParseExpression());
            }
            read = this.Read();
        }
        this.Stored = read;
        return returning;
    }

    ParseIfs(outerscope) { // array of scopes
        const returning = [];
        const IF = this.Read();
        if(!(IF.Type == TokenTypes.OPERATOR && IF.Val == "if")) {
            throw this.Error("Expecting if statement!");
        }
        returning.push(this.ParseIf(outerscope));
        let read = this.Read();
        while(read.Type == TokenTypes.OPERATOR && read.Val == "elseif") {
            returning.push(this.ParseIf(outerscope));
            read = this.Read();
        }
        if(read.Type == TokenTypes.OPERATOR && read.Val == "else") {
            this.RequireSymbol("{");
            returning.push(this.ParseScope());
            this.RequireSymbol("}");
        } else {
            this.Stored = read;
        }
        return returning;
    }

    ParseIf(outerscope) { // single scope
        this.RequireSymbol("(");
        outerscope.addVar(this.ParseExpression());
        this.RequireSymbol(")");
        this.RequireSymbol("{");
        const returning = this.ParseScope();
        this.RequireSymbol("}");
        return returning;
    }

    ParseLi(params = false) { // list of varis
        const returning = [];
        let read = this.Read();
        if(read.Type == TokenTypes.SYMBOL && (read.Val == "]" || read.Val == ")")) { // empty list
            this.Stored = read;
            return returning;
        }
        while(true) { 
            this.Stored = read;
            if(params) {
                let key = this.Read();
                if(key.Type != TokenTypes.KEYWORD) {
                    throw this.Error("Expecting a function parameter!");
                }
                LexEntry next = Read();
                IOperator? exp = null;
                if(next.Val == "plant" || next.Val == "p") {
                    exp = ParseExpression();
                } else {
                    Stored = next;
                }
                returning.Item1.Add(key.Val);
                returning.Item2.Add(exp);
                returning.push(new Variable(this.Read(), CompletionItemKind.Variable, this.currentInt, "", ""));
                this.currentInt++;
            } else {
                returning = returning.concat(this.ParseExpression());
            }
            
            const next = this.Read();

            if(!(next.Type == TokenTypes.SYMBOL && next.Val == ",")) {
                this.Stored = next;
                break;
            }

            read = this.Read();
        }
        return returning;
    }

    ParseArgs() {
        return ParseLi<(List<string>, List<IOperator?>)>(() => {
            return (new List<string>(), new List<IOperator?>());
        }, ((List<string>, List<IOperator?>) returning) => {
            LexEntry key = Read();
            if(key.Type != TokenTypes.KEYWORD) {
                Error("Expecting a function parameter!");
            }
            LexEntry next = Read();
            IOperator? exp = null;
            if(next.Val == "plant" || next.Val == "p") {
                exp = ParseExpression();
            } else {
                Stored = next;
            }
            returning.Item1.Add(key.Val);
            returning.Item2.Add(exp);
        });
    }

    private IOperator ParseAssignment(IOperator current, Func<IOperator, IOperator, IOperator> translate) {
        Print("parsing variable assignment");
        IOperator after = ParseCombiners();
        return new Operators.Assignment(current, translate(current, after), Row, Col);
    }

    private IOperator ParseExpression() {
        Print("begin expression");
        IOperator current = ParseCombiners();
        LexEntry next = Read();
        Func<bool> check = (() => {
            if(next.Type == TokenTypes.OPERATOR) {
                switch(next.Val) {
                    case "plant":
                    case "p":
                        current = ParseAssignment(current, (IOperator current, IOperator after) => { return after; });
                        break;
                    case "+=":
                        current = ParseAssignment(current, (IOperator current, IOperator after) => { return new Operators.Add(stack, current, after, Row, Col); });
                        break;
                    case "-=":
                        current = ParseAssignment(current, (IOperator current, IOperator after) => { return new Operators.Subtract(stack, current, after, Row, Col); });
                        break;
                    case "*=":
                        current = ParseAssignment(current, (IOperator current, IOperator after) => { return new Operators.Multiply(stack, current, after, Row, Col); });
                        break;
                    case "/=":
                        current = ParseAssignment(current, (IOperator current, IOperator after) => { return new Operators.Divide(stack, current, after, Row, Col); });
                        break;
                    case "%=":
                        current = ParseAssignment(current, (IOperator current, IOperator after) => { return new Operators.Modulo(stack, current, after, Row, Col); });
                        break;
                    case "++":
                        current = new Operators.Assignment(current, new Operators.Add(stack, current, new Operators.Number(stack, 1, Row, Col), Row, Col), Row, Col);
                        break;
                    case "--":
                        current = new Operators.Assignment(current, new Operators.Subtract(stack, current, new Operators.Number(stack, 1, Row, Col), Row, Col), Row, Col);
                        break;
                    default:
                        Stored = next;
                        return false;
                }
                return true;
            }
            Stored = next; // cancel viewing
            return false;
        });
        while(check()) {
            next = Read();
        }
        return current;
    }

    private IOperator ParseCombiners() {
        Print("begin combiners");
        IOperator current = ParseComparators();
        LexEntry next = Read();
        Func<bool> check = (() => {
            if(next.Type == TokenTypes.OPERATOR) {
                if(next.Val == "&&") {
                    Print("parsing and");
                    IOperator after = ParseComparators();
                    current = new Operators.And(stack, current, after, Row, Col);
                    return true;
                }
                if(next.Val == "||") {
                    Print("parsing or");
                    IOperator after = ParseComparators();
                    current = new Operators.Or(stack, current, after, Row, Col);
                    return true;
                }
            }
            Stored = next; // cancel viewing
            return false;
        });
        while(check()) {
            next = Read();
        }
        return current;
    }

    private IOperator ParseComparators() {
        Print("begin comparators");
        IOperator current = ParseTerms();
        LexEntry next = Read();
        Func<bool> check = (() => {
            if(next.Type == TokenTypes.OPERATOR) {
                if(next.Val == "==") {
                    Print("parsing double equals");
                    IOperator after = ParseTerms();
                    current = new Operators.EqualsEquals(stack, current, after, Row, Col);
                    return true;
                }
                if(next.Val == ">=") {
                    Print("parsing more than equals");
                    IOperator after = ParseTerms();
                    current = new Operators.MoreThanOrEquals(stack, current, after, Row, Col);
                    return true;
                }
                if(next.Val == "<=") {
                    Print("parsing less than equals");
                    IOperator after = ParseTerms();
                    current = new Operators.LessThanOrEquals(stack, current, after, Row, Col);
                    return true;
                }
                if(next.Val == ">") {
                    Print("parsing more than");
                    IOperator after = ParseTerms();
                    current = new Operators.MoreThan(stack, current, after, Row, Col);
                    return true;
                }
                if(next.Val == "<") {
                    Print("parsing less than");
                    IOperator after = ParseTerms();
                    current = new Operators.LessThan(stack, current, after, Row, Col);
                    return true;
                }
                if(next.Val == "!=") {
                    Print("parsing not equals");
                    IOperator after = ParseTerms();
                    current = new Operators.Invert(stack, new Operators.EqualsEquals(stack, current, after, Row, Col), Row, Col);
                    return true;
                }
            }
            Stored = next; // cancel viewing
            return false;
        });
        while(check()) {
            next = Read();
        }
        return current;
    }

    private IOperator ParseTerms() {
        Print("begin terms");
        IOperator current = ParseFactors();
        LexEntry next = Read();
        Func<bool> check = (() => {
            if(next.Type == TokenTypes.OPERATOR) {
                if(next.Val == "+") {
                    Print("parsing plus");
                    IOperator after = ParseFactors();
                    current = new Operators.Add(stack, current, after, Row, Col);
                    return true;
                }
                if(next.Val == "-") {
                    Print("parsing minus");
                    IOperator after = ParseFactors();
                    current = new Operators.Subtract(stack, current, after, Row, Col);
                    return true;
                }
            }
            Stored = next; // cancel viewing
            return false;
        });
        while(check()) {
            next = Read();
        }
        return current;
    }

    private IOperator ParseFactors() {
        Print("begin factors");
        IOperator current = ParseNegatives();
        LexEntry next = Read();
        Func<bool> check = (() => {
            if(next.Type == TokenTypes.OPERATOR) {
                if(next.Val == "*") {
                    Print("parsing multiply");
                    IOperator after = ParseNegatives();
                    current = new Operators.Multiply(stack, current, after, Row, Col);
                    return true;
                }
                if(next.Val == "/") {
                    Print("parsing divide");
                    IOperator after = ParseNegatives();
                    current = new Operators.Divide(stack, current, after, Row, Col);
                    return true;
                }
                if(next.Val == "%") {
                    Print("parsing modulo");
                    IOperator after = ParseNegatives();
                    current = new Operators.Modulo(stack, current, after, Row, Col);
                    return true;
                }
            }
            Stored = next; // cancel viewing
            return false;
        });
        while(check()) {
            next = Read();
        }
        return current;
    }

    private IOperator ParseNegatives() {
        LexEntry returned = Read();
        if(returned.Type == TokenTypes.OPERATOR) {
            if(returned.Val == "-") {
                return new Operators.Multiply(stack, new Operators.Number(stack, -1.0, Row, Col), ParseNegatives(), Row, Col);
            }
            if(returned.Val == "!") {
                return new Operators.Invert(stack, ParseNegatives(), Row, Col);
            }
        }
        Stored = returned;
        return ParseCalls();
    }
    
    private IOperator ParseCalls() {
        Print("begin calls");
        IOperator current = ParseLowest();
        LexEntry next = Read();
        Func<bool> checkCheck = (() => {
            if(next.Val == "(") {
                Print("parsing function call");
                IOperator args = ParseList();
                RequireSymbol(")");
                current = new Operators.FunctionCall(current, args, stack, Row, Col);
                return true;
            }
            if(next.Val == "[") {
                Print("parsing object accessor via array brackets");
                IOperator exp = ParseExpression();
                RequireSymbol("]");
                current = new Operators.BracketGet(current, exp, stack, Row, Col);
                return true;
            }
            return false;
        });
        Func<bool> check = (() => {
            if(next.Type == TokenTypes.SYMBOL) {
                while(checkCheck()) {
                    next = Read();
                }
                if(next.Val == ".") {
                    Print("parsing accessor");
                    LexEntry read = Read();
                    current = new Operators.Get(current, read.Val, stack, Row, Col);
                    return true;
                }
            }
            Stored = next; // cancel viewing
            return false;
        });
        while(check()) {
            next = Read();
        }
        return current;
    }

    private IOperator ParseLowest() {
        Print("begin lowest");
        LexEntry returned = Read();
        if(returned.Type == TokenTypes.OPERATOR) {
            if(returned.Val == "dig" || returned.Val == "d") {
                Print("parsing variable definition");
                LexEntry next = Read();
                List<string> modifiers = new List<string>();
                while(next.Type == TokenTypes.OPERATOR && (next.Val == "public" || next.Val == "private" || next.Val == "protected" || next.Val == "static")) {
                    modifiers.Add(next.Val);
                    next = Read();
                }
                if(next.Type == TokenTypes.KEYWORD && next.Val != "this") { // can't declare a variable named "this"
                    LexEntry afterNext = Read();
                    if(afterNext.Type == TokenTypes.SYMBOL && afterNext.Val == "{") {
                        Print("parsing variable as property");
                        IOperator? give = null;
                        IOperator? _get = null;
                        for(int i = 0; i < 2; i++) {
                            LexEntry newType = Read();
                            if(newType.Type == TokenTypes.SYMBOL && newType.Val == "}") {
                                Stored = newType;
                                break;
                            }
                            if(newType.Type != TokenTypes.OPERATOR) {
                                throw new RadishException($"Expecting plant or harvest function instead of {newType.Val}!");
                            }
                            RequireSymbol("{");
                            if(newType.Val == "plant" || newType.Val == "p") {
                                give = new Operators.FunctionDefinition(stack, new List<string>() { "input" }, new List<IOperator?>() { null }, ParseScope(), Row, Col);

                            } else if(newType.Val == "harvest" || newType.Val == "h") {
                                _get = new Operators.FunctionDefinition(stack, new List<string>(), new List<IOperator?>(), ParseScope(), Row, Col);
                            } else {
                                throw new RadishException("Only plant and harvest functions are valid in this context!");
                            }
                            RequireSymbol("}");
                        }
                        RequireSymbol("}");
                        return new Operators.Property(stack, next.Val, give, _get, modifiers, Row, Col);
                    }
                    Stored = afterNext;
                    return new Operators.Declaration(stack, next.Val, modifiers, Row, Col);
                }
                throw new RadishException($"Expecting a variable name instead of {next.Val}!");
            }
            if(returned.Val == "tool" || returned.Val == "t") {
                Print("parsing function definition");
                RequireSymbol("(");
                (List<string>, List<IOperator?>) args = ParseArgs();
                RequireSymbol(")");
                RequireSymbol("{");
                Operators.ExpressionSeparator body = ParseScope();
                RequireSymbol("}");
                Operators.FunctionDefinition def = new Operators.FunctionDefinition(stack, args.Item1, args.Item2, body, Row, Col);
                return def;
            }
            if(returned.Val == "null") {
                Print("parsing NULL");
                return new Operators.NullValue(Row, Col);
            }
            if(returned.Val == "all") {
                Print("parsing ALL");
                return new Operators.All(stack, Row, Col);
            }
            if(returned.Val == "throw") {
                Print("parsing throw statement");
                IOperator throwing = ParseExpression();
                return new Operators.Throw(throwing, stack, Row, Col);
            }
            if(returned.Val == "pass") {
                Print("parsing inverse await");
                IOperator passing = ParseExpression();
                return new Operators.Pass(passing, Row, Col);
            }
            if(returned.Val == "import") {
                Print("parsing import");
                IOperator importing = ParseExpression();
                return new Operators.Import(stack, importing, Row, Col);
            }
            if(returned.Val == "class") {
                Print("parsing class definition");
                string _base = "Object";
                LexEntry next = Read();
                if(next.Type == TokenTypes.SYMBOL && next.Val == ":") {
                    _base = Read().Val;
                } else {
                    Stored = next;
                }
                RequireSymbol("{");
                Print("parsing class body");
                IOperator body = ParseScope();
                Print("parsing closing braces");
                RequireSymbol("}");
                return new Operators.ClassDefinition(stack, body, _base, Row, Col);
            }
            if(returned.Val == "new") {
                Print("parsing class instantiation");
                LexEntry next = Read();
                Print("parsing opening paren.");
                RequireSymbol("(");
                IOperator args = ParseList();
                Print("parsing closing paren.");
                RequireSymbol(")");
                return new Operators.New(stack, next.Val, args, Row, Col);
            }
        } else if(returned.Type == TokenTypes.STRING) {
            Print("parsing string");
            return new Operators.String(stack, returned.Val, Row, Col);
        } else if(returned.Type == TokenTypes.NUMBER) {
            Print("parsing number");
            return new Operators.Number(stack, Double.Parse(returned.Val), Row, Col);
        } else if(returned.Type == TokenTypes.BOOLEAN) {
            Print("parsing boolean");
            return new Operators.Boolean(returned.Val == "yes", stack, Row, Col);
        } else if(returned.Type == TokenTypes.KEYWORD) {
            Print("parsing variable");
            return new Operators.Reference(stack, returned.Val, Row, Col);
        } else if(returned.Type == TokenTypes.SYMBOL) {
            if(returned.Val == "(") {
                Print("parsing opening paren.");
                Print("parsing expression");
                IOperator returning = ParseExpression();
                Print("parsing closing paren.");
                RequireSymbol(")");
                return returning;
            } 
            if(returned.Val == "[") {
                Print("parsing opening square brackets");
                Operators.ListSeparator returning = ParseList();
                Print("parsing closing square brackets");
                RequireSymbol("]");
                return returning;
            }
            if(returned.Val == "{") {
                Print("parsing object literal");
                Operators.ExpressionSeparator body = ParseScope();
                Print("parsing closing braces");
                RequireSymbol("}");
                return new Operators.ObjectDefinition(stack, body, Row, Col);
            }
        }
        throw Error($"Could not parse value: {returned.Val} !");
    }
}