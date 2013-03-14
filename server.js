var https = require('https');
var http = require('http');
var fs = require('fs');
var _ = require('underscore');

var config = {
	host: process.env.JIRA_HOST || 'linkshare.jira.com',
	port: process.env.JIRA_PORT || 80,
	user: process.env.JIRA_USER,
	password: process.env.JIRA_PASSWORD
};

var port = process.env.PORT || 8888;

var auth = 'Basic ' + new Buffer(config.user+ ':' + config.password).toString('base64');


function search(jql, callback) {
	var options = {
		hostname: 'linkshare.jira.com',
		path: '/rest/api/latest/search?jql=' + escape(jql) + '&fields=key,summary,status,labels,description,customfield_11910&maxResults=1000',
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
			try {
				var data = JSON.parse(res.data);
				callback(null, data);
			} catch (err) {
				err.response = res.data;
				callback(err);
			}
		});
	});
}

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
	'BP',
	'TRK',
	'Dashboard',
	'LNK',
	'CR',
	'ANA',
	'DX'
];

function color(issues, theme, track) {
	var issues = matching(issues, theme, track);
	if (issues.length > 0) {
		for (var i = 0; i < issues.length; i++) {
			var issue = issues[i];
			if (!hasPlan(issue)) return 'red'
		}
		return 'yellow';
	}
	return 'green';
}

function hasPlan(issue) {
	if (!issue.fields.customfield_11910) return false;
	return issue.fields.customfield_11910.value == 'Yes';
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
	var isTheme = false;
	var isTrack = false;
	for (var i = 0; i < issue.fields.labels.length; i++) {
		var label = issue.fields.labels[i];
		if (theme == null || label == 'Theme:' + theme) { isTheme = true; }
		if (track == null || label == 'Track:' + track) { isTrack = true; }
	}
	return isTheme && isTrack;
}

var css = fs.readFileSync('./style.css', 'utf8');

