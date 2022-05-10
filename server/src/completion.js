const { languageserver, cached } = require('./global');
module.exports = _textDocumentPosition => {
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.
    console.log(cached[_textDocumentPosition.textDocument.uri].vars);
    return cached[_textDocumentPosition.textDocument.uri].vars;
}