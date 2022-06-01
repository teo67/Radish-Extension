
const { languageserver, cached, autoCompleteDefaults, server2 } = require('./global');
const getResults = require('./getResults.js');
const getobj = require('./getobj.js');
const Response = require('./Response.js');
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
    //console.log("i am here");
    const stored = cached[_textDocumentPosition.textDocument.uri];
    if(stored === undefined) {
        return [];
    }
    const cs = stored.cs;
    if(cs === null) {
        return [];
    }
    const returned = getobj(stored.ref, _textDocumentPosition.position);
    if(returned === null) {
        return [];
    }
    //console.log(returned[1]);
    let all = getResults(cs, _textDocumentPosition.position, returned[0], returned[1]);
    //console.log(all);
    if(returned.length == 1) { // only add defaults if we aren't accessing a property
        all = defaults.concat(all);
    }
    
    return all;
}, "completion", []);
module.exports = completion;