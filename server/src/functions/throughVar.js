const throughVar = (props, inherited, select = vari => {
    return vari;
}) => {
    let returning = [];
    let blacklist = [];
    for(const vari of props) {
        if(!vari.ignore) {
            returning.push(select(vari));
            blacklist.push(vari.inner.label);
        }
    }
    if(inherited !== null) {
        const returned = throughVar(inherited.properties, inherited.inherited);
        for(const vari of returned) {
            if(!blacklist.includes(vari.inner.label)) {
                returning.push(select(vari));
            }
        }
    }
    return returning;
}
module.exports = throughVar;