var https = require('https');

var config = {
    host: 'linkshare.jira.com',
    port: 80,
    user: 'joe.sadowski',
    password: 'M0nster$'
};

var auth = 'Basic ' + new Buffer(config.user+ ':' + config.password).toString('base64');


function search(jql, callback) {
}

var options = {
    hostname: 'linkshare.jira.com',
    path: '/rest/api/latest/search?jql=Project=QR',
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
        for (var i = 0; i < data.issues.length; i++) {
            console.log(data.issues[i]);
            console.log('----------------------------------------------------------------------------');
        }
    });
});