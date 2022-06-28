const through = require('./through.js');
const findInVariable = require('./findInVariable.js');
const findProto = (bs, searching) => {
    for(const v of bs) {
        if(v.inner.label == searching) {
            return v;
        }
    }
    throw `Unable to find ${searching}!`;
}
module.exports = (bs, cs, position, returned, newPosition, arrayEnds) => {
    const allvars = through(cs, position, true, bs);
    let current = allvars;
    let currentinherited = null;
    let currentreturn = null;
    for(let i = returned.length - 1; i > 0; i--) {
        if(returned[i] == '') { // some kind of error
            current = [];
            currentinherited = null;
            currentreturn= null;
            break;
        }
        if(i == returned.length - 1) {
            if(returned[i] == '}') {
                current = through(cs, newPosition, false, bs);
                if(!(current.endline - 1 == newPosition.line && current.endchar == newPosition.character)) {
                    current = [];
                    currentinherited = null;
                    currentreturn = null;
                    break;
                }
                if(current.returns === null) {
                    current = current.vars;
                    currentinherited = findProto(bs, 'Object');
                    currentreturn = null;
                } else {
                    currentreturn = current.returns;
                    current = [];
                    currentinherited = findProto(bs, 'Function');
                    
                }
                continue;
            }
            let isOne = true;
            if(returned[i] == '"') {
                currentinherited = findProto(bs, 'String');
            } else if(returned[i] == 'yes' || returned[i] == 'no') {
                currentinherited = findProto(bs, 'Boolean');
            } else if(returned[i].length > 0 && ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(returned[i][0])) {
                currentinherited = findProto(bs, 'Number');
            } else if(returned[i] == ']') {
                let found = false;
                for(const end of arrayEnds) {
                    if(end.line == newPosition.line && end.character == newPosition.character) {
                        found = true;
                    }
                }
                currentinherited = found ? findProto(bs, 'Array') : null;
            } else {
                isOne = false;
            }
            if(isOne) {
                current = [];
                currentreturn = null;
                continue;
            }
        }
        const vari = returned[i] == "()" ? currentreturn : findInVariable(returned[i], current, currentinherited);
        if(vari === null) {
            current = [];
            currentinherited = null;
            currentreturn = null;
            break;
        }
        current = vari.properties;
        currentinherited = vari.inherited;
        currentreturn = vari.returns;
    }
    return {
        properties: current, 
        inherited: currentinherited, 
        returns: currentreturn
    };
}