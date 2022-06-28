module.exports = (vari, dep, previous = null, searching = "", playground = false) => {
    if(vari === null) {
        if(previous !== null && !playground) {
            if(searching == "()") {
                previous.returndeps.push(dep);
            } else {
                if(previous.propertydeps[":" + searching] === undefined) { // we have to add a colon because {}["constructor"] actually means something in js
                    previous.propertydeps[":" + searching] = [];
                }
                previous.propertydeps[":" + searching].push(dep);
            }
        }
        return false;
    }
    if(!vari.evaluated && !playground) {
        if(dep !== null) {
            vari.deps.push(dep);
        }
        return false;
    }
    return true;
}