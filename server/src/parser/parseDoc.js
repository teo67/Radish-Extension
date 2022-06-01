module.exports = doc => {
    const old = doc.Val.substring(1, doc.Val.length - 1);
    let edited = '';
    for(let i = 0; i < old.length; i++) {
        if(old[i] == '\n' || old[i] == '\r') {
            edited += '\n';
        } else {
            edited += old[i];
        }
    }
    return edited;
}