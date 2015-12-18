/**
 * Created by Stefan Kraus and Eric Swanberg for SE 319.
 */

(function(){
    //App definition
    var app = angular.module('app', []);
	
	//Filter to format time elements for weather
	app.filter('timeFilter', function() {
		return function(input){
			var output = input;
			if(!output) return "ERROR";
			output = output.substr(0, output.indexOf(":"))
				+ " " + output.substr(output.length -2, output.length);
			return output;
		}
	});
	
	app.filter('dowFilter', function() {
		return function(input){
			var dow = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
			return dow[input];
		}
	});
	
    //Controller for all weather aspects
    app.controller('weatherController' , function($scope, $rootScope, $interval) {
		$rootScope.count = 0;
		$rootScope.imgCode = 0;
		var count = 0;
		$scope.alternate = $interval(function () {
			count++;
			count = count % 6;
			$rootScope.count = count;
			//Easter egg for chance to enable Gorilla Weather Images
			//Set to .01 for 1% chance, .99 for 99% chance.
			$rootScope.imgCode = Math.floor(Math.random() +.01);
		}, 5000);
		
        socket.on('receiveWeather', function (data) {
            if(data.currently){
                $scope.weather = data;
				
                $scope.$apply();
                //console.log('Updated weather information has been received');
            } else {
                console.log('Updated weather information is empty');
            }
        });
    });

	app.controller('titleController', function($scope, $interval){
		$scope.clock = "Loading clock...";

        //Updates the clock every second
        $scope.tick = $interval(function () {
            $scope.clock = Date.now();
        }, 1000);
		
	});
	
    //Controller for all information aspects
    app.controller('infoController', function($scope, $timeout){
        $scope.contacts = {};
        $scope.announcements = {};
        
        //Receives updated contacts
        socket.on('receiveContacts', function(data){
            if(data && data.length){
                $scope.contacts = data;
                $scope.$apply();
                //console.log('Updated contacts have been received');
            } else {
                console.log('Updated contacts object is empty');
            }
        });

        //Receives updated announcements
        socket.on('receiveAnnouncements', function(data){
            if(data && data.length){
                $scope.announcements = data;
                $scope.$apply();
                //console.log('Updated announcements have been received');
            } else {
                console.log('Updated announcements object is empty');
            }
        });
    });

	//Controller for Project Slideshow
	app.controller('slideController', function($scope, $interval){
		$scope.projects = {};
		var count =0;
		
		  socket.on('receiveProjects', function(data){
			if(data && data.length){
				$scope.projects = data;
				$scope.project = $scope.projects[count];
				$scope.$apply();
				//console.log('Projects Received!: ' + data.length);
			} else {
				console.log('Empty Projects');
			}
		}); 
		
		$scope.alternate = $interval(function () {
			count++;
			count = count % $scope.projects.length;
			$scope.count = count;
			$scope.project = $scope.projects[count];
		}, 7000);
		
	});
	
    //Controller for all news aspects
    app.controller('newsController', function($scope){
        $scope.news = {};

        //Receives updated news
        socket.on('receiveNews', function(data){
            if(data && data.length){
                $scope.news = data;
                $scope.$apply();
                //console.log('Updated news has been received: ' + data.length);
            } else {
                console.log('Updated news object is empty');
            }
        });
    });
})();