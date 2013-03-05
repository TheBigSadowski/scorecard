var https = require('https');

var config = {
    host: 'linkshare.jira.com',
    port: 80,
    user: 'joe.sadowski',
    password: 'M0nster$'
};

var auth = 'Basic ' + new Buffer(config.user+ ':' + config.password).toString('base64');


function search(jql, callback) {
    var options = {
        hostname: 'linkshare.jira.com',
        path: '/rest/api/latest/search?jql=' + escape(jql),
        headers: {
            'Authorization': auth
        }
    };

    https.get(options, function (res) {
        res.setEncoding('utf8');
        res.data = ''
        res.on('data', function (chunk) {
            res.data += chunk;
        });
        res.on('end', function () {
            var data = JSON.parse(res.data);
            callback(null, data);
        });
    });
}



search('Project=QR', function (err, results) {
    for (var i = 0; i < results.issues.length; i++) {
        console.log(results.issues[i]);
        console.log('----------------------------------------------------------------------------');
    }
});