/**
 * Created by Stefan Kraus and Eric Swanberg for SE 319.
 */
(function() {
    var app = angular.module('adminApp', []);

//Token used to authenticate all data being pushed to the server
    var authenticationToken = '';

//Templates
    var templateFolder = '/Templates/';
    var adminLogin = 'adminLogin.html';
    var adminEditor = 'adminEditor.html';
    var adminPasswordReset = 'adminPasswordReset.html';

//Controller responsible for handling the editing of data types on the admin page
    app.controller('dataEditor', function ($scope) {
        var dataType = {};
        $scope.title = '';
        $scope.data = {};
        $scope.newData = {};

        //Sets up the controller for the type of data it's handling and registers the listener socket
        $scope.init = function (type) {
            if (type == 'announcements') {
                dataType.data = 'announcement';
                dataType.request = 'requestAnnouncements';
                dataType.receive = 'receiveAnnouncements';
                dataType.store = 'storeAnnouncements';
                $scope.title = 'Announcement';
            } else if (type == 'contacts') {
                dataType.data = 'contact';
                dataType.request = 'requestContacts';
                dataType.receive = 'receiveContacts';
                dataType.store = 'storeContacts';
                $scope.title = 'Contact';
            }
            //Receives updated data
            socket.on(dataType.receive, function (data) {
                if (data && data.length) {
                    $scope.data = data;
                    $scope.$apply();
                    console.log('Updated ' + dataType.data + 's have been received');
                } else {
                    console.log('Updated ' + dataType.data + 'object is empty');
                }
            });

            //Requests updated data
            socket.emit(dataType.request);
        };

        //Deletes a data item
        $scope.deleteData = function (index) {
            $scope.data.splice(index, 1);
        };

        //Called when the submit button is hit
        $scope.submit = function () {
            var sendData = {
                authentication: authenticationToken,
                data: $scope.data
            };
            socket.emit(dataType.store, sendData);
        };

        //Clears the values of the new data cells
        $scope.clearNewData = function () {
            $scope.newData.title = '';
            $scope.newData.value = '';
        };

        //Function that is called when the add button is hit
        $scope.addNewData = function () {
            if (!$scope.newData.title || !$scope.newData.value) {
                alert('You cannot add an ' + dataType.data + ' with a blank field.');
            } else {
                var newData = {
                    'title': $scope.newData.title,
                    'value': $scope.newData.value
                };
                $scope.data.push(newData);
                $scope.clearNewData();
            }
        };
    });

//Controller responsible for handling resetting admin passwords
    app.controller('passwordReset', function ($scope) {
        $scope.username = '';
        $scope.questionAnswer = '';
        $scope.newPassword = '';
        $scope.question = 'Security Question';

        //Array containing list of admin usernames and security questions
        var adminSecurityData = [];

        //Gets security credentials to reset password
        socket.emit('getPasswordResetData');

        //Listens for username/security question data
        socket.on('receivePasswordResetData', function (data) {
            if (data && data.length) {
                adminSecurityData = data;
            } else {
                console.error('There was a problem receiving the admin security credentials.');
            }
        });

        //Handles the security question population based on username input typing
        $scope.questionTextPopulate = function () {
            for (var i = 0; i < adminSecurityData.length; i++) {
                if (adminSecurityData[i].username == $scope.username) {
                    $scope.question = adminSecurityData[i].securityQuestion;
                    return;
                }
            }
            $scope.question = 'Security Question';
        };

        //Sends new password to server
        $scope.pushPassword = function () {
            var credentials = {
                username: $scope.username,
                questionAnswer: $scope.questionAnswer,
                newPassword: $scope.password
            };
            socket.emit('setAdminPassword', credentials);
        };

        socket.on('setPasswordResult', function (data) {
            if (data == true) {
                console.log('Password successfully updated');
                alert('Password successfully updated');
                $scope.$emit('changeView', 'adminLogin.html');
            } else {
                console.log('Password change rejected');
                alert('Invalid recovery question answer');
                $scope.questionAnswer = '';
                $scope.password = '';
                $scope.$apply();
            }
        });
    });

//Controller responsible for handling the admin login
    app.controller('login', function ($scope) {
        $scope.username = '';
        $scope.password = '';

        //Function that pushes login credentials to the server
        $scope.login = function () {
            var userCredentials = {
                username: $scope.username,
                password: $scope.password
            };
            socket.emit('adminLogin', userCredentials);
        };

        //Registers the listener socket for authentication response
        socket.on('adminLoginResponse', function (data) {
            console.log(data);
            //The authentication was successful
            if (data && data.authenticationToken != 'denied') {
                authenticationToken = data.authenticationToken;
                console.log('Login successful');
                if(data.setQuestions){
                    $scope.$emit('changeView', 'adminSetResetQuestion.html');
                } else {
                    $scope.$emit('changeView', 'adminEditor.html');
                }
            } else if (data && data.authenticationToken == 'denied') {
                console.error('Invalid username or password');
                alert("Invalid username or password");
            } else {
                console.error('Login attempt failed');
                alert("Login attempt failed");
            }
        });
    });

    app.controller('setSecurityQuestion', function($scope){
        var data = {
            'securityQuestion': $scope.securityQuestion,
            'questionAnswer': $scope.questionAnswer
        };
        socket.emit('setSecurityQuestion', data);

        socket.on('questionSet', function(data){
            if(data){
                $scope.$emit('changeView', 'dataEditor.html');
            } else {
                console.log('Set security question failed');
                alert('Set security question failed! Try again.');
            }
        })
    });

//Controller responsible for handling the admin page as a whole
    app.controller('admin', function ($scope) {
        //Initial view setup
        $scope.template = templateFolder + adminLogin;

        //Changes the admin view based on the view received from other admin controllers
        $scope.$on('changeView', function (event, data) {
            $scope.template = templateFolder + data;
            //Makes sure $apply is called only if it's not already in progress
            if (!$scope.$$phase) {
                $scope.$apply();
            }
        })
    });
})();