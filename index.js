var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
  return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
      function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
      function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};


const core = require("@actions/core");
const github = require("@actions/github");

var climateMessage = "This is the monthly climate coach report, here to give you an \
  overview of various metrics in this repository, such as responsiveness and tone used in discussions"; 


var DISCOVERY_URL = 'https://commentanalyzer.googleapis.com/$discovery/rest?version=v1alpha1'

function analyzeToxicity(commentAnalyzer, text) {
   // var analyzeRequest = {
  //   comment: {text: 'what kind of idiot name is foo?'},
  //   requestedAttributes: {'TOXICITY': {}}
  // };

  // commentAnalyzer.comments.analyze({key: API_KEY, resource: analyzeRequest}, (err, response) => {
  //   if (err) throw err;
  //   console.log(JSON.stringify(response, null, 2));
  // });
  return 0.1; 
}

// TODO - pass in issue text as well 
function updateCommentToxicityScore(client, owner, repo, issueID, toxicityScores, commentAnalyzer) {
  return __awaiter(this, void 0, void 0, function* () {
    console.log('getting comments...\n');
    const {data: comments} = yield client.issues.listComments({
        owner: owner,
        repo: repo,
        issue_number: issueID,
    });

    for (var comment in comments) {
    //   if (! toxicityScores.has(user)) {
    //     toxicityScores.set(user, new Map()); 
    //   }
      console.log("COMMENT:", comment);
    }

    console.log('in function numComments: ' + comments.length);
    toxicityScores.set("A", "pavi");
    console.log("value of map now in update: ", toxicityScores);
    return comments.length;
  });
}

function getToxicityScores(client, owner, repo, commentAnalyzer) {
  return __awaiter(this, void 0, void 0, function* () {
      // Provide console output if we loop for a while.
      console.log('Checking...');
      var toxicityScores = new Map(); 
      const { status, data: issues } = yield client.issues.listForRepo({
          owner: owner,
          repo: repo,
          since: '2020-04-12T20:12:47Z'
      })
      // .then(res => {
      //   console.log(res);
      // })
      // .catch(err => {
      //     console.log(err);
      // });;

      if (status !== 200) {
          throw new Error(`Received unexpected API status code ${status}`);
      }
      if (issues.length === 0) {
          console.log("No  issues..")
          return toxicityScores; 
      }
      for ( var issue of issues) {
          // console.log("ISSUE: ", issue);
          var user = issue.user.login;
          var issueText = issue.body; 
          var issueId = issue.id; 
          // TODO - measure toxicity of the PR/Issue main message as well 

          // measure toxicity here 
          yield updateCommentToxicityScore(client, owner, repo, issueId, toxicityScores, commentAnalyzer);
          
          //TODO - remove 
          toxicityScores.set("B", "yo");
          console.log("value of map now in get: ", toxicityScores);
          return toxicityScores; 
      }
      console.log("value of map now: ", toxicityScores);
      return toxicityScores; 
      
  });
}


function run() {
  const {google} = require("googleapis");

  var client = new github.GitHub(core.getInput('repo-token', { required: true }));
  const API_KEY = core.getInput('google-api-key');
  const repo = core.getInput('repo-name');
  const owner = core.getInput('repo-owner');
  
  console.log("I am running index"); 
  // const context = github.context;    
  // const newIssue = client.issues.create({
  //     ...context.repo,
  //     title: 'Climate Coach for Current Month',
  //     body: climateMessage
  // });

  var commentAnalyzer = google.commentanalyzer('v1alpha1');
  var toxicityScores = yield getToxicityScores(client, owner, repo, commentAnalyzer)
  console.log("value of map final: ", toxicityScores);
  
  // var analyzeRequest = {
  //   comment: {text: 'what kind of idiot name is foo?'},
  //   requestedAttributes: {'TOXICITY': {}}
  // };

  // commentAnalyzer.comments.analyze({key: API_KEY, resource: analyzeRequest}, (err, response) => {
  //   if (err) throw err;
  //   console.log(JSON.stringify(response, null, 2));
  // });


}


run(); 
