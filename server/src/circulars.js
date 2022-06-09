const propertyStuff = require('./functions/propertyStuff.js');
const handleDependency = require('./functions/handleDependency.js');
const getFromRT = require('./functions/getFromRT.js');
const passInRT = require('./functions/passInRT.js');
const getInherited = require('./functions/getInherited.js');
class Circle {
    constructor(_path) {
        this.path = _path;
    }
    handle() {
        for(let i = 0; i < this.path.length; i++) {
            const next = i == this.path.length - 1 ? this.path[0] : this.path[i + 1];
            this.path[i].dep = next.run;
        }
    }
}
const circles = [
    new Circle([propertyStuff, handleDependency]), 
    new Circle([passInRT, getFromRT, getInherited])
];
module.exports = () => {
    for(const circle of circles) {
        circle.handle();
    }
}