const through = (scope, position, list = true) => {
    let returning = [];
    let blacklist = [];
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
        for(const ret of returned) {
            returning.push(ret);
            blacklist.push(ret.inner.label);
        }
        break;
    }
    if(list) {
        for(const vari of scope.vars) {
            if(!vari.ignore && !blacklist.includes(vari.inner.label)) {
                returning.push(vari);
            }
        }
    }
    if(!list) {
        return scope;
    }
    return returning;
}
module.exports = through;