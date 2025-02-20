const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require('express-session');
require("dotenv").config();

const app = express();
app.use(express.json());

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(async (req, res, next) => {
    if (req.session.userId) {
        try {
            const user = await User.findById(req.session.userId);
            req.user = user;
        } catch (error) {
            console.error('Auth middleware error:', error);
        }
    }
    next();
});

const PORT = process.env.PORT || 5000;

//mongodb connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    syncImages();
    console.log("Connected to MongoDB");
}).catch((err) => {
    console.log(err);
});
//mongodb schema
const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const User = mongoose.model('User', UserSchema);

const imageSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    author: String,
    width: Number,
    height: Number,
    url: String,
    download_url: String,
    likes: [{ type: String }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Image = mongoose.model('Image', imageSchema);

const auth = async (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(401).json({ error: 'user not found' });
        }
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Auth error' });
    }
}

async function syncImages() {
    try {
        console.log('Syncing images...');
        const existingImages = await Image.countDocuments();
        if (existingImages > 0) {
            console.log('Images already synced');
            return;
        } else {
            const response = await axios.get('https://picsum.photos/v2/list?limit=100');
            const images = response.data;
            const processedImages = images.map(image => ({
                id: image.id,
                author: image.author,
                width: image.width,
                height: image.height,
                url: image.url,
                download_url: `https://picsum.photos/id/${image.id}/400/400`,
                likes: []
            }));

            for (const img of processedImages) {
                const exist = await Image.findOne({ id: img.id });
                if (exist) {
                    console.log(`Image ${img.id} already exists`);
                    continue;
                } else {
                    await Image.create(img);
                    console.log(`Image ${img.id} created`);
                }
            }
            console.log(`Synced ${processedImages.length} images successfully`);
        }

    } catch (error) {
        console.error('Error syncing images:', error);
    }
}

// user routes

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        console.log('processing registration for user:', username);

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const existingUser = await User.findOne({
            $or: [
                { username: username.trim() },
                { email: email.toLowerCase().trim() }
            ]
        })

        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));
        const user = new User({
            username: username.trim(),
            email: email.toLowerCase().trim(),
            password: hashedPassword
        });

        await user.save();
        console.log('User registered successfully:', user.username);
        req.session.userId = user._id;
        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: error.message });
    }

});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        req.session.userId = user._id;
        res.json({
            message: 'Login successful', user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Something went wrong, please try again later' });
    }
});

app.post('/api/auth/logout', async (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            res.status(500).json({ error: 'Error logging out' });
        } else {
            res.clearCookie('connect.sid');
            res.json({ message: 'Logged out successfully' });
        }

    })
});

app.get('/api/auth/user', auth, async (res, req) => {
    res.json({
        user: {
            id: req.user._id,
            username: req.user.username,
            email: req.user.email
        }
    })
})

app.get('/api/auth/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        res.json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// images routes

app.get('/api/images', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const images = await Image.find({})
            .sort('-createdAt')
            .skip(skip)
            .limit(limit);

        const totalImages = await Image.countDocuments();
        const hasMore = skip + images.length < totalImages;

        res.json({
            images,
            hasMore,
            total: totalImages
        });
    } catch (error) {
        console.error('Error fetching images:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/images/:imagesId/likes', async (req, res) => {
    try {
        const image = await Image.findOne({ id: req.params.imagesId });
        if (!image) {
            return res.status(404).json({ error: "Image not found" });
        }
        const userId = req.query?.user ? req.query?.user?.toString() : null;
        res.json({
            likes: image.likes.length,
            liked: userId ? image.likes.includes(userId) : false
        });
    } catch (error) {
        console.error('Error fetching image like count:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/images/:imageId/like', async (req, res) => {
    try {
        const userId = req.body.user.id || req.user._id;
        const imageId = req.params.imageId;

        const image = await Image.findOne({ id: imageId });
        if (!image) {
            return res.status(404).json({ error: 'Image not found' });
        }

        const userLiked = image.likes.includes(userId);
        if (userLiked) {
            image.likes = image.likes.filter(id => id.toString() !== userId.toString());
        } else {
            image.likes.push(userId);
        }

        await image.save();

        res.json({
            likes: image.likes.length,
            liked: !userLiked
        });
    } catch (error) {
        console.error('Error handling like:', error);
        res.status(500).json({ error: error.message });
    }
});

// start the server
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api', (req, res) => {
    res.send('API is running');
})

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});