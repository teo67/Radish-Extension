class StackNode {
    constructor(_val, _next = null) {
        this.val = _val;
        this.next = _next;
    }
}
const tokens = {
    ')': '(',
    ']': '[', 
    '}': '{',
    '"': '"',
    "'": "'" 
};
class Stack {
    constructor() {
        this.head = null;
    }
    push(val) {
        this.head = new StackNode(val, this.head);
    }
    pop() {
        
        if(this.head !== null) {
            const saved = this.head.val;
            this.head = this.head.next;
            return saved;
        }
        return null;
    }
    add(val) { // false = rule broken, cancel request
        const index = Object.values(tokens).indexOf(val);
        if(tokens[val] !== undefined && !(index != -1 && this.head !== null && this.head.val == val)) {
            this.push(val);
            return true;
        }
        if(index != -1) {
            const finding = Object.keys(tokens)[index];
            return this.pop() == finding;
        }
        return true; // nothing happened
    }
}
module.exports = Stack;