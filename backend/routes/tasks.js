const router = require('express').Router();
const Task = require('../models/Task');
const { protect, admin } = require('../middleware/auth');

// Get all tasks (admin gets all, user gets own)
router.get('/', protect, async (req, res) => {
  try {
    const { status, priority, category, search } = req.query;
    const filter = req.user.role === 'admin' ? {} : { user: req.user._id };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (search) filter.title = { $regex: search, $options: 'i' };
    const tasks = await Task.find(filter).populate('user', 'name email').sort('-createdAt');
    res.json(tasks);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get task stats
router.get('/stats', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { user: req.user._id };
    const [total, todo, inProgress, completed] = await Promise.all([
      Task.countDocuments(filter),
      Task.countDocuments({ ...filter, status: 'todo' }),
      Task.countDocuments({ ...filter, status: 'in-progress' }),
      Task.countDocuments({ ...filter, status: 'completed' })
    ]);
    res.json({ total, todo, inProgress, completed });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Create task
router.post('/', protect, async (req, res) => {
  try {
    const task = await Task.create({ ...req.body, user: req.user._id });
    req.app.get('io').emit('taskCreated', task);
    res.status(201).json(task);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Update task
router.put('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.user.toString() !== req.user._id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not allowed' });
    if (req.body.status === 'completed' && task.status !== 'completed')
      req.body.completedAt = new Date();
    const updated = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    req.app.get('io').emit('taskUpdated', updated);
    res.json(updated);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Delete task
router.delete('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.user.toString() !== req.user._id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not allowed' });
    await task.deleteOne();
    req.app.get('io').emit('taskDeleted', { id: req.params.id });
    res.json({ message: 'Task deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
