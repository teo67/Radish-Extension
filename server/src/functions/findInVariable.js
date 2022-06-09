const findInVariable = (target, properties, inherited) => {
    //console.log("finding " + target);
    for(const prop of properties) {
        if(prop.inner.label == target) {
            return prop;
        }
    }
    if(inherited !== null) {
        //console.log(inherited.inner.label + "\n" + inherited.properties + "\n" + inherited.inherited)
        return findInVariable(target, inherited.properties, inherited.inherited);
    }
    return null;
}

module.exports = findInVariable;