var server = http.createServer(function (req, res) {
	if (req.url == '/releases') {
		//var jql = 'labels in (' + getThemesForQuery() + ') and Status not in (Closed, Resolved) ORDER BY Rank ASC';
		jira('/rest/api/latest/project/PB/versions', function (err, results) {
			res.writeHead(200, { 'content-type': 'text/html' });
			res.write('<!DOCTYPE html>');
			res.write('<html>');
			res.write('<head>');
			res.write('<title>Q4 Readiness Scorecard</title>');
			res.write('<style type="text/css">');
			res.write(css);
			res.write('</style>');
			res.write('<meta http-equiv="refresh" content="60">')
			res.write('</head>');
			res.write('<body>');
			
			console.log(results);
			_.chain(results)
				.where({ archived: false })
				.sortBy(function(version) { return version.releaseDate; })
				.reverse()
				.each(function(version) {
					res.write('<h1>' + version.name);
					if (version.released) { 
						res.write(' (released)'); 
					}
					res.write('</h1>');
					res.write('<p>release date: ' + version.releaseDate);
					res.write('<p>' + version.description)
				});
			res.write('There should be something here');
			res.write('</body>');
			res.write('</html>');
			res.end();
		});
		return;
	}
	var jql = 'labels in (' + getThemesForQuery() + ') and Status not in (Closed, Resolved) ORDER BY Rank ASC';
	search(jql, function (err, results) {
		if (err) {
			res.writeHead(500, { 'content-type': 'text/plain' });
			res.end('Something went very wrong reading from jira. This is probably a configuration issue or maybe you crossed the streams... Please check the configuration.');
			return;
		}
		res.writeHead(200, { 'content-type': 'text/html' });
		res.write('<!DOCTYPE html>');
		res.write('<html>');
		res.write('<head>');
		res.write('<title>Q4 Readiness Scorecard</title>');
		res.write('<style type="text/css">');
		res.write(css);
		res.write('</style>');
		res.write('<meta http-equiv="refresh" content="60">')
		res.write('</head>');
		res.write('<body>');

		var url = require('url').parse(req.url, true);
		if (url.query.track) {
			res.write('<p>Track:' + url.query.track);
		}

		res.write('<table>');

		res.write('<thead>');
		res.write('<tr>');
		res.write('<th>Theme</th>');
		for (var i = 0; i < tracks.length; i++) {
			var track = tracks[i];
			var issues = matching(results.issues, null, track);
			res.write('<th>' + track + ' (' + issues.length + ' open)</th>');
		}
		res.write('</tr>');
		res.write('</thead>');

		res.write('<tbody>');
		for (var i = 0; i < themes.length; i++) {
			var theme = themes[i];
			var themeIssues = matching(results.issues, theme);
			res.write('<tr>');
			res.write('<th>' + theme + ' (' + themeIssues.length + ' open)</th>');
			for (var ii = 0; ii < tracks.length; ii++) {
				var track = tracks[ii];
				res.write('<td class="' + color(results.issues, theme, track) + '">');
				var issues = matching(results.issues, theme, track);
				res.write('<ul>');
				for (var iii = 0; iii < issues.length; iii++) {
					var issue = issues[iii];
					res.write('<li><a href="https://linkshare.jira.com/browse/' + issue.key + '">' + issue.key + '</a>' + ' ' + issue.fields.summary + (hasPlan(issue) ? ' (has plan)' : '') + '</li>');
				}
				res.write('</ul>');
				res.write('</td>');
			}
			res.write('</tr>');
		}
		res.write('</tbody>');

		res.write('</table>');

		res.write('<p><a href="https://linkshare.jira.com/secure/RapidBoard.jspa?rapidView=118">Manage scorecard issues</a>')

		res.write('<table>');

		res.write('<thead>');
		res.write('<tr>');
		res.write('<th>Theme</th>');
		res.write('<th>All Tracks (' + results.issues.length  + ' open)</th>');
		res.write('</tr>');
		res.write('</thead>');

		res.write('<tbody>');
		for (var i = 0; i < themes.length; i++) {
			var theme = themes[i];
			res.write('<tr>');
			res.write('<th>' + theme + '</th>');
			res.write('<td class="' + color(results.issues, theme) + '">');
			var issues = matching(results.issues, theme);
			res.write('<ul>');
			for (var iii = 0; iii < issues.length; iii++) {
				var issue = issues[iii];
				res.write('<li><a href="https://linkshare.jira.com/browse/' + issue.key + '">' + issue.key + '</a>' + ' ' + issue.fields.summary + (hasPlan(issue) ? ' (has plan)' : '') + '</li>');
			}
			res.write('</ul>');
			res.write('</td>');
			res.write('</tr>');
		}
		res.write('</tbody>');

		res.write('</table>');

		res.write('<table>');

		res.write('<thead>');
		res.write('<tr>');
		res.write('<th>All Open Issues (' + results.issues.length  + ')</th>');
		res.write('</tr>');
		res.write('</thead>');

		res.write('<tbody>');
		res.write('<tr>');
		res.write('<th>')
		res.write('<ul>');
		for (var i = 0; i < results.issues.length; i++) {
			var issue = results.issues[i];
			res.write('<li><a href="https://linkshare.jira.com/browse/' + issue.key + '">' + issue.key + '</a>' + ' ' + issue.fields.summary + (hasPlan(issue) ? ' (has plan)' : '') + '</li>');
		}
		res.write('</ul>');
		res.write('</th>')
		res.write('</tr>');
		res.write('</tbody>');

		res.write('</table>');

		res.write('</body>');
		res.write('</html>');
		res.end();
	});
});


server.listen(port);
console.log('listening on port ' + port);


function jira(path, callback) {
	var options = {
		hostname: 'linkshare.jira.com',
		path: path,
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
			try {
				var data = JSON.parse(res.data);
				callback(null, data);
			} catch (err) {
				callback(err);
			}
		});
	});
}

function getThemesForQuery() {
	var result = '"Theme:' + themes[0] + '"';
	for (var i = 1; i< themes.length; i++) {
		result += ', "Theme:' + themes[i] + '"';
	}
	return result;
}
