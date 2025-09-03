import mongoose from 'mongoose';

const UsageSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['prompt', 'completion', 'error'],
    required: true
  },
  tokens: {
    type: Number,
    default: 0
  },
  model: {
    type: String,
    default: null
  },
  prompt: {
    type: String,
    default: null
  },
  completion: {
    type: String,
    default: null
  },
  error: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
UsageSchema.index({ user_id: 1, timestamp: -1 });
UsageSchema.index({ user_id: 1, type: 1, timestamp: -1 });

export default mongoose.model('Usage', UsageSchema);
