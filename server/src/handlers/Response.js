class Response {
    constructor(__execute, _name, _default) {
        this._execute = __execute;
        this.name = _name;
        this.default = _default;
    }
    async execute(arg) {
        try {
            //console.log(`Starting ${this.name}...`);
            const returned = await this._execute(arg);
            //console.log(`Completed ${this.name}!`);
            return returned;
        } catch(e) {
            console.log(`Response ${this.name} failed!`);
            //console.log(e);
            return this.default;
        }
    }
}
module.exports = Response;