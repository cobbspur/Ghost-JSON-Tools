var  fs,
    _ = require('lodash'),
    path = require('path'),
    Promise = require('bluebird'),
    request = Promise.promisify(require('request')),
    cheerio = require('cheerio'),
    mkdirp = require('mkdirp-promise'),
    moment = require('moment'),
    archiver = require('archiver'),
    file, data, baseDir,
    posts, tags, posts_tags, users,
    pdc = Promise.promisify(require('pdc')),
    normalizeNewline = require('normalize-newline'),
    originalImages = [], newImages = [],
    debug = require('debug')('Image.js'),
    fsExtra = require('fs-extra'), fetchImage;

fs = Promise.promisifyAll(require('fs'));

fetchImage = {
    init: function init(params, type) {
        debug('initialising');
        fs.exists(params.originalFile, function (exists) {
            if (exists) {
                fetchImage.createWorkspace(params, type);
            } else {
                console.log('No matching file found');
            }
        });
    },

    checkEmailUnique: function checkEmailUnique(emails, email) {
        if (_.findIndex(emails, email) === -1) {
            emails.push(email);
            return email;
        } else {
            return fetchImage.checkEmailUnique(emails, email.replace('@', _.uniqueId() + '@' ));
        }
    },

    createWorkspace: function createWorkspace(params,type) {
        var self = this;
        baseDir = path.resolve('./tmp' + _.uniqueId());
        fs.exists(baseDir, function(exists) {
            if (exists) {
                createWorkspace(params);
            } else {
                var year = moment().format('YYYY'),
                    month = moment().format('MM'),
                    contentDir = '/content/images/' + year + '/' + month;

                mkdirp(baseDir + contentDir).then(function (made) {
                    debug('Temporary workspace created: %s', baseDir);
                    fetchImage.getData(params, type);
                }).catch(function (err) {
                    console.error(err);
                });
            }
        });
    },

    createUniqueImage: function createUniqueImage(file) {
        file = _.uniqueId() + 'c' + file;
        if (_.contains(newImages, file)) {
            fetchImage.createUniqueImage(file);
        } else {
            newImages.push(file);
            return file;
        }
    },

    getImageFilename : function getImageFilename(image){
        var fileNameArray = image.url.split('/'),
            fileName = fileNameArray[fileNameArray.length - 1],
            name;

        if (_.contains(fileName, '?')) {
            fileName = fileName.split('?');
            fileName = _.uniqueId() + fileName[0];
        }

        fileName = fetchImage.createUniqueImage(fileName);

        name = contentDir + '/' + fileName;
        image.newUrl = name.replace(/\%/g, '');
        return image;
    },

    preProcessImage: function preProcessImage(image, id, date) {
        if (_.find(originalImages, {url: image}) !== undefined) {
            // Image already in array - no need to download twice
            // TODO Use a mapping function instead of this ugliness
        } else if (image.substring(0,3) === 'htt' || image.substring(0,2) === '//'){
            // Add image to array and try to download
            originalImages.push({url: image, newUrl: ''});
        }
    },

    //Loads a JSON file and pushes html from posts into an array
    getData: function getData(params,type) {
        var urlPromises = [];
        debug('Getting Data');
        file = fsExtra.readJsonSync(params.originalFile);

        if (file.db) {
            data = file.db[0].data;
        } else {
            data = file.data;
        }
        // Create arrays for posts, users and tags

        posts = data['posts'] ? data['posts'] : [];
        users = data['users'] ? data['users'] : [];
        tags = data['tags'] ? data['tags'] : [];
        posts_tags = data['posts_tags'] ? data['posts_tags'] : [];
        posts_authors = data['posts_authors'] ? data['posts_authors'] : [];
        console.log(posts.length + ' posts in file');

        if (params.chunk) {
            debug('Chunking process');
            fetchImage.writeFile(posts);
        } else if (params.html) {
            debug('Convert html to markdown');
            fetchImage.getHTML(params,type, posts);
        } else {
            debug('Finding Images');
            fetchImage.findImages(params);
        }
    },

    findImages: function findImages(params) {
        var urlPromises = [];
        console.log('findImages called');
        if (params.images) {
            _.each([posts, users, tags], function (collection) {
                _.each(collection, function (data) {
                    if (data.html) {
                        var $ = cheerio.load(data.html),
                            images = $('img');
                        _.each(images, function (image) {
                            var src = $(image).attr('src') === undefined ? $(image).attr('data-src') : $(image).attr('src');
                            fetchImage.preProcessImage(src, data.slug, data.created_at);
                        });
                    }
                    if (data.image) {
                        fetchImage.preProcessImage(data.image, data.slug, data.created_at);
                    }
                });
            });
            function downloadImage(image){
                return request({url: image.url, headers: {'User-Agent': 'Chrome/49.0.2623.110'}, encoding : null })
                    .spread(function (response, body) {
                        if (response.statusCode != 200) return Promise.resolve();

                        var newUrl = fetchImage.getImageFilename(image),
                            name = baseDir + newUrl.newUrl;
                        return fs.writeFileAsync(name, body)
                            .catch(function (err){
                                console.log('fs write error', image);
                            });
                    }).then(function updatedImage() {
                        return image;
                    }).catch(function (err){
                        console.log(err);
                        console.log('Image Request Error', image);
                    });
            }

            function escapeRegExp(str) {
                return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
            }

            return Promise.map(originalImages, function(image) {
                return downloadImage(image);
            }, {concurrency: 5}).then(function updatePostsImageReferences(updatedImages) {
                _.each(updatedImages, function updateImageReferences(image) {
                    _.each(posts, function updatePostImageReferences(post) {
                        if (image && image.url && image.newUrl) {
                            var find = image.url,
                                re = new RegExp(escapeRegExp(find), 'g');

                            post.html = post.html.replace(re, function (match) {
                                return image.newUrl;
                            });
                            post.markdown = post.markdown.replace(re, function (match) {
                                return image.newUrl;
                            });
                            if (post.image) {
                                post.image = post.image.replace(re, function (match) {
                                    return image.newUrl;
                                });
                            }
                        }
                    });
                }) ;
                fetchImage.getMarkdown(posts);
            });

        } else if (params.markdown) {
            fetchImage.getMarkdown(posts);
        }
    },

    // Finds all the filenames in directory then returns array of all filenames.
    getFilenames: function () {
        return fs.readdirSync(baseDir + contentDir);
    },

    writeFile: function writeFile(updatedPosts) {
        console.log('writeFile called');
        var files = [], output, postsArray = _.chunk(updatedPosts, 100);

        for(var i = 0; i < postsArray.length; i++) {
            var postCol = postsArray[i];
            var sectionTags = [], sectionPostTags = [], newPosts = [], sectionUsers = [], userIds = [], sectionPostAuthors = [];
            _.each(postCol, function (post) {
                _.each(posts_tags, function (tag) {
                    if (post.id === tag.post_id) {
                        sectionPostTags.push(tag);
                        var matchedTag = _.find(tags, _.matchesProperty('id', tag.tag_id)),
                            checkTag = _.find(sectionTags, _.matchesProperty('id', matchedTag.id));
                        if (checkTag === undefined) {
                            sectionTags.push(matchedTag);
                        }
                    }
                });
                _.each(posts_authors, function (author) {
                    if (post.id === author.post_id) {
                        sectionPostAuthors.push(author);
                        var matchedAuthor = _.find(users, _.matchesProperty('id', author.author_id)),
                            checkAuthor = _.find(sectionUsers, _.matchesProperty('id', matchedAuthor.id));
                        if (checkAuthor === undefined) {
                            sectionUsers.push(matchedAuthor);
                        }
                    }
                })
                    if(_.findIndex(userIds, post.author_id) === -1) {
                        userIds.push(post.author_id);
                    }
                    if(_.findIndex(userIds, post.created_by) === -1) {
                        userIds.push(post.created_by);
                    }

                    if(_.findIndex(userIds, post.updated_by) === -1) {
                        userIds.push(post.updated_by);
                    }

                    if(_.findIndex(userIds, post.published_by) === -1) {
                        userIds.push(post.published_by);
                    }

            });

            _.each(users, function(user) {
                if(_.findIndex(userIds, user.id) === -1) {
                    sectionUsers.push(user);
                }
            });

            var exportJson = {
                'db': [
                    {
                        'meta': {
                            'exported_on': 1571277773105,
                            'version': '2.0.0'
                        },
                        'data': {
                            'posts': postsArray[i],
                            'tags': sectionTags,
                            'posts_tags': sectionPostTags,
                            'users': sectionUsers,
                            'posts_authors': sectionPostAuthors
                        }
                    }
                ]
            };

            exportJson = JSON.stringify(exportJson);

            fs.writeFileAsync(baseDir + '/file' + i + '.json', exportJson).catch(function (err) {
                console.log('write JSON-file Error', err);
            });
        }
    },

    // We need html in order to retrieve images
    getHTML: function getHTML(params, type, posts) {
        var ops = [];
        // If no type is specified assume markdown
        type = type ? type : 'markdown';
        _.forEach(posts, function(post, i) {
            var promise = pdc(post.html, 'html', 'commonmark', ['-R']).then(function (result) {
                posts[i].markdown = result;
                posts[i].title = posts[i].title === "(no title)" ?  posts[i].slug.replace(/-/g, ' ') : posts[i].title;
            });

            ops.push(promise);
        });

        Promise.all(ops).then(function(results) {
            // console.log(results.length);
            if (params.images) {
                fetchImage.findImages(params);
            } else {
                fetchImage.writeFile(posts);
            }
        }).catch(function (e) {
            console.log('e', e)
        })
    },

    getMarkdown: function getMarkdown(posts) {
        var ops = [];

        Promise.map(posts, function convertToMarkdown(post) {
            return pdc(post.html, 'html', 'commonmark', ['-R']).then(function (result) {
                post.markdown = normalizeNewline(result);
                return post;
            }).catch(function (err) {
                console.log(err);
            });
        }, {concurrency:5}).then(function (posts) {
            fetchImage.writeFile(posts);
        });
    }
};


module.exports = fetchImage;
