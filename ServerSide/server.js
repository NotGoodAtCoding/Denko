/**
 * Created by skraus and eswan95 for SE 319.
 */
//Link dependencies
var express = require('express');
var sockets = require('socket.io');
var Forecast = require('forecast.io');
var fs = require('fs');
var request = require('request');
var FeedParser = require('feedparser');
var security = require('./JSSecurityTools');
var util = require('util');

//Setup server
var app = express();
var io = sockets();
var server;
var port = 1337;
var adminCredentials = [];
var authenticationToken = '';
var maxClientConnections = 3;
var socketTimeout = 1000;
var debounceThreshold = 5;

//Weather setup
var forecastAPIKey = '';
var forecast;
var latitude = 42.01915;
var longitude = -93.64638;
var hoursToShow = 6;
var daysToShow = 6;
var weatherImageSet = '/Images/WeatherIcons/';
var weather = {
    currently: '',
    hourly: [],
	daily: [],
    alerts: []
};

//Info setup
var contacts;
var announcements;
var projects;

//News Setup
var news = [];
var feeds = ['http://feeds.reuters.com/reuters/technologyNews', 'http://feeds.reuters.com/reuters/scienceNews', 'http://feeds.reuters.com/Reuters/domesticNews', 'http://feeds.reuters.com/Reuters/worldNews', 'http://feeds.feedburner.com/TechCrunch/'];

app.use(express.static('../node_modules/angular'));
app.use(express.static('../node_modules/bootstrap/dist/css'));
app.use(express.static('../node_modules/normalize-css'));
app.use(express.static('../ClientSide/', {
    extensions: ['html'],
    index: 'client.html'
}));

/*
Server functions
 */

var errorCount = 0;

