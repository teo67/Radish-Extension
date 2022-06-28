const global = require('../global.js');
const fs = require('fs/promises');
const path = require('path');
const Operations = require('../classes/Operations.js');
const CountingReader = require('../classes/CountingReader.js');
const handleDependency = require('./handleDependency.js').run;
const url = require('url');
module.exports = async () => {
    try {
        let newPath = path.join(__dirname, '../../../Radish-Standard-Library/').replaceAll('\\', '/');
        const folders = await fs.readdir(newPath, { "encoding": "utf-8" });
        for(const folder of folders) {
            if(folder.includes('.')) {
                continue;
            }
            let modPath = `${newPath}${folder}/main.rdsh`;
            const read = await fs.readFile(modPath, { encoding: "utf-8" });
            modPath = url.pathToFileURL(modPath).href; // unicode substitution for windows
            const newOps = new Operations(new CountingReader({
                _content: read,
                uri: modPath
            }), true);
            newOps.ParseScope();
            for(const dep of newOps.dependencies) {
                handleDependency(dep, newOps);
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