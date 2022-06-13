const states = {
    docs: 0, 
    paramName: 1, 
    paramDocs: 2
};

module.exports = doc => {
    const old = doc.substring(1, doc.length - 1);
    let edited = '';
    let params = {};
    let paramDocs = '';
    let paramName = '';
    let state = states.docs;
    const handleState = (nextState, i) => {
        if(old[i] == '\n' || old[i] == '\r') {
            return '\n';
        } else if(old[i] == '@') {
            state = nextState;
            return '';
        } else {
            return old[i];
        }
    }
    for(let i = 0; i < old.length; i++) {
        if(state == states.docs) {
            edited += handleState(states.paramName, i);
        } else if(state == states.paramName) {
            paramName += handleState(states.paramDocs, i);
        } else { // if we're in param docs
            if(old[i] == '\n' || old[i] == '\r') {
                paramDocs += '\n';
            } else if(old[i] == '@') {
                state = states.docs;
                params[paramName] = paramDocs;
                paramName = '';
                paramDocs = '';
            } else {
                paramDocs += old[i];
            }
        }
    }
    return [edited.trim(), params];
}