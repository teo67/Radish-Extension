Object.defineProperty(exports, "__esModule", { value: true });
const completion = require('./handlers/completion.js');
const { documents, connection, documentSettings, languageserver, capabilities, tokenTypes, server2 } = require('./global.js');
const assess = require('./handlers/assess.js');
const tokens = require('./handlers/tokens.js');
const hover = require('./handlers/hover.js');
const signature = require('./handlers/signature.js');
require('./circulars.js')(); // handle circular deps
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
                triggerCharacters: ['.']
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
    console.log("initializing");
    if (capabilities.configuration) {
        connection.client.register(languageserver.DidChangeConfigurationNotification.type, undefined);
    }
    if (capabilities.workspaceFolder) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            console.log('Workspace folder change event received.');
        });
    }
});

const defaultSettings = { maxNumberOfProblems: 1000 };
let globalSettings = defaultSettings;

connection.onDidChangeConfiguration(change => {
    console.log("changed config");
    if (capabilities.configuration) {
        documentSettings.clear();
    } else {
        globalSettings = ((change.settings.radishLanguageServer || defaultSettings));
    }
});
function getDocumentSettings(resource) {
    if (!capabilities.configuration) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'radishLanguageServer'
        });
        documentSettings.set(resource, result);
    }
    return result;
}
documents.onDidClose(e => {
    documentSettings.delete(e.document.getText());
});
documents.onDidChangeContent(change => {
    //console.log(documents.all());
    //console.log("changed content");
    assess.execute(change.document).then(result => {
        if(result !== null) {
            connection.sendDiagnostics(result);
        }
    });
});
connection.onSignatureHelp(s => {
    return signature.execute(s);
});
connection.onDidChangeWatchedFiles(_change => {
    //assess
    console.log('We received a file change event');
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