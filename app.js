var http = require('http');
var express = require('express');
var fs = require('fs');
var mongojs = require('mongojs');
var crypto = require('crypto');

var logger = require('morgan');
var static = require('serve-static');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');

var app = express();
// var db = mongojs('dailyRecordApp', ['users']);
var db = mongojs('mongodb://test:test@ds163232.mlab.com:63232/dailyrecord', ['workoutrecord']);


// 미들웨어를 설정합니다.
app.use(logger());
app.use(bodyParser());
app.use(cookieParser('secret key'));
app.use(session());
app.use(static('public'));


var createHash = function(password) {
	var sha = crypto.createHash('sha256');
	sha.update(password);
	return sha.digest('hex');
} 


app.route('/register')
	.get(function (request, response) {
		if (request.session.me) {
			response.redirect('/');
		} else {
			fs.readFile('register.html', function (error, file) {
				response.send(file.toString());
			});
		}
	})
	.post(function (request, response) {
		var login = request.param('login');
		var password = request.param('password');

		if (login && password) {
			// 아이디 중복을 확인합니다.
			db.users.findOne({
				login: login
			}, function (error, result) {
				if (result) {
					// Conflict status code
					response.sendStatus(409);
				} else {
					hash = createHash(password);

					db.users.insert({
						login: login,
						hash: hash,
						date: {}
					}, function (error, result) {
						if (error) {
							response.sendStatus(500);
						} else {
							response.redirect('/');
						}
					})
				}
			})
		} else {
			response.send(400);
		}
	});


app.route('/login')
	.get(function (request, response) {
		if (request.session.me) {
			response.redirect('/');
		} else {
			fs.readFile('login.html', function (error, file) {
				response.send(file.toString());
			});			
		}
	})
	.post(function (request, response) {
		var login = request.param('login');
		var password = request.param('password');

		if (login && password) {
			db.users.findOne({
				login: login
			}, function(error, result) {
				if (result == null) {
					response.send({message: '아이디가 존재하지 않습니다.'}, 400);
				} else {
					var hash = createHash(password);
					if (result.hash == hash) {
						request.session.me = result;
						response.redirect('/');

					} else {
						response.send({message: '비밀번호가 일치하지 않습니다.'}, 400);
					}
				}
			});
		} else {
			response.sendStatus(400);
		}
	});


app.route('/logout')
	.get(function (request, response) {
		if (request.session.me) {
			request.session.destroy();
			response.redirect('/');
		} else {
			// Unauthorized
			response.sendStatud(401);
		}
	});


app.route('/')
	.get(function (request, response) {
		if (request.session.me) {
			fs.readFile('HTMLPage.html', function (error, file) {
				response.send(file.toString());
			})
		} else {
			response.redirect('/login');
		}
	});


app.route('/user/favorites')
	.get(function (request, response) {
		var me = request.session.me;
		if (me == undefined) {
			response.sendStatus(400);
		} else {
			db.users.findOne({
				login: me.login
			}, function (error, result) {
				if (error) {
					response.sendStatus(500);
				} else {
					response.send(result.list);
				}
			});			
		}
	})


app.route('/user/records/:date')
	.get(function (request, response) {
		var dateToFetch = request.params.date;

		if (request.session.me) {
			var me = request.session.me;

			db.users.findOne({
				login: me.login
			}, function (error, result) {
				if (error) {
					response.send(500)
				} else {
					if (result.date[dateToFetch] == undefined) {
						response.send([]);
					} else {
						response.send(result.date[dateToFetch]);
					}
				}
			});
		} else {
			response.sendStatus(400);	
		}
	})
	// favoriteList와 date 둘 다 데이터를 추가합니다.
	.post(function (request, response) {
		if (request.session.me) {
			var dateToSave = request.params.date;
			var hour = request.param('hour');
			var activity = request.param('activity');
			var me = request.session.me;
			var prevFavList = [];

			db.users.findOne({
				login: me.login
			}, function (error, result) {
				if (error) {
					response.sendStatus(500);
				} else {

					if (activity == "지우기") {
						var prevDate = result.date;
						delete prevDate[dateToSave][hour];

						db.users.update({
							login: me.login 
						}, {
							$set: {date: prevDate}
						}, function(error, result) {
							if (error) {
								response.send(500);
							} else {
								response.send(200);
							}
						});
					} else {
						// 추가하는 활동이 이미 저장되어 있으면 시간대만 업데이트하고,
						// 없으면 Favorite List부분도 같이 업데이트 하기.
						for (var i in result.list) {
								prevFavList.push(result.list[i]);
							};

						if (prevFavList.indexOf(activity) == -1) {
							prevFavList.push(activity);

							db.users.update({
								login: me.login
							}, {
								$set: {list: prevFavList}
							},function (error) {
								if (error) {
									response.send(500);
								}
							});
						}						

						var prevDate = result.date;

						console.log(prevDate);
						console.log(prevDate[dateToSave]);
						if (prevDate[dateToSave] == undefined) {
							prevDate[dateToSave] = {};
						}
						prevDate[dateToSave][hour] = activity;

						db.users.update({
							login: me.login 
						}, {
							$set: {date: prevDate}
						}, function(error, result) {
							if (error) {
								response.send(500);
							} else {
								response.send(200);
							}
						});
					}					
				}
			});

		} else {
			// Bad request
			response.sendStatus(400);
		}
	});


http.createServer(app).listen(52273, function () {
	console.log("Server Running at localhost:52273");
});

