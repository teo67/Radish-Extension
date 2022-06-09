const getFromRT = require('./getFromRT.js').run;
const { tokenKey } = require('../global.js');
module.exports = tokendependencies => {
    let overall = [];
    let lastline = 0;
    let lastchar = 0;
    for(const dep of tokendependencies) {
        //console.log(dep.path + " - " + dep.lines)
        const gotten = getFromRT(null, dep.reference, dep.before.concat(dep.path), dep.baseScope, null, null, null, "", false, true);
        //console.log(dep.path);
        //console.log(gotten);
        if(dep.baseScope !== null) {
            gotten.shift();
        }
        if(gotten === null || gotten.length > dep.before.length + dep.path.length) {
            //console.log("null");
            continue;
        }
        
        let returning = [];
        for(let i = dep.before.length; i < gotten.length; i++) {
            if(dep.lines[i - dep.before.length] < 0 || dep.chars[i - dep.before.length] < 0) {
                continue;
            }
            const adding = [];
            adding.push(dep.lines[i - dep.before.length] - 1 - lastline);
            const savedchar = dep.chars[i - dep.before.length] - 1;
            adding.push(savedchar - (dep.lines[i - dep.before.length] - 1 == lastline ? lastchar : 0));
            
            adding.push(dep.path[i - dep.before.length].length);
            const index = tokenKey.indexOf(gotten[i].inner.kind);
            if(index == -1) {
                //console.log("no add :(");
                continue;
            }
            adding.push(index);
            adding.push(0);
            lastline = dep.lines[i - dep.before.length] - 1;
            lastchar = savedchar;
            returning = returning.concat(adding);
        }
        overall = overall.concat(returning);
    }
    return overall;
}