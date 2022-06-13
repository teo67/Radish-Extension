const findInVariable = (target, properties, inherited) => {
    
    for(const prop of properties) {
        if(prop.inner.label == target) {
            return prop;
        }
    }
    if(inherited !== null) {
        
        return findInVariable(target, inherited.properties, inherited.inherited);
    }
    return null;
}

module.exports = findInVariable;