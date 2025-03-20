require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/dynamic-chat-app');

const app = require('express')();
const http = require('http').Server(app);

const userRoute = require('./routes/userRoute');
const User = require('./models/userModel');
const Chat = require('./models/chatMode');

app.use('/',userRoute);

const io = require('socket.io')(http);
var usp = io.of('/user-namespace');

usp.on('connection', async function(socket){
    console.log('user connected');

    var userId = socket.handshake.auth.token;
    await User.findByIdAndUpdate({ _id:userId },{$set:{is_online:'1'}});

    //user broadcast online status
    socket.broadcast.emit('getOnlineUser',{user_id:userId});


    socket.on('disconnect',async function(){
        console.log('user is disconncted');

        var userId = socket.handshake.auth.token;
        await User.findByIdAndUpdate({ _id:userId },{$set:{is_online:'0'}});

        //user broadcast online status
        socket.broadcast.emit('getOfflineUser',{user_id:userId});
    });

    //chatting implementation
    socket.on('newChat',function(data){
        socket.broadcast.emit('loadNewChat',data);
    })
    
    //load old chats 
    socket.on('existsChat',async function(data){
        var chats =await Chat.find({ $or:[
            {sender_id:data.sender_id, receiver_id:data.receiver_id},
            {sender_id:data.receiver_id,receiver_id:data.sender_id},
        ]});

        socket.emit('loadChats',{chats:chats});
    });

    //delete chats
    socket.on('chatDeleted',function(id){
        socket.broadcast.emit('chatMessageDeleted',id);
    } );

    //update chats
    socket.on('chatUpdated',function(data){
        socket.broadcast.emit('chatMessageUpdated',data);
    });

});

http.listen(3000,()=>{
    console.log("server is running at:  3000");
});