const languageserver = require("vscode-languageserver/node");
const textdocument = require("vscode-languageserver-textdocument");
const connection = (0, languageserver.createConnection)(languageserver.ProposedFeatures.all);
const documents = new languageserver.TextDocuments(textdocument.TextDocument);
const documentSettings = new Map();
const capabilities = {
    configuration: false, 
    workspaceFolder: false,
    diagnostics: false
};
const cached = {};
module.exports = {
    languageserver, textdocument, connection, documents, documentSettings, capabilities, cached
};