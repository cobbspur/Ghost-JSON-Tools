var _ = require('lodash'),
    debug = require('debug')('Analyse.js'),
    fsExtra = require('fs-extra'),

    file, data, tags, posts_tags, users;

//Loads a JSON file and pushes html from posts into an array
getData = function getData(params) {
    var urlPromises = [];
    debug('Getting Data');
    
    file = fsExtra.readJsonSync(params.originalFile);
    
    debug('Data Acquired %s', _.size(file.db[0].data));

    data = file.db[0].data;

    posts      = data['posts'] ? data['posts'] : [];
    users      = data['users'] ? data['users'] : [];
    tags       = data['tags'] ? data['tags'] : [];
    posts_tags = data['posts_tags'] ? data['posts_tags'] : [];
    
    debug('Post count: %s', posts.length);
    debug('Tag count: %s', tags.length);
    debug('User count: %s', users.length);
    debug('Post Tags count: %s', posts_tags.length);
    
};

module.exports = getData;
