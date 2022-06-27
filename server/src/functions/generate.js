const global = require('../global.js');
const fs = require('fs/promises');
const path = require('path');
const Operations = require('../classes/Operations.js');
const CountingReader = require('../classes/CountingReader.js');
const handleDependency = require('./handleDependency.js').run;
const handleConstDep = require('./handleConstDep.js');
module.exports = async () => {
    try {
        const newPath = path.join(__dirname, '../../../Radish-Standard-Library/');
        const folders = await fs.readdir(newPath, { "encoding": "utf-8" });
        for(const folder of folders) {
            if(folder.includes('.')) {
                continue;
            }
            const modPath = path.join(newPath, folder, 'main.rdsh');
            const read = await fs.readFile(modPath, { encoding: "utf-8" });
            const newOps = new Operations(new CountingReader({
                _content: read,
                uri: 'file://' + modPath
            }), true);
            newOps.ParseScope();
            for(const dep of newOps.dependencies) {
                handleDependency(dep, newOps);
            }
            for(const dep of newOps.constructordependencies) {
                handleConstDep(dep, newOps);
            }
            if(folder !== 'PROTOTYPES') {
                newOps.cs.returns.inner.label = folder;
                global.baseScope.push(newOps.cs.returns);
            }
            newOps.CleanUp();
        }
    } catch(e) {
        console.log('Error generating standard library:');
        console.log(e);
    }
}