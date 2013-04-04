var https = require('https');
var http = require('http');
var fs = require('fs');
var _ = require('underscore');
var async = require('async');

var config = {
	host: process.env.JIRA_HOST || 'linkshare.jira.com',
	port: process.env.JIRA_PORT || 80,
	user: process.env.JIRA_USER,
	password: process.env.JIRA_PASSWORD
};

var port = process.env.PORT || 8888;

var auth = 'Basic ' + new Buffer(config.user+ ':' + config.password).toString('base64');

function search(jql, callback) {
	var path = '/rest/api/latest/search?jql=' + escape(jql) + '&fields=key,summary,status,labels,description,customfield_11910,assignee,components&maxResults=1000';
	jira(path, callback);
}

var component = function (name) {
	return function(issue) {
		return _(issue.fields.components).any(function (c) { return c.name == name; });
	};
};

var label = function (name) {
	return function(issue) {
		return _(issue.fields.labels).contains(name);
	};
};

var theme = function (name) {
	return { name: name, matches: label('Theme:'+name) };
}

var themes = [
	theme('Uptime'),
	theme('HA-Automated_Failover'),
	theme('Quality'),
	theme('On_Time'),
	theme('Performance'),
	theme('HA-No_Outage_Deployment'),
	theme('Capacity'),
	theme('Infrastructure_Upgrade'),
	theme('Compliance'),
	theme('Security'),
	theme('Data_Retention')
];

var tracks = [
	{ name: 'BP', matches: component('Billing & Payments') },
	{ name: 'Tracking', matches: component('Tracking') },
	{ name: 'Dashboard', matches: component('UX') },
	{ name: 'LNK', matches: label("Track:LNK") },
	{ name: 'CR', matches: label('Track:LNK') },
	{ name: 'ANA', matches: component('Analytics') },
	{ name: 'DX', matches: component('Data Exchange') }
];

function color(issues, theme, track) {
	//var issues = matching(issues, theme, track);
	return issues.length == 0
		? 'green'
		: _(issues).all(hasPlan)
			? 'yellow'
			: 'red';
}

function hasPlan(issue) {
	if (!issue.fields.customfield_11910) return false;
	return issue.fields.customfield_11910.value == 'Yes';
}

function matching(issues, theme, track) {
	return _(issues).filter(function (issue) { return matches(issue, theme, track); });
}

function matches(issue, theme, track) {
	return (theme == null || theme.matches(issue))
		&& (track == null || track.matches(issue));
}

var css = fs.readFileSync('./style.css', 'utf8');

var server = http.createServer(function (req, res) {
	var jql = 'labels in (' + getThemesForQuery() + ') and Status not in (Closed, Resolved) ORDER BY Rank ASC';
	search(jql, function (err, results) {
		if (err) {
			throw err;
			res.writeHead(500, { 'content-type': 'text/plain' });
			res.end('Something went very wrong reading from jira. This is probably a configuration issue or maybe you crossed the streams... Please check the configuration.');
			return;
		}
		res.writeIssueListItem = function (issue) {
			res.write('<li><a href="https://linkshare.jira.com/browse/' + issue.key + '">' + issue.key + '</a>' + ' ' + issue.fields.summary + (hasPlan(issue) ? ' (has plan)' : '') + ' (' + issue.fields.status.name + ' - ' + (issue.fields.assignee ? issue.fields.assignee.displayName : '') + ')</li>');
		};
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

		res.write('<table>');
		res.write('<thead>');
		res.write('<tr>');
		res.write('<th>Theme</th>');
		_(tracks).each(function (track) {
			var issues = matching(results.issues, track);
			res.write('<th>' + track.name + ' (' + issues.length + ' open)</th>');
		});
		res.write('</tr>');
		res.write('</thead>');
		res.write('<tbody>');
		_(themes).each(function (theme) {
			var themeIssues = matching(results.issues, theme);
			res.write('<tr>');
			res.write('<th>' + theme.name + ' (' + themeIssues.length + ' open)</th>');
			_(tracks).each(function (track) {
				var issues = matching(themeIssues, track);
				res.write('<td class="' + color(issues) + '">');
				res.write('<ul>');
				_(issues).each(res.writeIssueListItem);
				res.write('</ul>');
				res.write('</td>');
			});
			res.write('</tr>');
		});
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
		_(themes).each(function (theme) {
			var issues = matching(results.issues, theme);
			res.write('<tr>');
			res.write('<th>' + theme.name + '</th>');
			res.write('<td class="' + color(issues) + '">');
			res.write('<ul>');
			_(issues).each(res.writeIssueListItem);
			res.write('</ul>');
			res.write('</td>');
			res.write('</tr>');
		});
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
		_(results.issues).each(res.writeIssueListItem);
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
	return _(themes).map(function(t) { return '"Theme:'+t.name+'"'; }).join(', ');
}


function getVersions(project, callback) {
	jira('/rest/api/latest/project/' + project + '/versions', function (err, results) {
		async.map(results, function(version, callback) {
			search('fixVersion = ' + version.id + ' AND issuetype in standardIssueTypes()', function(err, issues) {
				version.issues = issues;
				callback(null, version);
			});
		}, function(err, mapped) {
			callback(err, mapped);
		});
	});
}

/*
jira('/rest/api/latest/field', function (err, results) {
	_(results).each(function (field) {
		console.log(field.name + ' => ' + field.id);
	})
});

getVersions('PB', function(err, results) {
	_.chain(results)
		.where({ archived: false })
		.sortBy(function(version) { return version.releaseDate; })
		.reverse()
		.each(function(version) {
			console.log(version.name);
			_(version.issues.issues)
				.each(function(issue) {
					console.log('  ' + issue.fields.summary);
				});
		});
});

getVersions('PB', function(err, results) {
	_(results).each(function(version) {
		console.log(version.description);
	});
});

search('Sprint in closedSprints()', function(err, results) {
	console.log('Closed sprints:');
	_(results.issues).each(function(issue) {
		console.log(issue)
	});
});
*/
