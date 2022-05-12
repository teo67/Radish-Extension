const { cached, languageserver } = require('./global.js');
const lex = require('./parser/Lexing/Lexer.js');
const Reader = require('./parser/CountingReader.js');
/*
changed = false: assessing either in progress or done, no further changes
changed = true: assessing in progress and will repeat once done
*/
const assess = async document => {
    console.log("starting");
    const version = document.version;
    await new Promise((resolve, reject) => setTimeout(resolve, 1000));
    const version2 = document.version;
    if(version != version2 && !(cached[document.uri] !== undefined && version2 - cached[document.uri].stamp > 20)) {
        return;
    }
    if(cached[document.uri] !== undefined && cached[document.uri].stamp == version2) {
        return;
    }
    console.log("running " + document.getText());
    if(cached[document.uri] === undefined) {
        cached[document.uri] = {
            vars: [], 
            stamp: -1
        };
    }
    const reader = new Reader(document);
    while(!reader.EndOfStream) {
        console.log(lex(reader));
        //console.log(lex(reader));
    }
    cached[document.uri].stamp = version2;
    console.log(
        document.getText()
    );
    return;
}
module.exports = assess;