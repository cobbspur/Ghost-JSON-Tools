/**
 *  The purpose of this little project is purely
 *  to test the use of flags from the command
 *  and triggering methods based off of these.
 */

var _ = require('lodash'),
        tools = {};

tools.image  = require('./image.js');

init = function init() {
    var flags = {
            markdown: false,
            images: false,
            originalFile: false,
            help: false
        },
        type,
        help = '-----------------------------\n\nYou can add these flags:\n\n-i                This will run the ' +
            'image scraper tool and create a folder of images\n-m                This will convert html to markdown' +
            '\n-f=test.json      This tells us the file you want to convert\n-c=markdown       This will convert different types of markdown to html' +
                '\n\n-----------------------------';

    _.each(process.argv, function(arg) {
        switch (arg.substring(0, 2)) {
            case '-i':
                flags.images = true;
                break;
            case '-f':
                flags.originalFile = arg.slice(3);
                break;
            case '-m':
                flags.markdown = true;
                break;
            case '-h':
                flags.help = true;
                break;
            case '-c':
                flags.html = true;
                type = arg.slic(3);
            default:
                break;
        }
    });

    if (flags.help) {
        console.log(help);
    } else if (!flags.originalFile) {
        console.log('You have not specified a file\n\n' + help);
    } else {
        tools.image(flags, type);
    }
};

init();
