/* eslint-disable  func-names */
/* eslint quote-props: ["error", "consistent"]*/
// We can use the following API:
// https://status.ctl.io/v1/status
'use strict';
const Alexa = require('alexa-sdk');
const https = require('https');
const querystring = require('querystring');
const url = require('url');

const helloMessages = [
  "Hi! Welcome to Express Scripts! how can I help you today?",
  "Hello! Welcome to Express Scripts! what can I do for you?",
  "Welcome to Express Scripts! Anything I can help you with?"
]
const iWillCall = [
  "Ok, I'll have somebody to call you back.",
  "Your pharmacy will be notified and an expert will call you back shortly",
  "Noted! expect a call from your pharmacy in a few minutes!",
  "I signaled your pharmacy, you'll get a call in a few minutes."
]
const reprompMessages = [
  "You can say for instance What's my medecine schedule today, or, I need help",
  "You can ask me what is Acetaminophen for instance, or any other medicine or ask me to have your pharmacist to call you"
]
const unrecognisedResponses = [
  "What was that again?",
  "Sorry, I could not recognize that, can you repeat?",
  "Sorry, I missed that, can you run that with me again?"
]
const shouldICallPharmacist = [
  "Would you like a pharmacist to contact you with more information?",
  "Do you want to receive a call for more consultation?",
  "Now, If you want I can arrange an expert to call you back to make sure you get all the information you need?"
]
const APP_ID = process.env.APP_ID;
const apiUrl = url.parse('https://api.healthgraphic.com/');
const healthgraphicPass = process.env.healthgraphicPass;
const healthgraphicEmail = process.env.healthgraphicEmail;

const getToken = function() {
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
    var req = https.request(options, function(res) {
      var chunks = [];
      res.on("data", function(chunk) {
        chunks.push(chunk);
      });
      res.on("end", function() {
        var body = Buffer.concat(chunks);
        resolve(JSON.parse(body.toString()).token)
      });
      res.on('error', (e) => {
        reject(e)
      });
    });
    req.write(postData);
    req.end();
  })
}

