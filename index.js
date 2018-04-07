/* eslint-disable  func-names */
/* eslint quote-props: ["error", "consistent"]*/
// We can use the following API:
// https://status.ctl.io/v1/status
'use strict';
// const Alexa = require('alexa-sdk');
const https = require('https');
const http = require('http');
const querystring = require('querystring');
const url = require('url');

const helloMessages = ["Hi! how can I help you today?", "Hello! what can I do for you?", "Hey there! please let me know how I may be able to help you!"]
const reprompMessages = [
  "You can say for instance What's my medecine schedule today, or, I need help",
  "You can ask me for the side-effects of your medecine or ask me to have your pharmacist to call you"]
const unrecognisedResponses = [
  "What was that again?",
  "Sorry, I could not recognize that, can you repeat?",
  "Sorry, I missed that, can you run that with me again?"
]
const APP_ID = process.env.APP_ID;
const apiUrl = url.parse('https://api.healthgraphic.com/');
const healthgraphicPass = process.env.healthgraphicPass;
const healthgraphicEmail = process.env.healthgraphicEmail;

const getToken = function(){
  return new Promise(function(resolve, reject) {
    const postData = querystring.stringify({
    'email': healthgraphicEmail,
    'password': healthgraphicPass
  });
  var options = {
    method: "POST",
    hostname: apiUrl.hostname,
    path: "/api/v1/login",
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  var req = https.request(options, function (res) {
    var chunks = [];
    res.on("data", function (chunk) {
      chunks.push(chunk);
    });
    res.on("end", function () {
      var body = Buffer.concat(chunks);
      resolve (JSON.parse(body.toString()).token)
    });
    res.on('error', (e) => {
            reject(e)
        });
  });
  req.write(postData);
  req.end();
  })
}

const medicines = {
  "Pregabalin":{
    "sideEffects": "Drowsiness, dizziness, headache, dry mouth, nausea, constipation, and weight gain may occur. If any of these effects last or get worse, tell your doctor or pharmacist promptly.",

  }
}

const getSMedicationInfo = function(medecine){
  return new Promise(function(resolve, reject) {
    getToken()
    .then((token)=>{
    var options = {
      method: "GET",
      hostname: apiUrl.hostname,
      path: `/v1/medications/${medecine}`,
      headers: {
        'token': token
      }
    };
    var req = https.request(options, function (res) {
      var chunks = [];
      res.on("data", function (chunk) {
        chunks.push(chunk);
      });
      res.on("end", function () {
        var body = Buffer.concat(chunks);
        resolve (JSON.parse(body.toString()))
      });
      res.on('error', (e) => {
              reject(e)
          });
    });
    req.end();
    })
    });
}

const handlers = {
    'LaunchRequest': function() {
        console.log('======================== LaunchRequest')
        this.attributes.speechOutput = helloMessages[randomInRange(0, helloMessages.length)];
        this.attributes.repromptSpeech = reprompMessages[randomInRange(0, reprompMessages.length)];
        this.response.speak(this.attributes.speechOutput).listen(this.attributes.repromptSpeech);
        this.emit(':responseReady');
    },
    'RepromptRequest': function() {
        this.attributes.repromptSpeech = reprompMessages[randomInRange(0, reprompMessages.length)];
        this.response.speak(this.attributes.repromptSpeech).listen(this.attributes.repromptSpeech);
        this.emit(':responseReady');
    },
    'GetStatus': function() {
        console.log('======================== GetPrice')
        fetchPrice().then((d) => {

            let statesList = [[],[],[],[],[]];
            let reportMsg = "";

            Object.keys(d.services).map( function(item, index){
                var st = d.services[item].state;
                var time = 'current'; // 'current', or like: '9/21'
                if(st[time]){
                    statesList[st[time]].push(item);
                    // values for st[time]:
                    // I guess numbers map to: ( needs to be verified )
                    //
                    // Operational: 0 or 1
                    // Planned Maintenance: 2
                    // Partial Service Disruption: 3
                    // Service Disruption: 4
                    //
                }
                return null;
            })

            if(statesList[4].length == 0 && statesList[3].length == 0){
                reportMsg += `All services are operating in good conditions. No minor or major service disruption was detected .`
            }else{
                if(statesList[4].length > 0) reportMsg += `There are ${statesList[4].length} service disruptions for ${statesList[4].map((i)=>i)} .`
                if(statesList[3].length > 0) reportMsg += `There are ${statesList[3].length} partial service disruptions for ${statesList[3].map((i)=>i)} . `
            }

            if(d.active.length > 0) reportMsg += ` there is also ${d.active.length} planned maintenance events currently in active mode . `
            if(d.future.length > 0) reportMsg += ` There are ${d.future.length} maintenance plans scheduled for future days that may affect some of the services . `

            this.attributes.speechOutput = reportMsg;
            this.response.speak(this.attributes.speechOutput);
            this.response.cardRenderer(
            `Status.CTL.io © mim.Armand`,
                reportMsg,
            {
                smallImageUrl: "https://s3.amazonaws.com/random-shit-public/ctl_small.jpg",
                largeImageUrl: "https://s3.amazonaws.com/random-shit-public/ctl_large.jpg"
            }
        );
        this.emit(':responseReady');
    })
    },
    'Unhandled': function() {
        console.log('======================== Unhandled')
        this.attributes.unrecognizedSpeech = unrecognisedResponses[randomInRange(0, unrecognisedResponses.length)];
        this.response.speak(this.attributes.unrecognizedSpeech).listen(this.attributes.repromptSpeech);
        this.emit('RepromptRequest');
    },
    'AMAZON.HelpIntent': function() {
        const speechOutput = "Ask me for the CTL operation status!";
        const reprompt = "Ask something like: what is the status of CTL?!";
        this.emit(':ask', speechOutput, reprompt);
    },
    'AMAZON.CancelIntent': function() {
        this.emit(':tell', "Cool!");
    },
    'AMAZON.StopIntent': function() {
        this.emit(':tell', "See ya later!");
    },
};
const fetchPrice = function() {
    return new Promise(function(resolve, reject) {
        https.get( apiUrl, (res) => {
            let rawData = "";
        res.on('data', (chunk) => { rawData += chunk })
        res.on('end', () => {
            resolve( JSON.parse(rawData) )
    })
    }).on('error', (e) => {
            reject(e)
        });
        // post_req.end();
    })
}
const randomInRange = function(min, max) {
    return Math.floor((Math.random() * (max - min) + min));
}
exports.handler = function(event, context) {
  getSMedicationInfo('botox')
  .then((res)=>{
    console.log('>>>>>>>', res)
  })
    // const alexa = Alexa.handler(event, context);
    // alexa.APP_ID = APP_ID;
    // // To enable string internationalization (i18n) features, set a resources object.
    // // alexa.resources = languageStrings;
    // alexa.registerHandlers(handlers);
    // alexa.execute();
};
