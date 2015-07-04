var url = require('url'),
	app = require('express')(),
    server = require('http').createServer(app),
	io = require('socket.io').listen(server);

    fs = require('fs'),
	exec = require('child_process').exec,
	str = require('stream'),
    util = require('util'),
    shortid = require('shortid'),
 	Files = {};


// set the view engine to ejs
app.set('view engine', 'ejs');
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ@$');

// Chargement de la page index.html
app.get('/nodejs/stream/', function (req, res) {
 	fs.readdir('./Video', function(err, files) {

 		//console.log('fichiers' + files);
 		var listmp4 = [];
 		files.forEach(function(file) { 
 			var fileExtension = file.substr(file.lastIndexOf('.')+1);
 			if(fileExtension == 'mp4' && files.indexOf(file+".jpg") > -1)
 			{
 				listmp4.push(file);
 			}	
 			
 		}); 
 		console.log(listmp4); 

 		//if (yourArray.indexOf("someString") > -1) {
 		res.render('index.ejs', {listmp4 : listmp4});
 	});
  	//res.sendFile(__dirname + '/index.ejs');
});

	function shortName(e){
		e = e.toLowerCase().replace(/([^\w\-])/g,'');
   		return e;
 	}
    /**
	* connection 
	**/
	io.sockets.on('connection', function (socket) {

		console.log('nouveau utilisateur');

		var listClients = [];
		socket.on('afficheRoom', function (valeur) {
			var numRoom = valeur;
			console.log('room : '+numRoom);
			socket.room = numRoom;
			socket.join(socket.room);
			socket.broadcast.to(numRoom).emit('message', 'Une personne vient de rejoindre la room numéro '+numRoom);
			//var sockets_in_room = io.nsps['/'].adapter.rooms[socket.room];
			//console.log('list clients : '+findClientsSocketByRoomId(socket.room));
			var namespace = '/';
			var roomName = socket.room;
			
			for (var socketId in io.nsps[namespace].adapter.rooms[roomName]) {
			   // console.log(socketId);
			    listClients.push(socketId);
			 
			}
		   if(listClients.length == 1) {
		    	socket.emit('admin', socket.room);
		    }

			console.log(listClients);
  		});

  		socket.on('playpause', function (valeur) {

  			console.log('room : ' + valeur.room +' timer : '+valeur.timer);
			socket.broadcast.to(valeur.room).emit('pause', valeur.timer);
		});
		socket.on('syncVideo', function (valeur) {
			console.log('admin : ' + listClients[0]);
			console.log('id : ' +socket.id);
			 socket.to(listClients[0]).emit("getTimerAdmin", socket.id);
		});
			socket.on('timerAdmin', function (valeur) {
				console.log('val : '+valeur.timerActu+' socketId : '+valeur.socketId);
			socket.to(valeur.socketId).emit("recupTimerAdmin", valeur.timerActu);
		});
	  	socket.on('Start', function (data) { //data contains the variables that we passed through in the html file
					var Name = data['Name'];
					Files[Name] = {  //Create a new Entry in The Files Variable
					FileSize : data['Size'],
					Data	 : "",
					Downloaded : 0
				}
				var Place = 0;
				try{
					var Stat = fs.statSync('Temp/' +  Name);
					if(Stat.isFile())
					{
						Files[Name]['Downloaded'] = Stat.size;
						Place = Stat.size / 524288;
					}
				}
		  		catch(er){} //It's a New File
				fs.open("Temp/" + Name, 'a', 0755, function(err, fd){
					if(err)
					{
						console.log(err);
					}
					else
					{
						Files[Name]['Handler'] = fd; //We store the file handler so we can write to it later
						socket.emit('MoreData', { 'Place' : Place, Percent : 0 });
					}
				});
		});
		
		socket.on('Upload', function (data){
			var Name = data['Name'];
			Files[Name]['Downloaded'] += data['Data'].length;
			Files[Name]['Data'] += data['Data'];
			if(Files[Name]['Downloaded'] == Files[Name]['FileSize']) //If File is Fully Uploaded
			{
				fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function(err, Writen){
					var inp = fs.createReadStream("Temp/" + Name);
					var out = fs.createWriteStream("Video/" + Name);
					inp.pipe(out);
						inp.on('end', function() {
							fs.unlink("Temp/" + Name, function () { //This Deletes The Temporary File
								var parseName = shortName(Name);
								var fileExtension = Name.substr(Name.lastIndexOf('.')+1);
								var newName = parseName + '_' +  shortid.generate()+ '.' + fileExtension;
								console.log(newName);
								fs.rename('Video/' + Name, 'Video/' + newName);
								exec("C:/wamp/www/nodejs/stream/ffmpeg-20150619-git-bb3703a-win64-static/ffmpeg-20150619-git-bb3703a-win64-static/bin/ffmpeg.exe -i Video/" + newName  + " -ss 00:10 -r 1 -an -vframes 1 -f mjpeg Video/" + newName  + ".jpg", function(err){
									socket.emit('Done', {'video' : newName, 'Image' : 'Video/' + newName + '.jpg'});
								});
							});
						});
					/* fin */
				});
			}
			else if(Files[Name]['Data'].length > 10485760){ //If the Data Buffer reaches 10MB
				fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function(err, Writen){
					Files[Name]['Data'] = ""; //Reset The Buffer
					var Place = Files[Name]['Downloaded'] / 524288;
					var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;
					socket.emit('MoreData', { 'Place' : Place, 'Percent' :  Percent});
				});
			}
			else
			{
				var Place = Files[Name]['Downloaded'] / 524288;
				var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;
				socket.emit('MoreData', { 'Place' : Place, 'Percent' :  Percent});
			}
		});
	});

// Chargement de la page video.html
app.get('/nodejs/stream/video.html', function (req, res) {
  res.sendFile(__dirname + '/video.html');
});

/*
// Chargement de la page room.html
var listRoom=new Array();
var numRoom = Math.ceil(Math.random() * 10000);
while (listRoom.indexOf(numRoom) != -1){
	numRoom = Math.ceil(Math.random() * 10000);
}
listRoom.push(numRoom);
*/
app.get('/nodejs/stream/room/:roomnum', function(req, res) {
    //res.render('room.ejs');
   // var serverr  = app.listen(8080);
   // var io = require('socket.io').listen(server);
	//var io = require('socket.io')();

    res.render('room.ejs', {room: req.params.roomnum});

	
  
	/**
	* Création des rooms
	*/
	/*var rooms = [1, 2, 3, 4];
	var room = numRoom;
	var messages = {};
	console.log('numero de rooms :'+rooms)
	// Pour chaque chambre...
	//rooms.forEach(function (room) {
	//	console.log('room :'+room);

		// On créé la liste des messages
		//messages[room] = [];
		// On créé la chambre et pour chaque connection...
		io.of('/'+room).on('connection', function (socket) {
			// on envoie le titre du chat + la liste des messages
			socket.emit('connected');
			/**
			* Réception du numéro de room
			/
			socket.on('afficheRoom', function(maRoom){
				numRoom = maRoom;
				
				console.log('test : '+ numRoom);
			})

		});
*/
	//});

	
});
// Chargement de la video
app.get('/nodejs/stream/Video/:video', function (req, res) {
  res.sendFile(__dirname + '/Video/'+ req.params.video +'');
});


server.listen(8080);
