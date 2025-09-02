import mongoose from 'mongoose';

const NewsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  excerpt: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  department: {
    type: String,
    required: true
  }
});

const News = mongoose.model('News', NewsSchema);
export default News;
