var _ = require('lodash'),
    debug = require('debug')('Analyse.js'),
    fsExtra = require('fs-extra'),

    file, data, tags, posts_tags, users;

//Loads a JSON file and pushes html from posts into an array
getData = function getData(params) {
    var urlPromises = [];
    debug('Getting Data');

    file = fsExtra.readJsonSync(params.originalFile);
    if (file.db) {
        data = file.db[0].data;
    } else {
        data = file.data;
    }

    meta = data['meta'] ? data['meta'] : [];
    posts      = data['posts'] ? data['posts'] : [];
    users      = data['users'] ? data['users'] : [];
    tags       = data['tags'] ? data['tags'] : [];
    posts_tags = data['posts_tags'] ? data['posts_tags'] : [];
    posts_authors = data['posts_authors'] ? data['posts_authors'] : [];

    debug('Meta information: %s', meta);
    debug('Post count: %s', posts.length);
    debug('Tag count: %s', tags.length);
    debug('User count: %s', users.length);
    debug('Post Tags count: %s', posts_tags.length);
    debug('Post Authors count: %s', posts_authors.length);

};

module.exports = getData;
