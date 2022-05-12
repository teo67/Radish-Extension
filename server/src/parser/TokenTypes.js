const TokenTypes = {
    SAME: 0, // not used after lex stage, represents a continuation of the same token
    NONE: 1, // not used after lex stage, represents token scheduled for deletion
    COMMENT: 2, // also not used after lex stage
    STRING: 3, 
    NUMBER: 4,
    OPERATOR: 5,
    BOOLEAN: 6,
    SYMBOL: 7,
    KEYWORD: 8,
    ENDOFFILE: 9
};
module.exports = TokenTypes;