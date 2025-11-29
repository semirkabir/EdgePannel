const bcrypt = require('bcryptjs');

// Test password
const testPassword = 'testpassword123';

// Generate a fresh hash
bcrypt.hash(testPassword, 10).then(hash => {
  console.log('New password hash:', hash);
  console.log('\nUse this hash to update the test user in the database.');
  console.log('\nTest credentials:');
  console.log('Email: test@example.com');
  console.log('Password: testpassword123');
});