//Gets weather from server and parses it
var getWeather = function(startupCallback){
    //Makes sure forecast is defined
    if(!forecast){
        //Make sure the api key is populated. Needed to give the getCredentials function a chance to finish executing
        if(!forecastAPIKey){
            setTimeout(function(){
                getWeather(startupCallback);
            }, 1000 );
            return;
        } else{
            forecast = new Forecast({APIKey: forecastAPIKey});
        }
    }

    //Options for forecast call
    var forecastOptions = {
        'exclude': 'minutely,flags',
        'lang': 'en',
        'units': 'us'
    };


    //Performs request and parses data
    forecast.get(latitude, longitude, forecastOptions, function( err, res, data){
        if (err){
            setTimeout(function(){
                console.log('Unable to get weather. Trying again...');
                getWeather(startupCallback);
            }, 1000 * errorCount);
            errorCount++;
            return;
        } else {
            errorCount = 0;
        }
		
		var parseWind = function(dir) {
			if(dir > 337 || dir < 23) return "N";
			else if(dir >= 23 && dir < 67) return "NE";
			else if(dir >= 67 && dir < 113) return "E";
			else if(dir >= 113 && dir < 158) return "SE";
			else if(dir >= 158 && dir < 203) return "S";
			else if(dir >= 203 && dir < 248) return "SW";
			else if(dir >= 248 && dir < 293) return "W";
			else if(dir >= 293 && dir < 337) return "NW";
		}
		
		var parseSpeed = function(speed) {
			return Math.round(speed) + " mph";
		}
		
		var parseTemp = function(temp) {
			return Math.round(temp) + " \xBA" +"F";
		}

        //Currently weather handling
        if(data.currently){
            var currently = data.currently;
            var currentDate = new Date(currently.time * 1000);
            currentDate.setMinutes(0);
            currentDate.setSeconds(0);
            currentDate.setMilliseconds(0);
            weather.currently = {
                'date': (currently.time) ? currentDate.toLocaleDateString() : 'ERROR',
                'time': (currently.time) ? currentDate.toLocaleTimeString() : 'ERROR',
                'temperature': (currently.temperature) ? parseTemp(currently.temperature) : 'ERROR',
				'altTitles' : ["", "Wind: ", "Direction: "],
				'alternating' : [
					((currently.summary) ? currently.summary : 'ERROR'),
					((currently.windSpeed) ? parseSpeed(currently.windSpeed) : 'ERROR'),
					((currently.windBearing) ? parseWind(currently.windBearing) : 0)
				],
                'image': [
					((currently.icon) ? weatherImageSet + currently.icon + '.png' : ''),
					((currently.icon) ? weatherImageSet + currently.icon + 'G.png' : '')
				]
				
            };
        }

        //Hourly and daily weather handling
        weather.hourly = [];
        if(data.hourly){
            for(var i = 0, j = 0; i < data.hourly.data.length && j < hoursToShow - 1; i++) {
                var hourly = data.hourly.data[i];
                var hourlyDate = new Date(hourly.time * 1000);
                var hourObj = {
                    'date': (hourly.time) ? hourlyDate.toLocaleDateString() : 'ERROR',
                    'time': (hourly.time) ? hourlyDate.toLocaleTimeString() : 'ERROR',
                    'temperature': (hourly.temperature) ? parseTemp(hourly.temperature) : 'ERROR',
					'altTitles' : [ "", "Dew Point: "],
					'alternating' : [
						(hourly.summary) ? hourly.summary : 'ERROR',
						(hourly.dewPoint) ? parseTemp(hourly.dewPoint) : 'ERROR'
					],
                    'image': [ 
						((hourly.icon) ? weatherImageSet + hourly.icon + '.png' : ''),
						((hourly.icon) ? weatherImageSet + hourly.icon + 'G.png' : '')
					]
                };
                if(hourObj.time.substring(0,2) != weather.currently.time.substring(0,2)){
                    weather.hourly.push(hourObj);
                    j++;
                }
            }
        }

		weather.daily = [];
        if(data.daily){
			console.log("Daily data recieved");
            for(var i = 1, j = 0; i < data.daily.data.length && j < daysToShow -1 ; i++) {
                var daily = data.daily.data[i];
                var dailyDate = new Date(daily.time * 1000);
                var dayObj = {
                    'date': (daily.time) ? dailyDate.getDay() : 'ERROR',
                    'time': (daily.time) ? dailyDate.toLocaleTimeString() : 'ERROR',
					'altTitles' : [ ["", ""], ["Wind Speed: ", "Direction: "], ["High: ", "Low: "]],
					'alternating' : [
						[((daily.summary) ? daily.summary : 'ERROR'), ''],
						
						[((currently.windSpeed) ? parseSpeed(currently.windSpeed) : 'ERROR'),
						((currently.windBearing) ? parseWind(currently.windBearing) : 0)],
						
						[((daily.temperatureMax) ? parseTemp(daily.temperatureMax) : 'ERROR'),
						((daily.temperatureMin) ? parseTemp(daily.temperatureMin) : 'ERROR')]
					],
                    'image': [
						((daily.icon) ? weatherImageSet + daily.icon + '.png' : ''),
						((daily.icon) ? weatherImageSet + daily.icon + 'G.png' : '')
					]
                };
                weather.daily.push(dayObj);
                j++;
            }
        }
		
        //Severe weather alert handling
        weather.alert = [];
        if(data.alerts){
            for(var k = 0; k < data.alerts.length; k++){
                var alert = data.alerts[k];
                var alertDate = new Date(alert.expires * 1000);
                var alertObj = {
                    'title': (alert.title) ? alert.title : 'ERROR',
                    'expires-date': (alert.expires) ? alertDate.toLocaleDateString() : 'ERROR',
                    'expires-time': (alert.expires) ? alertDate.toLocaleTimeString() : 'ERROR',
                    'description': (alert.description) ? alert.description : 'ERROR',
                    'uri': (alert.uri) ? alert.uri : 'ERROR'
                };
                weather.alerts.push(alertObj);
            }
        }
        //Pushes new weather info to all clients
        io.emit('receiveWeather', weather);
        //Weather was retrieved, parsed, and pushed successfully
        console.log(new Date().toLocaleTimeString() + ' | Updated weather conditions received, parsed, and pushed.');
        //Handles callback if function is being called on server startup
        if(startupCallback){
            startupCallback();
        }
    });
    //Schedules weather refresh every 5 minutes
    setTimeout(getWeather, 5 * 60000);
};

//Updates contacts with values in file and sends to all clients
var getContacts = function(startupCallback){
    fs.readFile('contacts.json', function(err, data){
        if(err){
            console.log(err);
        } else{
            contacts = JSON.parse(data);
            io.emit('receiveContacts', contacts);
        }
        //Handles callback if function is being called on server startup
        if(startupCallback){ startupCallback() }
    });
};

//Writes new contact info to file and calls getContacts()
var setContacts = function(contacts){
    fs.writeFile('contacts.json', JSON.stringify(contacts, null, 4), function(err){
        if(err) {
             console.log(err);
        } else{
            getContacts();
        }
    });
};

//Updates contacts with values in file and sends to all clients
var getAnnouncements = function(startupCallback){
	console.log('Announcements Loaded');
    fs.readFile('announcements.json', function(err, data){
        if(err){
            console.log(err);
        } else{
            announcements = JSON.parse(data);
            io.emit('receiveAnnouncements', announcements);
        }
        //Handles callback if function is being called on server startup
        if(startupCallback){ startupCallback() }
    });
};

