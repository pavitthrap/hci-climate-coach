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
  console.log("starting text: ", text);
  console.log("\n TEXT contains backtick?:", text.includes("`"));
  console.log("\n TEXT contains inline?:", text.includes(">"));

  // remove code snippets
  var regex_code = /```[a-z ]*\n[\s\S]*?\n```/gms;
  var regex_inline_code= /`[a-z ]*\n?[\s\S]*?\n?`/gms;
  // var regex_new = /```([^`]|[\r\n])*```/;
  var regex_inline = /(^> ?.+?)((\r?\n\r?\n)|\Z)/gms;
  var regex_url = /(https:\/\/.*?([\s]|$))|(http:\/\/.*?([\s]|$))/g;

  var next = text.replace(regex_code, ''); 
  console.log("\nAFTER removing code blocks: ", next); 
  var next = next.replace(regex_inline_code, ''); 
  console.log("\nAFTER removing inline code blocks: ", next); 
  var next = next.replace(regex_inline, ''); 
  console.log("\nAFTER removing block quotes: ", next); 
  var next = next.replace(regex_url, ''); 
  console.log("\nAFTER removing urls: ", next); 
  


  // while (next != text) {
  //   text = next;
  //   var next = text.replace(regex, ''); 
  //   var next = next.replace(regex_inline, ''); 
  // }

  // remove markdown formatting 
  var plainText = removeMd(next); 
  console.log("after removing md: ", plainText); 
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
        var cleaned = cleanText(comment.body);
        updateToxicityInMap(toxicity, user, comment.id, comment.body, toxicityScoresComments)
        var cleanedToxicity = yield analyzeToxicity(commentAnalyzer, cleaned);
        console.log("COMMENT TEXT: ", comment.body, " , user: ", user, ", comment Toxicity: ", toxicity);
        console.log("CLEAN COMMENT TEXT: ", cleaned, ", comment Toxicity: ", cleanedToxicity);
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
          console.log("Issue: ", issue);
          var issueUser = issue.user.login;
          var issueText = issue.title + " " + issue.body; 
          var issueId = issue.number;
          var creationTime = issue.created_at;  
          var creationDate = new Date(creationTime); 

          // TODO: remove true
          if (true || creationDate.getMonth() == queryDate.getMonth()) {
            console.log("Creation of issue is previous month, so analyzing now. Issue #: ", issueId);

            // measure toxicity here 
            yield getToxicityScoresForIssue(client, owner, repo, issueUser, issueId, issueText, toxicityScoresIssues, toxicityScoresComments, commentAnalyzer);
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


// TODO - clean input 
//   [x] remove code blocks '''
//   [ ] should I remove blockquotes? typically refers to others' comments   

// TODO - run it on moderation examples post input pruning 
//     - try running sentence by sentence 

function processRow(commentAnalyzer, data, row) {
  return __awaiter(this, void 0, void 0, function* () {
    console.log(row); 
    console.log(row.TEXT);
    
    var text = row.TEXT; 
    var cleaned = cleanText(text);
    var toxicity_before = yield analyzeToxicity(commentAnalyzer, text);
    var toxicity_after = yield analyzeToxicity(commentAnalyzer, cleaned);
    
    new_data = [text, cleaned, row.TOXICITY, toxicity_before, toxicity_after]; 
    data.push(new_data); 
  });
}

function processAllData(commentAnalyzer, pre_data) {
  return __awaiter(this, void 0, void 0, function* () {
    console.log("LENGTH:", pre_data.length);
    var data = [["text", "clean_text", "toxic_label", "toxicity_pre_clean", "toxicity_post_clean"]];

    for (var i=0; i < pre_data.length; i++) {
      yield processRow(commentAnalyzer, data, pre_data[i]);
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
    
    // console.log("about to process csv file");
    // fs.createReadStream('data.csv')
    //   .pipe(csv())
    //   .on('data', (row) => {
    //     console.log(row);
    //   })
    //   .on('end', () => {
    //     console.log('CSV file successfully processed');
    //   });

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
    
    stream.write(CSV_GITHUB_STRING);
    stream.end();

    console.log("done with stream, pre_data is:", pre_data); 


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





const CSV_GITHUB_STRING = [
  '_id,polarity,perspective_score,owner,repo,num_reference,text,num_url,stanford_polite,subjectivity,num_emoji,num_mention,nltk_score,toxicity',
'2018-1-OSS-E4/18-1-SKKU-OSS/3/394665010,0,0,18-1-SKKU-OSS,2018-1-OSS-E4,0,Command 부분 번역하였습니다 ,0,0.439007418522547,0,0,0,0,n',
'312-Development/nielse63/166/422486124,0.001623376623376622,0.08117193,nielse63,312-Development,0,"The devDependency sharp was updated from  to . This version is not covered by your current version range. If you don’t accept this pull request, your project will work just like it did before. However, you might be missing out on a bunch of new features, fixes and/or performance improvements from the dependency update.  Find out more about this release. &lt;details&gt;   &lt;summary&gt;FAQ and help&lt;/summary&gt;    There is a collection of [frequently asked questions]( If those don’t help, you can always [ask the humans behind Greenkeeper]( Greenkeeper bot palm_tree ",2,0.5914189818951595,0.45064935064935063,0,0,0.7845,n',
'A3-Antistasi/A3Antistasi/57/323119824,0.045666666666666675,0.06204475,A3Antistasi,A3-Antistasi,0,"Version 1.0.0+ Mods CBA, TFAR, ACE(no-medical) Environment MP dedi .rpt attatched? NO have you edited the missionfile? NO Is it possible to add a parameter such as ""load save"" to the parameters (lobby) of the mission? It will automatically load the previous saving of the campaign, by default (for your servers) you can set it to whatever value you want, for example, it\'s off, me and other server owners are very comfortable will be when I can turn it on (for example, through the cfg file) ",0,0.8905496970594228,0.6083333333333334,0,0,0.633,n',
'A3-Antistasi/A3Antistasi/57/389837101,0.7,0.030149797,A3Antistasi,A3-Antistasi,0,Will study the possibility. It seems a good idea ,0,0.515407917787913,0.6000000000000001,0,0,0.4404,n',
'A3-Antistasi/A3Antistasi/57/393246500,0.23249999999999998,0.065765075,A3Antistasi,A3-Antistasi,0,"belive me it’s not low priority task, it’s very very important task you are very good man if you do, it’s not so complicated ",0,0.4036337884085769,0.77,0,0,0.749,n',
'A3-Antistasi/A3Antistasi/57/393329149,0.45,0.04779639,A3Antistasi,A3-Antistasi,0,but there are more important tasks and my time is not unlimited ,0,0.399852619319327,0.75,0,0,0.3898,n',
'A3-Antistasi/A3Antistasi/57/393766966,0.2,0.043971922,A3Antistasi,A3-Antistasi,0,"yeah, I did not expect anything else, thanks ",0,0.47919589065878826,0.2,0,0,0.6249,n',
].join(EOL);


// Questions 
//  need to fix code parser 
//  remove inline code blocks? -> single backtick 


// With Outpute CSV File
//  get average persepective toxicity (before & after parsing) for all toxic/not comments 
// 