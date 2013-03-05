﻿var https = require('https');

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
        path: '/rest/api/latest/search?jql=' + escape(jql) + '&fields=key,summary,status,labels,description',
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



//search('Project=QR', function (err, results) {
//    for (var i = 0; i < results.issues.length; i++) {
//        console.log(results.issues[i]);
//        console.log('----------------------------------------------------------------------------');
//    }
//});

var themes = [
    'Uptime',
    'HA-Automated_Failover',
    'Quality',
    'On_Time',
    'Performance',
    'HA-No_Outage_Deployment',
    'Capacity',
    'Infrastructure_Upgrade',
    'Compliance',
    'Security',
    'Data_Retention'
];

var tracks = [
    'Billing-Payments',
    'Tracking',
    'Dashboards',
    'Linktranet',
    'Custom_Reporting',
    'Analytics',
    'Data_Exchange'
];


function color(issues, theme, track) {
    if (matching(issues, theme, track).length > 0) {
        return 'red';
    }
    return 'green';
}

function matching(issues, theme, track) {
    var results = [];
    for (var i = 0; i < issues.length; i++) {
        var issue = issues[i];
        if (matches(issue, theme, track)) {
            results.push(issue);
        }
    }
    return results;
}

function matches(issue, theme, track) {
    //console.log(issue);
    //console.log('--------');
    var isTheme = false;
    var isTrack = false;
    for (var i = 0; i < issue.fields.labels.length; i++) {
        var label = issue.fields.labels[i];
        if (label == 'Theme:' + theme) { isTheme = true; }
        if (label == 'Track:' + track) { isTrack = true; }
    }
    //console.log(issue.key + ' ' 
    return isTheme && isTrack;
}

var http = require('http');

var server = http.createServer(function (req, res) {
    search('Project = QR and Status not in (Closed, Resolved)', function (err, results) {
        //console.log(results);
        res.writeHead(200, { 'content-type': 'text/html' });
        res.write('<!DOCTYPE html>');
        res.write('<html>');
        res.write('<head>');
        res.write('<title>Q4 Readyness Scorecard</title>');
        res.write('</head>');
        res.write('<body>');

        res.write('<table>');

        res.write('<thead>');
        res.write('<tr>');
        res.write('<th>Theme</th>');
        for (var i = 0; i < tracks.length; i++) {
            res.write('<th>' + tracks[i] + '</th>');
        }
        res.write('</tr>');
        res.write('</thead>');

        res.write('<tbody>');
        for (var i = 0; i < themes.length; i++) {
            var theme = themes[i];
            res.write('<tr>');
            res.write('<th>' + theme + '</th>');
            for (var ii = 0; ii < tracks.length; ii++) {
                var track = tracks[ii];
                res.write('<td style="background: ' + color(results.issues, theme, track) + ';">');
                var issues = matching(results.issues, theme, track);
                res.write('<ul>');
                for (var iii = 0; iii < issues.length; iii++) {
                    var issue = issues[iii];
                    res.write('<li><a href="https://linkshare.jira.com/browse/' + issue.key + '">' + issue.key + ' - ' + issue.fields.summary + '</a></li>');
                }
                res.write('</ul>');
                res.write('</td>');
            }
            res.write('</tr>');
        }
        res.write('</tbody>');

        res.write('</table>');

        res.write('</body>');
        res.write('</html>');
        res.end();
    });
});


server.listen(8888);