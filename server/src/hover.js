const getobj = require('./getobj.js');
const getResults = require('./getResults.js');
const { cached, server2 } = require('./global.js');
const Response = require('./Response.js');
const hover = new Response(params => {
    const stored = cached[params.textDocument.uri];
    if(stored === undefined) {
        return null;
    }
    const cs = stored.cs;
    if(cs === null) {
        return null;
    }
    
    //console.log("stage 1");
    //console.log(stored.ref);
    const returned = getobj(stored.ref, params.position);
    if(returned === null) {
        return null;
    }
    //console.log("stage 2");
    const all = getResults(cs, params.position, returned[0], returned[1]);
    let final = null;
    for(const inner of all) {
        if(inner.label == returned[0][0]) {
            final = inner;
        }
    }
    if(final === null) {
        return null;
    }
    let val = `*${final.label}*`;
    switch(final.kind) {
        case server2.CompletionItemKind.Class:
            val += ` (class)`;
            break; 
        case server2.CompletionItemKind.Field:
            val += ` (parameter)`;
            break; 
        case server2.CompletionItemKind.Function:
            val += ` (function)`;
            break;
        default:
            break;
    }
    val += `  
    \`\`\`  
    ${final.detail}  
    \`\`\`  
    ${final.documentation}`;
    return {
        contents: {
            kind: server2.MarkupKind.Markdown, 
            value: val
        }
    };
}, "hover", null);
module.exports = hover;