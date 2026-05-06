import mongoose from 'mongoose';

const connect = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in .env');

  try {
    await mongoose.connect(uri, { dbName: 'repo-analyzer' });
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () =>
    console.warn('⚠️  MongoDB disconnected')
  );
};

export default connect;