//Writes new contact info to file and calls getContacts()
var setAnnouncements = function(announcements){
    fs.writeFile('announcements.json', JSON.stringify(announcements, null, 4), function(err){
        if(err) {
            console.log(err);
        } else{
            getAnnouncements();
        }
    });
};

//Updates Projects and sends to all clients
var getProjects = function(startupCallback){
		console.log('Projects Loaded');
		fs.readFile('projects.json', function(err, data){
        if(err){
            console.log(err);
        } else{
            projects = JSON.parse(data);
            io.emit('receiveProjects', projects);
        }
        //Handles callback if function is being called on server startup
        if(startupCallback){ startupCallback() }
    });
};

//Writes new contact info to file and calls getContacts()
var setProjects = function(projects){
    fs.writeFile('projects.json', JSON.stringify(projects, null, 4), function(err){
        if(err) {
            console.log(err);
        } else{
            getProjects();
        }
    });
};

//Gets fresh news feed data
var getNews = function(startupCallback) {
    var feedsFinished = 0;
    news = [];
    //Runs for each feed
    for (var i = 0; i < feeds.length; i++) {
        //Makes request to rss feed
        var req = new request(feeds[i]);

        //Request error
        req.on('error', function (error) {
            console.log('There was an error making a feed request.');
            console.log(error);
        });

        //Request successful
        req.on('response', function (res) {
            //Server returned an error
            if (res.statusCode != 200){
                return this.emit('error', new Error('Bad status code'));
            }
            var stream = this;
            var parser = new FeedParser();
            //Parser error
            parser.on('error', function (error) {
                console.log('There was an error parsing the rss feed.');
                console.log(error);
            });

            //Parser ok
            parser.on('readable', function () {
                var stream = this;
                var item;
                while (item = stream.read()) {
                    var feedData = {
                        'source': item.meta.title,
                        //'sourceImg': item.meta.image.url,
                        'title': item.title
                        //'imgUrl': item.image.url
                    };
                    news.push(feedData);
                }
            });

            //Feed reading has ended
            parser.on('end', function(){
                feedsFinished++;
                //If all reading has finished
                if(feedsFinished === feeds.length){
                    var m = news.length, t, i;
                    // While there remain elements to shuffle…
                    while (m) {
                        // Pick a remaining element…
                        i = Math.floor(Math.random() * m--);
                        // And swap it with the current element.
                        t = news[m];
                        news[m] = news[i];
                        news[i] = t;
                    }
                    //Pushes new weather info to all clients
                    io.emit('receiveNews', news);
                    console.log( new Date().toLocaleTimeString() + ' | Updated feeds received, parsed, scrambled, and pushed.');
                    if(startupCallback){startupCallback()}
                }
            });
            //Sends data to the parser
            stream.pipe(parser);
        });
    }
    //Schedules news refresh every 5 minutes
    setTimeout(getNews, 300000);
};

//Populates all of the credential/authentication variables
var getCredentials = function(startupCallback){
    fs.readFile('credentials.json', function(err, data){
        if(err){
            if(err.code == 'ENOENT'){
                console.error('No credential file present.');
                process.exit(1);
            } else {
                console.log(err);
            }

        } else{
            var credentialData = JSON.parse(data);
            forecastAPIKey = credentialData.forecastApiKey;
            authenticationToken = credentialData.serverAuthenticationToken;
            adminCredentials = credentialData.adminCredentials;

        }
        //Handles callback if function is being called on server startup
        if(startupCallback){ startupCallback() }
    });
};


var setCredentials = function(credentials){
    var dataToWrite = {
        forecastApiKey: forecastAPIKey,
        serverAuthenticationToken: authenticationToken,
        adminCredentials: credentials
    };

    fs.writeFile('credentials.json', JSON.stringify(dataToWrite, null, 4), function(err){
        if(err) {
            console.log(err);
        } else{
            getCredentials();
        }
    });
};

//Handles the initial server setup before starting
var initializeServer = function(functions, startServer) {
    var progress = 0;
    var completion = functions.length;
    //Callback for each startup method
    var callback = function () {
        progress++;
        if(progress === completion){
            //All setup is finished
            console.log('All setup completed');
            startServer();
        }
    };
    //Invokes all linked functions
    for (var i = 0; i < completion; i++) {
        functions[i](callback);
    }
};

//Starts the server
(function(){
    //Link required startup methods
    var functions = [getCredentials, getContacts, getAnnouncements, getNews, getWeather, getProjects];

    //What to do once initialization finishes
    var start = function(){
        security.init({'maxClientConnections': maxClientConnections, 'debounceThreshold': debounceThreshold});//Todo make preferences hydrator

        //Starts the Express server
        server = app.listen(port, function () {
            //Server started
            console.log('Office-Board web server running on port ' + port);

            //Start socket server
            io.listen(server);
            console.log('Office-Board socket server running on port ' + port);
        });
    };
    initializeServer(functions, start);
})();

