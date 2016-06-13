/**
 *  The purpose of this little project is purely
 *  to test the use of flags from the command
 *  and triggering methods based off of these.
 */

var _ = require('lodash'),
        tools = {},
        debug = require('debug')('Index.js');

tools.image     = require('./image.js');
tools.analyse   = require('./analyse.js');

init = function init() {
    var flags = {
            markdown: false,
            images: false,
            originalFile: false,
            help: false,
            chunk: false,
            analyse: false
        },
        type,
        help = '----------------------------------------------------------------------------------------' +
            '\n\nYou can add these flags:' +
            '\n\n-i                This will run the image scraper tool and create a folder of images' +
            '\n-m                This will convert html to markdown' +
            '\n-f=test.json      This tells us the file you want to convert\n-t=markdown       This will convert different types of markdown to html' +
            '\n-c                This will chunk your json import file into chunks of 200 posts' +
            '\n\n---------------------------------------------------------------------------------------' +
            '\n-a                Analyses your file. Prepend cli command with DEBUG=analysis.' +
            '\n                  This overrides all other methods' +
            '\n\n---------------------------------------------------------------------------------------';

    _.each(process.argv, function (arg) {
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
            case '-t':
                flags.html = true;
                type = arg.slice(3);
            case '-c':
                flags.chunk = true;
            case '-a':
                flags.analyse = true;
            default:
                break;
        }
    });
    type = type ? type : null;
    if (flags.help) {
        debug('\n', help);
    } else if (!flags.originalFile) {
        console.log('You have not specified a file\n\n' + help);
    } else if (flags.analyse) {
        tools.analyse(flags);
    } else{
        tools.image(flags, type);
    }
};

init();
