const express = require('express')
const http = require('http');
const app = express()
const port = 3000;
const fs = require('fs')
    , es = require('event-stream');
const _ = require('lodash');
var filepath1 = 'dummy.txt';
var filepath2 = 'dummy1.txt';


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
            host: 'norvig.com',
            path: '/big.txt'
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
                        //call dictionairy API for top ten words
                        return makeDictionaryAPIRequest(data)
                    })
                    .then(result => {
                        resolve(result);
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

makeDictionaryAPIRequest = (wordArray) => {
    /* call dictionary API for top 10 words order by occuurence */

    return new Promise(function(resolve,reject){
        let wordDetailsArray = [];
        var count = 0;
        let apiKey = 'dict.1.1.20170610T055246Z.0f11bdc42e7b693a.eefbde961e10106a4efa7d852287caa49ecc68cf';
        for (let item in wordArray) {
            let word = wordArray[item].word;
            let wordCount = wordArray[item].wordCount;
            var request = require("request");

            var options = {
                method: 'GET',
                url: 'https://dictionary.yandex.net/api/v1/dicservice.json/lookup',
                qs:
                {
                    key: apiKey,
                    lang: 'en-en',
                    text: word
                }
            };

            request(options, function (error, response, body) {
                count++;
                if (error) throw new Error(error);

                if (body) {
                    body = JSON.parse(body);

                    let key = word
                    let obj = {};
                    obj[key] = {
                        occurrence: wordCount,
                        syn: _.get(body, 'def.0.tr', null)
                    }
                    wordDetailsArray.push(obj);
                }

                if (count == wordArray.length) {
                    resolve (wordDetailsArray);
                }

            });

        }
    })
}


app.listen(port, () => console.log(`server listening on port ${port}!`))