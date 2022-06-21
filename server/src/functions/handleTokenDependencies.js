const getFromRT = require('./getFromRT.js').run;
const global = require('../global.js');
module.exports = tokendependencies => {
    const usedOnce = [];
    const goodToGo = [];
    const locations = [];
    let overall = [];
    let lastline = 0;
    let lastchar = 0;
    for(const dep of tokendependencies) {
        const gotten = getFromRT(null, dep.reference, dep.before.concat(dep.path), dep.baseScope, null, dep.linkedscope, dep.imported, "", false, true);
        if(dep.baseScope !== null || dep.imported !== null) {
            gotten.shift();
        }
        if(gotten === null || gotten.length > dep.before.length + dep.path.length) {
            continue;
        }
        // only works if there is NO scope to work with
        if(gotten.length == 1 && dep.lines[0] >= 0 && dep.chars[0] >= 0) {
            const goodIndex = goodToGo.indexOf(gotten[0]);
            if(goodIndex == -1) {
                if(dep.isDeclarationIfSoWhatsThis === null) { // false for not a declaration
                    const usedIndex = usedOnce.indexOf(gotten[0]);
                    goodToGo.push(gotten[0]);
                    if(usedIndex != -1) {
                        usedOnce.splice(usedIndex, 1);
                        locations.splice(usedIndex, 1);
                    }
                } else if(!dep.isDeclarationIfSoWhatsThis && !usedOnce.includes(gotten[0])) {
                    usedOnce.push(gotten[0]);
                    locations.push({
                        line: dep.lines[0] - 1, 
                        character: dep.chars[0] - 1
                    });
                }   
            }
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
            const index = global.tokenKey.indexOf(gotten[i].inner.kind);
            if(index == -1) {
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
    for(let i = 0; i < usedOnce.length; i++) {
        global.currentOperator.diagnostics.push({
            severity: global.server2.DiagnosticSeverity.Hint,
            range: {
                start: locations[i], 
                end: {
                    line: locations[i].line, 
                    character: locations[i].character + usedOnce[i].inner.label.length
                }
            },
            message: `Variable "${usedOnce[i].inner.label}" is declared but never used!`,
            source: 'Radish Language Server', 
            tags: [global.server2.DiagnosticTag.Unnecessary]
        })
    }
    return overall;
}