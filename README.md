# Scorecard
An automatically updating scorecard for judging Q4 readiness.


# Running the Scorecard

## 1) Install dependancies:
    npm install

## 2) Set environment variables:

### Windows:
    set JIRA_USER=[your-jira-username]
    set JIRA_PASSWORD=[your-jira-password]

### OSX:
    export JIRA_USER=[your-jira-username]
    export JIRA_PASSWORD=[your-jira-password]

## 3) Start the server
    node server

You should now have a server running on http://localhost:8888/!

If port 8888 is taken on your computer, you can set the PORT environment vaiable to change what port it's listening on.