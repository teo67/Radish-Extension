const languageserver = require("vscode-languageserver/node");
const server2 = require("vscode-languageserver");
const textdocument = require("vscode-languageserver-textdocument");
const Variable = require('./classes/Variable.js');
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
const importCache = {};
const autoCompleteDefaults = [
    "if", "elseif", "else", 
    "while", "for", 
    "dig", "d", "tool", "t", "plant", "p", "uproot",
    "harvest", "h", "cancel", "continue", "end",
    "new", "null", "class",
    "public", "private", "protected", "static",
    "try", "catch", "throw", "import", "all"
];
const assessTime = 50;
const uselib = false; // only set to false if you don't want any standard library
const protos = {
    ARRAY: new Variable("Array", server2.CompletionItemKind.Variable, "[object]", "The default object from which all Radish arrays extend."),
    BOOLEAN: new Variable("Boolean", server2.CompletionItemKind.Variable, "[object]", "The default object from which all Radish booleans extend."),
    FUNCTION: new Variable("Function", server2.CompletionItemKind.Variable, "[object]", "The default object from which all Radish functions extend."),
    NUMBER: new Variable("Number", server2.CompletionItemKind.Variable, "[object]", "The default object from which all Radish numbers extend."),
    OBJECT: new Variable("Object", server2.CompletionItemKind.Variable, "[object]", "The default object from which all Radish objects extend."),
    STRING: new Variable("String", server2.CompletionItemKind.Variable, "[object]", "The default object from which all Radish strings extend.")
};
const baseScope = [protos.ARRAY, protos.BOOLEAN, protos.FUNCTION, protos.NUMBER, protos.OBJECT, protos.STRING];
module.exports = {
    languageserver, textdocument, connection, documents, documentSettings, capabilities, cached, server2, tokenTypes, tokenKey, autoCompleteDefaults, assessTime, importCache, protos, baseScope, uselib
};