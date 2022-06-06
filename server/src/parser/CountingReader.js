const RadishException = require('./RadishException.js');
class CountingReader {
    constructor(file, startrow = 1, startcol = 1) {
        this.row = startrow;
        this.col = startcol;
        this.index = 0;
        this.file = file;
    }
    get EndOfStream() {
        return this.index >= this.file._content.length;
    }
    Peek() {
        //console.log(this.file);
        return this.file._content[this.index];
    }
    Read() {
        const returning = this.Peek();
        if(returning == '\r') {
            this.index++;
            return this.Read();
        }
        if(returning == '\n') {
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