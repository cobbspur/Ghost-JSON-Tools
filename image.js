//var     cheerio = require('cheerio'),
//
var  fs = require('fs'),
    _ = require('lodash'),
    path = require('path'),
    Promise = require('bluebird'),
    request = Promise.promisify(require('request')),
    imageUrls = [],
    json = require('json-file'),
    cheerio = require('cheerio'),
    mkdirp = require('mkdirp-promise'),
    moment = require('moment'),
    archiver = require('archiver'),
    file, data,
    posts, htmlArray = [], coverImageArray = [],
    exportFile, tags, posts_tags, users,
    pdc = Promise.promisify(require('pdc')),
    normalizeNewline = require('normalize-newline'),
    originalImages = [], newImages = [], index = 0,
    newExport= '', baseDir, contentDir, count = 0;

init = function init(params, type) {
    fs.exists(params.originalFile, function(exists) {
        if (exists) {
            createWorkspace(params);
        } else {
            console.log('No matching file found');
        }
    });
};

createWorkspace = function createWorkspace(params) {
    baseDir = 'tmp' + _.uniqueId();
    fs.exists(baseDir, function(exists) {
        if (exists) {
            createWorkspace(params);
        } else {
            var year = moment().format('YYYY'),
                month = moment().format('MM');
            contentDir = '/content/images/' + year + '/' + month;
            console.log('Temporary workspace created:', baseDir);
            mkdirp(baseDir + contentDir).then(function (made) {
                getData(params);
            }).catch(function (err) {
                console.error(err);
            });
        }
    });
};

createUniqueImage = function createUniqueImage(file) {
    file = _.uniqueId() + file;
    if (_.contains(newImages, file)) {
        createUniqueImage(file);
    } else {
        return file;
    };
};

getImage = function getImage(response,image){
    var status, error = 0;
    status = response.statusCode;
    if (status === 200){
        index +=  1;

        if (response.headers['content-type']){
            var fileNameArray = image.url.split('/'),
                fileName = fileNameArray[fileNameArray.length - 1],
                name;

            if (_.contains(fileName, '?')) {
                fileName = fileName.split('?');
                fileName = _.uniqueId() + fileName[0];
            }

            // Check if this filename is already in use
            if (_.contains(newImages, fileName)) {
              fileName = createUniqueImage(fileName);
            }

            name = contentDir + '/' + fileName;
            newImages.push({url: image.url, newUrl: name});
        }
    }
};

preProcessImage = function preProcessImage(image) {
    if (_.find(originalImages, {url: image}) !== undefined) {
        // Image already in array - no need to download twice
        // TODO Use a mapping function instead of this ugliness
    } else if (image.substring(0,3) === 'htt' || image.substring(0,2) === '//'){
        // Add image to array and try to download
        originalImages.push({url: image, newUrl: ''});
    }
};

// This checks that all valid images have been saved before proceeding.
// TODO find a nicer way to promisify the piping process instead of this hacky method
writingImages = function writingImages(params, posts) {
    if (count !== newImages.length) {
        setTimeout(function () {
            console.log('Downloading images');
            writingImages(params, posts);
        }, 500);
    } else {
        console.log('Images saved');
        if (params.markdown) {
            return getMarkdown(posts);
        } else {
            // Ensure that content in markdown matches content in html
            _.each(posts, function (post) {
                post.markdown = normalizeNewline(post.html);
            });

            return writeFile(posts);
        }
    }
};

//Loads a JSON file and pushes html from posts into an array
getData = function getData(params) {
    var urlPromises = [];
    console.log('get data called');
    file = json.read(params.originalFile);
    data = file.data.db[0].data;
    // Create arrays from for posts, users and tags
    // TODO make this more robust to handle more ghost json formats

    posts = data['posts'] ? data['posts'] : [];
    users = data['users'] ? data['users'] : [];
    tags = data['tags'] ? data['tags'] : [];
    posts_tags = data['posts_tags'] ? data['posts_tags'] : [];

    if (params.html) {
        getHTML();
    } else {
        findImages();
    }
};

