class ReturnType {
    constructor(_type, _detail = "", _raw = [], _baseScope = null, _inherited = null, _linkedscope = null, _imported = null) {
        this.type = _type; // for example: CompletionItemKind.Variable
        this.raw = _raw; // array of string
        this.baseScope = _baseScope;
        this.inherited = _inherited;
        this.linkedscope = _linkedscope;
        this.detail = _detail;
        this.imported = _imported;
    }
    static Reference = 525; // enum to return type variable
}
module.exports = ReturnType;