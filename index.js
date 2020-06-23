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
const fs = require('fs');
// const nodemailer = require("nodemailer");
const sgMail = require('@sendgrid/mail');


const { EOL } = require('os');
const { parse } = require('fast-csv');

data = "Name,Surname,Age,Gender\
John,Snow,26,M\
Clair,White,33,F\
Fancy,Brown,78,F";


var climateMessage = "This is the monthly climate coach report, here to give you an \
  overview of various metrics in this repository, such as responsiveness and tone used in discussions"; 

var toxicityThreshold = 0.45; 
var numOverThreshold = 0; 
var numUnderThreshold = 0; 

var errorNum = 0;

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
        console.log(errorNum, ", another err", err);
        errorNum += 1; 
        return -1;
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

// TODO -> use this
function cleanText(text) {
  // remove code snippets
  var regex_inline_code= /`[a-z ]*\n?[\s\S]*?\n?`/gms;
  var regex_inline = /(^> ?.+?)((\r?\n\r?\n)|\Z)/gms;
  var regex_url = /(https:\/\/.*?([\s]|$))|(http:\/\/.*?([\s]|$))/g;

  var next = text.replace(regex_inline_code, ''); 
  var next = next.replace(regex_inline, ''); 
  var next = next.replace(regex_url, ''); 
  
  // remove markdown formatting 
  var plainText = removeMd(next); 
  return plainText; 
}

