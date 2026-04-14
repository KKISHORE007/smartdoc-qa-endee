import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';

const router = express.Router();

// Helper to generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'smartdoc_secret_key_123', {
        expiresIn: '30d',
    });
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 */
router.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, age, contactMethod, password, profilePhoto } = req.body;

        const userExists = await User.findOne({ where: { contactMethod } });
        if (userExists) {
            return res.status(400).json({ error: 'User with this email/phone already exists' });
        }

        const user = await User.create({
            firstName, lastName, age, contactMethod, password, profilePhoto
        });

        if (user) {
            res.status(201).json({
                success: true,
                _id: user.id, // keep _id for frontend compatibility
                firstName: user.firstName, lastName: user.lastName, 
                age: user.age, contactMethod: user.contactMethod, profilePhoto: user.profilePhoto,
                token: generateToken(user.id)
            });
        } else {
            res.status(400).json({ error: 'Invalid user data' });
        }
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

/**
 * @route   POST /api/auth/login
 * @desc    Auth user & get token
 */
router.post('/login', async (req, res) => {
    try {
        const { contactMethod, password } = req.body;
        const user = await User.findOne({ where: { contactMethod } });
        
        if (user && (await user.matchPassword(password))) {
            res.json({
                success: true,
                _id: user.id, firstName: user.firstName, lastName: user.lastName, 
                age: user.age, contactMethod: user.contactMethod, profilePhoto: user.profilePhoto,
                token: generateToken(user.id)
            });
        } else {
            res.status(401).json({ error: 'Invalid contact method or password' });
        }
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile data
 */
router.put('/profile', async (req, res) => {
    try {
        const { id, firstName, lastName, age, profilePhoto } = req.body;
        
        const user = await User.findByPk(id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        user.firstName = firstName || user.firstName;
        user.lastName = lastName || user.lastName;
        user.age = age || user.age;
        if (profilePhoto !== undefined) user.profilePhoto = profilePhoto;

        await user.save();

        res.json({
            success: true,
            _id: user.id, firstName: user.firstName, lastName: user.lastName, 
            age: user.age, contactMethod: user.contactMethod, profilePhoto: user.profilePhoto,
        });
    } catch (error) {
        console.error('Profile Update Error:', error);
        res.status(500).json({ error: 'Server error during profile update' });
    }
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Verify user details for password reset
 */
router.post('/forgot-password', async (req, res) => {
    try {
        const { firstName, lastName, contactMethod } = req.body;
        
        // MySQL does case-insensitive string comparisons by default (in case of utf8mb4_unicode_ci collation)
        const user = await User.findOne({ 
            where: {
                contactMethod,
                firstName,
                lastName
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'No account matches this exact Name and Email/Phone.' });
        }
        
        res.json({ success: true, message: 'Identity verified. You may now reset your password.' });
    } catch (error) {
        console.error('Verification Error:', error);
        res.status(500).json({ error: 'Server error during verification' });
    }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Set new password for verified user
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { contactMethod, newPassword } = req.body;
        const user = await User.findOne({ where: { contactMethod } });
        
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.password = newPassword;
        await user.save(); // beforeSave hook will hash it

        res.json({ success: true, message: 'Password has been successfully updated!' });
    } catch (error) {
        res.status(500).json({ error: 'Server error during password reset' });
    }
});

export default router;
