const RadishException = require('./RadishException.js');
class CountingReader {
    static Path = "";
    constructor(file) {
        this.row = 1;
        this.col = 1;
        this.index = 0;
        this.file = file;
    }
    get EndOfStream() {
        return this.index >= this.file.getText().length;
    }
    Peek() {
        return this.file.getText()[this.index];
    }
    Read() {
        const returning = this.Peek();
        if(returning == '\r' || returning == '\n') {
            this.row++;
            this.col = 1;
        } else {
            this.col++;
        }
        this.index++;
        return returning;
    }
    Error(msg, row = this.row, col = this.col) {
        return new RadishException(msg, row, col);
    }
}

module.exports = CountingReader;