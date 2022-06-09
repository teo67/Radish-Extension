
const propertyStuff = (holder, held) => {
    //console.log(holder.inner.label + " - " + held.inner.label);
    if(holder.propertydeps[":" + held.inner.label] !== undefined) {
        //console.log(holder.propertydeps);
        //console.log(holder.propertydeps[":" + held.inner.label]);
        for(const propdep of holder.propertydeps[":" + held.inner.label]) {
            //console.log('handling');
            exporting.dep(propdep);
        }
    } 
}

const exporting = {
    run: propertyStuff, 
    dep: null
};

module.exports = exporting;