
const propertyStuff = (holder, held) => {
    
    if(holder.propertydeps[":" + held.inner.label] !== undefined) {
        
        
        for(const propdep of holder.propertydeps[":" + held.inner.label]) {
            
            exporting.dep(propdep);
        }
    } 
}

const exporting = {
    run: propertyStuff, 
    dep: null
};

module.exports = exporting;