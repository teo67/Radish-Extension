
const { languageserver, cached } = require('./global');
const getobj = require('./getobj.js');
const through = (scope, position, list = true) => {
    let returning = [];
    if(list) {
        for(const vari of scope.vars) {
            returning.push(vari);
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
        returning = returning.concat(through(inner, position));
        break;
    }
    if(!list) {
        return scope;
    }
    return returning;
}
const findInVar = (props, inherited, finding) => {
    for(const vari of props) {
        //console.log(vari.inner.label);
        if(vari.inner.label == finding) {
            //console.log("found!");
            return vari;
        }
    }
    if(inherited !== null) {
        return findInVar(inherited.properties, inherited.inherited, finding);
    }
    return null;
}
const throughVar = (props, inherited) => {
    let returning = [];
    for(const vari of props) {
        returning.push(vari.inner);
    }
    if(inherited !== null) {
        returning = returning.concat(throughVar(inherited.properties, inherited.inherited));
    }
    return returning;
}
module.exports = _textDocumentPosition => {
    //console.log("triggered");
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
    const allvars = through(cs, _textDocumentPosition.position);
    //console.log(allvars);
    let current = allvars;
    let currentinherited = null;
    for(let i = returned.length - 1; i > 0; i--) {
        if(returned[i] == '') { // some kind of error
            current = [];
            currentinherited = null;
            break;
        }
        if(i == returned.length - 1 && returned[i].startsWith('}')) {
            current = through(cs, {
                line: _textDocumentPosition.position.line, 
                character: returned[i].substring(1)
            }, false).vars;
            currentinherited = null;
        } else {
            const found = findInVar(current, currentinherited, returned[i]);
            if(found === null) { // couldn't find var
                //console.log("none");
                current = [];
                currentinherited = null;
                break;
            }
            current = found.properties;
            currentinherited = found.inherited;
        }
    }
    //console.log(throughVar(current, currentinherited));
    return throughVar(current, currentinherited);
}