function getToxicityScoresForIssue(client, owner, repo, issueUser, issueID, issueText, toxicityScoresIssues, toxicityScoresComments, commentAnalyzer, allUsers) {
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
        console.log(comment);
        var toxicity = yield analyzeToxicity(commentAnalyzer, comment.body);
        var user = comment.user.login;
        var cleaned = cleanText(comment.body);
        updateToxicityInMap(toxicity, user, comment.id, comment.body, toxicityScoresComments)
        var cleanedToxicity = yield analyzeToxicity(commentAnalyzer, cleaned);
        console.log("COMMENT TEXT: ", comment.body, " , user: ", user, ", comment Toxicity: ", toxicity);
        console.log("CLEAN COMMENT TEXT: ", cleaned, ", comment Toxicity: ", cleanedToxicity);

        allUsers.set(user, comment.created_at);


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

function getToxicityScores(client, owner, repo, commentAnalyzer, toxicityScoresIssues, toxicityScoresComments, allUsers, allPosters) {
  return __awaiter(this, void 0, void 0, function* () {

      try {
        var queryDate = getBeginningOfPrevMonth(); 
        const { status, data: issues } = yield client.issues.listForRepo({
            owner: owner,
            repo: repo,
            since: queryDate, 
            state: 'all'
        });
      
        if (status !== 200) {
            throw new Error(`Received unexpected API status code ${status}`);
        }
        if (issues.length === 0) {
            console.log("No  issues..")
            return; 
        }

        for ( var issue of issues) {
          console.log("Issue: ", issue);
          var issueUser = issue.user.login;
          var issueText = issue.title + " " + issue.body; 
          var issueId = issue.number;
          var issueLink = issue.html_url; 
          var creationTime = issue.created_at;  
          var creationDate = new Date(creationTime); 

          allUsers.set(issueUser, creationTime);
          allPosters.set(issueUser, creationDate);

          // TODO: remove true
          if (true || creationDate.getMonth() == queryDate.getMonth()) {
            console.log("Creation of issue is previous month, so analyzing now. Issue #: ", issueId);

            // measure toxicity here 
            yield getToxicityScoresForIssue(client, owner, repo, issueUser, issueId, issueText, toxicityScoresIssues, toxicityScoresComments, commentAnalyzer, allUsers);
          }

          // TODO: remove return 
          return; 
        }

        return; 
        
      } catch (err) {
        console.log("error thrown: ", err); 
        return; 
      }
      
  });
}


// No way to filter pulls by creator
function isFirstPost(client, owner, repo, allPosters, page = 1) {
  return __awaiter(this, void 0, void 0, function* () {
      // Provide console output if we loop for a while.
      console.log('Checking issues page ', page);
      const { status, data: issues } = yield client.issues.listForRepo({
        owner: owner,
        repo: repo,
        per_page: 100,
        page: page,
        state: 'all'
      });
    
      console.log("num issues:", issues.length);
      if (status !== 200) {
          throw new Error(`Received unexpected API status code ${status}`);
      }
      if (issues.length === 0) {
          console.log("Finished checking all issues, so will return the remaining new posters.")
          return allPosters;
      }
      for (const issue of issues) {
          const currUser = issue.user.login;
          
          var creationTime = issue.created_at;  
          var creationDate = new Date(creationTime); 

          if (allPosters.has(currUser) && creationDate < allPosters.get(currUser)) {
              // delete currUser from the dict ; return if the dict is empty 
              console.log("An older post was found for user:  ", currUser);
              allPosters.delete(currUser);
              if (allPosters.size == 0) {
                  console.log('There are no more users left to check, so will return early.')
                  return allPosters;
              }
          }
      }
      return yield isFirstPost(client, owner, repo, allPosters, page + 1);
  });
}


// TODO - clean input 
//   [x] remove code blocks '''
//   [ ] should I remove blockquotes? typically refers to others' comments   

// TODO - run it on moderation examples post input pruning 
//     - try running sentence by sentence 

function processRow(commentAnalyzer, data, row) {
  return __awaiter(this, void 0, void 0, function* () {
    var text = row.TEXT; 
    var cleaned = cleanText(text);
    var toxicity_before = yield analyzeToxicity(commentAnalyzer, text);
    var toxicity_after = yield analyzeToxicity(commentAnalyzer, cleaned);
    
    if (toxicity_after != -1 & toxicity_before!= -1) {
      new_data = [row._ID, text, cleaned, row.TOXICITY, toxicity_before, toxicity_after, row.POLARITY, row.STANFORD_POLITE, row.NLTK_SCORE]; 
      data.push(new_data); 
    } else {
      console.log("toxicity was -1");
    }

  });
    
}

function processAllData(commentAnalyzer, pre_data) {
  return __awaiter(this, void 0, void 0, function* () {
    console.log("LENGTH:", pre_data.length);
    var data = [["id", "text", "clean_text", "toxic_label", "toxicity_pre_clean", "toxicity_post_clean", "polarity", "politeness", "nltk_score"]];

    for (var i=0; i < pre_data.length; i++) {
      yield processRow(commentAnalyzer, data, pre_data[i]);
      setTimeout(function() {
        console.log("sleep");
      }, 200);
    }

    var csvContent = '';
    data.forEach(function(infoArray, index) {
      dataString = infoArray.join(';');
      csvContent += index < data.length ? dataString + '\n' : dataString;
    });

    fs.writeFile('report.csv', csvContent, (err) => { 
      // In case of a error throw err. 
      if (err) throw err; 
    }) 
    console.log("wrote to file...");
  }); 
}


function generateEmailContents(repo, numOverThreshold, numSamples) {
  var queryDate = getBeginningOfPrevMonth(); 
  const month = queryDate.toLocaleString('default', { month: 'long' });
  console.log("PREV MONTH in TEXT!!", month); 

  var title = "<h1>" + month + "project climate report for " + repo + "📊🐻⛄️🐛 </h1>"; 
  var section_one = "<h2> 🐻 Your project stats <h2>"; 
  
  var newContributors = 3; 
  var uniqueContributors = 3; 

  section_one += "<ul> <li>Number of new contributors this month: " + "</li> <li>Number of unique commenters / contributors this month: " + uniqueContributors +"</li><li>Percent “toxic” comments: "+ numOverThreshold/numSamples + "</li>  <li>Number of “toxic” comments: "+ numOverThreshold + "</li> </ul>"
  var section_two = "<h2>🔥 Problem convos </h2 <p> Here are some conversations you should probably check in on </p> ";
  var section_three = "<h2>🐛 How you compare to other projects</h2> <p> For projects your size (X-Y contributors)*, you are in the…. </p>"; 
  section_three += "<ul> <li>5th percentile for toxic comments (min = X, max = Y, median = Z) </li> </ul>";

  var body = title + section_one + section_two + section_three; 
  
  console.log("email contents:", body)
  return body; 
}

function run() {
  return __awaiter(this, void 0, void 0, function* () {
    const {google} = require("googleapis");

    var client = new github.GitHub(core.getInput('repo-token', { required: true }));
   
    const repo = core.getInput('repo-name');
    const owner = core.getInput('repo-owner');
    
    var commentAnalyzer = google.commentanalyzer('v1alpha1');

    var toxicityScoresIssues = new Map(); 
    var toxicityScoresComments = new Map(); 

    var allUsers = new Map();
    var allPosters = new Map(); 
    yield getToxicityScores(client, owner, repo, commentAnalyzer, toxicityScoresIssues, toxicityScoresComments, allUsers, allPosters);

    console.log("ALL USERS:", allUsers);
    console.log("# of USERS: ", allUsers.size); 

    console.log("All POSTERS before: ", allPosters); 
    yield isFirstPost(client, owner, repo, allPosters); 
    console.log("All POSTERS after: ", allPosters); 

    var sample = "Implemented build step functionality  Eiffel json schema's cloned from github eiffel repo, topic-drop4 branch. Eiffel Schema Changes  for jsonSchema2pojo generation plugin \n### Added required properties JavaType ExtendedJavaType    Modified eiffel shcema's \n1. Changed time format \n2. Removed 's' from class names ending with that letter";
    console.log('cleaned sample: ', cleanText(sample));

    console.log("value of map issues: ", toxicityScoresIssues);
    console.log("value of map comments: ", toxicityScoresComments);

    var numSamples =  numUnderThreshold + numOverThreshold; 
    console.log("total number of text samples analyzed: ", numSamples); 

    // does numSamples 
    if (numSamples > 0) {
      console.log("Proportion of comments exceeding toxicity threshold: ", numOverThreshold/numSamples); 
    }

    // TODO
    // - filter github-actions[bot] out of user map  
    // send email 
    const username = core.getInput("username", { required: true })
    const password = core.getInput("password", { required: true })
    const sendgrid_key = core.getInput("send-grid-key", { required: true })

    var body = generateEmailContents(repo, numOverThreshold, numSamples);

    console.log("\nABOUT TO SEND MAIL....");
    sgMail.setApiKey(sendgrid_key);
    const msg = {
      to: 'paviusa@yahoo.com',
      from: 'hci.demo.pavi@gmail.com',
      subject: 'Sending with Twilio SendGrid is Fun',
      text: 'and easy to do anywhere, even with Node.js',
      html: body,
    };

    sgMail
    .send(msg)
    .then(() => {
      console.log("IN THEN.")
    }, error => {
      console.error(error);
  
      if (error.response) {
        console.error(error.response.body)
      }
    });

    console.log("After email sent.")

    // process csv data 
    pre_data = []
    const stream = parse({
      headers: headers => headers.map(h => h.toUpperCase()),
      })
      .on('error', error => console.error(error))
      .on('data', row => {
        pre_data.push(row);
      })
      .on('end', async function (rowCount) {
        console.log(`Parsed ${rowCount} rows`);
        await processAllData(commentAnalyzer, pre_data);
        console.log("done processing data in end.")
      });
    
    //stream.write(CSV_STRING);
    //stream.end();


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


const CSV_STRING = [
  "Name,Surname,Age,Gender",
  "John,Snow,26,M",
  "Clair,White,33,F",
  "Fancy,Brown,78,F",
].join(EOL);




// Questions 
//  need to fix code parser 
//  remove inline code blocks? -> single backtick 


// With Outpute CSV File
//  get average persepective toxicity (before & after parsing) for all toxic/not comments 
// 