/**
 * MongoDB Connection Test
 * 
 * This script tests the connection to MongoDB using the URI in the .env file.
 * It will attempt to connect, create a test document, read it, and delete it.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: No MongoDB connection string found in .env file');
  process.exit(1);
}

console.log('🔄 Attempting to connect to MongoDB...');
console.log(`🔗 Using URI: ${MONGODB_URI.replace(/\/\/(.+?)@/, '//****:****@')}`); // Hide credentials in output

async function testConnection() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Successfully connected to MongoDB!');
    
    // Create a temporary test schema and model
    const testSchema = new mongoose.Schema({
      name: String,
      timestamp: { type: Date, default: Date.now }
    });
    
    // Remove the model if it exists to avoid OverwriteModelError
    try {
      mongoose.deleteModel(/^TestConnection$/);
    } catch (e) {
      // It's okay if the model doesn't exist
    }
    
    const TestModel = mongoose.model('TestConnection', testSchema);
    
    // Create a test document
    console.log('🔄 Creating a test document...');
    const testDoc = new TestModel({ 
      name: `Test Document ${Date.now()}` 
    });
    await testDoc.save();
    console.log('✅ Test document created successfully!');
    
    // Read the test document
    console.log('🔄 Reading test document...');
    const foundDoc = await TestModel.findById(testDoc._id);
    console.log(`✅ Test document found: ${foundDoc.name}`);
    
    // Delete the test document
    console.log('🔄 Deleting test document...');
    await TestModel.deleteOne({ _id: testDoc._id });
    console.log('✅ Test document deleted successfully!');
    
    // Drop the test collection
    console.log('🔄 Dropping test collection...');
    await mongoose.connection.dropCollection('testconnections');
    console.log('✅ Test collection dropped successfully!');
    
    console.log('\n🎉 MongoDB connection test completed successfully! The database is working properly.');
    
    // Close the connection
    await mongoose.connection.close();
    console.log('👋 MongoDB connection closed.');
  } catch (error) {
    console.error('❌ MongoDB Connection Test Failed:');
    console.error(`   Error: ${error.message}`);
    
    // Provide common troubleshooting tips
    console.log('\n🔍 Troubleshooting Tips:');
    console.log('1. Check if your MongoDB Atlas cluster is running and accessible');
    console.log('2. Verify that the username and password in the connection string are correct');
    console.log('3. Ensure your IP address is whitelisted in the MongoDB Atlas network settings');
    console.log('4. Check if the database name in the URI is correct');
    console.log('5. Confirm that your MongoDB Atlas cluster is properly configured');
    
    // Close the connection if it was established
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('👋 MongoDB connection closed.');
    }
    
    process.exit(1);
  }
}

testConnection(); 