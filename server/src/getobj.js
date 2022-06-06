const letters = 'abcdefghijklmnopqrstuvwxyz';
const work = [];
for(let i = 0; i < letters.length; i++) {
    work.push(letters[i]);
    work.push(letters[i].toUpperCase());
}
const nums = '0123456789';
for(let i = 0; i < nums.length; i++) {
    work.push(nums[i]);
}
work.push('_');
const whitespace = [' ', '\n', '\r', '\xa0', '\t'];
module.exports = (document, position) => {
    if(document._lineOffsets === undefined || document._content === undefined) {
        return null;
    }
    const positionCopy = {
        line: position.line, 
        character: position.character
    };
    let currentIndex = document._lineOffsets[position.line] + position.character - 1;
    let returning = [];
    let current = '';
    let upIndex = currentIndex;
    while(upIndex < document._content.length) {
        upIndex++;
        if(!work.includes(document._content[upIndex])) {
            break;
        }
        current += document._content[upIndex];
    }
    let requireDot = false;
    let inParens = 0;
    while(currentIndex >= 0) {
        //console.log("beginning cycle");
        if(inParens > 0) {
            if(document._content[currentIndex] == ')') {
                inParens++;
            } else if(document._content[currentIndex] == '(') {
                inParens--;
                if(inParens == 0) {
                    returning.push("()");
                    // current is still blank at this point, so a dot will invalidate (which is good)
                }
            }
        } else if(document._content[currentIndex] == '.') {
            returning.push(current);
            //console.log("dot");
            current = '';
            requireDot = false;
        } else if(document._content[currentIndex] == ')' && current == '') {
            inParens = 1;
        } else {
            const saved = document._content[currentIndex];
            if(whitespace.includes(saved)) {
                //console.log("whitespace");
                if(current != '') {
                    requireDot = true;
                }
                // if(saved == '\r') {
                //     currentIndex--;
                //     continue;
                // }
            } else if(requireDot) {
                //console.log("no dot found");
                break;
            } else if(work.includes(saved)) {
                //console.log("pushing to current");
                current = saved + current;
            } else {
                if(saved == '}' && current == '') {
                    //console.log("ending with a }");
                    current = '}';
                }
                break;
            }
        }
        currentIndex--;
        positionCopy.character--;
        if(positionCopy.character == -1) {
            positionCopy.line--;
            //console.log(document._lineOffsets);
            positionCopy.character = document._lineOffsets[positionCopy.line + 1] - document._lineOffsets[positionCopy.line] - 1;
        }
        
        //console.log(positionCopy);
    }
    returning.push(current);
    //console.log(returning);
    return [returning, positionCopy];
}