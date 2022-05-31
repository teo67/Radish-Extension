class Response {
    constructor(__execute, _name, _default) {
        this._execute = __execute;
        this.name = _name;
        this.default = _default;
    }
    execute(arg) {
        try {
            return this._execute(arg);
        } catch(e) {
            console.log(`Response ${this.name} failed!\n${e}`);
            return this.default;
        }
    }
}
module.exports = Response;