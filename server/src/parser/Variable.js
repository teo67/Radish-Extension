class Item {
    constructor(_detail, _documentation) {
        this.detail = _detail;
        this.documentation = _documentation;
    }
}
class Variable {
    constructor(_label, _kind, _data, _detail, _documentation) {
        this.label = _label;
        this.kind = _kind;
        this.data = _data;
        this.item = new Item(_detail, _documentation);
    }
}
module.exports = Variable;