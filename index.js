const core = require("@actions/core");
const github = require("@actions/github");

var climateMessage = "This is the monthly climate coach report, here to give you an \
  overview of various metrics in this repository, such as responsiveness and tone used in discussions"; 


var DISCOVERY_URL = 'https://commentanalyzer.googleapis.com/$discovery/rest?version=v1alpha1'

function run() {
  const {google} = require("googleapis");

  var client = new github.GitHub(core.getInput('repo-token', { required: true }));
  const API_KEY = core.getInput('google-api-key');
  //const repoName = core.getInput('repo-name');
  //const repoOwner = core.getInput('repo-owner');
  
  console.log("I am running index"); 
  // const context = github.context;    
  // const newIssue = client.issues.create({
  //     ...context.repo,
  //     title: 'Climate Coach for Current Month',
  //     body: climateMessage
  // });

  commentAnalyzer = google.commentanalyzer('v1alpha1');

  var analyzeRequest = {
    comment: {text: 'what kind of idiot name is foo?'},
    requestedAttributes: {'TOXICITY': {}}
  };

  commentAnalyzer.comments.analyze({key: API_KEY, resource: analyzeRequest}, (err, response) => {
    if (err) throw err;
    console.log(JSON.stringify(response, null, 2));
  });

  // googleapis.discoverAPI(DISCOVERY_URL, (err, client) => {
  //   if (err) throw err;
  //   var analyzeRequest = {
  //     comment: {text: 'what kind of idiot name is foo?'},
  //     requestedAttributes: {'TOXICITY': {}}
  //   };
  //   client.comments.analyze({key: API_KEY, resource: analyzeRequest}, (err, response) => {
  //     if (err) throw err;
  //     console.log(JSON.stringify(response, null, 2));
  //   });
  // });

}


run(); 
