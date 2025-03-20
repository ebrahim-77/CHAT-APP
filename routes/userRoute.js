const express = require('express');
const user_route = express();
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const session = require('express-session');

const {SESSION_SECRET} = process.env;

user_route.use(session({secret:SESSION_SECRET}));



user_route.use(bodyParser.json());
user_route.use(bodyParser.urlencoded({ extended: true }));

user_route.set('view engine', 'ejs');
user_route.set('views', path.join(__dirname, '../views')); // Ensure correct views path

user_route.use(express.static(path.join(__dirname, '../public')));

// Ensure upload directory exists
const uploadPath = path.resolve(__dirname, '../public/images');
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const name = Date.now() + "-" + file.originalname.replace(/\s+/g, '-');
        cb(null, name);
    }
});

const upload = multer({ storage });

const userController = require('../controllers/userController');

const auth = require('../middlewares/auth');

// Routes
user_route.get('/register',auth.isLogout, userController.registerLoad);
user_route.post('/register', upload.single('image'), (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }
    next();
}, userController.register);


user_route.get('/',auth.isLogout, userController.loadLogin);
user_route.post('/',userController.login);
user_route.get('/logout',auth.isLogin,userController.logout);
user_route.get('/dashboard',auth.isLogin,userController.loadDashboard);

user_route.post('/save_chat',userController.saveChat);

user_route.post('/delete-chat',userController.deleteChat);

user_route.post('/update-chat',userController.updateChat);

user_route.get('*',function(req,res){
    res.redirect('/');
});


module.exports = user_route;
