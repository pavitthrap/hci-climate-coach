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
const removeMd = require('remove-markdown');

var climateMessage = "This is the monthly climate coach report, here to give you an \
  overview of various metrics in this repository, such as responsiveness and tone used in discussions"; 

var toxicityThreshold = 0.45; 
var numOverThreshold = 0; 
var numUnderThreshold = 0; 

// TODO -> create alternate analysis using Sophie's classifier 

/* Analyzes the toxicity of a comment using Google's Perspective API
* @param {google API object} A comment analyzer object 
* @param {string} the text to be analyzed
* @return {float} The toxicity score of the provided text 
*/ 
function analyzeToxicity(commentAnalyzer, text) {
  return __awaiter(this, void 0, void 0, function* () {
    const API_KEY = core.getInput('google-api-key');
    var analyzeRequest = {
      comment: {text: text},
      requestedAttributes: {'TOXICITY': {}}
    };

    var toxicity = yield commentAnalyzer.comments.analyze({key: API_KEY, resource: analyzeRequest})
      .then(response => {
        toxicity = response.data.attributeScores.TOXICITY.summaryScore.value;
        return toxicity;
      })
      .catch(err => {
        console.log(err);
        throw err;
      });

    return toxicity; 
  });
}

/* Updates the toxicity score associated with a user + comment/issue ID in the map, tracks number of 
*  text samples below/ above the threshold
* @param {float} 
* @param {string}
* @param {integer}
* @param {string}
* @param {Map}
*/
function updateToxicityInMap(toxicity, user, ID, text, toxicityScores) {
  if (toxicity < toxicityThreshold) {
    console.log("Not recording comment/issue since the toxicity score is below the threshold.")
    numUnderThreshold += 1; 
    return; 
  }

  numOverThreshold += 1; 

  if (! toxicityScores.has(user)) {
    toxicityScores.set(user, new Map()); 
  }
  var userToxicityMap = toxicityScores.get(user);
  userToxicityMap.set(ID, [toxicity, text]);
}


function cleanText(text) {
  // remove code snippets
  const regex = /(```.+?```)/;
  var next = text.replace(regex, ''); 
  
  while (next != text) {
    text = next;
    var next = text.replace(regex, ''); 
  }

  // remove markdown formatting 
  var plainText = removeMd(text); 
  return plainText; 
}

function getToxicityScoresForIssue(client, owner, repo, issueUser, issueID, issueText, toxicityScoresIssues, toxicityScoresComments, commentAnalyzer) {
  return __awaiter(this, void 0, void 0, function* () {
    
    console.log("analyzing issue text... ");
    var toxicity = yield analyzeToxicity(commentAnalyzer, issueText);
    updateToxicityInMap(toxicity, issueUser, issueID, issueText, toxicityScoresIssues)

    console.log('getting comments...\n');
    try {
      const {data: comments} = yield client.issues.listComments({
          owner: owner,
          repo: repo,
          issue_number: issueID,
      });
    
      for (var comment of comments) {
        var toxicity = yield analyzeToxicity(commentAnalyzer, comment.body);
        var user = comment.user.login;
        updateToxicityInMap(toxicity, user, comment.id, comment.body, toxicityScoresComments)
        console.log("COMMENT TEXT: ", comment.body, " , user: ", user, ", comment Toxicity: ", toxicity);
      }
      return;

    } catch(err) {
      console.log("error thrown: ", err);
      return;  
    }

  });
}

function getBeginningOfPrevMonth(){
  var currDate = new Date(); 
  var currMonth = currDate.getMonth(); 
  var prevMonth = (currMonth -1) % 12; 
  var prevYear = currDate.getFullYear(); 
  if (prevMonth > currMonth) {
    prevYear -= 1; 
  }
  
  var newDate = new Date(prevYear, prevMonth, 1, 0, 0, 0, 0);
  console.log("ISO DATE:", newDate.toISOString()); 
  return newDate;
}

function getToxicityScores(client, owner, repo, commentAnalyzer, toxicityScoresIssues, toxicityScoresComments) {
  return __awaiter(this, void 0, void 0, function* () {

      try {
        var queryDate = getBeginningOfPrevMonth(); 
        const { status, data: issues } = yield client.issues.listForRepo({
            owner: owner,
            repo: repo,
            since: queryDate
        });
      
        if (status !== 200) {
            throw new Error(`Received unexpected API status code ${status}`);
        }
        if (issues.length === 0) {
            console.log("No  issues..")
            return; 
        }

        for ( var issue of issues) {
            var issueUser = issue.user.login;
            var issueText = issue.title + " " + issue.body; 
            var issueId = issue.number;
            var creationTime = issue.created_at;  
            var creationDate = new Date(creationTime); 

            if (creationDate.getMonth() != queryDate.getMonth()) {
              console.log("Only looking at previous month, so returning now to avoid analyzing current month.")
              // TODO: maybe remove 
              // return; 
            }

            // measure toxicity here 
            yield getToxicityScoresForIssue(client, owner, repo, issueUser, issueId, issueText, toxicityScoresIssues, toxicityScoresComments, commentAnalyzer);
        }

        return; 
        
      } catch (err) {
        console.log("error thrown: ", err); 
        return; 
      }
      
  });
}


// TODO - clean input 
//   [x] remove code blocks '''
//   [ ] should I remove blockquotes? typically refers to others' comments   

// TODO - run it on moderation examples post input pruning 
//     - try running sentence by sentence 

function run() {
  return __awaiter(this, void 0, void 0, function* () {
    const {google} = require("googleapis");

    var client = new github.GitHub(core.getInput('repo-token', { required: true }));
   
    const repo = core.getInput('repo-name');
    const owner = core.getInput('repo-owner');
    
    var commentAnalyzer = google.commentanalyzer('v1alpha1');

    var toxicityScoresIssues = new Map(); 
    var toxicityScoresComments = new Map(); 

    yield getToxicityScores(client, owner, repo, commentAnalyzer, toxicityScoresIssues, toxicityScoresComments);

    console.log("value of map issues: ", toxicityScoresIssues);
    console.log("value of map comments: ", toxicityScoresComments);

    var numSamples =  numUnderThreshold + numOverThreshold; 
    console.log("total number of text samples analyzed: ", numSamples); 

    // does numSamples 
    if (numSamples > 0) {
      console.log("Proportion of comments exceeding toxicity threshold: ", numOverThreshold/numSamples); 
    }
    
    

    // TODO - maybe apply some filtering to the toxicity scores?
    //  [x] apply threshold 
    //  [x] give toxicity percentage => proportion of comments that exceed the toxicity threshold 
    //  [ ] maybe don't report all the people that commented 

    // QUESTION -> give top offending scores + text + user? 
    // QUESTION -> email it? 

     // const context = github.context;    
    // const newIssue = client.issues.create({
    //     ...context.repo,
    //     title: 'Climate Coach for Current Month',
    //     body: climateMessage
    // });
  }); 

}


run(); 
