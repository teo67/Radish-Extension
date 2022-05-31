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

module.exports = (document, position) => {
    if(document._lineOffsets === undefined || document._content === undefined) {
        return null;
    }
    //console.log(document);
    const initialIndex = document._lineOffsets[position.line] + position.character - 1;
    //console.log(initialIndex);
    let currentIndex = initialIndex;
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
    while(currentIndex >= 0) {
        if(document._content[currentIndex] == '.') {
            returning.push(current);
            current = '';
        } else {
            const saved = document._content[currentIndex];
            if(work.includes(saved)) {
                current = saved + current;
            } else {
                if(saved == '}' && current == '') {
                    current = `}${(position.character) - (initialIndex - currentIndex)}`;
                }
                break;
            }
        }
        currentIndex--;
    }
    returning.push(current);
    //console.log(returning);
    return returning;
}