/*
 Websocket stuff
 */


//Socket routes
io.on('connection', function (socket) {
    //Ensures the socket connections aren't being abused. If it is, skip everything.
    if(security.socketConnectionThrottle(socket)) return;
    console.log(new Date().toLocaleTimeString() + ' | A user has connected. IP Address: ' + socket.handshake.address +  ' Total users: ' + io.engine.clientsCount);

    //On connect, send client current info
    socket.emit('receiveWeather', weather);
    socket.emit('receiveAnnouncements', announcements);
    socket.emit('receiveContacts', contacts);
    socket.emit('receiveNews', news);
	socket.emit('receiveProjects', projects); 

    /*
    ** Client Requests
    */
    socket.on('adminLogin', function(data){
        adminLogin(data);
    });

    socket.on('setAdminPassword', function(data){
        setAdminPassword(data);
    });

    socket.on('getPasswordResetData', function(){
        getPasswordResetData();
    });

    //Sets updated contact information
    socket.on('storeContacts', function(data){
        storeContacts(data);
    });

    //Returns updated announcements on user request
    socket.on('requestAnnouncements', function(){
        returnAnnouncements();
    });
	
	socket.on('requestProjects', function(){
        returnProjects();
    });

    //Returns updated contacts on user request
    socket.on('requestContacts', function(){
        returnContacts();
    });
	
    //Sets updated announcement information
    socket.on('storeAnnouncements', function(data){
        storeAnnouncements(data);
    });

    //A user has disconnected
    socket.on('disconnect', function (data) {
        security.socketDisconnect(socket);
        console.log(new Date().toLocaleTimeString() + ' | A user has disconnected. Total users: ' + io.engine.clientsCount);
    });

    //Socket functions
    var adminLogin = security.debounce(function(data){
        for(var i = 0; i < adminCredentials.length; i++){
            if(adminCredentials[i].username === data.username && adminCredentials[i].password === data.password){
                var test = false;
                if(!adminCredentials[i].securityQuestion || !adminCredentials[i].securityAnswer){
                    test = true;
                }
                socket.emit('adminLoginResponse', { 'authenticationToken': authenticationToken, 'setQuestions': test});
                console.log(new Date().toLocaleTimeString() + ' | ' + data.username + ' has logged in.');
                return;
            }
        }
        socket.emit('adminLoginResponse', {'authenticationToken' : 'denied', 'setQuestions' : false});
    }, socket, socketTimeout, true);

    var setAdminPassword = security.debounce(function(data){
        for(var i = 0; i < adminCredentials.length; i++){
            if(adminCredentials[i].username == data.username && adminCredentials[i].securityAnswer == data.questionAnswer){
                adminCredentials[i].password = data.newPassword;
                setCredentials(adminCredentials);
                console.log(new Date().toLocaleTimeString() + ' | Password changed for user ' + data.username);
                socket.emit('setPasswordResult', true);
                return;
            }
        }
        console.log(new Date().toLocaleTimeString() + ' | Attempted password change for user ' + data.username);
        socket.emit('setPasswordResult', false);
    }, socket, socketTimeout, true);

    var getPasswordResetData = security.debounce(function(){
        var adminSecurityCredentials = function(username, securityQuestion){
            this.username = username;
            this.securityQuestion = securityQuestion;
        };
        var admins = [];

        for(var i = 0; i < adminCredentials.length; i++){
            admins.push(new adminSecurityCredentials(adminCredentials[i].username, adminCredentials[i].securityQuestion));
        }
        socket.emit('receivePasswordResetData', admins);
    }, socket, socketTimeout, true);

    var storeContacts = security.debounce(function(data){
        if(data.authentication === authenticationToken){
            setContacts(data.data);
        } else {
            console.log('An unauthenticated attempt at setting data has been made');
        }
    }, socket, socketTimeout, true);

    var returnContacts = security.debounce(function(){
        socket.emit('receiveContacts', contacts);
    }, socket, socketTimeout, true);

    var storeAnnouncements = security.debounce(function(data){
        if(data.authentication === authenticationToken){
            setAnnouncements(data.data);
        } else {
            console.log('An unauthenticated attempt at setting data has been made');
        }
    }, socket, socketTimeout, true);

    var returnAnnouncements = security.debounce(function(){
        socket.emit('receiveAnnouncements', announcements);
    }, socket, socketTimeout, true);
	
	var returnProjects = security.debounce(function() {
		socket.emit('receiveProjects', projects);
	}, socket, socketTimeout, true); 
});