/**
 * Created by Stefan
 */

var clients = [];
var maxClientConnections;
var debounceThreshold;

module.exports = {
    init: function(parameters){
        if(parameters.maxClientConnections){
            maxClientConnections = parameters.maxClientConnections;
        }
        if(parameters.debounceThreshold){
            debounceThreshold = parameters.debounceThreshold;
        }
    },

    debounce: function(func, socket, wait, immediate) {
        var timeout;
        var calls = 0;
        return function() {
            var context = this, args = arguments;
            var later = function() {
                timeout = null;
                calls = 0;
                if (!immediate) func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) {
                func.apply(context, args);
            } else {
                calls++;
                if(calls == debounceThreshold){
                    console.log(new Date().toLocaleTimeString() + ' | A user has attempted to send socket messages too quickly and has been disconnected. IP Address: ' + socket.handshake.address);
                    socket.disconnect();
                }
            }
        };
    },

    socketConnectionThrottle: function(socket){
        var client = function(ipAddress){
            this.ipAddress = ipAddress;
            this.connections = 1;
        };

        if(clients.length){
            for(var i = 0; i < clients.length; i++){
                if(socket.handshake.address.indexOf(clients[i].ipAddress) >= 0){
                    if(clients[i].connections == maxClientConnections) {
                        console.log(new Date().toLocaleTimeString() + ' | A user has attempted to open too many sockets. IP Address: ' + socket.handshake.address);
                        socket.disconnect();
                        return true;
                    } else {
                        clients[i].connections++;
                        return false;
                    }
                }
            }
        } else {
            clients.push(new client(socket.handshake.address));
            return false;
        }
    },

    socketDisconnect: function(socket){
        if(clients.length) {
            for (var i = 0; i < clients.length; i++) {
                if (socket.handshake.address.indexOf(clients[i].ipAddress) >= 0) {
                    clients[i].connections--;
                }
            }
        }
    }
};