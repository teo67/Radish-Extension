const TokenTypes = require('../TokenTypes.js');
const LexEntry = require('./LexEntry.js');
const OpKeywords = require('../../global').autoCompleteDefaults;
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
const quoteChar = '"';
const hashChar = '#';
const semi = ';';
const init = () => {
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
    const ops = "+-/*<>|&!=%\\";
    for(let i = 0; i < ops.length; i++) {
        dict[ops[i]] = CharTypes.operators;
    }
    const symbols = "(){}[],:";
    for(let i = 0; i < symbols.length; i++) {
        dict[symbols[i]] = CharTypes.symbols;
    }
    dict[dotChar] = CharTypes.dot;
    dict[' '] = CharTypes.whitespace;
    dict['\n'] = CharTypes.whitespace;
    dict['\r'] = CharTypes.whitespace;
    dict['\xa0'] = CharTypes.whitespace;
    dict['\t'] = CharTypes.whitespace;
    dict[quoteChar] = CharTypes.quotes;
    dict[hashChar] = CharTypes.hashtags;
    dict[semi] = CharTypes.semis;
}
init();



const GetCharType = input => {
    if(dict[input] === undefined) {
        return CharTypes.letter;
    }
    return dict[input];
}

const GetTokenType = (current, adding, currentRaw) => { // same = no change
    if(current == TokenTypes.COMMENT && currentRaw.indexOf(hashChar) == currentRaw.lastIndexOf(hashChar)) { // being in a comment gets first priority
        return TokenTypes.SAME;
    }
    if(current == TokenTypes.SEMIS && currentRaw.indexOf(semi) == currentRaw.lastIndexOf(semi)) { // being in a comment gets first priority
        return TokenTypes.SAME;
    }
    if(current == TokenTypes.STRING && currentRaw.indexOf(quoteChar) == currentRaw.lastIndexOf(quoteChar)) { // then being in a string
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
        default:
            throw new Error("Something went wrong in the lex phase.");
    }
}

const Convert = (current, currentRaw) => {
    if(current == TokenTypes.KEYWORD) {
        let type = TokenTypes.KEYWORD;
        if(currentRaw == "yes" || currentRaw == "no") {
            type = TokenTypes.BOOLEAN;
        }
        if(OpKeywords.includes(currentRaw)) {
            type = TokenTypes.OPERATOR;
        }
        //Console.WriteLine($"Lexer returning {type}: {currentRaw}");
        return new LexEntry(type, currentRaw);
    }
    if(current == TokenTypes.STRING) {
        return new LexEntry(current, currentRaw.slice(1, currentRaw.length - 1));
    }
    //Console.WriteLine($"Lexer returning {current}: {currentRaw}");
    return new LexEntry(current, currentRaw);
}

const Run = reader => {
    if(reader.EndOfStream) {
        return new LexEntry(TokenTypes.ENDOFFILE, "");
    }
    let currentRaw = "";
    let current = TokenTypes.NONE;
    do {
        const read = reader.Peek();
        const newToken = GetTokenType(current, GetCharType(read), currentRaw);
        if(newToken == TokenTypes.SAME) {
            reader.Read();
            currentRaw += read;
        } else {
            if(current != TokenTypes.COMMENT && current != TokenTypes.NONE) {
                return Convert(current, currentRaw);
            }
            reader.Read();
            current = newToken;
            currentRaw = read;
        }
    } while(!reader.EndOfStream);
    if(current == TokenTypes.COMMENT || current == TokenTypes.NONE) {
        return new LexEntry(TokenTypes.ENDOFFILE, "");
    }
    return Convert(current, currentRaw);
}

module.exports = Run;