const getSMedicationInfo = function(medecine) {
  // return new Promise(function(resolve, reject) {
  //   resolve({
  //     'response':{'medication':{'description': 'yup!'}}
  //   });
  // })
  return new Promise(function(resolve, reject) {
    getToken()
      .then((token) => {
        var options = {
          method: "GET",
          hostname: apiUrl.hostname,
          path: `/v1/medications/${medecine}`,
          headers: {
            'token': token,
            'Cache-Control': 'no-cache'
          }
        };
        var req = https.request(options, function(res) {
          var chunks = [];
          res.on("data", function(chunk) {
            chunks.push(chunk);
          });
          res.on("end", function() {
            var body = Buffer.concat(chunks);
            resolve(JSON.parse(body.toString()))
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
    this.attributes.speechOutput = helloMessages[randomInRange(0,
      helloMessages.length)];
    this.attributes.repromptSpeech = reprompMessages[randomInRange(0,
      reprompMessages.length)];
    this.response.speak(this.attributes.speechOutput).listen(this.attributes
      .repromptSpeech);
    this.emit(':responseReady');
  },
  'RepromptRequest': function() {
    this.attributes.repromptSpeech = reprompMessages[randomInRange(0,
      reprompMessages.length)];
    this.response.speak(this.attributes.repromptSpeech).listen(this.attributes
      .repromptSpeech);
    this.emit(':responseReady');
  },
  'CallPharmacist': function() {
    this.emit(':tell',
      "Alright! it's set up! an expert will call you back in less than 10 minutes."
    );
  },
  'GetStatus': function() {
    console.log('======================== GetPrice')
    fetchPrice().then((d) => {

      let statesList = [
        [],
        [],
        [],
        [],
        []
      ];
      let reportMsg = "";

      Object.keys(d.services).map(function(item, index) {
        var st = d.services[item].state;
        var time = 'current'; // 'current', or like: '9/21'
        if (st[time]) {
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

      if (statesList[4].length == 0 && statesList[3].length == 0) {
        reportMsg +=
          `All services are operating in good conditions. No minor or major service disruption was detected .`
      } else {
        if (statesList[4].length > 0) reportMsg +=
          `There are ${statesList[4].length} service disruptions for ${statesList[4].map((i)=>i)} .`
        if (statesList[3].length > 0) reportMsg +=
          `There are ${statesList[3].length} partial service disruptions for ${statesList[3].map((i)=>i)} . `
      }

      if (d.active.length > 0) reportMsg +=
        ` there is also ${d.active.length} planned maintenance events currently in active mode . `
      if (d.future.length > 0) reportMsg +=
        ` There are ${d.future.length} maintenance plans scheduled for future days that may affect some of the services . `

      this.attributes.speechOutput = reportMsg;
      this.response.speak(this.attributes.speechOutput);
      this.response.cardRenderer(
        `Status.CTL.io © mim.Armand`,
        reportMsg, {
          smallImageUrl: "https://s3.amazonaws.com/random-shit-public/ctl_small.jpg",
          largeImageUrl: "https://s3.amazonaws.com/random-shit-public/ctl_large.jpg"
        }
      );
      this.emit(':responseReady');
    })
  },
  'MedicalHelp': function() {
    let intentObj = this.event.request.intent;
    if (intentObj.confirmationStatus !== 'CONFIRMED') {
      if (intentObj.confirmationStatus !== 'DENIED') {
        // Intent is not confirmed
        let speechOutput =
          'Should I call 911? Please say yes if it is a Medical emergency, otherwise say no and I\'ll notify your physician and other parties that were set up in your account. you can also say cancel!';
        this.emit(':confirmIntent', speechOutput, shouldICallPharmacist[
          randomInRange(0, reprompMessages.length)]);
      } else {
        // Users denies the confirmation of intent. May be value of the slots are not correct.
        this.attributes.speechOutput =
          "Ok! be careful! I alerted your physician to give you a call, I also notified your relatives and other parties that was set up as emergency contacts in your account.";
        this.emit(':tell', this.attributes.speechOutput);
      }
    } else {
      // this.response.speak("Alright! it's set up! an expert will call you back in less than 10 minutes.")
      this.attributes.speechOutput =
        "Ok, I am calling 911 right now and transfering your information, please stay calm and breathe normally. help is on the way.";
      this.emit(':tell', this.attributes.speechOutput);
    }
  },
  'Schedule': function() {
    let intentObj = this.event.request.intent;
    if (intentObj.confirmationStatus !== 'CONFIRMED') {
      if (intentObj.confirmationStatus !== 'DENIED') {
        // Intent is not confirmed
        let speechOutput =
          'You should take your next Fluoroquinolones pills in 4 hours, you had to take the last one 2 hours ago, have you taken that one ontime?';
        this.emit(':confirmIntent', speechOutput, shouldICallPharmacist[
          randomInRange(0, reprompMessages.length)]);
      } else {
        // Users denies the confirmation of intent. May be value of the slots are not correct.
        this.attributes.speechOutput =
          "No worries, since there is 4 hours left till your next dose, please take one right now and continue on the same schedule. Please note that it's important to take antibiotics on time.";
        this.emit(':tell', this.attributes.speechOutput);
      }
    } else {
      // this.response.speak("Alright! it's set up! an expert will call you back in less than 10 minutes.")
      this.attributes.speechOutput = "Ok! I noted that!";
      this.emit(':tell', this.attributes.speechOutput);
    }
  },
  'PharmacistCall': function() {
    this.emit(':tell', iWillCall[randomInRange(0, iWillCall.length)]);
  },
  'WhatsNext': function() {
    this.emit(':tell',
      'After this hackathon we all need to take a long nap, and then maybe we can relase this skill in the market place and make it available to general public!'
    );
  },
  'Medication': function() {
    console.log('======================== Medication')
    getSMedicationInfo(this.event.request.intent.slots.medecine.value)
      .then((res) => {
        // this.response.speak(this.attributes.repromptSpeech).listen(this.attributes.repromptSpeech);
        // this.emit(':tell', this.attributes.speechOutput);
        // this.emit(':listen', this.attributes.speechOutput, this.attributes.repromptSpeech);

        // this.response.speak(this.attributes.speechOutput)
        // .listen(this.attributes.repromptSpeech)
        // .speak('Alright!');
        // // this.emit(':responseReady');
        // this.emit(':confirmIntent',
        // this.attributes.speechOutput,
        // this.attributes.repromptSpeech);
        // this.emit(':responseReady');

        let intentObj = this.event.request.intent;
        if (intentObj.confirmationStatus !== 'CONFIRMED') {
          if (intentObj.confirmationStatus !== 'DENIED') {
            // Intent is not confirmed
            let speechOutput = (res.response.medication.name || '') + ' ' +
              (
                res.response.medication.description ||
                'I couldn\'t find that in my database') + '. ' +
              shouldICallPharmacist[randomInRange(0, reprompMessages.length)];
            this.emit(':confirmIntent', speechOutput,
              shouldICallPharmacist[randomInRange(0, reprompMessages.length)]
            );
          } else {
            // Users denies the confirmation of intent. May be value of the slots are not correct.
            this.attributes.speechOutput =
              "Ok! let me know if you changed your mind!";
            this.emit(':tell', this.attributes.speechOutput);
          }
        } else {
          // this.response.speak("Alright! it's set up! an expert will call you back in less than 10 minutes.")
          this.attributes.speechOutput =
            "Alright! it's set up! an expert will call you back in less than " +
            randomInRange(5, 30) +
            " minutes.";
          this.emit(':tell', this.attributes.speechOutput);
        }


        // this.emit('CallPharmacist');
      })
  },
  'Unhandled': function() {
    console.log('======================== Unhandled')
    this.attributes.unrecognizedSpeech = unrecognisedResponses[
      randomInRange(0, unrecognisedResponses.length)];
    this.response.speak(this.attributes.unrecognizedSpeech).listen(this.attributes
      .repromptSpeech);
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
const randomInRange = function(min, max) {
  return Math.floor((Math.random() * (max - min) + min));
}
exports.handler = function(event, context) {
  const alexa = Alexa.handler(event, context);
  alexa.APP_ID = APP_ID;
  // To enable string internationalization (i18n) features, set a resources object.
  // alexa.resources = languageStrings;
  alexa.registerHandlers(handlers);
  alexa.execute();
};
