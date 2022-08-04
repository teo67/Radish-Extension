const throughVar = (props, inherited, alr = [], select = vari => {
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
    if(inherited !== null && !alr.includes(inherited)) {
        alr.push(inherited);
        const returned = throughVar(inherited.properties, inherited.inherited, alr);
        for(const vari of returned) {
            if(!blacklist.includes(vari.inner.label)) {
                returning.push(select(vari));
            }
        }
        
    }
    return returning;
}
module.exports = throughVar;