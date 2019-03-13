const express = require('express')
const http = require('https');
const app = express()
const port = 3000;
const fs = require('fs')
    , es = require('event-stream');
const _ = require('lodash');
var filepath1 = 'dummy.txt';
var filepath2 = 'dummy1.txt';


app.get('/', (req, res) => {

    res.send('Express');
});

app.get('/read-file', (req, res) => {

    return fetchDocumentFromURL()
        .then(data => {
            res.send(data);
        })
        .catch(err => {
            console.log(err);
        })
});

fetchDocumentFromURL = () => {
    /*  read txt file from url in chunks  */

    return new Promise(function (resolve, reject) {
        fs.writeFileSync(filepath1, '');
        fs.writeFileSync(filepath2, '');
        
        let params = {
            host: 'terriblytinytales.com',
            path: '/test.txt'
        }
        let req = http.request(params, function (res) {

            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error('statusCode=' + res.statusCode));
            }

            var body = [];

            res.on('data', function (chunk) {
                res.pause();
                body.push(chunk);

                let chunkArray = chunk.toString().split(/[ .:;?!~,`"&|()<>{}\[\]\r\n/\\]+/);
                let chunkObj = {};
                chunkArray.forEach(function (item) {
                    if (chunkObj[item]) {
                        chunkObj[item]++;
                    } else {
                        chunkObj[item] = 1;
                    }
                })
                return (saveChunkDataToFile(chunkObj))
                    .then(data => {
                        res.resume();
                    })
            });

            res.on('end', function () {
                return findTopWordsByOccurences()
                    .then(data => {
						resolve(data);
                    })
                    .catch(err => {
                        reject(err);
                    })
            });
        });
        req.on('error', function (err) {
            reject(err);
        });
        req.end();
    });
}

saveChunkDataToFile = (chunkObj) => {
    /* save words from chunks in file with word count */

    return new Promise(function (resolve, reject) {
        let s = fs.createReadStream(filepath1)
            .pipe(es.split())
            .pipe(es.mapSync(function (line) {
                s.pause();
                if (line) {
                    let word = line.split(' ')[0];
                    let wordCount = line.split(' ')[1] | 0;

                    if (chunkObj[word]) {
                        wordCount += chunkObj[word];
                        delete chunkObj[word];
                    }
                    fs.appendFileSync(filepath2, word + " " + wordCount + "\r\n")
                }
                s.resume();
            })
                .on('error', function (err) {
                    console.log('Error while reading file.', err);
                    reject();
                })
                .on('end', function () {
                    for (var key in chunkObj) {
                        fs.appendFileSync(filepath2, key + " " + chunkObj[key] + "\r\n")
                    }
                    fs.writeFileSync(filepath1, "");
                    [filepath1, filepath2] = [filepath2, filepath1]
                    console.log('Read entire file.')
                    resolve();
                })
            );
    });
}

findTopWordsByOccurences = () => {
    /* to get words with most occurences */

    let finalArray = [];
    return new Promise(function (resolve, reject) {

        var s = fs.createReadStream(filepath1)
            .pipe(es.split())
            .pipe(es.mapSync(function (line) {
                s.pause();

                if (line) {
                    let word = line.split(' ')[0];
                    let wordCount = line.split(' ')[1] | 0;
                    finalArray.push({ word, wordCount });
                }
                s.resume();
            })
                .on('error', function (err) {
                    console.log('Error while reading file.', err);
                })
                .on('end', function () {
                    finalArray.sort((a, b) => {
                        return a.wordCount > b.wordCount ? -1 : 1;
                    })

                    finalArray = finalArray.slice(0, 10);
                    resolve(finalArray);
                })

            );
    });
}


app.listen(port, () => console.log(`server listening on port ${port}!`))