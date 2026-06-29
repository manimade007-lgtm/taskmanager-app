const router = require('express').Router();
const User = require('../models/User');
const { protect, admin } = require('../middleware/auth');

router.get('/', protect, admin, async (req, res) => {
  const users = await User.find().select('-password');
  res.json(users);
});

router.delete('/:id', protect, admin, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: 'User deleted' });
});

module.exports = router;
