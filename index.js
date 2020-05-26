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

var toxicityThreshold = 0.15; 
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
        // TODO -  calculate the date 
        // QUESTION => should I go up to the current date - or not include the month we are in?
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

            // measure toxicity here 
            yield getToxicityScoresForIssue(client, owner, repo, issueUser, issueId, issueText, toxicityScoresIssues, toxicityScoresComments, commentAnalyzer);
            
            //TODO - remove 
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
    
    //const markdown = ' also ``` here is code``` \n# This is a heading\n\nThis is ``` code pt 2``` a paragraph with [a link](http://www.disney.com/) in it.';
    var texts = ["WIP: Sent all girls to factory This PR will make sure that the factories provided by alchemy_cms can be used in our own tests host application's without using a special procedure before (like the Alchemy::Seeder).",
        "@julienben @gretzky Examples or you're wrong.", "Guess you're wrong.", "Nah, you're just rude. Your way is not the 'right' way.", "Those Indian developers in Google really did something wrong with Google Console product", 
        "So this issue is like a half a year old, any improvements? the whole shadow DOM thing is utter crap, it adds more headaches than it solves, because we're unable to solve things on our own without waiting for you guys to move your lazy butts and add the variable.",
        "Ionic version: (check one with 'x')\
[x ] 3.x\
\
I'm submitting a ... (check one with 'x')\
[x] bug report\
\
Related code:\
```\
    showToast($event) {\
        this.toastController.create({message: 'fuck', position: 'middle'}).present();\
    }\
```\
",      
        "WHY THE FUCK AM I GETTING THESE MAILS ARE YOU FUICKING RETARDED?????",
         "Hey @TomasKatz , while I agree that the email notifications can get a little frustrating sometimes, we do ask that you follow our code of conduct at all times. Also, since this issue has been resolved I am going to lock this issue for now.",
         "Lol makes no sense. Why would it be because of microsoft ? the app handles the bring to front not microsoft lol",
         "It is same on web version. Try it. Maybe @klaussinani can work around fix it. But dont make fun of people, u violate code of conduct https://github.com/klaussinani/ao/blob/master/code-of-conduct.md \
      Also mayde considerered contributting with PR",
      "@caishengmao Please stop raising duplicate issues, please follow up in your original issue #586 \
  \
      Further duplicates will be considered (at least in my opinion) against the Electron Community CoC.",
      "Yesterday afternoon, I started getting this message on a project that I was working on in the morning without incident. Nothing changed except the time. \
\
I was able to eliminate it by reducing the scope of the watched list but that meant I was not getting proper coverage.\
\
I reinstalled and otherwise tried things. Eventually I got it to go away by upgrade from node 10 LTS to node 11.1.0.\
\
This is just stupid.",
      "> This is just stupid.\
\
      ☝️ I was referring to this part of your comment. Language like this will do nothing to motivate contributors to prioritize this issue. If anything, it will disincentivize people to look into solving it. Please familiarize yourself with the Node.js Code of Conduct to have a better sense of what kinds of behavior are (not) tolerated in this project.",
      "Que mamones, si no van a ayudar mejor ni comenten :D",
      "Get rid of that idiot zloirock and his core-js library Is your feature request related to a problem? Please describe.\
When npm install is executed, the terminal is full of messages like:\
```\
Thank you for using core-js ( https://github.com/zloirock/core-js ) for polyfilling JavaScript standard library!\
\
The project needs your help! Please consider supporting of core-js on Open Collective or Patreon:\
> https://opencollective.com/core-js\
> https://www.patreon.com/zloirock\
\
Also, the author of core-js ( https://github.com/zloirock ) is looking for a good job -)\
```\
This is a major problem in the open source community, that we may depend on work of someone who might as well go nuts at some moment and we are at his mercy. There has been a big discussion here zloirock/core-js#635 where the author is openly reckless and promotes the freedom to clog his own library any way he wants. It is also being discussed around the internet.\
\
Describe the solution you'd like\
Now that it has been identified, I believe major libraries should break apart from this library, and replace its functionality with something else.\
\
Are you able to assist bring the feature to reality?\
I would be happy to try, unless there is someone capable of doing it much faster than me."
              ]

    for (var i = 0; i < texts.length; i++) {
      var text = texts[i]; 
      var cleaned = cleanText(markdown);
      var tox1 = analyzeToxicity(commentAnalyzer, text);
      var tox2 = analyzeToxicity(commentAnalyzer, cleaned);
      console.log("on text number ", i, " : ", text);
      console.log("CLEANED text: ", cleaned);
      console.log("TOX prev: ", tox1, ", TOX clean: ", tox2); 
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
