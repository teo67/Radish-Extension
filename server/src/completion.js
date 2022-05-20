const { languageserver, cached } = require('./global');
const through = (scope, returning, position) => {
    for(const vari of scope.vars) {
        returning.push(vari.inner);
    }
    for(const inner of scope.innerscopes) {
        //console.log(`position: (line ${position.line + 1}, char ${position.character}), inner: (start: (line ${inner.startline}, char ${inner.startchar}), end: (line ${inner.endline}, char ${inner.endchar}))`);
        if(position.line + 1 < inner.startline || position.line + 1 > inner.endline) {
            continue;
        }
        if(position.line + 1 == inner.startline && position.character < inner.startchar) {
            continue;
        }
        if(position.line + 1 == inner.endline && position.character > inner.endchar) {
            continue;
        }
        //console.log("going to inner scope");
        through(inner, returning, position);
        break;
    }
    return;
}
const getRef = (position, doc) => {
    let validLetters = "abcdefghijklmnopqrstuvwxyz";
    validLetters += validLetters.toUpperCase();
    validLetters += "_";
    let currentPos = position.character;
    let read = doc.getText()[]
}
module.exports = _textDocumentPosition => {
    // {
    //     textDocument: { uri: 'file:///Users/h205p3/Desktop/code/txt/test.txt' },
    //     position: { line: 3, character: 2 },
    //     context: { triggerKind: 1 }
    //   }
    //console.log("started completion");
    console.log(_textDocumentPosition.context);
    const stored = cached[_textDocumentPosition.textDocument.uri];
    if(stored === undefined) {
        return [];
    }
    const cs = stored.cs;
    if(cs === null) {
        return [];
    }
    let returning = [];
    through(cs, returning, _textDocumentPosition.position);
    //console.log(returning);
    return returning;
}