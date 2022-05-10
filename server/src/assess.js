const { cached, languageserver } = require('./global.js');
/*
changed = false: assessing either in progress or done, no further changes
changed = true: assessing in progress and will repeat once done
*/
const process = async document => { // arbitrary synchronous process with high time complexity (~1 second execution)
    let j = 0; 
    for(let i = 0; i < 2000000000; i++) {
        j += i;
    }
    console.log(j);
}
const assess = async document => {
    const version = document.version;
    await new Promise((resolve, reject) => setTimeout(resolve, 1000)); // cancel process if a newer version comes up within a second (depends on typing speed of the person)
    if(version != document.version) {
        //console.log("cancelling...");
        return;
    }
    if(cached[document.uri] === undefined) {
        cached[document.uri] = {
            vars: []
        };
    }
    //console.log("starting assess");
    //process();
    //console.log("ending assess");
    cached[document.uri].vars = [{
        label: `${document.getText()[0]}  b`,
        kind: languageserver.CompletionItemKind.Text,
        data: 1
    }];
    return;
}
module.exports = assess;