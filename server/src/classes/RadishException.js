class RadishException extends Error {
    constructor(message, row, col) {
        super(message);
        this.row = row;
        this.col = col;
    }
}
module.exports = RadishException;