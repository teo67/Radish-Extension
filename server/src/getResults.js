const through = require('./through.js');
const findInVar = require('./findInVar.js');
const throughVar = require('./throughVar.js');
module.exports = (cs, position, returned, newPosition) => {
    const allvars = through(cs, position);
    //console.log(allvars);
    let current = allvars;
    let currentinherited = null;
    for(let i = returned.length - 1; i > 0; i--) {
        //console.log("new round: " + returned[i]);
        if(returned[i] == '') { // some kind of error
            current = [];
            currentinherited = null;
            break;
        }
        if(i == returned.length - 1 && returned[i] == '}') {
            current = through(cs, newPosition, false);
            if(!(current.endline - 1 == newPosition.line && current.endchar - 1 == newPosition.character)) {
                //console.log("error finding: " + returned[i].substring(1) + " / " + (current.endchar - 1));
                current = [];
                currentinherited = null;
                break;
            }
            //console.log("selected scope");
            //console.log(current.startline);
            current = current.vars;
            currentinherited = null;
        } else {
            const vari = findInVar(current, currentinherited, returned[i]);
            if(vari === null) {
                current = [];
                currentinherited = null;
                break;
            }
            current = vari.properties;
            currentinherited = vari.inherited;
        }
    }
    //console.log(throughVar(current, currentinherited));
    //console.log(returned);
    return throughVar(current, currentinherited);
}