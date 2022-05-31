const findInVar = (props, inherited, finding) => {
    for(const vari of props) {
        //console.log(vari.inner.label);
        if(vari.inner.label == finding && !vari.ignore) {
            //console.log("found!");
            return vari;
        }
    }
    if(inherited !== null) {
        return findInVar(inherited.properties, inherited.inherited, finding);
    }
    return null;
}
module.exports = findInVar;