const User = require('../models/userModel');
const Chat = require('../models/chatMode');
const Group = require('../models/groupModel');
const Member = require('../models/memberModel');
const GroupChat = require('../models/groupChatModel');
const bcrypt = require('bcrypt');
const mongoose = require("mongoose");

const registerLoad = async (req, res) => {
    try {
        res.render('register'); 
    } catch (error) {
        console.log(error.message);
        res.status(500).send("Server Error"); 
    }
};

const register = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send("Image upload is required"); 
        }

        const passwordHash = await bcrypt.hash(req.body.password, 10);

        const user = new User({
            name: req.body.name,
            email: req.body.email,
            image: 'images/' + req.file.filename, 
            password: passwordHash
        });

        await user.save();
        res.render('register', { message: 'Your registration has been successful' });

    } catch (error) {
        console.log(error.message);
        res.status(500).send("Server Error"); 
    }
};

const loadLogin = async (req,res)=>{
    try{

        res.render('login');

    }catch(error){
        console.log(error.message);
    }
}

const login = async (req, res) => {
    try {
        const email = req.body.email;
        const password = req.body.password;

        const userData = await User.findOne({ email: email });

        if (!userData) {
            return res.render('login', { message: 'Email and password are incorrect!' });
        }

        const passwordMatch = await bcrypt.compare(password, userData.password);
        if (!passwordMatch) {
            return res.render('login', { message: 'Email and password are incorrect!' });
        }

        req.session.user = userData;
        res.cookie(`user`,JSON.stringify(userData));
        return res.redirect('/dashboard'); 

    } catch (error) {
        console.log(error.message);
        return res.status(500).send("Server Error");
    }
};


const logout = async (req, res) => {
    try {

        res.clearCookie('user');
        req.session.destroy(() => {
            return res.redirect('/');
        });
    } catch (error) {
        console.log(error.message);
        return res.status(500).send("Server Error");
    }
};


const loadDashboard = async (req,res)=>{
    try{
        
        var users = await User.find({ _id:{ $nin:[req.session.user._id] } });
        res.render('dashboard',{user:req.session.user,users:users});

    }catch(error){
        console.log(error.message);
    }
}

const saveChat = async(req,res)=>{
    try{
        var chat = new Chat({
            sender_id:   req.body.sender_id,
            receiver_id: req.body.receiver_id,
            message:     req.body.message,
        });

        var newChat = await chat.save();
        res.status(200).send({success:true, msg:'chat inserted!', data:newChat });

    }catch(error){
        res.status(400).send({success:false,mag:error.message});
    }
}

const deleteChat = async (req,res)=>{
    try{

        await Chat.deleteOne({_id:req.body.id});
        res.status(200).send({success:true});

    }catch(error){
        res.status(400).send({success:false,mag:error.message});
    }
}

const updateChat = async (req,res)=>{
    try{

        await Chat.findByIdAndUpdate({_id:req.body.id},{
            $set:{
                message:req.body.message
            }
        });
        res.status(200).send({success:true});

    }catch(error){
        res.status(400).send({success:false,mag:error.message});
    }
}

const loadGroups = async(req,res)=>{
    try{

        const groups = await Group.find({creator_id:req.session.user._id});
        
        res.render('group',{groups:groups});

    }catch(error){
        console.log(error.message);
    }
}

const createGroup = async(req,res)=>{

    try{

        const group = new Group({
            creator_id:req.session.user._id,
            name:req.body.name,
            image:'images/' + req.file.filename,
            limit:req.body.limit
        });

        await group.save();

        const groups = await Group.find({creator_id:req.session.user._id});
        
        res.render('group',{message: req.body.name+' Group created successfully!',groups:groups});

    }catch(error){
        console.log(error.message);
    }

}

const getMembers = async (req, res) => {
    try {
        const { group_id } = req.body;

        if (!group_id) {
            return res.status(400).send({ success: false, msg: "Group ID is required" });
        }

        if (!req.session.user || !req.session.user._id) {
            return res.status(401).send({ success: false, msg: "Unauthorized access" });
        }

        let groupObjectId, userObjectId;
        
        // Validate and convert IDs
        try {
            groupObjectId = new mongoose.Types.ObjectId(group_id);
            userObjectId = new mongoose.Types.ObjectId(req.session.user._id);
        } catch (error) {
            return res.status(400).send({ success: false, msg: "Invalid ObjectId format" });
        }

        const users = await User.aggregate([
            {
                $lookup: {
                    from: "members",
                    localField: "_id",
                    foreignField: "user_id",
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$group_id", groupObjectId]
                                }
                            }
                        }
                    ],
                    as: "member"
                }
            },
            {
                $match: {
                    _id: { $nin: [userObjectId] }
                }
            }
        ]);

        return res.status(200).send({ success: true, data: users });

    } catch (error) {
        console.error(error);
        return res.status(500).send({ success: false, msg: error.message });
    }
};


