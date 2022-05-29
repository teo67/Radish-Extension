Object.defineProperty(exports, "__esModule", { value: true });
const completionresolve = require('./completionresolve.js');
const completion = require('./completion.js');
const { documents, connection, documentSettings, languageserver, capabilities, tokenTypes, server2 } = require('./global.js');
const validate = require('./validate.js');
const assess = require('./assess.js');
const tokens = require('./tokens.js');
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
    if (capabilities.configuration) {
        documentSettings.clear();
    } else {
        globalSettings = ((change.settings.radishLanguageServer || defaultSettings));
    }
    documents.all().forEach(validate);
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
    //console.log("change");
    //console.log(`changed: ${change.document.version} ${new Date().getSeconds()}`);
    assess(change.document, connection);
});
connection.onDidChangeWatchedFiles(_change => {
    //console.log('We received a file change event');
});
connection.onCompletion(completion);
connection.onCompletionResolve(completionresolve);
connection.languages.semanticTokens.on(tokens);
connection.languages.semanticTokens.onRange(tokens);
documents.listen(connection);
connection.listen();