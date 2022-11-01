const TokenTypes = require('../classes/TokenTypes.js');
const LexEntry = require('../classes/LexEntry.js');
const global = require('../global.js');
const CharTypes = {
    letter: 0,
    digit: 1, 
    dot: 2,
    quotes: 3,
    hashtags: 4, 
    whitespace: 5,
    operators: 6,
    symbols: 7, // these cant be chained and are immediately parsed when added
    semis: 8
};
const dict = {};
const dotChar = '.';
const hashChar = '#';
const semi = ';';
const backslashes = {};
const init = () => {
    backslashes['n'] = '\n';
    backslashes['t'] = '\t';
    backslashes['r'] = '\r';
    const numbers = "0123456789";
    const letters = "abcdefghijklmnopqrstuvwxyz";
    for(let i = 0; i < letters.length; i++) {
        dict[letters[i]] = CharTypes.letter;
        dict[letters[i].toUpperCase()] = CharTypes.letter;
    }
    dict['_'] = CharTypes.letter;
    for(let i = 0; i < numbers.length; i++) {
        dict[numbers[i]] = CharTypes.digit;
    }
    const ops = "+-/*<>|&!=%^~";
    for(let i = 0; i < ops.length; i++) {
        dict[ops[i]] = CharTypes.operators;
    }
    const symbols = "(){}[],:\\?`";
    for(let i = 0; i < symbols.length; i++) {
        dict[symbols[i]] = CharTypes.symbols;
    }
    dict[dotChar] = CharTypes.dot;
    dict[' '] = CharTypes.whitespace;
    dict['\n'] = CharTypes.whitespace;
    dict['\r'] = CharTypes.whitespace;
    dict['\xa0'] = CharTypes.whitespace;
    dict['\t'] = CharTypes.whitespace;
    dict['"'] = CharTypes.quotes;
    dict["'"] = CharTypes.quotes;
    dict[hashChar] = CharTypes.hashtags;
    dict[semi] = CharTypes.semis;
}
init();



const getCharType = input => {
    if(dict[input] === undefined) {
        return CharTypes.letter;
    }
    return dict[input];
}

const getTokenType = (current, adding, currentRaw) => { // same = no change
    if(current == TokenTypes.COMMENT && (currentRaw.length == 1 || currentRaw[currentRaw.length - 1] != hashChar)) { // being in a comment gets first priority
        return TokenTypes.SAME;
    }
    if(current == TokenTypes.SEMIS && (currentRaw.length == 1 || currentRaw[currentRaw.length - 1] != semi)) { // being in a comment gets first priority
        return TokenTypes.SAME;
    }
    if(current == TokenTypes.STRING && (currentRaw.length == 1 || (currentRaw[currentRaw.length - 1] != '"' && currentRaw[currentRaw.length - 1] != "'"))) { // then being in a string
        return TokenTypes.SAME;
    }
    switch(adding) {
        case CharTypes.quotes:
            return TokenTypes.STRING;
        case CharTypes.hashtags:
            return TokenTypes.COMMENT;
        case CharTypes.semis:
            return TokenTypes.SEMIS;
        case CharTypes.whitespace:
            return TokenTypes.NONE;
        case CharTypes.letter:
            return (current == TokenTypes.KEYWORD) ? TokenTypes.SAME : TokenTypes.KEYWORD;
        case CharTypes.digit:
            return (current == TokenTypes.NUMBER || current == TokenTypes.KEYWORD) ? TokenTypes.SAME : TokenTypes.NUMBER;
        case CharTypes.dot:
            return (current == TokenTypes.NUMBER && currentRaw.indexOf(dotChar) == -1) ? TokenTypes.SAME : TokenTypes.SYMBOL; // if youre already in a number with no decimal points yet, consider this a decimal point : otherwise, its punctuation
        case CharTypes.symbols:
            return TokenTypes.SYMBOL;
        case CharTypes.operators:
            return (current == TokenTypes.OPERATOR) ? TokenTypes.SAME : TokenTypes.OPERATOR;
    }
}

const convert = (current, currentRaw) => {
    if(current == TokenTypes.KEYWORD) {
        let type = TokenTypes.KEYWORD;
        if(currentRaw == "yes" || currentRaw == "no") {
            type = TokenTypes.BOOLEAN;
        }
        if(global.autoCompleteDefaults.includes(currentRaw)) {
            type = TokenTypes.OPERATOR;
        }
        //Console.WriteLine($"Lexer returning {type}: {currentRaw}");
        return new LexEntry(type, currentRaw);
    }
    //Console.WriteLine($"Lexer returning {current}: {currentRaw}");
    return new LexEntry(current, currentRaw);
}

const resolve = (current, currentRaw, startPos, reader, operations) => {
    const savedline = startPos.line;
    const savedcol = startPos.character;
    startPos.line = reader.row;
    startPos.character = reader.col;
    if(savedline && savedcol && (current == TokenTypes.COMMENT || current == TokenTypes.SEMIS)) {
        operations.noHoverZones.push({
            startline: savedline, 
            startchar: savedcol + 1,
            endline: startPos.line, 
            endchar: startPos.character - 1
        });
    }

    if([TokenTypes.SEMIS, TokenTypes.NONE, TokenTypes.COMMENT].includes(current)) {
        if(current == TokenTypes.SEMIS) {
            operations.currentDocs = currentRaw;
        }
        operations.lastTrim = {
            line: startPos.line - 1, 
            character: startPos.character - 1
        };
        return false;
    }
    return convert(current, currentRaw);
}

const run = (reader, operations) => {
    operations.currentDocs = null;
    if(reader.EndOfStream) {
        operations.lastTrim = {
            line: reader.row - 1, 
            character: reader.col - 1
        };
        return new LexEntry(TokenTypes.ENDOFFILE, "");
    }
    let currentRaw = "";
    let current = TokenTypes.NONE;
    const startPos = {};
    let skip = false;
    do {
        const read = reader.Peek();
        if(read == '\\' && current == TokenTypes.STRING) {
            reader.Read();
            const next = reader.Peek();
            reader.Read();
            if(backslashes[next] !== undefined) {
                currentRaw += backslashes[next];
            } else {
                currentRaw += next;
            }
            skip = true;
        } else {
            const newToken = getTokenType(current, getCharType(read), currentRaw);
            if(skip || newToken == TokenTypes.SAME) {
                skip = false;
                reader.Read();
                currentRaw += read;
            } else {
                const resolved = resolve(current, currentRaw, startPos, reader, operations);
                if(resolved) {
                    return resolved;
                }
                reader.Read();
                current = newToken;
                currentRaw = read;
            }
        }
    } while(!reader.EndOfStream);
    const resolved = resolve(current, currentRaw, startPos, reader, operations);
    if(resolved) {
        return resolved;
    }
    return new LexEntry(TokenTypes.ENDOFFILE, "");
}

module.exports = run;
