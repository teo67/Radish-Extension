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
module.exports = throughVar;