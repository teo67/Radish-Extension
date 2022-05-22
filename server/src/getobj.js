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
    const initialIndex = document._lineOffsets[position.line] + position.character - 1;
    //console.log(initialIndex);
    let currentIndex = initialIndex
    let returning = [];
    let current = '';
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
    return returning;
}