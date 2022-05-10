const { languageserver, connection, capabilities } = require('./global.js');

module.exports = async change => {
    const textDocument = change.document;
    const text = textDocument.getText();
    const diagnostics = [];
    const diagnostic = {
        severity: languageserver.DiagnosticSeverity.Warning,
        range: {
            start: textDocument.positionAt(0),
            end: textDocument.positionAt(1)
        },
        message: `abc`,
        source: 'ex'
    };
    if (capabilities.diagnostics) {
        diagnostic.relatedInformation = [
            {
                location: {
                    uri: textDocument.uri,
                    range: Object.assign({}, diagnostic.range)
                },
                message: 'Spelling matters bozo!!!'
            }
        ];
    }
    diagnostics.push(diagnostic);
    // Send the computed diagnostics to VSCode.
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}