const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔧 Database Connection String Fixer\n');
console.log('This will help you create the correct DATABASE_URL for Supabase.\n');

rl.question('Enter your Supabase project reference (e.g., onwkzqbrmrskazfitshr): ', (projectRef) => {
  rl.question('Enter your database password: ', (password) => {
    // URL encode the password
    const encodedPassword = encodeURIComponent(password);
    
    // Create the connection string
    const connectionString = `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`;
    
    console.log('\n✅ Generated Connection String:\n');
    console.log(connectionString);
    console.log('\n📝 Add this to your .env file as:');
    console.log(`DATABASE_URL=${connectionString}\n`);
    
    // Check if .env exists
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      rl.question('Would you like to update your .env file automatically? (y/n): ', (answer) => {
        if (answer.toLowerCase() === 'y') {
          let envContent = fs.readFileSync(envPath, 'utf8');
          
          // Replace existing DATABASE_URL or add new one
          if (envContent.includes('DATABASE_URL=')) {
            envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL=${connectionString}`);
          } else {
            envContent += `\nDATABASE_URL=${connectionString}\n`;
          }
          
          fs.writeFileSync(envPath, envContent);
          console.log('\n✅ .env file updated successfully!');
        }
        rl.close();
      });
    } else {
      console.log('\n⚠️  .env file not found. Please create it and add the DATABASE_URL above.');
      rl.close();
    }
  });
});



