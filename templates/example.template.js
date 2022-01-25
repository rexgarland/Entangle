{{{initial}}}

{{{updater}}}

document.addEventListener('DOMContentLoaded', function () {

    var model = {
        initialize: function () {
            for (const key of Object.keys(initial)) {
                // this.setValue(key, initial[key])
                this[key] = initial[key]
            }
        },
        update: function () {
            const next = updater(this)
            for (const key of Object.keys(next)) {
                // this.setValue(key, next[key])
                this[key] = next[key]
            }
        }
    };

    const element = document.getElementById("tangle");
    new Tangle(element,model);
    
});