findImages = function findImages() {
    if (params.images) {
        console.log('Reading image references');
        _.each([posts, users, tags], function (collection) {
            _.each(collection, function (data) {
                if (data.html) {
                    var $ = cheerio.load(data.html),
                        images = $('img');
                    _.each(images, function (image) {
                        var src = $(image).attr('src') === undefined ? $(image).attr('data-src') : $(image).attr('src');
                        preProcessImage(src);
                    });
                }
                if (data.image) {
                    preProcessImage(data.image);
                }
            });
        });

        _.each(originalImages, function (image) {
            urlPromises.push(request({url: image.url, followRedirect: true, headers: {'User-Agent': 'Chrome/45.0.2454.85'}}).spread(function (response, body) {
                return {response: response, image: image};
            }));
        });

        return Promise.settle(urlPromises).then(function (results) {
            console.log('Verifying images');
            setTimeout(function () {
            }, 2000);

            _.each(results, function (result) {
                setTimeout(function () {
                }, 2000);
                if (result.isFulfilled()){
                    getImage(result.value().response, result.value().image)
                } else if (result.isRejected()){
                    console.log(result.reason());
                }

            });

            function escapeRegExp(str) {
                return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
            }
            console.log('Updating image references');
            _.each(newImages, function(image) {
                _.each(posts, function (post) {
                    var find = image.url,
                        re = new RegExp(escapeRegExp(find), 'g');

                    post.html = post.html.replace(re, function(match) {
                        return image.newUrl;
                    });
                    post.markdown = post.markdown.replace(re, function(match) {
                        return image.newUrl;
                    });
                    if (post.image) {
                        post.image = post.image.replace(re, function(match) {
                            return image.newUrl;
                        });
                    }
                });
            }) ;

            _.each(newImages, function(image) {
                request.get({url: image.url, followRedirect: true, headers: {'User-Agent': 'Chrome/45.0.2454.85'}}).on('response', function (response, body) {
                }).pipe(fs.createWriteStream(baseDir + image.newUrl)).on('error', function(e) {
                }).on('finish', function () {
                    count += 1;
                });
            });

            writingImages(params, posts);
        });
    } else if (params.markdown) {
        getMarkdown(posts);
    }
};

// Finds all the filenames in directory then returns array of all filenames.
getFilenames = function () {
    return fs.readdirSync(baseDir + contentDir);
};

writeFile = function writeFile(posts) {
    var files = [], output, archive, postsArray = _.chunk(posts, 140);

    output = fs.createWriteStream('output.zip');
    archive = archiver('zip');

    output.on('close', function() {
        console.log('Images and import file have been archived.\nSize:', archive.pointer() + ' total bytes');
    });

    archive.on('error', function(err) {
        throw err;
    });

    archive.pipe(output);

    for(var i = 0; i < postsArray.length; i++) {
        var postCol = postsArray[i];
        var sectionTags = [], sectionPostTags = [], newPosts = [];
        _.each(postCol, function (post) {
            _.each(posts_tags, function (tag) {
                if (post.id === tag.post_id) {
                    sectionPostTags.push(tag);
                    var matchedTag = _.find(tags, _.matchesProperty('id', tag.tag_id)),
                        checkTag = _.find(tags3, _.matchesProperty('id', matchedTag.id));
                    if (checkTag === undefined) {
                        sectionTags.push(matchedTag);
                    }

                }
            });
        });

        var exportJson = {
            'db': [
                {
                    'meta': {
                        'exported_on': 1408539273930,
                        'version': '003'
                    },
                    'data': {
                        'posts': postsArray[i],
                        'tags': sectionTags,
                        'posts_tags': sectionPostTags,
                        'users': users
                    }
                }
            ]
        };

        exportJson = JSON.stringify(exportJson);

        fs.writeFileSync(baseDir + '/file' + i + '.json', exportJson);
        archive.append(fs.createReadStream(baseDir + '/file' + i + '.json'), {name: 'file' + i + '.json'});
    }

    files = getFilenames();
    _.each(files, function (file) {
        archive.append(fs.createReadStream(baseDir + contentDir + '/' + file), { name: contentDir + '/' + file})
    });

    archive.finalize();

    // TODO add clean up function to remove temporary files

};

// We need html in order to retrieve images
getHTML = function getHTML(posts, type) {
    var ops = [], type;

    // If no type is specified assume markdown
    type = type ? type : 'markdown';
    _.forEach(posts, function(post, i) {
        var promise = pdc(post.markdown, type, 'html').then(function (result) {
            posts[i].html = result;
            posts[i].markdown = result;
        });

        ops.push(promise);
    });

    Promise.all(ops).then(function() {
          findImages();
    })
};

getMarkdown = function getMarkdown(posts) {
    var ops = [];

    _.forEach(posts, function(post, i) {
        var promise = pdc(post.html, 'html', 'markdown_github').then(function (result) {
            posts[i].markdown = result;
        });

        ops.push(promise);
    });

    Promise.all(ops).then(function() {
        writeFile(posts);
    })
};

module.exports = init;
