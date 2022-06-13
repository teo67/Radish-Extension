
const { languageserver, cached, autoCompleteDefaults, server2 } = require('../global');
const getResults = require('../functions/getResults.js');
const getobj = require('../functions/getobj.js');
const Response = require('./Response.js');
const throughVar = require('../functions/throughVar.js');
let defaults = [];
for(const def of autoCompleteDefaults) {
    defaults.push({
        label: def, 
        kind: server2.CompletionItemKind.Value, 
        data: -1, 
        detail: `[operator: ${def}]`, 
        documentation: {
            kind: server2.MarkupKind.Markdown, 
            value: 'A built-in `Radish` operator. See https://radishpl.com for implementations.'
        }
    });
}
const completion = new Response(_textDocumentPosition => {
    
    const stored = cached[_textDocumentPosition.textDocument.uri];
    if(stored === undefined) {
        return [];
    }
    const cs = stored.cs;
    if(cs === null) {
        return [];
    }
    const returned = getobj(stored.ref, stored.noHoverZones, _textDocumentPosition.position);
    if(returned === null) {
        return [];
    }
    
    const results = getResults(cs, _textDocumentPosition.position, returned[0], returned[1]);
    let all = throughVar(results.properties, results.inherited);
    
    if(returned[0].length == 1) { // only add defaults if we aren't accessing a property
        all = defaults.concat(all);
    }
    
    return all;
}, "completion", []);
module.exports = completion;