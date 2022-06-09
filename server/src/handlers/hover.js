const getobj = require('../functions/getobj.js');
const getResults = require('../functions/getResults.js');
const { cached, server2 } = require('../global.js');
const Response = require('./Response.js');
const throughVar = require('../functions/throughVar.js');
const hover = new Response(params => {
    const stored = cached[params.textDocument.uri];
    if(stored === undefined) {
        return null;
    }
    const cs = stored.cs;
    if(cs === null) {
        return null;
    }
    
    const realPosition = {
        line: params.position.line, 
        character: params.position.character + 1 // for some reason the position given is off
    };
    //console.log(realPosition);
    const returned = getobj(stored.ref, stored.noHoverZones, realPosition, true);
    //console.log(returned);
    if(returned === null) {
        return null;
    }
    //console.log("stage 2");
    const all = getResults(cs, realPosition, returned[0], returned[1]);
    let final = null;
    if(returned[0][0] == "()") {
        final = all.returns === null ? null : all.returns.inner;
    } else {
        const throughd = throughVar(all.properties, all.inherited);
        for(const inner of throughd) {
            if(inner.label == returned[0][0]) {
                final = inner;
            }
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
    \`\`\`${final.detail}\`\`\`  
    ${final.documentation}`;
    if(final.returns !== null) {
        //console.log("yes");
        val += `**returns** \`\`\`${final.returns.inner.detail}\`\`\``;
    }
    //console.log(val);
    return {
        contents: {
            kind: server2.MarkupKind.Markdown, 
            value: val
        }
    };
}, "hover", null);
module.exports = hover;