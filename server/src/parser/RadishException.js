class RadishException extends Error {
    constructor(message, row, col) {
        this.message = message;
        this.row = row;
        this.col = col;
    }
}
module.exports = RadishException;