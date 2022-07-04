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
    "harvest", "h", "cancel", "continue", "end", "fill",
    "new", "null", "class",
    "public", "private", "protected", "static",
    "try", "catch", "throw", "import", "all", "PATH", "enum"
];
const assessTime = 50;
const uselib = true; // only set to false if you don't want any standard library
const create = name => {
    return new Variable(name, server2.CompletionItemKind.Variable, "[object]", `The default object from which all Radish ${name.toLowerCase()}s extend.`);
}
const baseScope = [];
for(const name of ["Object", "Array", "Boolean", "Function", "Number", "String"]) {
    const cr = create(name);
    if(baseScope.length > 0) {
        cr.inherited = baseScope[0];
    }
    baseScope.push(cr);
    if(!uselib) {
        cr.evaluated = true;
    }
}
module.exports = {
    languageserver, textdocument, connection, documents, documentSettings, capabilities, cached, server2, tokenTypes, tokenKey, autoCompleteDefaults, assessTime, importCache, baseScope, uselib
};