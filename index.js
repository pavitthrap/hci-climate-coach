const core = require("@actions/core");
const github = require("@actions/github");


var climateMessage = "This is the monthly climate coach report, here to give you an \
  overview of various metrics in this repository, such as responsiveness and tone used in discussions"; 

function run() {
  var client = new github.GitHub(core.getInput('repo-token', { required: true }));
  const repoName = core.getInput('repo-name');
  const repoOwner = core.getInput('repo-owner');
  
  const context = github.context;    
  const newIssue = client.issues.create({
      ...context.repo,
      title: 'Climate Coach for Current Month',
      body: climateMessage
  });
}


run(); 
