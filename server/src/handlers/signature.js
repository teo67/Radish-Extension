const Response = require('./Response.js');
const { cached, server2 } = require('../global.js');
const getobj = require('../functions/getobj.js');
const getResults = require('../functions/getResults.js');
const throughVar = require('../functions/throughVar.js');
const Stack = require('../classes/Stack.js');
const addToParams = (params, current, final, i) => {
    if(current != '') {
        const realCurrent = current[current.length - 1] == '?' ? current.slice(0, current.length - 1) : current;
        const adding = {
            label: [final.inner.label.length + 9 + i - current.length, final.inner.label.length + 9 + i], 
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
    let numCommas = 0;
    const stack = new Stack();
    while(index >= 0) {
        const i = stored.ref._content[index];
        if(stack.head === null) {
            if(i == '(') {
                break; // good
            }
            if(i == ',') {
                numCommas++;
            }
        }
        if(!stack.add(i)) {
            return default1;
        }
        index--;
        positionCopy.character--;
        if(positionCopy.character == -1) {
            positionCopy.line--;
            positionCopy.character = stored.ref._lineOffsets[positionCopy.line + 1] - stored.ref._lineOffsets[positionCopy.line] - 1;
        }
    }
    if(stack.head !== null || index < 0) { // if something is wrong
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
        final = all.returns;
    } else {
        const throughd = throughVar(all.properties, all.inherited);
        for(const vari of throughd) {
            if(vari.inner.label == returned[0][0]) {
                final = vari;
            }
        }
    }
    if(final === null || final.inner.detail.substring(0, 6) != '[tool]') {
        return default1;
    }
    const paramstring = final.inner.detail.substring(8);
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
                label: `${final.inner.label} ${final.inner.detail}`,
                documentation: {
                    kind: server2.MarkupKind.Markdown, 
                    value: `tool name: **${final.inner.label}**  
                    ${final.inner.documentation.length < 1 ? '*No documentation provided.*' : final.inner.documentation}  
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