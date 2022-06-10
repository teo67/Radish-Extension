const languageserver = require("vscode-languageserver/node");
const server2 = require("vscode-languageserver");
const textdocument = require("vscode-languageserver-textdocument");
const connection = (0, languageserver.createConnection)(languageserver.ProposedFeatures.all);
const documents = new languageserver.TextDocuments(textdocument.TextDocument);
const documentSettings = new Map();
const capabilities = {
    configuration: false, 
    workspaceFolder: false,
    diagnostics: false
};
const tokenTypes = [server2.SemanticTokenTypes.class, server2.SemanticTokenTypes.function, server2.SemanticTokenTypes.parameter];
const tokenKey = [server2.CompletionItemKind.Class, server2.CompletionItemKind.Function, server2.CompletionItemKind.Field];
const cached = {};
const autoCompleteDefaults = [
    "if", "elseif", "else", 
    "while", "for", 
    "dig", "d", "tool", "t", "plant", "p",
    "harvest", "h", "cancel", "continue", "end",
    "new", "null", "class",
    "public", "private", "protected", "static",
    "try", "catch", "throw", "import", "all"
];
const assessTime = 50;
let currentOperator = null;
module.exports = {
    languageserver, textdocument, connection, documents, documentSettings, capabilities, cached, server2, tokenTypes, tokenKey, autoCompleteDefaults, assessTime, currentOperator
};