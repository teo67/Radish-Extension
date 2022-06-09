module.exports = (position, inner) => {
    if(position.line + 1 < inner.startline || position.line + 1 > inner.endline) {
        return false;
    }
    if(position.line + 1 == inner.startline && position.character < inner.startchar) {
        return false;
    }
    if(position.line + 1 == inner.endline && position.character > inner.endchar) {
        return false;
    }
    return true;
}