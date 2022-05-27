class Inner {
    constructor(_label, _kind, _data, _detail, _documentation) {
        this.label = _label; // name
        this.kind = _kind; // type (var, function, class)
        this.data = _data; // unique int tag
        this.detail = _detail; // completion details
        this.documentation = _documentation; // more completion details
    }
}
class Variable {
    constructor(_label, _kind, _data, _detail, _documentation) {
        this.inner = new Inner(_label, _kind, _data, _detail, _documentation); // data used for completion, etc
        this.properties = []; // array of variables that are straight up properties
        this.inherited = null; // variable that this variable inherits from (class usually)
        this.evaluated = false; // whether the variable has been evaluated using the dependency engine
        this.deps = []; // dependencies to run once the variable is evaluated
        this.propertydeps = {};
        this.ignore = false;
    }
}
module.exports = Variable;