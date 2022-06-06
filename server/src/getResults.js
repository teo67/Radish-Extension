const through = require('./through.js');
const findInVar = require('./findInVar.js');
const throughVar = require('./throughVar.js');
module.exports = (cs, position, returned, newPosition) => {
    const allvars = through(cs, position);
    //console.log(allvars);
    let current = allvars;
    let currentinherited = null;
    let currentreturn = null;
    for(let i = returned.length - 1; i > 0; i--) {
        //console.log("new round: " + returned[i]);
        if(returned[i] == '') { // some kind of error
            current = [];
            currentinherited = null;
            currentreturn= null;
            break;
        }
        if(i == returned.length - 1 && returned[i] == '}') {
            current = through(cs, newPosition, false);
            if(!(current.endline - 1 == newPosition.line && current.endchar - 1 == newPosition.character)) {
                //console.log("error finding: " + returned[i].substring(1) + " / " + (current.endchar - 1));
                current = [];
                currentinherited = null;
                currentreturn = null;
                break;
            }
            //console.log("selected scope");
            //console.log(current.startline);
            current = current.vars;
            currentinherited = null;
            currentreturn= null;
        } else {
            const vari = returned[i] == "()" ? currentreturn : findInVar(current, currentinherited, returned[i]);
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
    //return throughVar(current, currentinherited);
}