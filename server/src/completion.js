
const { languageserver, cached } = require('./global');
const getobj = require('./getobj.js');
const through = (scope, position, list = true) => {
    let returning = [];
    if(list) {
        for(const vari of scope.vars) {
            if(!vari.ignore) {
                returning.push(vari);
            }
        }
    }
    for(const inner of scope.innerscopes) {
        //console.log(`position: (line ${position.line + 1}, char ${position.character}), inner: (start: (line ${inner.startline}, char ${inner.startchar}), end: (line ${inner.endline}, char ${inner.endchar}))`);
        if(position.line + 1 < inner.startline || position.line + 1 > inner.endline) {
            continue;
        }
        if(position.line + 1 == inner.startline && position.character < inner.startchar) {
            continue;
        }
        if(position.line + 1 == inner.endline && position.character > inner.endchar) {
            continue;
        }
        //console.log("going to inner scope");
        if(!list) {
            return through(inner, position, false);
        }

        const returned = through(inner, position);
        returning = returned.concat(returning);
        break;
    }
    if(!list) {
        return scope;
    }
    return returning;
}
const findInVar = (props, inherited, finding) => {
    let returning = [];
    let blacklist = [];
    for(const vari of props) {
        //console.log(vari.inner.label);
        if(vari.inner.label == finding && !vari.ignore) {
            //console.log("found!");
            returning.push(vari);
            blacklist.push(vari.inner.label);
        }
    }
    if(inherited !== null) {
        const returned = findInVar(inherited.properties, inherited.inherited, finding);
        for(const vari of returned) {
            if(!blacklist.includes(vari.inner.label)) {
                returning.push(vari);
            }
        }
    }
    return returning;
}
const throughVar = (props, inherited) => {
    let returning = [];
    let blacklist = [];
    for(const vari of props) {
        if(!vari.ignore) {
            returning.push(vari.inner);
            blacklist.push(vari.inner.label);
        }
    }
    if(inherited !== null) {
        const returned = throughVar(inherited.properties, inherited.inherited);
        for(const vari of returned) {
            if(!blacklist.includes(vari.label)) {
                returning.push(vari);
            }
        }
    }
    return returning;
}
module.exports = _textDocumentPosition => {
        console.log("began completion");
        const stored = cached[_textDocumentPosition.textDocument.uri];
        if(stored === undefined) {
            return [];
        }
        const cs = stored.cs;
        if(cs === null) {
            return [];
        }
        //console.log(cs.vars);
        const returned = getobj(stored.ref, _textDocumentPosition.position);
        //console.log(returned);
        //console.log(cs);
        const allvars = through(cs, _textDocumentPosition.position);
        //console.log(allvars);
        let current = [allvars];
        let currentinherited = [null];
        for(let i = returned.length - 1; i > 0; i--) {
            console.log("new round: " + returned[i]);
            if(returned[i] == '') { // some kind of error
                current = [];
                currentinherited = [];
                break;
            }
            if(i == returned.length - 1 && returned[i].startsWith('}')) {
                current = through(cs, {
                    line: _textDocumentPosition.position.line, 
                    character: returned[i].substring(1)
                }, false);
                if(!(current.endline - 1 == _textDocumentPosition.position.line && current.endchar - 1 == returned[i].substring(1))) {
                    //console.log("error finding: " + returned[i].substring(1) + " / " + (current.endchar - 1));
                    current = [];
                    currentinherited = [];
                    break;
                }
                current = [current.vars];
                currentinherited = [null];
            } else {
                let newc = [];
                let newn = [];
                for(let j = 0; j < current.length; j++) {
                    const varis = findInVar(current[j], currentinherited[j], returned[i]);
                    for(const vari of varis) {
                        console.log(vari.properties);
                        console.log(vari.inherited);
                        newc.push(vari.properties);
                        newn.push(vari.inherited);
                    }
                }
                if(newc.length == 0) {
                    current = [];
                    currentinherited = [];
                    break;
                }
                current = newc;
                currentinherited = newn;
            }
        }
        //console.log(throughVar(current, currentinherited));
        console.log(current);
        let all = [];
        for(let i = 0; i < current.length; i++) {
            all = all.concat(throughVar(current[i], currentinherited[i]));
        }
        //console.log(all);
        return all;
        //return throughVar(current, currentinherited);
    //console.log("triggered");
    
}