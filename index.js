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
  const API_KEY = core.getInput('google-api-key');
  var analyzeRequest = {
    comment: {text: text},
    requestedAttributes: {'TOXICITY': {}}
  };

  commentAnalyzer.comments.analyze({key: API_KEY, resource: analyzeRequest}, (err, response) => {
    if (err) throw err;
    var analysis = JSON.stringify(response, null, 2);
    var toxicity = analysis.data.attributeScores.TOXICITY.summaryScore.value;
    console.log("toxicity is: ", toxicity);
  });
  
  return toxicity;
}

// TODO - pass in issue text as well 
function updateCommentToxicityScore(client, owner, repo, issueUser, issueID, issueText, toxicityScores, commentAnalyzer) {
  return __awaiter(this, void 0, void 0, function* () {
    console.log("analyzing main text... ");
    var toxicity = analyzeToxicity(commentAnalyzer, issueText);
    if (! toxicityScores.has(issueUser)) {
        toxicityScores.set(issueUser, new Map()); 
    }
    var userToxicityMap = toxicityScores.get(issueUser);
    userToxicityMap.set(issueID, toxicity);
    console.log("after issue analysis, toxicityMap is: ", toxicityScores);

    console.log('getting comments...\n');

    try {
      const {data: comments} = yield client.issues.listComments({
          owner: owner,
          repo: repo,
          issue_number: issueID,
      });

      console.log('in function numComments: ' + comments.length);
      for (var comment in comments) {
      //   if (! toxicityScores.has(user)) {
      //     toxicityScores.set(user, new Map()); 
      //   }
        console.log("COMMENT:", comment);
      }

      toxicityScores.set("A", "pavi");
      console.log("value of map now in update: ", toxicityScores);
      return comments.length;
    }
    catch(err) {
      console.log("error thrown: ", err); 
    }
  });
}

function getToxicityScores(client, owner, repo, commentAnalyzer, toxicityScores) {
  return __awaiter(this, void 0, void 0, function* () {
      // Provide console output if we loop for a while.
      console.log('Checking...');
      
      const { status, data: issues } = yield client.issues.listForRepo({
          owner: owner,
          repo: repo,
          since: '2020-04-12T20:12:47Z'
      });

      if (status !== 200) {
          throw new Error(`Received unexpected API status code ${status}`);
      }
      if (issues.length === 0) {
          console.log("No  issues..")
          return toxicityScores; 
      }
      for ( var issue of issues) {
          // console.log("ISSUE: ", issue);
          var issueUser = issue.user.login;
          var issueText = issue.body; 
          var issueId = issue.id; 
          // TODO - measure toxicity of the PR/Issue main message as well 

          // measure toxicity here 
          yield updateCommentToxicityScore(client, owner, repo, issueUser, issueId, issueText, toxicityScores, commentAnalyzer);
          
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
  return __awaiter(this, void 0, void 0, function* () {
    const {google} = require("googleapis");

    var client = new github.GitHub(core.getInput('repo-token', { required: true }));
   
    const repo = core.getInput('repo-name');
    const owner = core.getInput('repo-owner');
    
    var commentAnalyzer = google.commentanalyzer('v1alpha1');
    analyzeToxicity(commentAnalyzer, "You are an idiot person.");

    var toxicityScores = new Map(); 
    yield getToxicityScores(client, owner, repo, commentAnalyzer, toxicityScores);
    console.log("value of map final: ", toxicityScores);
    
     // const context = github.context;    
    // const newIssue = client.issues.create({
    //     ...context.repo,
    //     title: 'Climate Coach for Current Month',
    //     body: climateMessage
    // });
  }); 

}


run(); 
