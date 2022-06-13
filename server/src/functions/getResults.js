const through = require('./through.js');
const findInVariable = require('./findInVariable.js');
module.exports = (cs, position, returned, newPosition) => {
    const allvars = through(cs, position);
    
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
        if(i == returned.length - 1 && returned[i] == '}') {
            current = through(cs, newPosition, false);
            if(!(current.endline - 1 == newPosition.line && current.endchar == newPosition.character)) {
                
                current = [];
                currentinherited = null;
                currentreturn = null;
                break;
            }
            
            
            current = current.vars;
            currentinherited = null;
            currentreturn= null;
        } else {
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
    }
    return {
        properties: current, 
        inherited: currentinherited, 
        returns: currentreturn
    };
}