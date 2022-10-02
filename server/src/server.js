Object.defineProperty(exports, "__esModule", { value: true });
const completion = require('./handlers/completion.js');
const { documents, connection, languageserver, capabilities, tokenTypes, uselib, cached } = require('./global.js');
const assess = require('./handlers/assess.js');
const tokens = require('./handlers/tokens.js');
const hover = require('./handlers/hover.js');
const signature = require('./handlers/signature.js');
require('./circulars.js')(); // handle circular deps
if(uselib) {
    require('./functions/generate.js')();
}
connection.onInitialize((params) => {
    const _capabilities = params.capabilities;
    capabilities.configuration = !!(_capabilities.workspace && !!_capabilities.workspace.configuration);
    capabilities.workspaceFolder = !!(_capabilities.workspace && !!_capabilities.workspace.workspaceFolders);
    capabilities.diagnostics = !!(_capabilities.textDocument &&
        _capabilities.textDocument.publishDiagnostics &&
        _capabilities.textDocument.publishDiagnostics.relatedInformation);
    
    const result = {
        capabilities: {
            textDocumentSync: languageserver.TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['.', ':']
            },
            semanticTokensProvider: {
                legend: {
                    tokenTypes: tokenTypes,
                    tokenModifiers: []
                },
                range: true, 
                full: true
            },
            hoverProvider: true, 
            signatureHelpProvider: {
                triggerCharacters: ['(', ','], 
                retriggerCharacters: [',']
            }
        }
    };
    if (capabilities.workspaceFolder) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});
connection.onInitialized(() => {
    console.log("Radish Language Server is starting...");
    if (capabilities.configuration) {
        connection.client.register(languageserver.DidChangeConfigurationNotification.type, undefined);
    }
});
documents.onDidClose(e => {
    // if(cached[e.document.uri] !== undefined) {
    //     delete cached[e.document.uri];
    // }
});
documents.onDidChangeContent(change => {
    assess.execute(change.document).then(result => {
        if(result !== null) {
            connection.sendDiagnostics(result);
        }
    });
});
connection.onSignatureHelp(s => {
    return signature.execute(s);
});
connection.onCompletion(c => {
    return completion.execute(c);
});
connection.onCompletionResolve(item => {
    return item;
});
connection.languages.semanticTokens.on(t => {
    return tokens.execute(t);
});
connection.languages.semanticTokens.onRange(t => {
    return tokens.execute(t);
});
connection.onHover(h => {
    return hover.execute(h);
});
documents.listen(connection);
connection.listen();