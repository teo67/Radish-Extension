const Response = require('./Response.js');
const { cached, server2 } = require('../global.js');
const getobj = require('../functions/getobj.js');
const getResults = require('../functions/getResults.js');
const throughVar = require('../functions/throughVar.js');
const addToParams = (params, current, final, i) => {
    if(current != '') {
        const realCurrent = current[current.length - 1] == '?' ? current.slice(0, current.length - 1) : current;
        const adding = {
            label: [final.label.length + 9 + i - current.length, final.label.length + 9 + i], 
            documentation: {
                kind: server2.MarkupKind.Markdown, 
                value: `parameter name: **${realCurrent}**  
                `
            }
        }; 
        if(final.params[realCurrent] !== undefined) {
            adding.documentation.value += final.params[realCurrent];
        } else {
            adding.documentation.value += '*No documentation provided.*'
        }
        if(current[current.length - 1] == '?') {
            adding.documentation.value += `  
            *Note: this parameter is optional.*`;
        }
        params.push(adding);
    }
}

const default1 = {signatures:[]};
const signature = new Response(s => {
    const stored = cached[s.textDocument.uri];
    if(stored === undefined) {
        return default1;
    }
    const cs = stored.cs;
    if(cs === null) {
        return default1;
    }
    if(stored.ref._lineOffsets === undefined || stored.ref._content === undefined) {
        return default1;
    }
    
    let index = stored.ref._lineOffsets[s.position.line] + s.position.character - 1;
    const positionCopy = {
        line: s.position.line, 
        character: s.position.character
    };
    let numParentheses = 0;
    let numCommas = 0;
    while(index >= 0) {
        if(stored.ref._content[index] == ')') {
            numParentheses++;
        } else if(stored.ref._content[index] == '(') {
            numParentheses--;
            if(numParentheses < 0) {
                break;
            }
        } else if(stored.ref._content[index] == ',') {
            numCommas++;
        }
        index--;
        positionCopy.character--;
        if(positionCopy.character == -1) {
            positionCopy.line--;
            positionCopy.character = stored.ref._lineOffsets[positionCopy.line + 1] - stored.ref._lineOffsets[positionCopy.line] - 1;
        }
    }
    if(numParentheses >= 0) { // if we never began the function
        return default1;
    }
    positionCopy.character--; // this always works because the last character must be ( and therefore cannot be a newline
    const returned = getobj(stored.ref, stored.noHoverZones, positionCopy);
    
    if(returned === null) {
        return default1;
    }
    const all = getResults(cs, positionCopy, returned[0], returned[1]);
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
    if(final === null || final.detail.substring(0, 6) != '[tool]') {
        return default1;
    }
    const paramstring = final.detail.substring(8);
    let params = [];
    let current = '';
    for(let i = 0; i < paramstring.length; i++) {
        if(paramstring[i] == '}') {
            addToParams(params, current, final, i - 1); // to account for the space
            break;
        }
        if(paramstring[i] == ' ') {
            continue;
        }
        if(paramstring[i] == ',') {
            addToParams(params, current, final, i);
            current = '';
        } else {
            current += paramstring[i];
        }
    }
    
    return {
        signatures: [
            {
                label: `${final.label} ${final.detail}`,
                documentation: {
                    kind: server2.MarkupKind.Markdown, 
                    value: `tool name: **${final.label}**  
                    ${final.documentation.length < 1 ? '*No documentation provided.*' : final.documentation}  
                    ${final.returns === null ? '*No explicit return value.*' : `**returns** \`\`\`${final.returns.inner.detail}\`\`\``}`
                },
                parameters: params,
                activeParameter: numCommas
            }
        ], 
        activeSignature: 0, 
        activeParameter: numCommas
    };
}, "signature", default1);
module.exports = signature;