const addMembers = async (req, res) => {
    try {
        // Validate input
        if (!req.body.members || !Array.isArray(req.body.members) || req.body.members.length === 0) {
            return res.status(400).send({ success: false, msg: "Please select at least one member." });
        }

        if (!req.body.limit || isNaN(req.body.limit) || req.body.members.length > parseInt(req.body.limit)) {
            return res.status(400).send({ success: false, msg: `You cannot select more than ${req.body.limit} members.` });
        }

        // Delete existing members in the group
        await Member.deleteMany({ group_id: req.body.group_id });

        // Prepare new members array
        let data = req.body.members.map(user_id => ({
            group_id: req.body.group_id,
            user_id: user_id
        }));

        // Insert new members
        await Member.insertMany(data);

        res.status(200).send({ success: true, msg: "Members added successfully." });

    } catch (error) {
        res.status(500).send({ success: false, msg: error.message });
    }
};


const updateChatGroup = async(req,res)=>{
    try{

        if(parseInt(req.body.limit)<parseInt(req.body.last_limit)){
            await Member.deleteMany({group_id:req.body.id});
        }
        
        var updateObj;

        if(req.file !== undefined){
            updateObj = {
                name:req.body.name,
                image: 'images/'+req.file.filename,
                limit:req.body.limit
            }
        }else {
            updateObj = {
                name:req.body.name,
                limit:req.body.limit
            }
            
        }

        await Group.findByIdAndUpdate({_id:req.body.id},{
            $set: updateObj
        });
        
        res.status(200).send({success:true,msg:'Chat group updated successfully'});
    }catch(error){
        res.status(400).send({success:false,msg:error.message});
    }
}

const deleteChatGroup = async(req,res)=>{

    try{

        await Group.deleteOne({_id:req.body.id});
        await Member.deleteMany({group_id:req.body.id});

        res.status(200).send({success:true,msg:'Chat group deleted successfully'});

    }catch(error){
        res.status(400).send({success:false,msg:error.message});
    }
}

const shareGroup = async(req,res)=>{
    try{

        var groupData = await Group.findOne({ _id: req.params.id });

        if(!groupData){
            res.render('error',{message:'404 not found'});
        }else if(req.session.user == undefined){
            res.render('error',{message:'you need to login to access the share URL'});
        }else {
            
            var totalMembers = await Member.countDocuments({ group_id: req.params.id });
            var avilable = groupData.limit - totalMembers;

            var isOwner = String(groupData.creator_id) == String(req.session.user._id);

            var isJoined = await Member.countDocuments({ group_id: req.params.id, user_id: req.session.user._id });


            res.render('shareLink',{group:groupData,avilable:avilable,totalMembers:totalMembers, isOwner:isOwner, isJoined:isJoined});

        }

    }catch(error){
        console.log(error.message);
    }
}

const joinGroup = async(req,res)=>{

    try{

        const member = new Member({
            group_id:req.body.group_id,
            user_id:req.session.user._id
        });

        await member.save();

        res.send({success:true, msg:'Congratulation, you have joined the group successfully'});

    }catch(error){
        res.send({success:false,msg:error.message});
    }
}

const groupChats = async(req,res)=>{
    try{

        const myGroups = await Group.find({creator_id:req.session.user._id});
        const joinedGroups = await Member.find({user_id:req.session.user._id}).populate('group_id');

        res.render('chat-group',{myGroups:myGroups,joinedGroups:joinedGroups});


    }catch(error){
        console.log(error.message);
    }
}

const saveGroupChat =async(req,res)=>{
    try{

        var chat = new GroupChat({
            sender_id:req.body.sender_id,
            group_id:req.body.group_id,
            message:req.body.message
        });

        var newChat = await chat.save();
        var cChat = await GroupChat.findOne({_id:newChat._id}).populate('sender_id');

        res.send({success:true,chat:cChat});

    }catch(error){
        res.send({success:false,msg:error.message});
    }
}

const loadGroupChat =async(req,res)=>{
    try{

        const groupChats = await GroupChat.find({group_id:req.body.group_id}).populate('sender_id');

        res.send({success:true,chats: groupChats});

    }catch(error){
        res.send({success:false,msg:error.message});
    }
}

const deleteGroupChat =async(req,res)=>{
    try{

        await GroupChat.deleteOne({_id:req.body.id});
        res.send({success:true,msg:'Chat Deleted'});

    }catch(error){
        res.send({success:false,msg:error.message});
    }
}

const updateGroupChat =async(req,res)=>{
    try{

        await GroupChat.findByIdAndUpdate({_id:req.body.id},{
            $set:{
                message:req.body.message
            }
        });
        res.send({success:true,msg:'Chat Updated'});

    }catch(error){
        res.send({success:false,msg:error.message});
    }
}

module.exports = {
    registerLoad,
    register,
    loadLogin,
    login,
    logout,
    loadDashboard,
    saveChat,
    deleteChat,
    updateChat,
    loadGroups,
    createGroup,
    getMembers,
    addMembers,
    updateChatGroup,
    deleteChatGroup,
    shareGroup,
    joinGroup,
    groupChats,
    saveGroupChat,
    loadGroupChat,
    deleteGroupChat,
    updateGroupChat
};
